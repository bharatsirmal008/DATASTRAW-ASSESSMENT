import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { withSharedSession } from '../src/services/shared-session.service';
import { createSession, getSession, addMessage, endSession, updateSessionContext, attachPostCallData, _resetSessionsForTesting } from '../src/services/session.service';
import type { Server } from 'node:http';

// Redis command-contract fixture, not a cloud integration test.
const data = new Map<string, string>();
const locks = new Map<string, string>();
let fail = false;
let loseLease = false;
async function command(args: (string | number)[]) {
  if (fail) throw new Error('private upstream diagnostic');
  const [op, key, value] = args as string[];
  if (op === 'GET') return data.get(key) || null;
  if (op === 'SET') {
    if (key.endsWith(':lock')) {
      if (locks.has(key)) return null;
      locks.set(key, value); return 'OK';
    }
    if (data.has(key)) return null;
    data.set(key, value); return 'OK';
  }
  if (op === 'EVAL' && args[2] === 2) {
    const [, , , lock, sessionKey, token, snapshot] = args as string[];
    if (loseLease || locks.get(lock) !== token) return 0;
    assert.equal(args[7], 7200);
    data.set(sessionKey, snapshot); locks.delete(lock); return 1;
  }
  if (op === 'EVAL' && args[2] === 1) {
    if (locks.get(String(args[3])) === args[4]) locks.delete(String(args[3]));
    return 1;
  }
  throw new Error('Unexpected command');
}
let server: Server;
let origin: string;
const saved = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, vercel: process.env.VERCEL };
before(async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
  const app = express();
  app.post('/sessions', withSharedSession((_req, res) => { res.json(createSession()); }, command));
  // Each route has an independent adapter, as separate function instances would.
  app.get('/sessions/:sessionId', withSharedSession((req, res) => { res.json(getSession(String(req.params.sessionId))); }, command));
  app.post('/sessions/:sessionId/messages', withSharedSession(async (req, res) => {
    addMessage(String(req.params.sessionId), 'user', 'Where is ORD-101?');
    updateSessionContext(String(req.params.sessionId), { latestOrderId: 'ORD-101', responseLanguage: 'hi' });
    await new Promise(resolve => setTimeout(resolve, 30));
    addMessage(String(req.params.sessionId), 'assistant', 'Out for delivery.');
    res.json(getSession(String(req.params.sessionId)));
  }, command));
  app.post('/sessions/:sessionId/end', withSharedSession((req, res) => {
    const id = String(req.params.sessionId);
    endSession(id);
    attachPostCallData(id, { summary: 'Order tracking resolved.' }, { customerTurns: 1 });
    res.json(getSession(id));
  }, command));
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  for (const [key, value] of Object.entries({ UPSTASH_REDIS_REST_URL: saved.url, UPSTASH_REDIS_REST_TOKEN: saved.token, VERCEL: saved.vercel })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await new Promise<void>(resolve => server.close(() => resolve()));
});
async function create() { return (await fetch(`${origin}/sessions`, { method: 'POST' })).json() as Promise<any>; }

it('restores a complete conversation after process-local state is cleared', async () => {
  const session = await create();
  _resetSessionsForTesting();
  assert.equal(getSession(session.id), null);
  const turn = await fetch(`${origin}/sessions/${session.id}/messages`, { method: 'POST' });
  assert.equal(turn.status, 200);
  _resetSessionsForTesting();
  const loaded = await (await fetch(`${origin}/sessions/${session.id}`)).json() as any;
  assert.equal(loaded.messages.length, 2);
  assert.equal(loaded.context.latestOrderId, 'ORD-101');
  assert.equal(loaded.context.responseLanguage, 'hi');
  await fetch(`${origin}/sessions/${session.id}/end`, { method: 'POST' });
  _resetSessionsForTesting();
  const ended = await (await fetch(`${origin}/sessions/${session.id}`)).json() as any;
  assert.equal(ended.status, 'ENDED');
  assert.equal(ended.messages[0].content, 'Where is ORD-101?');
  assert.equal(ended.summary.summary, 'Order tracking resolved.');
  assert.equal(ended.analytics.customerTurns, 1);
});
it('rejects overlapping writes rather than losing a turn', async () => {
  const session = await create();
  const responses = await Promise.all([1, 2].map(() => fetch(`${origin}/sessions/${session.id}/messages`, { method: 'POST' })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const loaded = JSON.parse(data.get(`aria:session:${session.id}`)!);
  assert.equal(loaded.messages.length, 2);
});
it('does not acknowledge success or overwrite storage when its lease was lost', async () => {
  const session = await create();
  loseLease = true;
  try {
    const response = await fetch(`${origin}/sessions/${session.id}/messages`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal(JSON.parse(data.get(`aria:session:${session.id}`)!).messages.length, 0);
  } finally { loseLease = false; }
});
it('fails safely during a storage outage without exposing upstream diagnostics', async () => {
  fail = true;
  try {
    const response = await fetch(`${origin}/sessions`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private upstream|test-only/);
  } finally { fail = false; }
});
it('never falls back to process memory on Vercel with missing storage credentials', async () => {
  process.env.VERCEL = '1';
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const response = await fetch(`${origin}/sessions`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal((await response.json() as any).error.code, 'SESSION_STORAGE_NOT_CONFIGURED');
  } finally {
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
    if (saved.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved.vercel;
  }
});
