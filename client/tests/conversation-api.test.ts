import { it } from 'node:test';
import assert from 'node:assert/strict';
import { endSessionApi } from '../src/services/conversation.api';

it('End Call waits for a busy shared session and returns its persisted ended state', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return attempts === 1
      ? new Response(JSON.stringify({ success: false, error: { code: 'SESSION_BUSY' } }), { status: 409 })
      : new Response(JSON.stringify({ success: true, data: { session: { id: 'call', status: 'ENDED' } } }));
  };
  try {
    assert.equal((await endSessionApi('call')).status, 'ENDED');
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = originalFetch; }
});

it('End Call does not automatically retry provider or storage failures', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return new Response(JSON.stringify({ success: false, error: { code: 'SESSION_STORAGE_UNAVAILABLE', message: 'Storage unavailable' } }), { status: 503 });
  };
  try {
    await assert.rejects(endSessionApi('call'), /Storage unavailable/);
    assert.equal(attempts, 1);
  } finally { globalThis.fetch = originalFetch; }
});
