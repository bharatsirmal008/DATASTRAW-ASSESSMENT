import { useRef, useEffect } from 'react';
import { useConversation } from '../hooks/useConversation';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { PostCallDashboard } from './PostCallDashboard';

export function AriaChat({ autoInit = true, available = false, catalogMode = false }: { autoInit?: boolean; available?: boolean; catalogMode?: boolean }) {
  const {
    session,
    messages,
    isInitializing,
    isSending,
    error,
    postCallData,
    setPostCallData,
    isLoadingPostCall,
    startNewSession,
    sendMessage,
    retryLastMessage,
    endCurrentSession,
    retryPostCall,
  } = useConversation(autoInit && available);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isSending]);

  const isSessionEnded = session?.status === 'ENDED';

  if (postCallData) {
    return (
      <PostCallDashboard
        postCallData={postCallData}
        onStartNewCall={startNewSession}
        onUpdatePostCallData={setPostCallData}
      />
    );
  }

  if (isLoadingPostCall) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-teal-100/70 p-16 flex flex-col items-center justify-center text-center gap-3">
        <span className="w-8 h-8 rounded-full border-3 border-teal-200 border-t-teal-600 animate-spin" />
        <span className="text-sm font-bold text-gray-800">Finalizing Chat &amp; Generating Summary…</span>
        <span className="text-xs text-gray-400">Extracting intents, resolution status, and tools metadata</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-teal-100/70 overflow-hidden flex flex-col h-[650px] transition-all">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/50 border-b border-teal-100/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-xs">
              <span className="text-white text-base font-bold">A</span>
            </div>
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-gray-400'} ring-2 ring-white`}></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Aria</h2>
              <span className="text-[10px] text-teal-600 ml-2">{available ? 'AI assistant' : 'Not connected'}</span>
            </div>
            <p className="text-[11px] text-gray-500">
              Your care assistant &bull; Product information &amp; customer support
            </p>
          </div>
        </div>

        {/* Session Actions */}
        <div className="flex items-center gap-2">
          {session?.context.latestOrderId && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md border border-teal-200">
              <span>Context:</span>
              <span className="font-bold">{session.context.latestOrderId}</span>
            </span>
          )}

          <button
            type="button"
            onClick={startNewSession}
            disabled={!available || isInitializing || isSending}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 hover:text-teal-900 hover:bg-teal-100/60 transition cursor-pointer disabled:opacity-50"
            title="Start fresh conversation"
          >
            New Chat
          </button>

          {!isSessionEnded && (
            <button
              type="button"
              onClick={endCurrentSession}
              disabled={!available || !session || isInitializing || isSending}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
              title="Conclude current session"
            >
              End
            </button>
          )}
        </div>
      </div>

      {/* Messages Viewport */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 min-w-0 overflow-x-hidden bg-gradient-to-b from-white to-[#faf8f5]/40">
        {isInitializing && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 gap-2">
            <svg className="animate-spin h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs">Connecting to Aria session...</span>
          </div>
        )}

        {messages.length === 0 && !isInitializing && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500 gap-2">
            <div className="w-12 h-12 rounded-full bg-teal-100/70 flex items-center justify-center text-teal-600 mb-1">
              💬
            </div>
            <p className="text-sm font-semibold text-gray-800">Start a conversation with Aria</p>
            <p className="text-xs text-gray-400 max-w-sm">
              {available ? 'Tell Aria what you need help with. You can ask follow-up questions naturally.' : 'Live support is not available yet. Please try again when the AI service is connected.'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isSending && (
          <div className="flex items-center gap-3 text-xs text-teal-700 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xs font-bold shrink-0">
              A
            </div>
            <div className="bg-teal-50 px-3.5 py-2 rounded-xl rounded-bl-xs border border-teal-100 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:0.2s]"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-[11px] text-gray-500 ml-1">Aria is checking policies &amp; orders...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error / Retry Banner */}
      {error && (
        <div className="px-6 py-2.5 bg-red-50 border-t border-red-200 text-xs text-red-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-red-800 shrink-0">
              {error.code ? `[${error.code}]` : 'Error:'}
            </span>
            <span className="truncate">{error.message}</span>
          </div>
          <button
            type="button"
            onClick={isSessionEnded ? retryPostCall : retryLastMessage}
            className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] shrink-0 transition cursor-pointer"
          >
            {isSessionEnded ? 'Retry summary' : 'Retry'}
          </button>
        </div>
      )}

      {/* Session Ended Banner */}
      {isSessionEnded && (
        <div className="px-6 py-2.5 bg-gray-100 border-t border-gray-200 text-xs text-gray-600 flex items-center justify-between">
          <span>This conversation session has ended.</span>
          <button
            type="button"
            onClick={startNewSession}
            disabled={!available}
            className="text-teal-700 font-semibold hover:underline"
          >
            Start New Session &rarr;
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <ChatInput
          onSend={sendMessage}
          isDisabled={!available || isSessionEnded || isInitializing}
          isSending={isSending}
          placeholder={
            isSessionEnded
              ? 'Session ended. Click "New Chat" to begin again.'
              : catalogMode ? 'Ask Aria about products, prices, or availability…' : 'Ask Aria about your order, returns, delivery or payments…'
          }
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 px-1">
          <span>Press Enter to send &bull; Multi-turn context enabled</span>
          <span>{available ? 'AI-powered support' : 'Service unavailable'}</span>
        </div>
      </div>
    </div>
  );
}
