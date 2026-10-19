import type { MockOrder } from '../types/order.types';

/** Supplied assessment records. Relative times are scenario facts, not live dates. */
export const assessmentOrders: readonly MockOrder[] = [
  { orderId: 'ORD-101', customer: 'Priya Sharma', product: 'Vitamin C Serum (30ml)',
    valueInr: 699, status: 'Out for Delivery', courier: 'BlueDart', trackingNumber: 'BD-982103',
    estimatedDelivery: 'Expected by 6 PM today (assessment scenario only)', isScenarioData: true },
  { orderId: 'ORD-102', customer: 'Rahul Verma', product: 'Hydrating Sunscreen SPF 50',
    valueInr: 499, status: 'Delivered', courier: 'Delhivery', trackingNumber: 'DL-441029',
    delivered: '14 days ago (assessment scenario only)', isScenarioData: true },
  { orderId: 'ORD-103', customer: 'Ananya Patel', product: 'Green Tea Face Wash + Toner',
    valueInr: 850, status: 'Processing',
    note: 'Ordered 3 hours ago; eligible for cancellation (assessment scenario only)', isScenarioData: true },
];
