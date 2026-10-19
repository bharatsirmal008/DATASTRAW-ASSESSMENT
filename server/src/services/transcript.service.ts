import { getSession, type ConversationSession, type ConversationMessage } from './session.service';
import type { ProcessedTranscript, StructuredTranscriptMessage } from '../types/summary.types';

function getFreshSession(sessionInput: ConversationSession): ConversationSession {
  if (sessionInput && sessionInput.id) {
    const fromStore = getSession(sessionInput.id);
    if (fromStore && fromStore.messages.length >= sessionInput.messages.length) {
      return fromStore;
    }
  }
  return sessionInput;
}

/**
 * Formats an ISO-8601 date string into a friendly HH:MM:SS or HH:MM display.
 */
function formatTimestamp(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Processes stored session messages into an authoritative, deduplicated
 * structured transcript and human-readable plain text export.
 */
export function processSessionTranscript(sessionInput: ConversationSession): ProcessedTranscript {
  const session = getFreshSession(sessionInput);
  const seenIds = new Set<string>();
  const structuredMessages: StructuredTranscriptMessage[] = [];

  for (const msg of session.messages) {
    // Deduplicate by stable message ID while preserving intentional repeated user words
    if (seenIds.has(msg.id)) {
      continue;
    }
    seenIds.add(msg.id);

    const speaker: 'CUSTOMER' | 'ARIA' = msg.role === 'user' ? 'CUSTOMER' : 'ARIA';
    structuredMessages.push({
      id: msg.id,
      speaker,
      text: msg.content,
      timestamp: msg.createdAt,
      toolCalls: msg.toolCalls,
    });
  }

  // Construct human-readable plain text format for download/review
  const textLines: string[] = [];
  textLines.push(`AURA SKINCARE — CALL TRANSCRIPT`);
  textLines.push(`Session ID: ${session.id}`);
  textLines.push(`Started At: ${session.createdAt}`);
  if (session.endedAt) {
    textLines.push(`Ended At:   ${session.endedAt}`);
  }
  textLines.push(`----------------------------------------\n`);

  if (structuredMessages.length === 0) {
    textLines.push(`[No messages recorded during this call]`);
  } else {
    for (const msg of structuredMessages) {
      const timeStr = formatTimestamp(msg.timestamp);
      const speakerLabel = msg.speaker === 'CUSTOMER' ? 'Customer' : 'Aria';
      const timePrefix = timeStr ? `[${timeStr}] ` : '';
      textLines.push(`${timePrefix}${speakerLabel}: ${msg.text}`);

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          textLines.push(`   [Tool Executed: ${tc.name} — ${tc.resultSummary || 'Completed'}]`);
        }
      }
      textLines.push('');
    }
  }

  return {
    messages: structuredMessages,
    plainText: textLines.join('\n').trim(),
  };
}
