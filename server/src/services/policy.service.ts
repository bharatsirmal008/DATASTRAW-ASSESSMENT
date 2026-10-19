import { BRAND_POLICIES, BrandPolicies } from '../knowledge/brandPolicies';

export type PolicyEvaluationStatus = 'eligible' | 'ineligible' | 'unspecified';

export interface PolicyEvaluationResult<T = unknown> {
  status: PolicyEvaluationStatus;
  policyCode: string;
  message: string;
  details?: T;
}

/**
 * Calculates shipping fee for Aura Skincare orders.
 * Policy:
 * - Free shipping for order values strictly above ₹499.
 * - ₹50 shipping charge for values strictly below ₹499.
 * - Exact ₹499 is ambiguous in brand documentation -> UNSPECIFIED_POLICY_BOUNDARY.
 */
export function calculateShippingFee(orderValueInr: number): PolicyEvaluationResult<{ feeInr?: number }> {
  if (typeof orderValueInr !== 'number' || isNaN(orderValueInr) || orderValueInr < 0) {
    return {
      status: 'ineligible',
      policyCode: 'INVALID_INPUT',
      message: 'Order value must be a valid non-negative number.',
    };
  }

  if (orderValueInr > 499) {
    return {
      status: 'eligible',
      policyCode: 'FREE_SHIPPING',
      message: 'Orders strictly above ₹499 qualify for free standard delivery.',
      details: { feeInr: 0 },
    };
  }

  if (orderValueInr < 499) {
    return {
      status: 'eligible',
      policyCode: 'STANDARD_SHIPPING_FEE',
      message: 'Orders strictly below ₹499 incur a standard shipping charge of ₹50.',
      details: { feeInr: 50 },
    };
  }

  // orderValueInr === 499
  return {
    status: 'unspecified',
    policyCode: 'UNSPECIFIED_POLICY_BOUNDARY',
    message:
      'The Aura Skincare policy does not specify shipping rates for orders of exactly ₹499. Please confirm with support.',
    details: {},
  };
}

/**
 * Checks cancellation eligibility.
 * Policy:
 * - Cancellation is allowed ONLY if order status is Processing.
 * - Once Shipped or Out for Delivery, it cannot be cancelled; customer may refuse delivery at doorstep.
 * - Delivered orders cannot be cancelled.
 * - IMPORTANT: This function ONLY evaluates eligibility and does NOT cancel or mutate any order.
 */
export function checkCancellationEligibility(orderStatus: string): PolicyEvaluationResult<{ doorstepRefusalAllowed?: boolean }> {
  if (!orderStatus || typeof orderStatus !== 'string' || !orderStatus.trim()) {
    return {
      status: 'ineligible',
      policyCode: 'INVALID_INPUT',
      message: 'A valid order status string is required.',
    };
  }

  const normalized = orderStatus.trim().toLowerCase();

  if (normalized === 'processing') {
    return {
      status: 'eligible',
      policyCode: 'CANCELLATION_ELIGIBLE',
      message:
        'Order is in Processing status and is eligible for cancellation. (Note: Eligibility check does not cancel or modify the order).',
      details: { doorstepRefusalAllowed: false },
    };
  }

  if (normalized === 'shipped' || normalized === 'out for delivery') {
    return {
      status: 'ineligible',
      policyCode: 'CANCELLATION_INELIGIBLE_IN_TRANSIT',
      message:
        `Orders that are ${orderStatus.trim()} cannot be cancelled once dispatched. However, customers may refuse delivery at the doorstep.`,
      details: { doorstepRefusalAllowed: true },
    };
  }

  if (normalized === 'delivered') {
    return {
      status: 'ineligible',
      policyCode: 'CANCELLATION_INELIGIBLE_DELIVERED',
      message:
        'Order is already Delivered and cannot be cancelled. Cancellation is strictly limited to orders in Processing status.',
      details: { doorstepRefusalAllowed: false },
    };
  }

  if (normalized === 'cancelled') {
    return {
      status: 'ineligible',
      policyCode: 'ALREADY_CANCELLED',
      message: 'Order has already been cancelled.',
      details: { doorstepRefusalAllowed: false },
    };
  }

  return {
    status: 'unspecified',
    policyCode: 'UNKNOWN_STATUS',
    message: `Unknown order status "${orderStatus}". Cancellation eligibility cannot be determined.`,
  };
}

/**
 * Checks return eligibility.
 * Policy:
 * - Returns accepted within 7 days of delivery.
 * - Must be unopened, unused, and in original packaging.
 * - Boundary: exactly 7 days is permitted if other conditions met; > 7 days is not.
 */
