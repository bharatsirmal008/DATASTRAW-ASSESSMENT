export type MessageRole = 'user' | 'assistant';
export type SessionStatus = 'ACTIVE' | 'ENDED';
export type ProviderMode = 'GEMINI';

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
  latestOrderId?: string;
}

export interface ConversationSession {
  id: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  messages: ConversationMessage[];
  context: SessionContext;
}

export interface ConversationTurnResult {
  response: string;
  mode: ProviderMode;
  toolCalls: ToolCallSummary[];
  session: ConversationSession;
}
