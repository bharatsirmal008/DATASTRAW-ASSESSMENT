import { Request, Response } from 'express';
import {
  createSession,
  getSession,
  endSession,
  attachPostCallData,
} from '../services/session.service';
import { processUserMessage } from '../services/conversation.service';
import { processSessionTranscript } from '../services/transcript.service';
import { generateCallSummary } from '../services/summary.service';
import { calculateCallAnalytics } from '../services/analytics.service';
import type { SummaryMode } from '../types/summary.types';
import { requireLiveAI } from '../services/readiness.service';

/**
 * Helper to ensure a session has generated summary and analytics.
 */
async function ensurePostCallArtifacts(
  session: any,
  forceMode?: SummaryMode
): Promise<{ summary: any; analytics: any }> {
  let summary = session.summary;
  if (!summary || forceMode) {
    summary = await generateCallSummary(session, forceMode);
  }

  let analytics = session.analytics;
  if (!analytics || forceMode) {
    analytics = calculateCallAnalytics(session, summary);
  }

  attachPostCallData(session.id, summary, analytics);
  return { summary, analytics };
}

/**
 * POST /api/conversations/sessions
 * Initializes a new conversation session.
 */
export function createSessionHandler(_req: Request, res: Response): void {
  try {
    requireLiveAI();
    const session = createSession();
    res.status(201).json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'SESSION_CREATION_FAILED',
        message: error.status === 503 ? error.message : 'Could not initialize conversation session.',
      },
    });
  }
}

/**
 * GET /api/conversations/sessions/:sessionId
 * Retrieves session status and message history.
 */
export function getSessionHandler(req: Request, res: Response): void {
  try {
    const rawId = req.params.sessionId;
    const sessionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const session = getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Conversation session "${sessionId}" was not found or has expired.`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching the session.',
      },
    });
  }
}

/**
 * POST /api/conversations/sessions/:sessionId/messages
 * Sends a user message and returns Aria's response with tool execution metadata.
 */
export async function postMessageHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.sessionId;
    const sessionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { message, language } = req.body || {};

    if (message === undefined || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Field "message" (string) is required.',
        },
      });
      return;
    }

    if (language !== undefined && language !== 'en' && language !== 'hi') {
      res.status(400).json({ success: false, error: { code: 'INVALID_LANGUAGE', message: 'Language must be en or hi.' } });
      return;
    }
    const result = await processUserMessage(sessionId, message, language);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const status = error.status || (error.code === 'SESSION_NOT_FOUND' ? 404 : error.code === 'SESSION_ENDED' ? 409 : 500);
    res.status(status).json({
      success: false,
      error: {
        code: error.code || 'CONVERSATION_ERROR',
        message: error.message || 'An error occurred during message processing.',
      },
    });
  }
}

/**
 * POST /api/conversations/sessions/:sessionId/end
 * Marks a conversation session as ENDED, computes post-call summary and analytics.
 */
export async function endSessionHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.sessionId;
    const sessionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const session = endSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Conversation session "${sessionId}" was not found.`,
        },
      });
      return;
    }

    const { summary, analytics } = await ensurePostCallArtifacts(session);
    const transcript = processSessionTranscript(session);

    res.status(200).json({
      success: true,
      data: {
        session,
        summary,
        analytics,
        transcript,
      },
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An error occurred while ending the session.',
      },
    });
  }
}

/**
 * GET /api/conversations/sessions/:sessionId/postcall
 * Retrieves comprehensive post-call bundle: transcript, summary, analytics.
 */
export async function getPostCallHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.sessionId;
    const sessionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const session = getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Conversation session "${sessionId}" was not found or has expired.`,
        },
      });
      return;
    }

    const transcript = processSessionTranscript(session);
    const { summary, analytics } = await ensurePostCallArtifacts(session);

    res.status(200).json({
      success: true,
      data: {
        session,
        transcript,
        summary,
        analytics,
        mode: summary.summary_mode,
      },
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An error occurred while retrieving post-call data.',
      },
    });
  }
}

/**
 * POST /api/conversations/sessions/:sessionId/summary/retry
 * Re-runs post-call summary generation (useful if customer toggles mode or previous run failed).
 */
export async function retrySummaryHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.sessionId;
    const sessionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const session = getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Conversation session "${sessionId}" was not found.`,
        },
      });
      return;
    }

    const requestedMode = req.body?.mode as SummaryMode | undefined;
    const summary = await generateCallSummary(session, requestedMode);
    const analytics = calculateCallAnalytics(session, summary);
    attachPostCallData(sessionId, summary, analytics);

    res.status(200).json({
      success: true,
      data: {
        session,
        summary,
        analytics,
      },
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: error.code || 'SUMMARY_RETRY_FAILED',
        message: error.message || 'Failed to re-generate call summary.',
      },
    });
  }
}

