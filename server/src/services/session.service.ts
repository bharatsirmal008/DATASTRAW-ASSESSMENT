import crypto from 'crypto';

export type MessageRole = 'user' | 'assistant';
export type SessionStatus = 'ACTIVE' | 'ENDED';

export interface ToolCallSummary {
  name: string;
  args: Record<string, unknown>;
  resultSummary: string;
}

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  toolCalls?: ToolCallSummary[];
}

export interface SessionContext {
  responseLanguage?: 'en' | 'hi';
  latestProductId?: string;
  recentCatalogProducts?: Array<{ id: string; name: string }>;
  latestOrderId?: string;
  pendingIntent?: import('../providers/conversation.utils').SupportIntent | null;
  lastIntent?: import('../providers/conversation.utils').SupportIntent;
  returnDetails?: { days?: number; opened?: boolean; used?: boolean; packaging?: boolean };
  damageDetails?: { hours?: number; photos?: boolean };
}

export interface ConversationSession {
  id: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  summary?: any;
  analytics?: any;
  messages: ConversationMessage[];
  context: SessionContext;
}

// In-memory session store (bounded lifetime, resets on server restart)
const sessions = new Map<string, ConversationSession>();

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_TOTAL_SESSIONS = 500;

/**
 * Creates a new active conversation session.
 */
export function createSession(): ConversationSession {
  cleanupExpiredSessions();

  if (sessions.size >= MAX_TOTAL_SESSIONS) {
    // Evict oldest session to maintain bounded memory
    const oldestKey = sessions.keys().next().value;
    if (oldestKey) sessions.delete(oldestKey);
  }

  const now = new Date().toISOString();
  const session: ConversationSession = {
    id: crypto.randomUUID(),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: {},
  };

  sessions.set(session.id, session);
  return { ...session, messages: [...session.messages], context: { ...session.context } };
}

/**
 * Retrieves an existing session by ID, returning null if expired or missing.
 */
export function getSession(sessionId: string): ConversationSession | null {
  if (!sessionId || typeof sessionId !== 'string') return null;
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check TTL
  const lastActive = new Date(session.updatedAt).getTime();
  if (Date.now() - lastActive > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }

  return {
    ...session,
    messages: [...session.messages],
    context: { ...session.context },
  };
}

/**
 * Adds a message to an active session. Throws if session is missing or ended.
 */
export function addMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  toolCalls?: ToolCallSummary[]
): ConversationMessage {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  if (session.status === 'ENDED') {
    throw new Error('SESSION_ENDED');
  }

  const message: ConversationMessage = {
    id: crypto.randomUUID(),
    role,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
  };

  session.messages.push(message);

  // Preserve the full transcript. Providers bound their reasoning context separately.

  session.updatedAt = new Date().toISOString();
  return { ...message };
}

/**
 * Updates context for a session (e.g. latest confirmed orderId).
 */
export function updateSessionContext(sessionId: string, patch: Partial<SessionContext>): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.context = {
    ...session.context,
    ...patch,
  };
  session.updatedAt = new Date().toISOString();
}

/**
 * Marks a session as ENDED idempotently.
 */
export function endSession(sessionId: string): ConversationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.status = 'ENDED';
  if (!session.endedAt) {
    session.endedAt = new Date().toISOString();
  }
  session.updatedAt = new Date().toISOString();
  return { ...session, messages: [...session.messages], context: { ...session.context } };
}

/**
 * Attaches generated summary and analytics to session cache.
 */
export function attachPostCallData(sessionId: string, summary: any, analytics: any): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.summary = summary;
  session.analytics = analytics;
  session.updatedAt = new Date().toISOString();
}

/**
 * Retrieves completed sessions for call history with bounded pagination.
 */
export function getCompletedSessions(limit = 20, offset = 0): {
  sessions: ConversationSession[];
  total: number;
} {
  cleanupExpiredSessions();
  const completed = Array.from(sessions.values())
    .filter((s) => s.status === 'ENDED')
    .sort((a, b) => new Date(b.endedAt || b.updatedAt).getTime() - new Date(a.endedAt || a.updatedAt).getTime());

  const total = completed.length;
  const boundedLimit = Math.max(1, Math.min(limit, 50));
  const boundedOffset = Math.max(0, offset);
  const sliced = completed.slice(boundedOffset, boundedOffset + boundedLimit);

  return {
    sessions: sliced.map((s) => ({
      ...s,
      messages: [...s.messages],
      context: { ...s.context },
    })),
    total,
  };
}

/**
 * Cleans up expired sessions.
 */
export function cleanupExpiredSessions(maxAgeMs = SESSION_TTL_MS): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    const age = now - new Date(session.updatedAt).getTime();
    if (age > maxAgeMs) {
      sessions.delete(id);
    }
  }
}

/**
 * For testing purposes: resets in-memory store.
 */
export function _resetSessionsForTesting(): void {
  sessions.clear();
}
