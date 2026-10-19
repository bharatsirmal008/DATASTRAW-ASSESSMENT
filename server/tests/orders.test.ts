import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findOrderById, normalizeOrderId, getAllMockOrders } from '../src/services/order.service';
import { get_order_details } from '../src/tools/getOrderDetails';

describe('Order Service & Tool - Business Logic', () => {
  it('should normalize order IDs correctly (trim whitespace and uppercase)', () => {
    assert.equal(normalizeOrderId('  ord-101  '), 'ORD-101');
    assert.equal(normalizeOrderId('ord-102'), 'ORD-102');
    assert.equal(normalizeOrderId('   '), null);
    assert.equal(normalizeOrderId(null), null);
    assert.equal(normalizeOrderId(123), null);
  });

  it('should retrieve all 3 mock scenario orders from getAllMockOrders()', () => {
    const orders = getAllMockOrders();
    assert.equal(orders.length, 3);
    assert.deepEqual(
      orders.map((o) => o.orderId),
      ['ORD-101', 'ORD-102', 'ORD-103']
    );
  });

  it('should lookup ORD-101 (Priya Sharma, Out for Delivery, BlueDart)', () => {
    const result = findOrderById('ORD-101');
    assert.equal(result.success, true);
    assert.equal(result.found, true);
    if (result.success && result.found) {
      assert.equal(result.order.customer, 'Priya Sharma');
      assert.equal(result.order.product, 'Vitamin C Serum (30ml)');
      assert.equal(result.order.valueInr, 699);
      assert.equal(result.order.status, 'Out for Delivery');
      assert.equal(result.order.courier, 'BlueDart');
      assert.equal(result.order.trackingNumber, 'BD-982103');
      assert.equal(result.order.isScenarioData, true);
    }
  });

  it('should lookup ORD-102 (Rahul Verma, Delivered, Delhivery)', () => {
    const result = findOrderById('ord-102');
    assert.equal(result.success, true);
    assert.equal(result.found, true);
    if (result.success && result.found) {
      assert.equal(result.order.customer, 'Rahul Verma');
      assert.equal(result.order.product, 'Hydrating Sunscreen SPF 50');
      assert.equal(result.order.valueInr, 499);
      assert.equal(result.order.status, 'Delivered');
      assert.equal(result.order.courier, 'Delhivery');
      assert.equal(result.order.delivered, '14 days ago (assessment scenario only)');
      assert.equal(result.order.isScenarioData, true);
    }
  });

  it('should lookup ORD-103 (Ananya Patel, Processing, eligible for cancellation)', () => {
    const result = findOrderById('  ORD-103  ');
    assert.equal(result.success, true);
    assert.equal(result.found, true);
    if (result.success && result.found) {
      assert.equal(result.order.customer, 'Ananya Patel');
      assert.equal(result.order.product, 'Green Tea Face Wash + Toner');
      assert.equal(result.order.valueInr, 850);
      assert.equal(result.order.status, 'Processing');
      assert.equal(
        result.order.note,
        'Ordered 3 hours ago; eligible for cancellation (assessment scenario only)'
      );
    }
  });

  it('should return NOT_FOUND for well-formed but non-existent order ID ORD-999', () => {
    const result = findOrderById('ORD-999');
    assert.equal(result.success, false);
    assert.equal(result.found, false);
    assert.equal(result.code, 'NOT_FOUND');
    assert.match(result.message, /not found/i);
  });

  it('should return INVALID_ORDER_ID for empty, missing, or malformed inputs', () => {
    assert.equal(findOrderById('').code, 'INVALID_ORDER_ID');
    assert.equal(findOrderById('   ').code, 'INVALID_ORDER_ID');
    assert.equal(findOrderById('INVALID-FORMAT').code, 'INVALID_ORDER_ID');
    assert.equal(findOrderById('12345').code, 'INVALID_ORDER_ID');
  });

  it('should satisfy the agent tool contract get_order_details(order_id)', async () => {
    const res = await get_order_details('ORD-101');
    assert.equal(res.success, true);
    assert.equal(res.found, true);
    if (res.success && res.found) {
      assert.equal(res.order.customer, 'Priya Sharma');
    }

    const notFoundRes = await get_order_details('ORD-888');
    assert.equal(notFoundRes.found, false);
    assert.equal(notFoundRes.code, 'NOT_FOUND');
  });
});
