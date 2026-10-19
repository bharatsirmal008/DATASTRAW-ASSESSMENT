import { useState } from 'react';
import type { PostCallData } from '../types/summary';
import { CallSummary } from './CallSummary';
import { CallAnalytics } from './CallAnalytics';
import { ExportControls } from './ExportControls';
import { retrySummaryApi } from '../services/conversation.api';

interface PostCallDashboardProps {
  postCallData: PostCallData;
  onStartNewCall: () => void;
  onUpdatePostCallData?: (updated: PostCallData) => void;
}

export function PostCallDashboard({
  postCallData,
  onStartNewCall,
  onUpdatePostCallData,
}: PostCallDashboardProps) {
  const [data, setData] = useState<PostCallData>(postCallData);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetrySummary = async (mode?: 'DEMO' | 'GEMINI') => {
    setIsRetrying(true);
    setRetryError(null);
    try {
      const res = await retrySummaryApi(data.session.id, mode);
      const updated: PostCallData = {
        ...data,
        session: res.session,
        summary: res.summary,
        analytics: res.analytics,
        mode: res.summary.summary_mode,
      };
      setData(updated);
      onUpdatePostCallData?.(updated);
    } catch (err: any) {
      setRetryError(err.message || 'Failed to re-evaluate summary.');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="postcall-dashboard">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-teal-100/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
              Your conversation, wrapped up
            </h2>
            <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full font-semibold">
              Call outcome
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Session ID: <code className="font-mono text-teal-700">{data.session.id}</code> &bull; Finished at{' '}
            {data.session.endedAt ? new Date(data.session.endedAt).toLocaleTimeString() : 'Just now'}
          </p>
        </div>

        {/* Start New Call CTA */}
        <button
          onClick={onStartNewCall}
          className="button-primary"
        >
          <span>New conversation</span>
          <span>&rarr;</span>
        </button>
      </div>

      {retryError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          {retryError}
        </div>
      )}

      {/* Structured Call Summary */}
      <CallSummary
        summary={data.summary}
        onRetry={handleRetrySummary}
        isRetrying={isRetrying}
      />

      <details open className="rounded-xl border border-teal-100 bg-white p-4">
        <summary className="text-xs font-semibold text-teal-900 cursor-pointer">Structured call outcome (JSON)</summary>
        <pre className="mt-3 max-h-80 overflow-auto text-xs leading-relaxed whitespace-pre-wrap break-words" aria-label="Structured call outcome JSON">{JSON.stringify(data.summary, null, 2)}</pre>
      </details>

      {/* Call Analytics Grid */}
      <details className="call-details"><summary>Call details &amp; metrics</summary><CallAnalytics analytics={data.analytics} /></details>

      {/* Export Controls & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-teal-100/70 shadow-xs">
        <span className="text-xs font-bold text-gray-800">
          Export Artifacts:
        </span>
        <ExportControls postCallData={data} />
      </div>

      {/* Authoritative Transcript Review */}
      <div className="bg-white rounded-2xl border border-teal-100/70 p-5 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-teal-100/60">
          <span className="text-xs font-bold text-gray-900 tracking-wide uppercase">
            Complete Conversation Transcript ({data.transcript.messages.length} messages)
          </span>
          <span className="text-[11px] text-gray-400">Customer and Aria</span>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
          {data.transcript.messages.length === 0 ? (
            <div className="text-gray-400 italic p-4 text-center">No dialogue in this call.</div>
          ) : (
            data.transcript.messages.map((m) => {
              const isCust = m.speaker === 'CUSTOMER';

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isCust ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-gray-400 mb-0.5 px-1">
                    {isCust ? 'Customer' : 'Aria'} &bull; {m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ''}
                  </span>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed shadow-xs ${
                      isCust
                        ? 'bg-teal-600 text-white rounded-tr-xs'
                        : 'bg-[#faf8fd] border border-teal-100 text-gray-800 rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>

                    {m.toolCalls && m.toolCalls.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-teal-100/70 flex flex-wrap gap-1">
                        {m.toolCalls.map((tc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] bg-teal-100/70 text-teal-800 font-semibold px-2 py-0.5 rounded-md"
                          >
                            <span>⚡ {tc.name}</span>
                            {tc.resultSummary && (
                              <span className="text-teal-600">({tc.resultSummary})</span>
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
        </div>
      </div>
    </div>
  );
}
