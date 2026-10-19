import { useState, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isDisabled: boolean;
  isSending: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isDisabled, isSending, placeholder }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !isDisabled && !isSending) {
      onSend(text);
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Ask Aria about orders, tracking, cancellations, returns...'}
        disabled={isDisabled || isSending}
        maxLength={2000}
        className="w-full px-4 py-3 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white pr-24 disabled:bg-gray-50 disabled:text-gray-400"
      />

      <div className="absolute right-2 flex items-center gap-1.5">
        {text.length > 1500 && (
          <span className="text-[10px] text-gray-400 mr-1">
            {2000 - text.length}
          </span>
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || isDisabled || isSending}
          className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 text-white disabled:text-gray-400 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-xs"
        >
          {isSending ? (
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <span>Send</span>
          )}
        </button>
      </div>
    </div>
  );
}
