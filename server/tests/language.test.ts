import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import app from '../src/app';
import { createSession, getSession } from '../src/services/session.service';
import { GeminiProvider } from '../src/providers/gemini.provider';

let server: Server; let url: string;
const previous = process.env.AI_PROVIDER;
const original = GeminiProvider.prototype.generateResponse;
before(async () => {
  process.env.AI_PROVIDER = 'gemini';
  GeminiProvider.prototype.generateResponse = async params => ({ mode: 'GEMINI', content: params.context.responseLanguage === 'hi' ? 'नमस्ते, मैं कैसे मदद कर सकती हूँ?' : 'Hello, how can I help?', toolCalls: [] });
  await new Promise<void>(resolve => { server = app.listen(0, () => { url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; resolve(); }); });
});
after(async () => {
  GeminiProvider.prototype.generateResponse = original;
  if (previous === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previous;
  await new Promise<void>(resolve => server.close(() => resolve()));
});
it('validates Hindi selection, retains it across turns and accepts an explicit English switch', async () => {
  const session = createSession();
  const send = (body: unknown) => fetch(`${url}/api/conversations/sessions/${session.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const hindi = await send({ message: 'नमस्ते', language: 'hi' });
  assert.equal(hindi.status, 200);
  assert.match((await hindi.json()).data.response, /नमस्ते/);
  await send({ message: 'मदद करें' });
  assert.equal(getSession(session.id)?.context.responseLanguage, 'hi');
  await send({ message: 'Hello', language: 'en' });
  assert.equal(getSession(session.id)?.context.responseLanguage, 'en');
  const before = getSession(session.id)!.messages.length;
  assert.equal((await send({ message: 'Hi', language: 'invalid' })).status, 400);
  assert.equal(getSession(session.id)!.messages.length, before);
});
