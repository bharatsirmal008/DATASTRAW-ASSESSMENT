import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, getSession, addMessage, endSession } from '../src/services/session.service';
import { processUserMessage } from '../src/services/conversation.service';
import { normalizeOrderIds } from '../src/providers/conversation.utils';
import { validateSummaryOutcome } from '../src/validators/summary.validator';
import { generateDemoSummary } from '../src/services/summary.service';
import { GeminiProvider } from '../src/providers/gemini.provider';

describe('Natural support conversations', () => {
  it('resumes cancellation after asking for an order number', async () => {
    const session = createSession();
    await processUserMessage(session.id, 'I want to cancel my order');
    const result = await processUserMessage(session.id, 'order one zero three');
    assert.match(result.response, /ORD-103.*eligible for cancellation/i);
    assert.ok(result.toolCalls.some(call => call.name === 'check_cancellation_eligibility'));
  });
  it('keeps damage intent across timing and photo follow-ups', async () => {
    const session = createSession();
    const complaint = await processUserMessage(session.id, 'My ORD-101 arrived damaged');
    assert.match(complaint.response, /sorry.*damage/i);
    assert.match(complaint.response, /record.*Out for Delivery/i);
    const timing = await processUserMessage(session.id, 'It arrived 12 hours ago');
    assert.match(timing.response, /photos/i);
    const photos = await processUserMessage(session.id, 'Yes, I have photos');
    assert.match(photos.response, /replacement review/i);
    assert.doesNotMatch(photos.response, /replacement (?:has been|was) shipped/i);
    assert.ok(photos.toolCalls.some(call => call.name === 'check_damage_replacement_eligibility'));
  });
  it('rejects an opened product without needing a scripted question', async () => {
    const session = createSession();
    const result = await processUserMessage(session.id, 'I bought this 20 days ago and opened it. Can I return it?');
    assert.match(result.response, /ineligible/i);
    assert.match(result.response, /7 days/);
  });
  it('continues shipping after receiving an amount', async () => {
    const session = createSession();
    await processUserMessage(session.id, 'Is shipping free?');
    const result = await processUserMessage(session.id, '700 rupees');
    assert.match(result.response, /delivery is free/);
    assert.equal(result.toolCalls[0].args.order_value_inr, 700);
  });
  it('evaluates the actual COD amount instead of a fixed threshold', async () => {
    const session = createSession();
    await processUserMessage(session.id, 'Can I pay cash?');
    const result = await processUserMessage(session.id, '3000');
    assert.match(result.response, /prepaid/i);
    assert.equal(result.toolCalls[0].args.order_value_inr, 3000);
  });
  it('provides the tracking number when the customer says yes', async () => {
    const session = createSession();
    await processUserMessage(session.id, 'Where is O R D 101?');
    const result = await processUserMessage(session.id, 'Yes please');
    assert.match(result.response, /BD-982103/);
  });
  it('lets the customer correct an unknown order without losing intent', async () => {
    const session = createSession();
    await processUserMessage(session.id, 'Cancel ORD-999');
    const result = await processUserMessage(session.id, 'Sorry, ORD-103');
    assert.match(result.response, /eligible for cancellation/);
  });
  it('does not pretend to execute an eligible cancellation on confirmation', async () => {
    const session = createSession();
    await processUserMessage(session.id, 'Cancel ORD-103');
    const result = await processUserMessage(session.id, 'Go ahead');
    assert.match(result.response, /can’t cancel/);
    assert.doesNotMatch(result.response, /(?:have|has been) cancelled/);
  });
  it('uses the order value when shipping is asked about a known order', async () => {
    const session = createSession();
    await processUserMessage(session.id, 'Where is ORD-101?');
    const result = await processUserMessage(session.id, 'What is shipping for this?');
    assert.match(result.response, /₹699/);
    assert.match(result.response, /free/);
  });
  it('asks which order to handle rather than silently ignoring a second ID', async () => {
    const session = createSession();
    const result = await processUserMessage(session.id, 'Track ORD-101 and ORD-103');
    assert.match(result.response, /one order at a time/);
    assert.equal(result.toolCalls.length, 0);
  });
  it('does not invent product ingredients or suitability', async () => {
    const session = createSession();
    const result = await processUserMessage(session.id, 'Is the serum safe for sensitive skin?');
    assert.match(result.response, /don’t have verified/);
  });
  it('preserves the full transcript past fifty messages', () => {
    const session = createSession();
    for (let i = 0; i < 65; i++) addMessage(session.id, i % 2 ? 'assistant' : 'user', `Message ${i}`);
    assert.equal(getSession(session.id)?.messages.length, 65);
    assert.equal(getSession(session.id)?.messages[0].content, 'Message 0');
  });
  it('marks a call that ended while awaiting a response as unresolved', () => {
    const session = createSession();
    addMessage(session.id, 'user', 'Where is ORD-101?');
    const ended = endSession(session.id)!;
    assert.equal(generateDemoSummary(ended).resolution_status, 'UNRESOLVED');
  });
  it('rejects invented order IDs even when no order appeared in the call', () => {
    const session = createSession();
    const summary = generateDemoSummary(session);
    summary.order_id = 'ORD-101'; summary.order_ids = ['ORD-101'];
    assert.equal(validateSummaryOutcome(summary, new Set()).isValid, false);
  });
  it('normalizes spaced and spoken IDs while leaving ordinary amounts intact', () => {
    for (const input of ['O R D 101', 'ord 1 0 1', 'order one zero one', 'order number 101']) assert.equal(normalizeOrderIds(input), 'ORD-101');
    assert.equal(normalizeOrderIds('Shipping for 700 rupees'), 'Shipping for 700 rupees');
  });
  it('summarizes a real damage conversation as needing support follow-up', async () => {
    const session = createSession();
    for (const message of ['My ORD-101 arrived damaged', '12 hours ago', 'I have photos']) await processUserMessage(session.id, message);
    const summary = generateDemoSummary(endSession(session.id)!);
    assert.equal(summary.customer_intent, 'DAMAGED_PRODUCT');
    assert.equal(summary.resolution_status, 'NEEDS_FOLLOW_UP');
    assert.match(summary.call_summary, /damaged|defective/);
    assert.match(summary.call_summary, /no replacement was arranged/);
  });
  it('sends the current Gemini user turn once without making a network call', async () => {
    const provider = new GeminiProvider();
    let captured: any;
    (provider as any).getClient = () => ({ model: 'test', ai: { models: { generateContent: async (request: any) => {
      captured = request;
      return { candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] };
    } } } });
    await provider.generateResponse({ userMessage: 'Hello', messages: [{ id: '1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() }], context: {} });
    assert.equal(captured.contents.length, 1);
    assert.equal(captured.contents[0].parts[0].text, 'Hello');
  });
  it('rejects a late provider reply after End Call without mutating the transcript', async () => {
    const original = GeminiProvider.prototype.generateResponse;
    const originalMode = process.env.AI_PROVIDER;
    let release!: (value: any) => void;
    GeminiProvider.prototype.generateResponse = () => new Promise(resolve => { release = resolve; });
    process.env.AI_PROVIDER = 'gemini';
    const session = createSession();
    try {
      const pending = processUserMessage(session.id, 'Hello');
      const rejected = assert.rejects(pending, (error: any) => error.code === 'SESSION_ENDED' && error.status === 409);
      endSession(session.id);
      release({ content: 'Late reply', mode: 'GEMINI', toolCalls: [] });
      await rejected;
      assert.equal(getSession(session.id)?.messages.length, 1);
    } finally {
      GeminiProvider.prototype.generateResponse = original;
      if (originalMode === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = originalMode;
    }
  });
});
