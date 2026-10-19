import { Router } from 'express';
import {
  createSessionHandler,
  getSessionHandler,
  postMessageHandler,
  endSessionHandler,
  getPostCallHandler,
  retrySummaryHandler,
  getCallHistoryHandler,
} from '../controllers/conversation.controller';

const router = Router();

// GET /api/conversations/history - Completed sessions history (must precede /:sessionId)
router.get('/history', getCallHistoryHandler);

// POST /api/conversations/sessions - Initialize new session
router.post('/sessions', createSessionHandler);

// GET /api/conversations/sessions/:sessionId - Get session and messages
router.get('/sessions/:sessionId', getSessionHandler);

// POST /api/conversations/sessions/:sessionId/messages - Send message to Aria
router.post('/sessions/:sessionId/messages', postMessageHandler);

// POST /api/conversations/sessions/:sessionId/end - End session and compute summary
router.post('/sessions/:sessionId/end', endSessionHandler);

// GET /api/conversations/sessions/:sessionId/postcall - Get post-call dashboard data
router.get('/sessions/:sessionId/postcall', getPostCallHandler);

// POST /api/conversations/sessions/:sessionId/summary/retry - Retry summary generation
router.post('/sessions/:sessionId/summary/retry', retrySummaryHandler);

export default router;
