import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import app from '../src/app';
import {
  createSession,
  getSession,
  addMessage,
  endSession,
  _resetSessionsForTesting,
} from '../src/services/session.service';
import { processSessionTranscript } from '../src/services/transcript.service';
import {
  generateDemoSummary,
  generateCallSummary,
  extractOrderIds,
  extractExecutedTools,
  classifyConversationIntents,
  evaluateResolutionStatus,
} from '../src/services/summary.service';
import { calculateCallAnalytics } from '../src/services/analytics.service';
import { validateSummaryOutcome } from '../src/validators/summary.validator';

let server: Server;
let baseUrl: string;

describe('Phase 5 — Post-Call Transcript, Structured Outcome & Analytics', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    _resetSessionsForTesting();
  });

  // Scenario 1: Simple Order Tracking Call
  it('1. should generate a structured outcome for a simple order tracking call (ORD-101)', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is my order ORD-101?');
    addMessage(
      session.id,
      'assistant',
      'Here are the verified details for order ORD-101: Priya Sharma, Vitamin C Serum, Status: Out for Delivery with courier partner BlueDart.',
      [
        {
          name: 'get_order_details',
          args: { order_id: 'ORD-101' },
          resultSummary: 'Verified ORD-101 for Priya Sharma',
        },
      ]
    );

    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'ORDER_TRACKING');
    assert.equal(summary.order_id, 'ORD-101');
    assert.deepEqual(summary.order_ids, ['ORD-101']);
    assert.equal(summary.resolution_status, 'RESOLVED');
    assert.deepEqual(summary.tools_used, ['get_order_details']);
    assert.equal(summary.summary_mode, 'DEMO');
    assert.ok(summary.call_summary.includes('ORD-101'));
  });

  // Scenario 2: Tracking Followed by Cancellation Question
  it('2. should capture multi-intent dialogue (tracking followed by cancellation question)', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is order ORD-101?');
    addMessage(session.id, 'assistant', 'Order ORD-101 is Out for Delivery with BlueDart.', [
      { name: 'get_order_details', args: { order_id: 'ORD-101' }, resultSummary: 'Out for Delivery' },
    ]);
    addMessage(session.id, 'user', 'Can I cancel it?');
    addMessage(
      session.id,
      'assistant',
      'Order ORD-101 cannot be cancelled because it has already been dispatched. You may refuse delivery at the doorstep.',
      [
        {
          name: 'check_cancellation_eligibility',
          args: { order_status: 'Out for Delivery' },
          resultSummary: 'Ineligible (in-transit)',
        },
      ]
    );

    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'ORDER_TRACKING');
    assert.ok(summary.additional_intents.includes('CANCELLATION_QUERY'));
    assert.equal(summary.order_id, 'ORD-101');
    assert.equal(summary.resolution_status, 'RESOLVED');
    assert.ok(summary.tools_used.includes('get_order_details'));
    assert.ok(summary.tools_used.includes('check_cancellation_eligibility'));
    assert.ok(summary.call_summary.includes('cannot be cancelled'));
  });

  // Scenario 3: Two Different Order IDs in One Conversation
  it('3. should handle multiple order IDs without arbitrarily picking one as primary', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is order ORD-101? Also check ORD-103.');
    addMessage(session.id, 'assistant', 'ORD-101 is Out for Delivery, and ORD-103 is Processing.');

    const summary = generateDemoSummary(session);
    assert.equal(summary.order_id, null); // Nullable because ambiguous multiple orders
    assert.equal(summary.order_ids.length, 2);
    assert.ok(summary.order_ids.includes('ORD-101'));
    assert.ok(summary.order_ids.includes('ORD-103'));
  });

  // Scenario 4: Unknown Order ID
  it('4. should mark resolution UNRESOLVED when order was not found in system (ORD-999)', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Track order ORD-999');
    addMessage(session.id, 'assistant', 'Order ORD-999 was not found in our system. Please check your order ID.');

    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'ORDER_TRACKING');
    assert.equal(summary.order_id, 'ORD-999');
    assert.equal(summary.resolution_status, 'UNRESOLVED');
  });

  // Scenario 5: Missing Order ID
  it('5. should mark resolution NEEDS_FOLLOW_UP when order ID was never provided', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is my order?');
    addMessage(session.id, 'assistant', 'Could you please provide your Order ID (e.g., ORD-101)?');

    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'ORDER_TRACKING');
    assert.equal(summary.order_id, null);
    assert.equal(summary.order_ids.length, 0);
    assert.equal(summary.resolution_status, 'NEEDS_FOLLOW_UP');
  });

  // Scenario 6: Policy Rejection (Return window expired for ORD-102)
  it('6. should resolve policy inquiries where action is disallowed (ORD-102 return expired)', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Can I return order ORD-102?');
    addMessage(
      session.id,
      'assistant',
      'Order ORD-102 was delivered 14 days ago and is ineligible for return under our 7 days policy.',
      [
        {
          name: 'check_return_eligibility',
          args: { days_since_delivery: 14, is_opened: false, has_original_packaging: true },
          resultSummary: 'ineligible (window expired)',
        },
      ]
    );

    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'RETURN_QUERY');
    assert.equal(summary.order_id, 'ORD-102');
    assert.equal(summary.resolution_status, 'RESOLVED');
    assert.ok(summary.call_summary.includes('7-day'));
  });

  // Scenario 7: Out-of-Scope Question
  it('7. should classify out-of-scope queries and mark them UNRESOLVED', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Book me a flight to Mumbai please');
    addMessage(session.id, 'assistant', 'I only assist with Aura Skincare customer inquiries.');

    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'OUT_OF_SCOPE');
    assert.equal(summary.resolution_status, 'UNRESOLVED');
  });

  // Scenario 8: Multiple Customer Intents
  it('8. should classify primary and additional intents correctly', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is ORD-101? Also what is your shipping fee for Rs 499?');
    addMessage(session.id, 'assistant', 'Here is ORD-101. Also for Rs 499 the boundary is currently unspecified.');

    const { primary, additional } = classifyConversationIntents(session);
    assert.equal(primary, 'ORDER_TRACKING');
    assert.ok(additional.includes('SHIPPING_QUERY'));
  });

  // Scenario 9: Empty Session
  it('9. should handle an empty session without crashing', () => {
    const session = createSession();
    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'UNKNOWN');
    assert.equal(summary.resolution_status, 'UNRESOLVED');
    assert.equal(summary.order_id, null);
    assert.deepEqual(summary.order_ids, []);

    const transcript = processSessionTranscript(session);
    assert.equal(transcript.messages.length, 0);
    assert.ok(transcript.plainText.includes('No messages recorded'));

    const analytics = calculateCallAnalytics(session, summary);
    assert.equal(analytics.totalMessages, 0);
    assert.equal(analytics.customerTurns, 0);
  });

  // Scenario 10: Very Short Conversation
  it('10. should handle very short greeting conversation', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Hello');
    addMessage(session.id, 'assistant', 'Hello! Welcome to Aura Skincare. How can I assist you?');

    const summary = generateDemoSummary(session);
    assert.equal(summary.customer_intent, 'GENERAL_SUPPORT');
    assert.equal(summary.resolution_status, 'RESOLVED');
  });

  // Scenario 11: Repeated End Call
  it('11. should be idempotent when End Call is called repeatedly', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Hi');
    addMessage(session.id, 'assistant', 'Hello!');

    const endedFirst = endSession(session.id);
    const firstEndedAt = endedFirst?.endedAt;
    assert.ok(firstEndedAt);

    // Call end again
    const endedSecond = endSession(session.id);
    assert.equal(endedSecond?.endedAt, firstEndedAt);
    assert.equal(endedSecond?.status, 'ENDED');
  });

  // Scenario 12: Concurrent Finalization Attempts
  it('12. should handle concurrent session finalization safely', async () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is ORD-101?');

    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/conversations/sessions/${session.id}/end`, { method: 'POST' }),
      fetch(`${baseUrl}/api/conversations/sessions/${session.id}/end`, { method: 'POST' }),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    const b1 = await res1.json();
    const b2 = await res2.json();
    assert.equal(b1.data.session.id, b2.data.session.id);
    assert.equal(b1.data.session.status, 'ENDED');
  });

  // Scenario 14: Gemini mode without API key
  it('14. should throw 503 error if Gemini summary mode is requested without credentials', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      const session = createSession();
      addMessage(session.id, 'user', 'Where is ORD-101?');

      await assert.rejects(
        async () => {
          await generateCallSummary(session, 'GEMINI');
        },
        (err: any) => {
          assert.equal(err.code, 'GEMINI_NOT_CONFIGURED');
          assert.equal(err.status, 503);
          return true;
        }
      );
    } finally {
      process.env.GEMINI_API_KEY = origKey;
    }
  });

  // Scenario 15: Validation of Malformed Summary
  it('15. should reject malformed summary with invalid intent or fabricated order ID', () => {
    const malformed = {
      customer_intent: 'INVALID_INTENT',
      resolution_status: 'RESOLVED',
      order_id: 'ORD-9999',
      order_ids: ['ORD-9999'],
      call_summary: 'Some short',
      tools_used: ['unregistered_tool'],
      summary_mode: 'DEMO',
    };

    const result = validateSummaryOutcome(malformed, new Set(['ORD-101']));
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('Invalid or missing customer_intent')));
    assert.ok(result.errors.some((e) => e.includes('Fabricated order_id')));
    assert.ok(result.errors.some((e) => e.includes('Unregistered tool name')));
  });

  // Scenario 16: Session Isolation
  it('16. should keep post-call data strictly isolated between different sessions', () => {
    const s1 = createSession();
    addMessage(s1.id, 'user', 'Where is ORD-101?');
    const sum1 = generateDemoSummary(s1);

    const s2 = createSession();
    addMessage(s2.id, 'user', 'Where is ORD-103?');
    const sum2 = generateDemoSummary(s2);

    assert.notEqual(sum1.session_id, sum2.session_id);
    assert.equal(sum1.order_id, 'ORD-101');
    assert.equal(sum2.order_id, 'ORD-103');
  });

  // Scenario 17 & 18: Transcript Ordering & Deduplication
  it('17 & 18. should preserve chronological order and deduplicate messages by ID', () => {
    const session = createSession();
    const m1 = addMessage(session.id, 'user', 'Hello Aria');
    const m2 = addMessage(session.id, 'assistant', 'Hello! How can I help?');

    // Simulate duplicate entry with same ID
    session.messages.push(m1);

    const transcript = processSessionTranscript(session);
    assert.equal(transcript.messages.length, 2);
    assert.equal(transcript.messages[0].id, m1.id);
    assert.equal(transcript.messages[1].id, m2.id);
    assert.equal(transcript.messages[0].speaker, 'CUSTOMER');
    assert.equal(transcript.messages[1].speaker, 'ARIA');
  });

  // Scenario 19: Read-Only Tool Constraint (No Claim of Executed Cancellation)
  it('19. should reject summaries claiming an order cancellation was actually executed', () => {
    const forbiddenOutcome = {
      session_id: 'test',
      customer_intent: 'CANCELLATION_QUERY',
      additional_intents: [],
      order_id: 'ORD-101',
      order_ids: ['ORD-101'],
      resolution_status: 'RESOLVED',
      call_summary: 'Customer called about ORD-101 and the order has been cancelled by the agent.',
      tools_used: ['get_order_details'],
      summary_mode: 'DEMO',
      generated_at: new Date().toISOString(),
    };

    const val = validateSummaryOutcome(forbiddenOutcome, new Set(['ORD-101']));
    assert.equal(val.isValid, false);
    assert.ok(val.errors.some((e) => e.includes('unverified action claim')));
  });

  // Scenario 20: Tool Execution Count from Tool Records
  it('20. should calculate tool executions strictly from metadata records, not text mentions', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Track ORD-101');
    addMessage(
      session.id,
      'assistant',
      'I checked using our get_order_details tool and check_cancellation_eligibility tool.',
      [{ name: 'get_order_details', args: { order_id: 'ORD-101' }, resultSummary: 'Verified' }]
    );

    const summary = generateDemoSummary(session);
    const analytics = calculateCallAnalytics(session, summary);

    // Only 1 actual tool call was logged in metadata, despite text mentioning 2 tools
    assert.equal(analytics.toolExecutionCount, 1);
    assert.deepEqual(analytics.uniqueToolsUsed, ['get_order_details']);
  });

  // Scenario 21: No Response Appended After Finalization
  it('21. should reject adding messages after a session has been finalized', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is ORD-101?');
    endSession(session.id);

    assert.throws(
      () => {
        addMessage(session.id, 'assistant', 'Late response arrives here');
      },
      (err: any) => {
        assert.equal(err.message, 'SESSION_ENDED');
        return true;
      }
    );
  });

  // Scenario 22: HTTP Endpoints Integration
  describe('Phase 5 HTTP Endpoints', () => {
    it('POST /api/conversations/sessions/:id/end should return post-call summary and analytics', async () => {
      const session = createSession();
      addMessage(session.id, 'user', 'Where is order ORD-101?');
      addMessage(session.id, 'assistant', 'ORD-101 is Out for Delivery.', [
        { name: 'get_order_details', args: { order_id: 'ORD-101' }, resultSummary: 'Verified' },
      ]);

      const res = await fetch(`${baseUrl}/api/conversations/sessions/${session.id}/end`, {
        method: 'POST',
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.session.status, 'ENDED');
      assert.equal(body.data.summary.customer_intent, 'ORDER_TRACKING');
      assert.equal(body.data.analytics.customerTurns, 1);
      assert.equal(body.data.analytics.assistantTurns, 1);
      assert.ok(body.data.transcript.plainText);
    });

    it('GET /api/conversations/sessions/:id/postcall should retrieve complete post-call data', async () => {
      const session = createSession();
      addMessage(session.id, 'user', 'What is shipping for Rs 499?');
      addMessage(session.id, 'assistant', 'For Rs 499, the policy boundary is currently unspecified.');
      endSession(session.id);

      const res = await fetch(`${baseUrl}/api/conversations/sessions/${session.id}/postcall`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.summary.customer_intent, 'SHIPPING_QUERY');
      assert.equal(body.data.summary.resolution_status, 'RESOLVED');
    });

    it('GET /api/conversations/history should return completed calls list with pagination', async () => {
      const s1 = createSession();
      addMessage(s1.id, 'user', 'Where is ORD-101?');
      endSession(s1.id);

      const s2 = createSession();
      addMessage(s2.id, 'user', 'Can I return ORD-102?');
      endSession(s2.id);

      const res = await fetch(`${baseUrl}/api/conversations/history?limit=10&offset=0`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.history.length >= 2);
      assert.ok(body.data.total >= 2);
    });

    it('POST /api/conversations/sessions/:id/summary/retry should re-evaluate summary', async () => {
      const session = createSession();
      addMessage(session.id, 'user', 'Where is ORD-101?');
      endSession(session.id);

      const res = await fetch(`${baseUrl}/api/conversations/sessions/${session.id}/summary/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'DEMO' }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.summary.summary_mode, 'DEMO');
      assert.equal(body.data.summary.order_id, 'ORD-101');
    });
  });
});
