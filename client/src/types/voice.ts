import type { ToolCallSummary } from './conversation';

export type VoiceState =
  | 'IDLE'
  | 'INITIALIZING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ENDING'
  | 'ENDED'
  | 'ERROR';

export interface VoiceTranscriptItem {
  id: string;
  speaker: 'customer' | 'aria';
  text: string;
  timestamp: string;
  isInterim?: boolean;
  toolCalls?: ToolCallSummary[];
}

export type VoiceErrorCode =
  | 'MIC_PERMISSION_DENIED'
  | 'SPEECH_RECOGNITION_UNSUPPORTED'
  | 'SPEECH_SYNTHESIS_UNSUPPORTED'
  | 'NO_SPEECH_DETECTED'
  | 'NETWORK_ERROR'
  | 'BACKEND_ERROR'
  | 'DEVICE_ERROR'
  | 'ABORTED'
  | 'UNKNOWN';

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
  actionableSuggestion?: string;
}

export interface VoiceSettings {
  language: string;
  speechRate: number;
  isMuted: boolean;
}
