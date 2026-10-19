import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  getSession,
  addMessage,
  updateSessionContext,
  endSession,
  _resetSessionsForTesting,
} from '../src/services/session.service';

describe('Conversation Session Service', () => {
  beforeEach(() => {
    _resetSessionsForTesting();
  });

  it('should create an active session with a valid UUID and empty messages', () => {
    const session = createSession();
    assert.ok(session.id);
    assert.match(
      session.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    assert.equal(session.status, 'ACTIVE');
    assert.equal(session.messages.length, 0);
    assert.deepEqual(session.context, {});
  });

  it('should retrieve an existing session by ID', () => {
    const created = createSession();
    const fetched = getSession(created.id);
    assert.ok(fetched);
    assert.equal(fetched?.id, created.id);
    assert.equal(fetched?.status, 'ACTIVE');
  });

  it('should return null for non-existent session ID', () => {
    assert.equal(getSession('non-existent-id'), null);
  });

  it('should add messages to a session with roles and timestamps', () => {
    const session = createSession();
    const userMsg = addMessage(session.id, 'user', 'Where is ORD-101?');
    assert.equal(userMsg.role, 'user');
    assert.equal(userMsg.content, 'Where is ORD-101?');
    assert.ok(userMsg.id);
    assert.ok(userMsg.createdAt);

    const asstMsg = addMessage(session.id, 'assistant', 'Your order is Out for Delivery.', [
      { name: 'get_order_details', args: { order_id: 'ORD-101' }, resultSummary: 'Found' },
    ]);
    assert.equal(asstMsg.role, 'assistant');
    assert.equal(asstMsg.toolCalls?.length, 1);

    const updated = getSession(session.id);
    assert.equal(updated?.messages.length, 2);
    assert.equal(updated?.messages[0].content, 'Where is ORD-101?');
    assert.equal(updated?.messages[1].content, 'Your order is Out for Delivery.');
  });

  it('should update session context (e.g. latestOrderId)', () => {
    const session = createSession();
    updateSessionContext(session.id, { latestOrderId: 'ORD-101' });

    const updated = getSession(session.id);
    assert.equal(updated?.context.latestOrderId, 'ORD-101');
  });

  it('should end a session and prevent further messages', () => {
    const session = createSession();
    const ended = endSession(session.id);
    assert.equal(ended?.status, 'ENDED');

    assert.throws(
      () => addMessage(session.id, 'user', 'Hello again'),
      /SESSION_ENDED/
    );
  });

  it('should throw error when adding message to non-existent session', () => {
    assert.throws(
      () => addMessage('unknown-session', 'user', 'Hello'),
      /SESSION_NOT_FOUND/
    );
  });

  it('should isolate sessions so that data from one session is never leaked to another', () => {
    const sessionA = createSession();
    const sessionB = createSession();

    addMessage(sessionA.id, 'user', 'ORD-101 in session A');
    updateSessionContext(sessionA.id, { latestOrderId: 'ORD-101' });

    addMessage(sessionB.id, 'user', 'ORD-103 in session B');
    updateSessionContext(sessionB.id, { latestOrderId: 'ORD-103' });

    const fetchedA = getSession(sessionA.id);
    const fetchedB = getSession(sessionB.id);

    assert.equal(fetchedA?.messages.length, 1);
    assert.equal(fetchedA?.context.latestOrderId, 'ORD-101');

    assert.equal(fetchedB?.messages.length, 1);
    assert.equal(fetchedB?.context.latestOrderId, 'ORD-103');
  });
});
