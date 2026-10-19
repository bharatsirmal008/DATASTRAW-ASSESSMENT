import { it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderIds } from '../src/providers/conversation.utils';
import { get_order_details } from '../src/tools/getOrderDetails';
import { executeTool } from '../src/tools/toolRegistry';
import { GeminiProvider } from '../src/providers/gemini.provider';

it('understands ordinary English spoken order numbers without treating amounts as IDs', async () => {
  for (const [spoken, expected] of [['order one hundred and one', 'ORD-101'], ['O R D one hundred two', 'ORD-102'], ['order number one zero three', 'ORD-103'], ['ord-१०१', 'ORD-101'], ['ओ आर डी एक शून्य तीन', 'ORD-103'], ['ऑर्डर नंबर एक सौ दो', 'ORD-102']]) {
    assert.equal(normalizeOrderIds(spoken), expected);
    assert.equal((await get_order_details(spoken)).found, true);
  }
  assert.equal(normalizeOrderIds('shipping for one hundred and one rupees'), 'shipping for one hundred and one rupees');
});
it('returns verified cancellation eligibility with the lookup to avoid another model round-trip', async () => {
  const result = await executeTool('get_order_details', { order_id: 'ORD-103' });
  assert.equal(result.order.status, 'Processing');
  assert.equal(result.cancellationEligibility.status, 'eligible');
  const unknown = await executeTool('get_order_details', { order_id: 'ORD-999' });
  assert.equal(unknown.found, false);
  assert.equal(unknown.cancellationEligibility, undefined);
});
it('clears the previous verified order after a new unknown order lookup', async () => {
  const provider = new GeminiProvider();
  let calls = 0;
  (provider as any).getClient = () => ({ model: 'context-check', ai: { models: { generateContent: async () => ({ candidates: [{ content: { role: 'model', parts: ++calls === 1 ? [{ functionCall: { name: 'get_order_details', args: { order_id: 'ORD-999' } } }] : [{ text: 'I could not find that order. Please check the number.' }] } }] }) } } });
  const response = await provider.generateResponse({ userMessage: 'Check my other order ORD-999', messages: [], context: { latestOrderId: 'ORD-101' } });
  assert.ok(Object.hasOwn(response.contextPatch!, 'latestOrderId'));
  assert.equal(response.contextPatch?.latestOrderId, undefined);
});
