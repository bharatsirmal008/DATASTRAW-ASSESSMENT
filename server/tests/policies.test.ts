import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateShippingFee,
  checkCancellationEligibility,
  checkReturnEligibility,
  checkDamageReplacementEligibility,
  checkCodEligibility,
  getBrandPolicy,
} from '../src/services/policy.service';
import { getAllMockOrders } from '../src/services/order.service';

describe('Brand Policies Engine & Guardrails', () => {
  describe('Shipping Fee Calculation', () => {
    it('should grant free shipping for order values strictly above ₹499', () => {
      const res500 = calculateShippingFee(500);
      assert.equal(res500.status, 'eligible');
      assert.equal(res500.policyCode, 'FREE_SHIPPING');
      assert.equal(res500.details?.feeInr, 0);

      const res699 = calculateShippingFee(699);
      assert.equal(res699.status, 'eligible');
      assert.equal(res699.details?.feeInr, 0);
    });

    it('should charge standard ₹50 shipping for order values strictly below ₹499', () => {
      const res400 = calculateShippingFee(400);
      assert.equal(res400.status, 'eligible');
      assert.equal(res400.policyCode, 'STANDARD_SHIPPING_FEE');
      assert.equal(res400.details?.feeInr, 50);

      const res0 = calculateShippingFee(0);
      assert.equal(res0.details?.feeInr, 50);

      const res498 = calculateShippingFee(498.99);
      assert.equal(res498.details?.feeInr, 50);
    });

    it('should return UNSPECIFIED_POLICY_BOUNDARY for orders of exactly ₹499', () => {
      const res499 = calculateShippingFee(499);
      assert.equal(res499.status, 'unspecified');
      assert.equal(res499.policyCode, 'UNSPECIFIED_POLICY_BOUNDARY');
      assert.match(res499.message, /does not specify/i);
    });

    it('should reject invalid or negative numbers', () => {
      assert.equal(calculateShippingFee(-10).policyCode, 'INVALID_INPUT');
      // @ts-expect-error Testing invalid runtime input
      assert.equal(calculateShippingFee('abc').policyCode, 'INVALID_INPUT');
      // @ts-expect-error Testing NaN input
      assert.equal(calculateShippingFee(NaN).policyCode, 'INVALID_INPUT');
    });
  });

  describe('Cancellation Eligibility', () => {
    it('should allow cancellation for orders in Processing status', () => {
      const res = checkCancellationEligibility('Processing');
      assert.equal(res.status, 'eligible');
      assert.equal(res.policyCode, 'CANCELLATION_ELIGIBLE');
      assert.match(res.message, /eligible for cancellation/i);
    });

    it('should disallow cancellation for Shipped orders but allow doorstep refusal', () => {
      const res = checkCancellationEligibility('Shipped');
      assert.equal(res.status, 'ineligible');
      assert.equal(res.policyCode, 'CANCELLATION_INELIGIBLE_IN_TRANSIT');
      assert.equal(res.details?.doorstepRefusalAllowed, true);
    });

    it('should disallow cancellation for Out for Delivery orders but allow doorstep refusal', () => {
      const res = checkCancellationEligibility('Out for Delivery');
      assert.equal(res.status, 'ineligible');
      assert.equal(res.policyCode, 'CANCELLATION_INELIGIBLE_IN_TRANSIT');
      assert.equal(res.details?.doorstepRefusalAllowed, true);
    });

    it('should disallow cancellation for Delivered orders without inventing alternate cancellation', () => {
      const res = checkCancellationEligibility('Delivered');
      assert.equal(res.status, 'ineligible');
      assert.equal(res.policyCode, 'CANCELLATION_INELIGIBLE_DELIVERED');
      assert.equal(res.details?.doorstepRefusalAllowed, false);
      assert.match(res.message, /already delivered/i);
    });

    it('should confirm checking cancellation eligibility does NOT modify orders', () => {
      const ordersBefore = getAllMockOrders();
      const statusBefore = ordersBefore.find((o) => o.orderId === 'ORD-103')?.status;

      checkCancellationEligibility('Processing');

      const ordersAfter = getAllMockOrders();
      const statusAfter = ordersAfter.find((o) => o.orderId === 'ORD-103')?.status;

      assert.equal(statusBefore, 'Processing');
      assert.equal(statusAfter, 'Processing');
    });

    it('should reject empty or invalid status', () => {
      assert.equal(checkCancellationEligibility('').policyCode, 'INVALID_INPUT');
      assert.equal(checkCancellationEligibility('RandomStatus').policyCode, 'UNKNOWN_STATUS');
    });
  });

  describe('Return Eligibility', () => {
    it('should allow returns delivered exactly 7 days ago if unopened, unused, in original packaging', () => {
      const res = checkReturnEligibility(7, true, true, true);
      assert.equal(res.status, 'eligible');
      assert.equal(res.policyCode, 'RETURN_ELIGIBLE');
    });

    it('should allow returns within 7 days (e.g., 3 days)', () => {
      const res = checkReturnEligibility(3, true, true, true);
      assert.equal(res.status, 'eligible');
      assert.equal(res.policyCode, 'RETURN_ELIGIBLE');
    });

    it('should reject returns beyond 7 days (e.g., ORD-102 scenario: 14 days ago)', () => {
      const res = checkReturnEligibility(14, true, true, true);
      assert.equal(res.status, 'ineligible');
      assert.equal(res.policyCode, 'RETURN_WINDOW_EXPIRED');
    });

    it('should reject returns if product was opened, used, or lacks packaging', () => {
      const resOpened = checkReturnEligibility(2, false, true, true);
      assert.equal(resOpened.status, 'ineligible');
      assert.equal(resOpened.policyCode, 'RETURN_CONDITION_NOT_MET');

      const resUsed = checkReturnEligibility(2, true, false, true);
      assert.equal(resUsed.status, 'ineligible');
      assert.equal(resUsed.policyCode, 'RETURN_CONDITION_NOT_MET');

      const resNoBox = checkReturnEligibility(2, true, true, false);
      assert.equal(resNoBox.status, 'ineligible');
      assert.equal(resNoBox.policyCode, 'RETURN_CONDITION_NOT_MET');
    });

    it('should reject invalid or negative numbers', () => {
      assert.equal(checkReturnEligibility(-1, true, true, true).policyCode, 'INVALID_INPUT');
      // @ts-expect-error Testing invalid boolean
      assert.equal(checkReturnEligibility(5, 'yes', true, true).policyCode, 'INVALID_INPUT');
    });
  });

  describe('Damage Replacement Eligibility', () => {
    it('should allow replacement reported at exactly 48 hours with photos', () => {
      const res = checkDamageReplacementEligibility(48, true);
      assert.equal(res.status, 'eligible');
      assert.equal(res.policyCode, 'DAMAGE_REPLACEMENT_ELIGIBLE');
    });

    it('should allow replacement reported within 48 hours (e.g., 12 hours) with photos', () => {
      const res = checkDamageReplacementEligibility(12, true);
      assert.equal(res.status, 'eligible');
      assert.equal(res.policyCode, 'DAMAGE_REPLACEMENT_ELIGIBLE');
    });

    it('should reject replacement if reported after 48 hours (e.g., 49 hours)', () => {
      const res = checkDamageReplacementEligibility(49, true);
      assert.equal(res.status, 'ineligible');
      assert.equal(res.policyCode, 'DAMAGE_REPORTING_WINDOW_EXPIRED');
    });

    it('should reject replacement within 48 hours if no photos provided', () => {
      const res = checkDamageReplacementEligibility(10, false);
      assert.equal(res.status, 'ineligible');
      assert.equal(res.policyCode, 'PHOTOS_REQUIRED');
    });

    it('should reject invalid or negative hours', () => {
      assert.equal(checkDamageReplacementEligibility(-5, true).policyCode, 'INVALID_INPUT');
      // @ts-expect-error Testing invalid type
      assert.equal(checkDamageReplacementEligibility(10, 'yes').policyCode, 'INVALID_INPUT');
    });
  });

  describe('Cash on Delivery (COD) Eligibility', () => {
    it('should allow COD for orders up to and including ₹2,500', () => {
      const res2500 = checkCodEligibility(2500);
      assert.equal(res2500.status, 'eligible');
      assert.equal(res2500.policyCode, 'COD_ELIGIBLE');
      assert.deepEqual(res2500.details?.acceptedPaymentModes, ['Cash', 'UPI']);

      const res1500 = checkCodEligibility(1500);
      assert.equal(res1500.status, 'eligible');
    });

    it('should disallow COD for orders strictly exceeding ₹2,500', () => {
      const res2501 = checkCodEligibility(2501);
      assert.equal(res2501.status, 'ineligible');
      assert.equal(res2501.policyCode, 'COD_THRESHOLD_EXCEEDED');

      const res5000 = checkCodEligibility(5000);
      assert.equal(res5000.status, 'ineligible');
    });

    it('should reject invalid or negative values', () => {
      assert.equal(checkCodEligibility(-50).policyCode, 'INVALID_INPUT');
    });
  });

  describe('Brand Knowledge Retrieval', () => {
    it('should return brand overview with Indian organic positioning', () => {
      const policy = getBrandPolicy();
      assert.ok(policy);
      assert.match(policy.brand.name, /Aura Skincare/);
      assert.match(policy.brand.description, /organic Indian skincare/i);
    });

    it('should return specific sub-policies when requested', () => {
      const shipping = getBrandPolicy('shipping');
      assert.ok(shipping);
      // @ts-expect-error Checking property on union
      assert.equal(shipping.freeShippingThresholdInr, 499);
    });
  });
});
