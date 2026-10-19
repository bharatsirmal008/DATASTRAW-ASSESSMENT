export interface BrandOverview {
  name: string;
  tagline: string;
  description: string;
  principles: string[];
}

export interface ShippingPolicy {
  freeShippingThresholdInr: number;
  standardShippingFeeInr: number;
  deliveryTimeframe: string;
  boundaryNote: string;
}

export interface CancellationPolicy {
  cancellableStatuses: string[];
  nonCancellableStatuses: string[];
  doorstepRefusalAllowed: boolean;
  ruleDescription: string;
}

export interface ReturnPolicy {
  windowDays: number;
  acceptedConditions: string[];
  ruleDescription: string;
}

export interface DamageReplacementPolicy {
  windowHours: number;
  photosRequired: boolean;
  ruleDescription: string;
}

export interface CodPolicy {
  maxThresholdInr: number;
  acceptedPaymentModes: string[];
  ruleDescription: string;
}

export interface BrandPolicies {
  brand: BrandOverview;
  shipping: ShippingPolicy;
  cancellation: CancellationPolicy;
  returns: ReturnPolicy;
  damageReplacement: DamageReplacementPolicy;
  cashOnDelivery: CodPolicy;
}

export const BRAND_POLICIES: BrandPolicies = {
  brand: {
    name: 'Aura Skincare',
    tagline: 'Simple, effective, organic Indian skincare',
    description:
      'Aura Skincare is a premium organic Indian skincare brand focused on simple, effective skincare made from thoughtfully selected ingredients.',
    principles: [
      'Simple, effective formulations',
      'Thoughtfully selected organic ingredients',
      'Transparent customer-first policies',
    ],
  },
  shipping: {
    freeShippingThresholdInr: 499,
    standardShippingFeeInr: 50,
    deliveryTimeframe: '3–5 business days',
    boundaryNote:
      'Free shipping applies strictly above ₹499. Standard ₹50 fee applies strictly below ₹499. The policy does not specify the rate for orders of exactly ₹499 (UNSPECIFIED_POLICY_BOUNDARY).',
  },
  cancellation: {
    cancellableStatuses: ['Processing'],
    nonCancellableStatuses: ['Shipped', 'Out for Delivery', 'Delivered'],
    doorstepRefusalAllowed: true,
    ruleDescription:
      'Cancellation is only allowed if the order status is Processing. Once an order is Shipped or Out for Delivery, it cannot be cancelled, but customers may refuse delivery at the doorstep. Delivered orders cannot be cancelled.',
  },
  returns: {
    windowDays: 7,
    acceptedConditions: ['unopened', 'unused', 'in original packaging'],
    ruleDescription:
      'Returns accepted within 7 days of delivery if unopened, unused, and in original packaging.',
  },
  damageReplacement: {
    windowHours: 48,
    photosRequired: true,
    ruleDescription:
      'Damaged or defective products must be reported within 48 hours of delivery with photos for replacement.',
  },
  cashOnDelivery: {
    maxThresholdInr: 2500,
    acceptedPaymentModes: ['Cash', 'UPI'],
    ruleDescription:
      'Cash on Delivery (COD) is available for orders up to and including ₹2,500. Customers can pay by cash or UPI at the doorstep.',
  },
};
