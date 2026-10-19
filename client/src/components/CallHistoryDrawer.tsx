import { useState, useEffect } from 'react';
import type { CallHistoryItem } from '../types/summary';
import { getCallHistoryApi } from '../services/conversation.api';

interface CallHistoryDrawerProps {
  onSelectSession: (sessionId: string) => void;
  activeSessionId?: string | null;
}

export function CallHistoryDrawer({ onSelectSession, activeSessionId }: CallHistoryDrawerProps) {
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getCallHistoryApi(15, 0);
      setHistory(data.history || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold border border-teal-200 transition cursor-pointer"
        title="View completed call history"
      >
        <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <span>Call History</span>
        {history.length > 0 && (
          <span className="bg-teal-200 text-teal-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
            {history.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-teal-100 p-4 z-50 text-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-teal-100">
            <div>
              <span className="font-bold text-gray-900">Completed Calls</span>
              <p className="text-[10px] text-gray-400">In-memory session history</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchHistory}
                disabled={isLoading}
                className="text-teal-600 hover:text-teal-800 text-[11px] font-semibold cursor-pointer"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="p-4 text-center text-gray-400">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No completed calls yet. Click &quot;End Call&quot; after a conversation to archive a session.
              </div>
            ) : (
              history.map((item) => {
                const isSelected = item.sessionId === activeSessionId;

                return (
                  <div
                    key={item.sessionId}
                    onClick={() => {
                      onSelectSession(item.sessionId);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 border-teal-300'
                        : 'bg-gray-50/70 border-gray-100 hover:bg-teal-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-gray-500">
                        {item.sessionId.slice(0, 8)}…
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          item.resolutionStatus === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.resolutionStatus === 'PARTIALLY_RESOLVED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.resolutionStatus}
                      </span>
                    </div>

                    <div className="font-semibold text-gray-800 text-xs">
                      {item.primaryIntent.replace(/_/g, ' ')}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                      <span>{item.orderIds.join(', ') || 'No order ID'}</span>
                      <span>{item.totalTurns} turns</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
