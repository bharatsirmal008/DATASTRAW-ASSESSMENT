import type { CallAnalytics as CallAnalyticsType } from '../types/summary';

interface CallAnalyticsProps {
  analytics: CallAnalyticsType;
}

export function CallAnalytics({ analytics }: CallAnalyticsProps) {
  const metrics = [
    {
      label: 'Call Duration',
      value: analytics.formattedDuration,
      subtext: analytics.durationSeconds !== null ? `${analytics.durationSeconds} seconds` : 'Continuous',
      icon: '⏱️',
    },
    {
      label: 'Customer Turns',
      value: analytics.customerTurns,
      subtext: 'Spoken / sent turns',
      icon: '🗣️',
    },
    {
      label: 'Assistant Turns',
      value: analytics.assistantTurns,
      subtext: 'Aria responses',
      icon: '🤖',
    },
    {
      label: 'Total Messages',
      value: analytics.totalMessages,
      subtext: 'Session history turns',
      icon: '💬',
    },
    {
      label: 'Verified Tool Calls',
      value: analytics.toolExecutionCount,
      subtext: `${analytics.uniqueToolsUsed.length} unique tools`,
      icon: '⚡',
    },
    {
      label: 'Orders Referenced',
      value: analytics.orderIdsReferenced,
      subtext: 'Unique order IDs',
      icon: '📦',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-teal-100/80 p-5 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-teal-100/60">
        <span className="text-xs font-bold text-gray-900 tracking-wide uppercase">
          Call Analytics &amp; Metrics
        </span>
        <span className="text-[11px] text-gray-400">
          Session ID: <span className="font-mono">{analytics.sessionId.slice(0, 8)}…</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-teal-50/30 border border-teal-100/60 flex flex-col items-center text-center justify-center"
          >
            <span className="text-base mb-1">{m.icon}</span>
            <span className="text-base font-extrabold text-gray-900 leading-tight">
              {m.value}
            </span>
            <span className="text-[11px] font-semibold text-gray-600 mt-0.5">{m.label}</span>
            <span className="text-[9px] text-gray-400">{m.subtext}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
