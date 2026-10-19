import type { ConversationMessage } from '../types/conversation';

interface ChatMessageProps {
  message: ConversationMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex min-w-0 gap-3 text-xs leading-relaxed ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <span className="text-white text-[11px] font-bold">A</span>
        </div>
      )}

      <div className={`flex min-w-0 flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`min-w-0 max-w-full p-3.5 rounded-2xl ${
            isUser
              ? 'bg-teal-600 text-white rounded-br-xs shadow-xs'
              : 'bg-white text-gray-800 border border-teal-100/70 rounded-bl-xs shadow-xs'
          }`}
        >
          {/* Tool execution badges if present on assistant response */}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <details className="mb-2.5 pb-2 border-b border-gray-100 text-[10px] text-teal-700"><summary className="cursor-pointer mb-1">Verified order &amp; policy checks</summary>
              {message.toolCalls.map((tc, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-50 text-[10px] font-medium text-teal-800 border border-teal-200/60"
                >
                  <span className="text-teal-600">⚡</span>
                  <span className="font-mono font-semibold break-all">{tc.name}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-gray-600 break-words">{tc.resultSummary}</span>
                </div>
              ))}
            </details>
          )}

          {/* Message content */}
          <div className="whitespace-pre-wrap break-words select-text">{message.content}</div>
        </div>

        <span className="text-[10px] text-gray-400 mt-1 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5 text-gray-600 text-[11px] font-semibold">
          You
        </div>
      )}
    </div>
  );
}
