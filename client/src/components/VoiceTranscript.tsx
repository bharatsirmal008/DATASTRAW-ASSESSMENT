import { useEffect, useRef } from 'react';
import type { VoiceTranscriptItem, VoiceState } from '../types/voice';

interface VoiceTranscriptProps {
  transcript: VoiceTranscriptItem[];
  interimTranscript: string;
  voiceState: VoiceState;
}

export function VoiceTranscript({
  transcript,
  interimTranscript,
  voiceState,
}: VoiceTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new transcript entries or interim speech
  useEffect(() => {
    if (transcript.length || interimTranscript) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [transcript, interimTranscript]);

  const isEmpty = transcript.length === 0 && !interimTranscript;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-teal-100/60">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          <span className="text-xs font-bold text-gray-800 tracking-wide uppercase">
            Conversation
          </span>
        </div>
        <span className="text-[11px] text-gray-400">
          {transcript.length} {transcript.length === 1 ? 'turn' : 'turns'} recorded
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[380px] min-h-[180px]">
        {isEmpty ? (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <svg className="w-8 h-8 text-teal-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
            <p className="text-xs font-medium text-gray-500">No voice dialogue yet</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
              Click &quot;Start Voice Call&quot; and speak to Aria. Your words and Aria&apos;s spoken responses will appear here in real-time.
            </p>
          </div>
        ) : (
          transcript.map((item) => {
            const isCustomer = item.speaker === 'customer';

            return (
              <div
                key={item.id}
                className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-gray-500">
                    {isCustomer ? 'You' : 'Aria'}
                  </span>
                  <span className="text-[10px] text-gray-400">&bull; {item.timestamp}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                    isCustomer
                      ? 'bg-teal-600 text-white rounded-tr-xs'
                      : 'bg-white border border-teal-100/80 text-gray-800 rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>

                  {/* Tool call execution pills */}
                  {item.toolCalls && item.toolCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-teal-100 flex flex-wrap gap-1.5">
                      {item.toolCalls.map((tc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-[10px] font-medium text-teal-700 border border-teal-200/60"
                        >
                          <span>⚡ Tool:</span>
                          <span className="font-semibold">{tc.name}</span>
                          {tc.resultSummary && (
                            <span className="text-teal-500">({tc.resultSummary})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Interim Speech Preview (While Customer is speaking) */}
        {interimTranscript && (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[11px] font-semibold text-teal-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                Listening to you…
              </span>
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs bg-teal-100/70 border border-teal-200 text-teal-900 italic shadow-xs">
              &ldquo;{interimTranscript}&rdquo;
            </div>
          </div>
        )}

        {/* Thinking Indicator Turn */}
        {voiceState === 'THINKING' && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[11px] font-semibold text-teal-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                Aria is processing…
              </span>
            </div>
            <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 text-xs bg-teal-50 border border-teal-100 text-teal-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" />
              <span className="text-[11px] text-teal-500 ml-1">Evaluating policies &amp; orders</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
