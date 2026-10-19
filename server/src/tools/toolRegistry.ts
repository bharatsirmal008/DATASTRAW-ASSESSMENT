import { get_order_details } from './getOrderDetails';
import { CATALOG_TOOLS } from './catalogTools';
import { isCatalogConfigured } from '../services/catalog.service';
import {
  calculateShippingFee,
  checkCancellationEligibility,
  checkReturnEligibility,
  checkDamageReplacementEligibility,
  checkCodEligibility,
  getBrandPolicy,
} from '../services/policy.service';

export interface ToolParameterSchema {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required: string[];
  };
  execute: (args: any) => Promise<any>;
}

export const TOOLS: Record<string, ToolDefinition> = {
  ...CATALOG_TOOLS,
  get_order_details: {
    name: 'get_order_details',
    description:
      'Retrieves verified details of an Aura Skincare order (customer, product, status, courier, tracking, ETA) from the connected store. If the store is unavailable, report the error and never invent order data.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The actual customer-provided order identifier.',
        },
      },
      required: ['order_id'],
    },
    execute: async (args: { order_id: string }) => {
      const result = await get_order_details(args.order_id);
      return result.found ? { ...result, cancellationEligibility: checkCancellationEligibility(result.order.status) } : result;
    },
  },

  check_cancellation_eligibility: {
    name: 'check_cancellation_eligibility',
    description:
      'Checks whether an order is eligible for cancellation based on its current status. Note: This check is read-only and does NOT cancel the order.',
    parameters: {
      type: 'object',
      properties: {
        order_status: {
          type: 'string',
          description:
            'Current status of the order (e.g., "Processing", "Shipped", "Out for Delivery", "Delivered").',
        },
      },
      required: ['order_status'],
    },
    execute: async (args: { order_status: string }) => {
      return checkCancellationEligibility(args.order_status);
    },
  },

  calculate_shipping_fee: {
    name: 'calculate_shipping_fee',
    description:
      'Calculates the shipping fee for an order value in INR according to Aura Skincare policy (free above ₹499, ₹50 below ₹499, ambiguous at exactly ₹499).',
    parameters: {
      type: 'object',
      properties: {
        order_value_inr: {
          type: 'number',
          description: 'The total value of the order in INR.',
        },
      },
      required: ['order_value_inr'],
    },
    execute: async (args: { order_value_inr: number }) => {
      return calculateShippingFee(args.order_value_inr);
    },
  },

  check_return_eligibility: {
    name: 'check_return_eligibility',
    description:
      'Checks return eligibility for an order based on days since delivery, opened status, used status, and original packaging.',
    parameters: {
      type: 'object',
      properties: {
        days_since_delivery: {
          type: 'number',
          description: 'Number of days elapsed since the item was delivered.',
        },
        is_unopened: {
          type: 'boolean',
          description: 'Whether the item has remained unopened.',
        },
        is_unused: {
          type: 'boolean',
          description: 'Whether the item has remained unused.',
        },
        has_original_packaging: {
          type: 'boolean',
          description: 'Whether the original packaging is intact.',
        },
      },
      required: ['days_since_delivery', 'is_unopened', 'is_unused', 'has_original_packaging'],
    },
    execute: async (args: {
      days_since_delivery: number;
      is_unopened: boolean;
      is_unused: boolean;
      has_original_packaging: boolean;
    }) => {
      return checkReturnEligibility(
        args.days_since_delivery,
        args.is_unopened,
        args.is_unused,
        args.has_original_packaging
      );
    },
  },

  check_damage_replacement_eligibility: {
    name: 'check_damage_replacement_eligibility',
    description:
      'Checks if a damaged or defective product qualifies for a free replacement (within 48 hours and with photos).',
    parameters: {
      type: 'object',
      properties: {
        hours_since_delivery: {
          type: 'number',
          description: 'Hours since the product was delivered.',
        },
        has_photos: {
          type: 'boolean',
          description: 'Whether clear photos of the damage/defect are provided.',
        },
      },
      required: ['hours_since_delivery', 'has_photos'],
    },
    execute: async (args: { hours_since_delivery: number; has_photos: boolean }) => {
      return checkDamageReplacementEligibility(args.hours_since_delivery, args.has_photos);
    },
  },

  check_cod_eligibility: {
    name: 'check_cod_eligibility',
    description:
      'Checks if an order value qualifies for Cash on Delivery (COD) (up to ₹2,500 payable by Cash or UPI at doorstep).',
    parameters: {
      type: 'object',
      properties: {
        order_value_inr: {
          type: 'number',
          description: 'Total order value in INR.',
        },
      },
      required: ['order_value_inr'],
    },
    execute: async (args: { order_value_inr: number }) => {
      return checkCodEligibility(args.order_value_inr);
    },
  },

  get_brand_policies: {
    name: 'get_brand_policies',
    description:
      'Retrieves the official published Aura Skincare brand policies and philosophy.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return getBrandPolicy();
    },
  },
};

/**
 * Safely executes a registered tool with argument validation and non-sensitive logging.
 */
export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  const tool = getAvailableTools()[name];
  if (!tool) {
    throw new Error(`Tool "${name}" is not registered in the active tool registry.`);
  }

  // Non-sensitive logging
  console.log(`[Tool Registry] Executing tool: ${name}`);

  try {
    return await tool.execute(args);
  } catch (err) {
    console.error(`[Tool Registry] Error executing ${name}`);
    throw err;
  }
}

/**
 * Returns all registered tools.
 */
export function getRegisteredTools(): ToolDefinition[] {
  return Object.values(TOOLS);
}

export function getAvailableTools(): Record<string, ToolDefinition> {
  return isCatalogConfigured() ? CATALOG_TOOLS : Object.fromEntries(Object.entries(TOOLS).filter(([name]) => !(name in CATALOG_TOOLS)));
}