export function checkReturnEligibility(
  daysSinceDelivery: number,
  isUnopened: boolean,
  isUnused: boolean,
  hasOriginalPackaging: boolean
): PolicyEvaluationResult {
  if (typeof daysSinceDelivery !== 'number' || isNaN(daysSinceDelivery) || daysSinceDelivery < 0) {
    return {
      status: 'ineligible',
      policyCode: 'INVALID_INPUT',
      message: 'daysSinceDelivery must be a valid non-negative number.',
    };
  }

  if (
    typeof isUnopened !== 'boolean' ||
    typeof isUnused !== 'boolean' ||
    typeof hasOriginalPackaging !== 'boolean'
  ) {
    return {
      status: 'ineligible',
      policyCode: 'INVALID_INPUT',
      message: 'isUnopened, isUnused, and hasOriginalPackaging must be boolean values.',
    };
  }

  if (daysSinceDelivery > 7) {
    return {
      status: 'ineligible',
      policyCode: 'RETURN_WINDOW_EXPIRED',
      message: `Return window expired. Aura Skincare accepts returns within 7 days of delivery (${daysSinceDelivery} days have elapsed).`,
    };
  }

  if (!isUnopened || !isUnused || !hasOriginalPackaging) {
    const failedReasons: string[] = [];
    if (!isUnopened) failedReasons.push('item has been opened');
    if (!isUnused) failedReasons.push('item has been used');
    if (!hasOriginalPackaging) failedReasons.push('item is missing original packaging');

    return {
      status: 'ineligible',
      policyCode: 'RETURN_CONDITION_NOT_MET',
      message: `Item does not meet return conditions: ${failedReasons.join(', ')}. All products must be unopened, unused, and in original packaging.`,
    };
  }

  return {
    status: 'eligible',
    policyCode: 'RETURN_ELIGIBLE',
    message:
      'Eligible for return: Within the 7-day delivery window and items are unopened, unused, with original packaging.',
  };
}

/**
 * Checks damage/defect replacement eligibility.
 * Policy:
 * - Must be reported within 48 hours of delivery.
 * - Requires photographic evidence for replacement.
 * - Boundary: exactly 48 hours qualifies if photos are provided; > 48 hours does not.
 */
export function checkDamageReplacementEligibility(
  hoursSinceDelivery: number,
  hasPhotos: boolean
): PolicyEvaluationResult {
  if (typeof hoursSinceDelivery !== 'number' || isNaN(hoursSinceDelivery) || hoursSinceDelivery < 0) {
    return {
      status: 'ineligible',
      policyCode: 'INVALID_INPUT',
      message: 'hoursSinceDelivery must be a valid non-negative number.',
    };
  }

  if (typeof hasPhotos !== 'boolean') {
    return {
      status: 'ineligible',
      policyCode: 'INVALID_INPUT',
      message: 'hasPhotos must be a boolean.',
    };
  }

  if (hoursSinceDelivery > 48) {
    return {
      status: 'ineligible',
      policyCode: 'DAMAGE_REPORTING_WINDOW_EXPIRED',
      message: `Reporting window expired. Damaged or defective products must be reported within 48 hours of delivery (${hoursSinceDelivery} hours have elapsed).`,
    };
  }

  if (!hasPhotos) {
    return {
      status: 'ineligible',
      policyCode: 'PHOTOS_REQUIRED',
      message:
        'Photographic evidence is required for replacement of damaged or defective items.',
    };
  }

  return {
    status: 'eligible',
    policyCode: 'DAMAGE_REPLACEMENT_ELIGIBLE',
    message:
      'Eligible for replacement: Reported within 48 hours of delivery with photographic evidence.',
  };
}

/**
 * Checks Cash on Delivery (COD) eligibility.
 * Policy:
 * - COD is available for orders up to and including ₹2,500.
 * - Payable via Cash or UPI at doorstep.
 * - Boundary: exactly ₹2,500 is eligible; ₹2,501+ is not.
 */
export function checkCodEligibility(orderValueInr: number): PolicyEvaluationResult<{ acceptedPaymentModes?: string[] }> {
  if (typeof orderValueInr !== 'number' || isNaN(orderValueInr) || orderValueInr < 0) {
    return {
      status: 'ineligible',
      policyCode: 'INVALID_INPUT',
      message: 'orderValueInr must be a valid non-negative number.',
    };
  }

  if (orderValueInr <= 2500) {
    return {
      status: 'eligible',
      policyCode: 'COD_ELIGIBLE',
      message:
        'Cash on Delivery is available for this order (up to ₹2,500). Payment can be made via Cash or UPI at doorstep.',
      details: { acceptedPaymentModes: ['Cash', 'UPI'] },
    };
  }

  return {
    status: 'ineligible',
    policyCode: 'COD_THRESHOLD_EXCEEDED',
    message: `Cash on Delivery is only available for orders up to and including ₹2,500 (order value is ₹${orderValueInr}). Please choose a prepaid payment option.`,
  };
}

/**
 * Retrieves the published brand policy document or specific sub-policy.
 */
export function getBrandPolicy(
  policyType?: keyof BrandPolicies | string
): BrandPolicies | BrandPolicies[keyof BrandPolicies] | null {
  if (!policyType) {
    return BRAND_POLICIES;
  }

  const key = policyType as keyof BrandPolicies;
  if (key in BRAND_POLICIES) {
    return BRAND_POLICIES[key];
  }

  return null;
}
