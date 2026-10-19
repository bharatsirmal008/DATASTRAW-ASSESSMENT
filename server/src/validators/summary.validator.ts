import type { StructuredCallOutcome, CustomerIntent, ResolutionStatus } from '../types/summary.types';
import { getRegisteredTools } from '../tools/toolRegistry';

const VALID_INTENTS: Set<CustomerIntent> = new Set([
  'PRODUCT_SEARCH',
  'PRODUCT_INFORMATION',
  'ORDER_TRACKING',
  'CANCELLATION_QUERY',
  'RETURN_QUERY',
  'REFUND_QUERY',
  'SHIPPING_QUERY',
  'DAMAGED_PRODUCT',
  'COD_QUERY',
  'BRAND_INFORMATION',
  'GENERAL_SUPPORT',
  'OUT_OF_SCOPE',
  'UNKNOWN',
]);

const VALID_STATUSES: Set<ResolutionStatus> = new Set([
  'RESOLVED',
  'PARTIALLY_RESOLVED',
  'UNRESOLVED',
  'NEEDS_FOLLOW_UP',
]);

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function summaryResponseSchema(orderIds: string[], toolsUsed: string[]) {
  return { type: 'object', additionalProperties: false,
    required: ['customer_intent', 'additional_intents', 'order_id', 'order_ids', 'resolution_status', 'call_summary', 'tools_used'],
    properties: {
      customer_intent: { type: 'string', enum: [...VALID_INTENTS] },
      additional_intents: { type: 'array', items: { type: 'string', enum: [...VALID_INTENTS] } },
      order_id: orderIds.length ? { anyOf: [{ type: 'string', enum: orderIds }, { type: 'null' }] } : { type: 'null' },
      order_ids: { type: 'array', items: orderIds.length ? { type: 'string', enum: orderIds } : { type: 'string' }, ...(orderIds.length ? {} : { maxItems: 0 }) },
      resolution_status: { type: 'string', enum: [...VALID_STATUSES] },
      call_summary: { type: 'string', minLength: 10, maxLength: 2000 },
      tools_used: { type: 'array', items: toolsUsed.length ? { type: 'string', enum: toolsUsed } : { type: 'string' }, ...(toolsUsed.length ? {} : { maxItems: 0 }) },
    } };
}

/**
 * Validates a StructuredCallOutcome against structural and semantic integrity rules.
 */
export function validateSummaryOutcome(
  outcome: unknown,
  allowedOrderIdsInTranscript: Set<string> = new Set()
): ValidationResult {
  const errors: string[] = [];

  if (!outcome || typeof outcome !== 'object') {
    return { isValid: false, errors: ['Outcome must be a non-null object.'] };
  }

  const o = outcome as Partial<StructuredCallOutcome>;

  // 1. Validate customer_intent
  if (!o.customer_intent || !VALID_INTENTS.has(o.customer_intent)) {
    errors.push(`Invalid or missing customer_intent: "${o.customer_intent}".`);
  }

  // 2. Validate resolution_status
  if (!o.resolution_status || !VALID_STATUSES.has(o.resolution_status)) {
    errors.push(`Invalid or missing resolution_status: "${o.resolution_status}".`);
  }

  // 3. Validate order_ids list
  if (!Array.isArray(o.order_ids)) {
    errors.push('Field "order_ids" must be an array of strings.');
  } else {
    for (const id of o.order_ids) {
      if (typeof id !== 'string') {
        errors.push(`Invalid order_id element in list: ${id}.`);
      } else if (
        !allowedOrderIdsInTranscript.has(id.toUpperCase())
      ) {
        errors.push(`Fabricated order_id "${id}" was not referenced in conversation transcript.`);
      }
    }
  }

  // 4. Validate primary order_id
  if (o.order_id !== null && typeof o.order_id !== 'string') {
    errors.push('Field "order_id" must be a string or null.');
  } else if (typeof o.order_id === 'string') {
    if (Array.isArray(o.order_ids) && !o.order_ids.includes(o.order_id)) {
      errors.push(`Primary order_id "${o.order_id}" is not present in order_ids list.`);
    }
  }

  // 5. Validate summary text
  if (!o.call_summary || typeof o.call_summary !== 'string') {
    errors.push('Field "call_summary" must be a non-empty string.');
  } else {
    const summaryText = o.call_summary.trim();
    if (summaryText.length < 10) {
      errors.push('Field "call_summary" is too short (minimum 10 characters).');
    }
    if (summaryText.length > 2000) {
      errors.push('Field "call_summary" exceeds maximum length of 2000 characters.');
    }

    // Semantic check: Read-only tool constraint
    // In Aura assessment, tools are read-only. We must never report that an order was executed as cancelled or refund issued.
    const forbiddenClaims = [
      /order (has been|was|is) cancelled\b/i,
      /cancellation (has been|was) (completed|processed|executed)\b/i,
      /refund (has been|was) (processed|issued|transferred)\b/i,
      /replacement (has been|was) shipped\b/i,
    ];

    for (const pattern of forbiddenClaims) {
      if (pattern.test(summaryText)) {
        errors.push(`Summary contains an unverified action claim matching "${pattern.source}".`);
      }
    }
  }

  // 6. Validate tools_used
  if (Array.isArray(o.tools_used)) {
    const registeredTools = new Set(getRegisteredTools().map((t: { name: string }) => t.name));
    for (const t of o.tools_used) {
      if (!registeredTools.has(t)) {
        errors.push(`Unregistered tool name reported in tools_used: "${t}".`);
      }
    }
  }

  // 7. Validate summary_mode
  if (o.summary_mode !== 'GEMINI') {
    errors.push(`Invalid summary_mode: "${o.summary_mode}". Expected GEMINI.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
