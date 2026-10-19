import { Request, Response } from 'express';
import {
  getBrandPolicy,
  calculateShippingFee,
  checkCancellationEligibility,
  checkReturnEligibility,
  checkDamageReplacementEligibility,
  checkCodEligibility,
  PolicyEvaluationResult,
} from '../services/policy.service';

/**
 * GET /api/policies
 * Returns brand overview and structured published policies.
 */
export function getPolicies(_req: Request, res: Response): void {
  try {
    const policies = getBrandPolicy();
    res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve brand policies.',
      },
    });
  }
}

/**
 * POST /api/policies/evaluate
 * Evaluates business policy guardrails with a discriminated payload.
 */
export function evaluatePolicy(req: Request, res: Response): void {
  try {
    const { policyType } = req.body || {};

    if (!policyType || typeof policyType !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_POLICY_TYPE',
          message:
            'Field "policyType" is required and must be one of: SHIPPING, CANCELLATION, RETURN, DAMAGE_REPLACEMENT, COD.',
        },
      });
      return;
    }

    let evaluationResult: PolicyEvaluationResult;

    switch (policyType.toUpperCase()) {
      case 'SHIPPING': {
        const { orderValueInr } = req.body;
        if (orderValueInr === undefined || typeof orderValueInr !== 'number') {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Field "orderValueInr" (number) is required for SHIPPING evaluation.',
            },
          });
          return;
        }
        evaluationResult = calculateShippingFee(orderValueInr);
        break;
      }

      case 'CANCELLATION': {
        const { orderStatus } = req.body;
        if (!orderStatus || typeof orderStatus !== 'string') {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Field "orderStatus" (string) is required for CANCELLATION evaluation.',
            },
          });
          return;
        }
        evaluationResult = checkCancellationEligibility(orderStatus);
        break;
      }

      case 'RETURN': {
        const { daysSinceDelivery, isUnopened, isUnused, hasOriginalPackaging } = req.body;
        if (
          daysSinceDelivery === undefined ||
          typeof daysSinceDelivery !== 'number' ||
          typeof isUnopened !== 'boolean' ||
          typeof isUnused !== 'boolean' ||
          typeof hasOriginalPackaging !== 'boolean'
        ) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message:
                'Fields "daysSinceDelivery" (number), "isUnopened" (boolean), "isUnused" (boolean), and "hasOriginalPackaging" (boolean) are required for RETURN evaluation.',
            },
          });
          return;
        }
        evaluationResult = checkReturnEligibility(
          daysSinceDelivery,
          isUnopened,
          isUnused,
          hasOriginalPackaging
        );
        break;
      }

      case 'DAMAGE_REPLACEMENT': {
        const { hoursSinceDelivery, hasPhotos } = req.body;
        if (
          hoursSinceDelivery === undefined ||
          typeof hoursSinceDelivery !== 'number' ||
          typeof hasPhotos !== 'boolean'
        ) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message:
                'Fields "hoursSinceDelivery" (number) and "hasPhotos" (boolean) are required for DAMAGE_REPLACEMENT evaluation.',
            },
          });
          return;
        }
        evaluationResult = checkDamageReplacementEligibility(hoursSinceDelivery, hasPhotos);
        break;
      }

      case 'COD': {
        const { orderValueInr } = req.body;
        if (orderValueInr === undefined || typeof orderValueInr !== 'number') {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Field "orderValueInr" (number) is required for COD evaluation.',
            },
          });
          return;
        }
        evaluationResult = checkCodEligibility(orderValueInr);
        break;
      }

      default:
        res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_POLICY_TYPE',
            message: `Unsupported policyType "${policyType}". Supported: SHIPPING, CANCELLATION, RETURN, DAMAGE_REPLACEMENT, COD.`,
          },
        });
        return;
    }

    res.status(200).json({
      success: true,
      data: evaluationResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while evaluating the policy.',
      },
    });
  }
}
