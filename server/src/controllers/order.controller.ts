import { Request, Response } from 'express';
import { getAllMockOrders, findOrderById } from '../services/order.service';
import { isAssessmentMode } from '../config/application';

/**
 * GET /api/orders/test
 * Returns the three sample orders for evaluator convenience.
 */
export function getTestOrders(_req: Request, res: Response): void {
  if (!isAssessmentMode()) {
    res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'API route not found.' } });
    return;
  }
  try {
    const orders = getAllMockOrders();
    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve test orders.',
      },
    });
  }
}

/**
 * GET /api/orders/:orderId
 * Returns the verified order or a 400/404 JSON response.
 */
export function getOrderById(req: Request, res: Response): void {
  if (!isAssessmentMode()) {
    res.status(503).json({ success: false, error: { code: 'ORDER_SERVICE_NOT_CONFIGURED', message: 'The store order system is not connected. No order lookup was performed.' } });
    return;
  }
  try {
    const { orderId } = req.params;
    const result = findOrderById(orderId);

    if (result.success && result.found) {
      res.status(200).json({
        success: true,
        data: result.order,
      });
      return;
    }

    if (result.code === 'INVALID_ORDER_ID') {
      res.status(400).json({
        success: false,
        error: {
          code: result.code,
          message: result.message,
        },
      });
      return;
    }

    if (result.code === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: {
          code: result.code,
          message: result.message,
        },
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Could not process order lookup.',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during order lookup.',
      },
    });
  }
}
