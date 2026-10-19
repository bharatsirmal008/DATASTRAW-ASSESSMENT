import { ConversationMessage, SessionContext } from '../services/session.service';

export interface ToolCallExecution {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  resultSummary: string;
}

export interface ProviderResponse {
  content: string;
  mode: 'DEMO' | 'GEMINI';
  toolCalls: ToolCallExecution[];
  contextPatch?: Partial<SessionContext>;
}

export interface AIProvider {
  readonly mode: 'DEMO' | 'GEMINI';
  generateResponse(params: {
    userMessage: string;
    messages: ConversationMessage[];
    context: SessionContext;
  }): Promise<ProviderResponse>;
}
