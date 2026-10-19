import type { ToolCallSummary, ConversationSession } from './conversation';

export type CustomerIntent =
  | 'PRODUCT_SEARCH'
  | 'PRODUCT_INFORMATION'
  | 'ORDER_TRACKING'
  | 'CANCELLATION_QUERY'
  | 'RETURN_QUERY'
  | 'REFUND_QUERY'
  | 'SHIPPING_QUERY'
  | 'DAMAGED_PRODUCT'
  | 'COD_QUERY'
  | 'BRAND_INFORMATION'
  | 'GENERAL_SUPPORT'
  | 'OUT_OF_SCOPE'
  | 'UNKNOWN';

export type ResolutionStatus =
  | 'RESOLVED'
  | 'PARTIALLY_RESOLVED'
  | 'UNRESOLVED'
  | 'NEEDS_FOLLOW_UP';

export type SummaryMode = 'DEMO' | 'GEMINI';

export interface StructuredCallOutcome {
  session_id: string;
  customer_intent: CustomerIntent;
  additional_intents: CustomerIntent[];
  order_id: string | null;
  order_ids: string[];
  resolution_status: ResolutionStatus;
  call_summary: string;
  tools_used: string[];
  summary_mode: SummaryMode;
  generated_at: string;
}

export interface CallAnalytics {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  formattedDuration: string;
  customerTurns: number;
  assistantTurns: number;
  totalMessages: number;
  toolExecutionCount: number;
  uniqueToolsUsed: string[];
  primaryIntent: CustomerIntent;
  resolutionStatus: ResolutionStatus;
  orderIdsReferenced: number;
}

export interface StructuredTranscriptMessage {
  id: string;
  speaker: 'CUSTOMER' | 'ARIA';
  text: string;
  timestamp: string;
  toolCalls?: ToolCallSummary[];
}

export interface ProcessedTranscript {
  messages: StructuredTranscriptMessage[];
  plainText: string;
}

export interface PostCallData {
  session: ConversationSession;
  transcript: ProcessedTranscript;
  summary: StructuredCallOutcome;
  analytics: CallAnalytics;
  mode: SummaryMode;
}

export interface CallHistoryItem {
  sessionId: string;
  completedAt: string;
  primaryIntent: CustomerIntent;
  resolutionStatus: ResolutionStatus;
  orderIds: string[];
  totalTurns: number;
  durationSeconds: number | null;
  summaryMode: SummaryMode;
}
