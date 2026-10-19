import { AIProvider, ProviderResponse } from '../providers/provider.interface';
import { GeminiProvider } from '../providers/gemini.provider';
import {
  getSession,
  addMessage,
  updateSessionContext,
  ConversationSession,
} from './session.service';

/**
 * Returns the configured AI provider based on AI_PROVIDER environment variable.
 * Live Gemini is the application provider.
 */
export function getAIProvider(): AIProvider {
  return new GeminiProvider();
}

export interface ConversationTurnResult {
  response: string;
  mode: 'GEMINI';
  toolCalls: ProviderResponse['toolCalls'];
  session: ConversationSession;
}

/**
 * Orchestrates a complete user conversation turn:
 * 1. Validates active session
 * 2. Records user turn
 * 3. Dispatches to live Gemini provider
 * 4. Updates session context
 * 5. Records assistant response with tool execution metadata
 */
export async function processUserMessage(
  sessionId: string,
  rawMessage: string,
  language?: 'en' | 'hi'
): Promise<ConversationTurnResult> {
  const session = getSession(sessionId);
  if (!session) {
    const err = new Error(`Session "${sessionId}" was not found or has expired.`);
    (err as Error & { code?: string; status?: number }).code = 'SESSION_NOT_FOUND';
    (err as Error & { code?: string; status?: number }).status = 404;
    throw err;
  }

  if (session.status === 'ENDED') {
    const err = new Error(`Session "${sessionId}" has ended. Please start a new conversation.`);
    (err as Error & { code?: string; status?: number }).code = 'SESSION_ENDED';
    (err as Error & { code?: string; status?: number }).status = 409;
    throw err;
  }

  const messageText = rawMessage.trim();
  if (!messageText) {
    const err = new Error('Message cannot be empty.');
    (err as Error & { code?: string; status?: number }).code = 'INVALID_INPUT';
    (err as Error & { code?: string; status?: number }).status = 400;
    throw err;
  }

  if (messageText.length > 2000) {
    const err = new Error('Message exceeds the maximum permitted length of 2000 characters.');
    (err as Error & { code?: string; status?: number }).code = 'MESSAGE_TOO_LONG';
    (err as Error & { code?: string; status?: number }).status = 400;
    throw err;
  }

  // 1. Record user turn
  if (language !== undefined) updateSessionContext(sessionId, { responseLanguage: language });
  addMessage(sessionId, 'user', messageText);

  // 2. Obtain current session snapshot
  const activeSession = getSession(sessionId)!;
  const provider = getAIProvider();

  // 3. Generate response from provider
  const result = await provider.generateResponse({
    userMessage: messageText,
    messages: activeSession.messages,
    context: activeSession.context,
  });

  // End Call can happen while a live provider is still processing. Do not append
  // a late response to an already finalized transcript or invalidate its summary.
  if (getSession(sessionId)?.status !== 'ACTIVE') {
    const error = Object.assign(new Error('This call has ended.'), { code: 'SESSION_ENDED', status: 409 });
    throw error;
  }

  // 4. Update session context if patch returned
  if (result.contextPatch) {
    updateSessionContext(sessionId, result.contextPatch);
  }

  // 5. Record assistant turn with tool call summaries
  const toolCallSummaries = result.toolCalls.map((tc) => ({
    name: tc.name,
    args: tc.args,
    resultSummary: tc.resultSummary,
  }));

  addMessage(sessionId, 'assistant', result.content, toolCallSummaries);

  const updatedSession = getSession(sessionId)!;

  return {
    response: result.content,
    mode: result.mode,
    toolCalls: result.toolCalls,
    session: updatedSession,
  };
}
