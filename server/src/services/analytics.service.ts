import { getSession, type ConversationSession } from './session.service';
import type { CallAnalytics, StructuredCallOutcome } from '../types/summary.types';

function getFreshSession(sessionInput: ConversationSession): ConversationSession {
  if (sessionInput && sessionInput.id) {
    const fromStore = getSession(sessionInput.id);
    if (fromStore && fromStore.messages.length >= sessionInput.messages.length) {
      return fromStore;
    }
  }
  return sessionInput;
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null || isNaN(seconds) || seconds < 0) {
    return 'N/A';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

/**
 * Calculates factual, deterministic analytics for a completed session.
 * Does NOT invent arbitrary CSAT, sentiment, or audio scores.
 */
export function calculateCallAnalytics(
  sessionInput: ConversationSession,
  summary: StructuredCallOutcome
): CallAnalytics {
  const session = getFreshSession(sessionInput);
  const startedAt = session.createdAt;
  const endedAt = session.endedAt || session.updatedAt || null;

  let durationSeconds: number | null = null;
  if (startedAt && endedAt) {
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(endedAt).getTime();
    if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
      durationSeconds = Math.round((endMs - startMs) / 1000);
    }
  }

  let customerTurns = 0;
  let assistantTurns = 0;
  const executedToolNames: string[] = [];

  for (const msg of session.messages) {
    if (msg.role === 'user') {
      customerTurns++;
    } else if (msg.role === 'assistant') {
      assistantTurns++;
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          executedToolNames.push(tc.name);
        }
      }
    }
  }

  const uniqueTools = Array.from(new Set(executedToolNames));

  return {
    sessionId: session.id,
    startedAt,
    endedAt,
    durationSeconds,
    formattedDuration: formatDurationSeconds(durationSeconds),
    customerTurns,
    assistantTurns,
    totalMessages: session.messages.length,
    toolExecutionCount: executedToolNames.length,
    uniqueToolsUsed: uniqueTools,
    primaryIntent: summary.customer_intent,
    resolutionStatus: summary.resolution_status,
    orderIdsReferenced: summary.order_ids.length,
  };
}
