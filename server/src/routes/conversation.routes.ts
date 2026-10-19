import { Router } from 'express';
import { withSharedSession } from '../services/shared-session.service';
import {
  createSessionHandler,
  getSessionHandler,
  postMessageHandler,
  endSessionHandler,
  getPostCallHandler,
  retrySummaryHandler,
} from '../controllers/conversation.controller';

const router = Router();

// POST /api/conversations/sessions - Initialize new session
router.post('/sessions', withSharedSession(createSessionHandler));

// GET /api/conversations/sessions/:sessionId - Get session and messages
router.get('/sessions/:sessionId', withSharedSession(getSessionHandler));

// POST /api/conversations/sessions/:sessionId/messages - Send message to Aria
router.post('/sessions/:sessionId/messages', withSharedSession(postMessageHandler));

// POST /api/conversations/sessions/:sessionId/end - End session and compute summary
router.post('/sessions/:sessionId/end', withSharedSession(endSessionHandler));

// GET /api/conversations/sessions/:sessionId/postcall - Get post-call dashboard data
router.get('/sessions/:sessionId/postcall', withSharedSession(getPostCallHandler));

// POST /api/conversations/sessions/:sessionId/summary/retry - Retry summary generation
router.post('/sessions/:sessionId/summary/retry', withSharedSession(retrySummaryHandler));

export default router;
