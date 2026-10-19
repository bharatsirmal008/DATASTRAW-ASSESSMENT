import { AIProvider, ProviderResponse, ToolCallExecution } from '../../src/providers/provider.interface';
import { ConversationMessage, SessionContext } from '../../src/services/session.service';
import { get_order_details } from '../../src/tools/getOrderDetails';
import { calculateShippingFee, checkCancellationEligibility, checkReturnEligibility, checkCodEligibility, checkDamageReplacementEligibility } from '../../src/services/policy.service';
import { detectIntent, extractAmount, normalizeOrderIds, SupportIntent } from '../../src/providers/conversation.utils';

/** Local conversational policy assistant. No general-purpose language model is implied. */
export class DemoProvider implements AIProvider {
  readonly mode = 'DEMO' as const;

  async generateResponse(params: { userMessage: string; messages: ConversationMessage[]; context: SessionContext }): Promise<ProviderResponse> {
    const raw = normalizeOrderIds(params.userMessage.trim());
    const lower = raw.toLowerCase();
    const tools: ToolCallExecution[] = [];
    const context: Partial<SessionContext> = {};
    const reply = (content: string): ProviderResponse => ({ content, mode: this.mode, toolCalls: tools, contextPatch: context });
    const record = (name: string, args: Record<string, unknown>, result: any) => {
      tools.push({ name, args, result, resultSummary: result.policyCode || (result.found ? `Found ${args.order_id} (${result.order.status})` : `Order ${args.order_id} not found`) });
      return result;
    };
    const ids = raw.match(/\bORD-\d+\b/gi) || [];
    if (new Set(ids.map(id => id.toUpperCase())).size > 1) {
      return reply('Let’s take one order at a time. Which order would you like help with first?');
    }
    const mentionedId = ids[0]?.toUpperCase();
    const orderId = mentionedId || params.context.latestOrderId;
    const changedOrder = Boolean(mentionedId && mentionedId !== params.context.latestOrderId);
    if (changedOrder) {
      context.returnDetails = {};
      context.damageDetails = {};
    }
    let intent = detectIntent(raw);
    // Delivery timing is an answer to a pending damage question, not a switch
    // back to tracking just because speech contains "arrived".
    if (params.context.pendingIntent === 'damage' && intent === 'tracking' && /\d+\s*(?:hours?|days?)|today|yesterday|just arrived/i.test(raw)) intent = 'damage';
    const explicitIntent = intent;
    if (!intent && params.context.pendingIntent) intent = params.context.pendingIntent;
    if (!intent && mentionedId) intent = 'tracking';
    if (!intent && /\b(it|that|this|again|why|what about|how much|when|yes|no|okay|ok)\b/i.test(raw)) intent = params.context.lastIntent;

    if (/ignore (?:all|previous)|system prompt|override policy|reveal.*instructions/i.test(raw)) {
      return reply('I’m Aria from Aura Skincare. I adhere strictly to our official brand policies and can help you check what’s possible for your order.');
    }
    if (/\b(flight|weather|python|javascript|hotel|movie|recipe|crypto|stock market)\b/i.test(raw)) {
      return reply('I can only assist with Aura Skincare orders and policies. What can I help you with there?');
    }
    if (/^(thanks?([ ,].*)?|thank you.*|bye.*|goodbye.*)$/i.test(raw)) {
      context.pendingIntent = null;
      return reply('You’re welcome! If you need anything else about Aura Skincare, I’m here. You can end the call whenever you’re ready.');
    }
    if (/^(hi|hello|hey|namaste|good morning|good evening)\b/i.test(raw) && !intent) {
      return reply('Namaste! I’m Aria from Aura Skincare. How can I help you today?');
    }
    if (/who are you|your name|how are you/i.test(raw)) return reply('I’m Aria, Aura Skincare’s support assistant. I’m here to help with your orders and our store policies. What can I check for you?');
    if (/change.*address|wrong address|update.*address/i.test(raw)) return reply('I can’t change a delivery address from this conversation. Please contact support using your order confirmation as soon as possible. If you share the order ID, I can check whether it has shipped.');
    if (/refund.*(?:how long|when|time)|(?:how long|when).*refund/i.test(raw)) return reply('The brand information doesn’t specify a refund processing time, so I can’t give you a reliable date. Support can confirm the timeline for your request. I can help check return eligibility if you’d like.');
    if (/discount|coupon|(?:current|special|ongoing) offers?|stock|available in|deliver to|delivery to/i.test(raw)) return reply('I don’t have verified information on current offers, stock, or delivery coverage for a particular location. Please check the store or your order confirmation. I can help with shipping fees or an existing order.');
    if (/what can you|how can you|help me|need help/i.test(raw) && !intent) {
      return reply('Of course. I can track an order, check cancellation or return eligibility, and explain shipping, damaged-item replacements, or payments. Tell me what happened.');
    }
    if (/speak.*(human|person)|human|agent|support team|contact support|phone number|email address/i.test(raw) && !/cancel|track|return|shipping/i.test(raw)) {
      return reply('I can explain your options, but I can’t transfer this call or contact a support team. A verified Aura support contact hasn’t been provided, so please use the contact details on your order confirmation.');
    }
    if (/^(yes|yeah|please|do it|go ahead|proceed|sure)[.! ]*$/i.test(raw) && params.context.lastIntent === 'cancellation' && !params.context.pendingIntent) {
      return reply('I can check eligibility, but I can’t cancel the order or send a request. Please use the support contact on your order confirmation to request cancellation while it is still Processing.');
    }
    if (intent) context.lastIntent = intent;
    context.pendingIntent = null;
    const needOrder = (nextIntent: SupportIntent) => {
      context.pendingIntent = nextIntent;
      return reply('Please provide your Order ID so I can check that for you. You can say “order one zero three”, for example.');
    };
    const lookup = async () => {
      const result = await get_order_details(orderId!);
      record('get_order_details', { order_id: orderId }, result);
      if (result.found) context.latestOrderId = result.order.orderId;
      return result;
    };
    const notFound = () => {
      context.pendingIntent = intent || 'tracking';
      context.latestOrderId = undefined;
      return reply(`Order ${orderId} was not found in our system. Could you check the number on your confirmation and repeat it?`);
    };

    if (intent === 'cancellation') {
      if (!orderId) return needOrder('cancellation');
      const result = await lookup();
      if (!result.found) return notFound();
      const order = result.order;
      const eligibility = record('check_cancellation_eligibility', { order_status: order.status }, checkCancellationEligibility(order.status));
      if (eligibility.status === 'eligible') return reply(`${order.orderId} is still Processing and eligible for cancellation. This check doesn’t cancel it; please request cancellation through the support contact on your order confirmation.`);
      if (eligibility.details?.doorstepRefusalAllowed) return reply(`${order.orderId} is ${order.status} and cannot be cancelled after dispatch. You may refuse delivery at your doorstep.`);
      return reply(`${order.orderId} has already been delivered and cannot be cancelled. Returns are a separate option within 7 days for unopened, unused items in original packaging.`);
    }

    if (intent === 'damage') {
      let order;
      if (orderId) {
        const result = await lookup();
        if (!result.found) return notFound();
        order = result.order;
      }
      const details = { ...(changedOrder ? {} : params.context.damageDetails) };
      const hours = lower.match(/(\d+)\s*hours?/);
      const days = lower.match(/(\d+)\s*days?/);
      if (hours) details.hours = Number(hours[1]);
      else if (days) details.hours = Number(days[1]) * 24;
      else if (/yesterday/i.test(raw)) details.hours = 24;
      else if (/today|just arrived/i.test(raw)) details.hours = 0;
      if (/no photos|without photos|don.t have.*photos/i.test(raw)) details.photos = false;
      else if (/photos|pictures|images/i.test(raw)) details.photos = true;
      if (order?.delivered?.includes('14 days')) details.hours = 14 * 24;
      context.damageDetails = details;
      context.pendingIntent = 'damage';
      if (details.hours !== undefined && details.hours > 48) {
        context.pendingIntent = null;
        return reply('I’m sorry about the damage. The replacement policy requires reporting within 48 hours of delivery; this falls outside that window. Please contact support for review; I can’t promise an exception.');
      }
      if (details.hours === undefined) return reply(`I’m sorry your item arrived damaged. ${order && order.status !== 'Delivered' ? `The record for ${order.orderId} still says ${order.status}, so I need to clarify the delivery. ` : ''}How long ago did it arrive? Damage must be reported within 48 hours with photos.`);
      if (details.photos !== true) return reply('Thank you. Clear photos of the damage are required along with reporting within 48 hours. Do you have photos to share with support?');
      record('check_damage_replacement_eligibility', { hours_since_delivery: details.hours, has_photos: true }, checkDamageReplacementEligibility(details.hours, true));
      context.pendingIntent = null;
      return reply('That meets the stated timing and photo requirements for replacement review. Send the photos and order ID to the support contact on your confirmation; I can’t review images or arrange a replacement here.');
    }

    if (intent === 'returns') {
      let order;
      if (orderId) {
        const result = await lookup();
        if (!result.found) return notFound();
        order = result.order;
      }
      const details = { ...(changedOrder ? {} : params.context.returnDetails) };
      const days = lower.match(/(\d+)\s*days?/);
      if (days) details.days = Number(days[1]);
      if (/^(yes|yeah|all three)[.! ]*$/i.test(raw) && params.context.pendingIntent === 'returns' && details.days !== undefined) { details.opened = false; details.used = false; details.packaging = true; }
      if (/unopened|not opened|haven.t opened|sealed/i.test(raw)) details.opened = false;
      else if (/opened|open it|broken seal/i.test(raw)) details.opened = true;
      if (/unused|not used|haven.t used/i.test(raw)) details.used = false;
      else if (/used it|have used|been used/i.test(raw)) details.used = true;
      if (/original (?:box|packaging)|all.*packaging/i.test(raw)) details.packaging = !/no original|without.*packaging/i.test(raw);
      if (order?.delivered?.includes('14 days')) details.days = 14;
      context.returnDetails = details;
      if ((details.days !== undefined && details.days > 7) || details.opened || details.used || details.packaging === false) {
        return reply(`Returns are accepted within 7 days of delivery for unopened, unused items in original packaging. ${order?.orderId === 'ORD-102' ? 'ORD-102 was delivered 14 days ago, so its return window has expired.' : 'The details you shared make this item ineligible for a standard return.'} I can’t promise a refund outside that policy.`);
      }
      if (order && order.status !== 'Delivered') return reply(`${order.orderId} is ${order.status}, so I can’t verify return eligibility yet. Returns apply after delivery; if you meant cancellation, I can check that instead.`);
      if (details.days !== undefined && details.opened === false && details.used === false && details.packaging === true) {
        record('check_return_eligibility', { days_since_delivery: details.days, is_unopened: true, is_unused: true, has_original_packaging: true }, checkReturnEligibility(details.days, true, true, true));
        if (!orderId) return needOrder('returns');
        return reply('Those details meet the stated return conditions. Please contact support with your order ID for verification and a return request. No return or refund has been processed here.');
      }
      context.pendingIntent = 'returns';
      if (details.days === undefined && (orderId || /my|bought|received|item|it/i.test(raw))) return reply('Returns are accepted within 7 days of delivery for unopened, unused items in original packaging. How many days ago was yours delivered?');
      if (details.days !== undefined) return reply('Is the product unopened, unused, and still in its original packaging? Please tell me those details so I can check the conditions.');
      return reply('Returns are accepted within 7 days of delivery for unopened, unused products in original packaging. Are you checking a particular order?');
    }

    if (intent === 'shipping' || intent === 'cod') {
      let amount = extractAmount(raw);
      if (amount === undefined && orderId && /this|that|my order|it|ORD-/i.test(raw)) {
        const result = await lookup();
        if (!result.found) return notFound();
        amount = result.order.valueInr;
      }
      if (intent === 'cod') {
        if (amount !== undefined) {
          const result = record('check_cod_eligibility', { order_value_inr: amount }, checkCodEligibility(amount));
          return reply(result.message);
        }
        context.pendingIntent = 'cod';
        return reply('Cash on Delivery is available up to and including ₹2,500, payable by Cash or UPI at the doorstep. What’s your order total?');
      }
      if (/how long|time|business days/i.test(raw) && amount === undefined) return reply('Standard delivery takes 3–5 business days. If you have an existing order, share its ID and I can check its status.');
      if (amount !== undefined) {
        const result = record('calculate_shipping_fee', { order_value_inr: amount }, calculateShippingFee(amount));
        if (result.status === 'unspecified') return reply('For exactly ₹499, the shipping fee is unspecified in the brand policy. Support will need to confirm it. Above ₹499 delivery is free; below ₹499 the fee is ₹50.');
        return reply(`For an order of ₹${amount}, ${amount > 499 ? 'standard delivery is free' : 'the shipping fee is ₹50'}. Standard delivery takes 3–5 business days.`);
      }
      context.pendingIntent = 'shipping';
      return reply('Standard delivery takes 3–5 business days. Shipping is free above ₹499 and ₹50 below ₹499. What’s your order total?');
    }

    if (intent === 'tracking') {
      if (!orderId) return needOrder('tracking');
      const result = await lookup();
      if (!result.found) return notFound();
      const order = result.order;
      const repeated = params.context.latestOrderId === orderId && params.context.lastIntent === 'tracking';
      if (repeated && /courier|tracking (?:id|number)|which.*deliver/i.test(raw)) return reply(order.courier ? `${order.courier} is handling ${order.orderId}. Your tracking number is ${order.trackingNumber}.` : 'A courier hasn’t been assigned in the order record yet.');
      if (repeated && /why|late|delay/i.test(raw)) return reply(`The latest record says ${order.status}. I don’t have a verified reason for a delay or live courier updates, so I don’t want to guess. Please contact support if the stated delivery time has passed.`);
      const clean = (value?: string) => value?.replace(/\s*\(assessment scenario only\)/g, '') || '';
      if (/^(yes|please|sure)/i.test(raw) && repeated && order.trackingNumber) return reply(`Your ${order.courier} tracking number is ${order.trackingNumber}.`);
      if (order.status === 'Out for Delivery') return reply(`${order.customer}, your order ${order.orderId} is Out for Delivery with ${order.courier}. It’s expected by 6 PM today. Would you like the tracking number?`);
      if (order.status === 'Delivered') return reply(`${order.customer}, ${order.orderId} was delivered ${clean(order.delivered)} by ${order.courier}. Is there a problem with the delivery or the product?`);
      if (/^(yes|please|sure)/i.test(raw) && repeated && order.trackingNumber) return reply(`Your ${order.courier} tracking number is ${order.trackingNumber}.`);
      return reply(`${order.customer}, ${order.orderId} is Processing and hasn’t shipped yet. It was placed 3 hours ago. You can still request cancellation while it is Processing.`);
    }

    if (intent === 'brand') {
      if (/recommend|best|safe|acne|sensitive|pregnan|allerg|suit|ingredients|how.*use/i.test(raw)) return reply('I don’t have verified ingredient lists, usage directions, or suitability advice for these products. Please check the product label or ask support; I can help with your order and store policies.');
      if (/product|sell|serum|sunscreen|toner|face wash/i.test(raw)) return reply('The sample orders include Vitamin C Serum, Hydrating Sunscreen SPF 50, and Green Tea Face Wash with Toner. I don’t have a complete catalogue or current stock details. Which product or order are you asking about?');
      return reply('Aura Skincare is a premium organic Indian brand focused on simple, effective skincare with thoughtfully selected ingredients. What would you like to know about your order or our policies?');
    }
    if (/repeat|say.*again|didn.t (?:hear|catch)|pardon/i.test(raw)) {
      const last = [...params.messages].reverse().find(message => message.role === 'assistant');
      if (last) return reply(last.content);
    }
    if (/angry|frustrat|terrible|disappoint|not helping/i.test(raw)) return reply('I understand this is frustrating. Tell me what went wrong with your order, and I’ll check the details and the options our policies allow.');
    return reply(explicitIntent ? 'Could you tell me a little more so I can check that accurately?' : 'I didn’t quite catch what you need. Is this about an order, a return, shipping, or a damaged product? You can describe the problem in your own words.');
  }
}
