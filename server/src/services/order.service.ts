import { MockOrder, OrderLookupResult } from '../types/order.types';
import { assessmentOrders } from '../data/assessmentOrders';
import { isAssessmentMode } from '../config/application';
import { normalizeOrderIds } from '../providers/conversation.utils';

/**
 * Normalizes an order ID string:
 * - Trims leading and trailing whitespace
 * - Converts to uppercase
 */
export function normalizeOrderId(rawOrderId: unknown): string | null {
  if (typeof rawOrderId !== 'string') {
    return null;
  }
  const trimmed = normalizeOrderIds(rawOrderId).trim().toUpperCase();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

/**
 * Retrieves all mock orders for evaluator convenience (scenario testing only).
 */
export function getAllMockOrders(): MockOrder[] {
  if (!isAssessmentMode()) throw Object.assign(new Error('The store order system is not connected.'), { code: 'ORDER_SERVICE_NOT_CONFIGURED', status: 503 });
  return assessmentOrders.map(order => ({ ...order }));
}

/**
 * Looks up an order by its ID from the local mock database.
 * Pure and independent of HTTP.
 */
export function findOrderById(rawOrderId: unknown): OrderLookupResult {
  if (!isAssessmentMode()) throw Object.assign(new Error('The store order system is not connected.'), { code: 'ORDER_SERVICE_NOT_CONFIGURED', status: 503 });
  const normalizedId = normalizeOrderId(rawOrderId);

  if (!normalizedId) {
    return {
      success: false,
      found: false,
      code: 'INVALID_ORDER_ID',
      message: 'Order ID is required and must be a non-empty string.',
    };
  }

  // Basic format validation: must match expected order ID pattern (e.g., ORD-xxx)
  const orderIdPattern = /^ORD-\d+$/;
  if (!orderIdPattern.test(normalizedId)) {
    return {
      success: false,
      found: false,
      code: 'INVALID_ORDER_ID',
      message: `Invalid Order ID format "${normalizedId}". Expected format like ORD-101.`,
    };
  }

  const order = assessmentOrders.find(order => order.orderId === normalizedId);

  if (!order) {
    return {
      success: false,
      found: false,
      code: 'NOT_FOUND',
      message: `Order with ID "${normalizedId}" was not found in the Aura Skincare database.`,
    };
  }

  return {
    success: true,
    found: true,
    order: { ...order },
  };
}
