import type { StructuredCallOutcome, ResolutionStatus, CustomerIntent } from '../types/summary';

interface CallSummaryProps {
  summary: StructuredCallOutcome;
  onRetry?: (mode?: 'DEMO' | 'GEMINI') => void;
  isRetrying?: boolean;
}

function formatIntentLabel(intent: CustomerIntent): string {
  return intent
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function getResolutionBadge(status: ResolutionStatus) {
  switch (status) {
    case 'RESOLVED':
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        label: 'Resolved',
      };
    case 'PARTIALLY_RESOLVED':
      return {
        bg: 'bg-blue-50 text-blue-800 border-blue-200',
        dot: 'bg-blue-500',
        label: 'Partially Resolved',
      };
    case 'NEEDS_FOLLOW_UP':
      return {
        bg: 'bg-teal-50 text-teal-800 border-teal-200',
        dot: 'bg-teal-500',
        label: 'Needs Follow-Up',
      };
    case 'UNRESOLVED':
    default:
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        label: 'Unresolved',
      };
  }
}

export function CallSummary({ summary, onRetry, isRetrying }: CallSummaryProps) {
  const resBadge = getResolutionBadge(summary.resolution_status);

  return (
    <div className="bg-white rounded-2xl border border-teal-100/80 p-5 shadow-xs flex flex-col gap-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-teal-100/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-900 tracking-wide uppercase">
            Structured Call Outcome
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
              summary.summary_mode === 'GEMINI'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-teal-50 text-teal-700 border-teal-200'
            }`}
          >
            AI summary
          </span>
        </div>

        {/* Resolution Status Badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${resBadge.bg}`}
        >
          <span className={`w-2 h-2 rounded-full ${resBadge.dot}`} />
          {resBadge.label}
        </span>
      </div>

      {/* Intents & Order References */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Customer Intent */}
        <div className="p-3 rounded-xl bg-teal-50/40 border border-teal-100/60 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">Primary Customer Intent</span>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="font-bold text-teal-900 bg-teal-100/70 px-2.5 py-0.5 rounded-lg border border-teal-200/60">
              {formatIntentLabel(summary.customer_intent)}
            </span>
            {summary.additional_intents &&
              summary.additional_intents.map((item, idx) => (
                <span
                  key={idx}
                  className="text-gray-600 bg-white px-2 py-0.5 rounded-md border border-teal-100 text-[11px]"
                >
                  +{formatIntentLabel(item)}
                </span>
              ))}
          </div>
        </div>

        {/* Referenced Orders */}
        <div className="p-3 rounded-xl bg-teal-50/40 border border-teal-100/60 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">Referenced Order ID(s)</span>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {summary.order_ids && summary.order_ids.length > 0 ? (
              summary.order_ids.map((id, idx) => (
                <span
                  key={idx}
                  className="font-mono font-bold text-gray-900 bg-white px-2.5 py-0.5 rounded-lg border border-teal-200"
                >
                  {id}
                </span>
              ))
            ) : (
              <span className="text-gray-400 italic">None referenced</span>
            )}
          </div>
        </div>
      </div>

      {/* Factual Call Summary */}
      <div className="p-4 rounded-xl bg-[#faf8fc] border border-teal-100/70 text-xs text-gray-700 leading-relaxed">
        <span className="font-bold text-gray-900 block mb-1">Call Summary:</span>
        <p className="whitespace-pre-wrap">{summary.call_summary}</p>
      </div>

      {/* Tools Executed */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-teal-100/50 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-gray-500 font-medium">Tools Verified:</span>
          {summary.tools_used && summary.tools_used.length > 0 ? (
            summary.tools_used.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100/60 text-teal-800 text-[11px] font-semibold"
              >
                <span>⚡</span>
                <span>{t}</span>
              </span>
            ))
          ) : (
            <span className="text-gray-400 italic">No backend tools required</span>
          )}
        </div>

        {/* Retry Button */}
        {onRetry && (
          <button
            onClick={() => onRetry()}
            disabled={isRetrying}
            className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer underline disabled:opacity-50"
          >
            {isRetrying ? 'Re-generating…' : '↻ Re-evaluate Summary'}
          </button>
        )}
      </div>
    </div>
  );
}
