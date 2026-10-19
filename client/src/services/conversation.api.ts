import type { ConversationSession, ConversationTurnResult } from '../types/conversation';
import { detectLanguageRequest } from '../utils/languageRequest';
import type {
  PostCallData,
  StructuredCallOutcome,
  CallAnalytics,
} from '../types/summary';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function createSessionApi(): Promise<ConversationSession> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_URL}/api/conversations/sessions`, {
      method: 'POST',
      signal: controller.signal,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error?.message || `Failed to create session (HTTP ${res.status})`);
    }

    return json.data.session;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSessionApi(sessionId: string): Promise<ConversationSession> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_URL}/api/conversations/sessions/${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error?.message || `Failed to fetch session (HTTP ${res.status})`);
    }

    return json.data.session;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendMessageApi(
  sessionId: string,
  message: string,
  language?: 'en' | 'hi'
): Promise<ConversationTurnResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(
      `${API_URL}/api/conversations/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language: detectLanguageRequest(message) || language }),
        signal: controller.signal,
      }
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const err = new Error(json?.error?.message || `Message failed with status ${res.status}`);
      if (json?.error?.code) {
        (err as Error & { code?: string }).code = json.error.code;
      }
      throw err;
    }

    return json.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Message request timed out. Please check backend connection.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function endSessionApi(sessionId: string): Promise<ConversationSession> {
  const controller = new AbortController();
  // An in-flight answer may hold the shared session lease. Ending is idempotent;
  // retry only an explicit busy response, never blindly replay a customer message.
  const timeout = setTimeout(() => controller.abort(), 65000);

  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(
      `${API_URL}/api/conversations/sessions/${encodeURIComponent(sessionId)}/end`,
      {
        method: 'POST',
        signal: controller.signal,
      }
    );

    const json = await res.json().catch(() => null);
    if (res.status === 409 && json?.error?.code === 'SESSION_BUSY' && attempt < 30 && !controller.signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    if (!res.ok || !json?.success) {
      throw new Error(json?.error?.message || `Failed to end session (HTTP ${res.status})`);
    }

    return json.data.session;
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPostCallApi(sessionId: string): Promise<PostCallData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(
      `${API_URL}/api/conversations/sessions/${encodeURIComponent(sessionId)}/postcall`,
      {
        signal: controller.signal,
      }
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error?.message || `Failed to retrieve post-call data (HTTP ${res.status})`);
    }

    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function retrySummaryApi(
  sessionId: string,
  mode?: 'GEMINI'
): Promise<{
  session: ConversationSession;
  summary: StructuredCallOutcome;
  analytics: CallAnalytics;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(
      `${API_URL}/api/conversations/sessions/${encodeURIComponent(sessionId)}/summary/retry`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
        signal: controller.signal,
      }
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error?.message || `Failed to re-generate summary (HTTP ${res.status})`);
    }

    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

