import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import app from '../src/app';
import { getAIProvider } from '../src/services/conversation.service';
import { get_order_details } from '../src/tools/getOrderDetails';
import { createSession, getSession } from '../src/services/session.service';
import { generateCallSummary } from '../src/services/summary.service';

describe('Live-only application behavior', () => {
  let server: Server;
  let url: string;
  const previous = { node: process.env.NODE_ENV, key: process.env.GEMINI_API_KEY, provider: process.env.AI_PROVIDER };
  before(async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GEMINI_API_KEY;
    process.env.AI_PROVIDER = 'demo'; // Old environment settings cannot re-enable fixtures.
    await new Promise<void>(resolve => { server = app.listen(0, () => {
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    }); });
  });
  after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const [name, value] of [['NODE_ENV', previous.node], ['GEMINI_API_KEY', previous.key], ['AI_PROVIDER', previous.provider]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  });
  it('uses Gemini even if an old environment setting still says demo', () => {
    assert.equal(getAIProvider().mode, 'GEMINI');
  });
  it('reports missing AI configuration without exposing secrets', async () => {
    const response = await fetch(`${url}/api/health`);
    const body = await response.json();
    assert.equal(body.readiness.ready, false);
    assert.equal(body.readiness.aiConfigured, false);
    assert.equal(body.readiness.orderConnected, false);
    assert.equal(body.readiness.provider, 'GEMINI');
    assert.equal('apiKey' in body.readiness, false);
  });
  it('refuses to start fake conversations without a real AI key', async () => {
    const response = await fetch(`${url}/api/conversations/sessions`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED');
  });
  it('removes the sample orders endpoint outside tests', async () => {
    const response = await fetch(`${url}/api/orders/test`);
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /Priya|Rahul|Ananya|ORD-101/);
  });
  it('reports the disconnected order service instead of fictional order data', async () => {
    const response = await fetch(`${url}/api/orders/ORD-101`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'ORDER_SERVICE_NOT_CONFIGURED');
    await assert.rejects(get_order_details('ORD-101'), (error: any) => error.code === 'ORDER_SERVICE_NOT_CONFIGURED');
  });
  it('does not publish all customer conversations through history', async () => {
    const response = await fetch(`${url}/api/conversations/history`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'HISTORY_AUTH_REQUIRED');
  });
  it('rejects a request for a synthetic summary', async () => {
    await assert.rejects(generateCallSummary(createSession(), 'DEMO'), (error: any) => error.status === 400);
  });
  it('does not fall back to a fake summary after live summary failure', async () => {
    const session = createSession();
    const response = await fetch(`${url}/api/conversations/sessions/${session.id}/end`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'GEMINI_NOT_CONFIGURED');
    assert.equal(getSession(session.id)?.summary, undefined);
  });
});
