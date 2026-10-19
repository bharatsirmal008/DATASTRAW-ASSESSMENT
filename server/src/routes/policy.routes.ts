import { Router } from 'express';
import { getPolicies, evaluatePolicy } from '../controllers/policy.controller';

const router = Router();

// GET /api/policies - Brand overview and published policies
router.get('/', getPolicies);

// POST /api/policies/evaluate - Business policy evaluation guardrails
router.post('/evaluate', evaluatePolicy);

export default router;
