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

export type PolicyEvaluationStatus = 'eligible' | 'ineligible' | 'unspecified';

export interface PolicyEvaluationResult<T = unknown> {
  status: PolicyEvaluationStatus;
  policyCode: string;
  message: string;
  details?: T;
}
