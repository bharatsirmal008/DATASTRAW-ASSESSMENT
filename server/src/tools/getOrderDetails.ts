import { findOrderById } from '../services/order.service';
import { OrderLookupResult } from '../types/order.types';
import { isAssessmentMode } from '../config/application';

/**
 * Required Agent Tool Contract for Phase 3 LLM tool-calling adapters:
 * `get_order_details(order_id)`
 *
 * Retrieves verified order information strictly from local Aura Skincare mock database.
 * Pure and independent of HTTP.
 */
export async function get_order_details(order_id: string): Promise<OrderLookupResult> {
  if (isAssessmentMode() || process.env.NODE_ENV === 'test') return findOrderById(order_id);
  throw Object.assign(new Error('The store order system is not connected. No order lookup was performed. Ask the customer to use their order confirmation or the store’s verified support channel; do not invent an order status.'), {
    code: 'ORDER_SERVICE_NOT_CONFIGURED', status: 503,
  });
}

// Idiomatic camelCase alias for standard TypeScript consumers
export const getOrderDetails = get_order_details;
