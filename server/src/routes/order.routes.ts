import { Router } from 'express';
import { getTestOrders, getOrderById } from '../controllers/order.controller';

const router = Router();

// GET /api/orders/test - Evaluator test fixture
router.get('/test', getTestOrders);

// GET /api/orders/:orderId - Order lookup by ID
router.get('/:orderId', getOrderById);

export default router;
