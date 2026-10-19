import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, executeTool } from '../src/tools/toolRegistry';

describe('Tool Registry & Safe Tool Execution', () => {
  it('should register get_order_details and policy evaluation tools', () => {
    assert.ok(TOOLS.get_order_details);
    assert.ok(TOOLS.check_cancellation_eligibility);
    assert.ok(TOOLS.calculate_shipping_fee);
    assert.ok(TOOLS.check_return_eligibility);
    assert.ok(TOOLS.check_damage_replacement_eligibility);
    assert.ok(TOOLS.check_cod_eligibility);
    assert.ok(TOOLS.get_brand_policies);
  });

  it('should execute get_order_details for ORD-101 and return verified details', async () => {
    const result = await executeTool('get_order_details', { order_id: 'ORD-101' });
    assert.equal(result.success, true);
    assert.equal(result.found, true);
    assert.equal(result.order.customer, 'Priya Sharma');
    assert.equal(result.order.courier, 'BlueDart');
    assert.equal(result.order.status, 'Out for Delivery');
  });

  it('should execute get_order_details for ORD-999 and return not found', async () => {
    const result = await executeTool('get_order_details', { order_id: 'ORD-999' });
    assert.equal(result.success, false);
    assert.equal(result.found, false);
    assert.equal(result.code, 'NOT_FOUND');
  });

  it('should execute check_cancellation_eligibility for Processing', async () => {
    const result = await executeTool('check_cancellation_eligibility', {
      order_status: 'Processing',
    });
    assert.equal(result.status, 'eligible');
    assert.equal(result.policyCode, 'CANCELLATION_ELIGIBLE');
  });

  it('should execute check_cancellation_eligibility for Out for Delivery', async () => {
    const result = await executeTool('check_cancellation_eligibility', {
      order_status: 'Out for Delivery',
    });
    assert.equal(result.status, 'ineligible');
    assert.equal(result.policyCode, 'CANCELLATION_INELIGIBLE_IN_TRANSIT');
    assert.equal(result.details.doorstepRefusalAllowed, true);
  });

  it('should execute calculate_shipping_fee for exact ₹499 boundary', async () => {
    const result = await executeTool('calculate_shipping_fee', { order_value_inr: 499 });
    assert.equal(result.status, 'unspecified');
    assert.equal(result.policyCode, 'UNSPECIFIED_POLICY_BOUNDARY');
  });

  it('should throw an error when attempting to execute an unregistered tool', async () => {
    await assert.rejects(
      async () => executeTool('unregistered_tool', {}),
      /not registered/
    );
  });
});
