import { useState } from 'react';

interface OrderLookupProps {
  onSearch: (orderId: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  errorCode?: string | null;
}

export function OrderLookup({ onSearch, isLoading, errorMessage, errorCode }: OrderLookupProps) {
  const [inputVal, setInputVal] = useState('ORD-101');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearch(inputVal);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-teal-100/60 p-6">
      <h2 className="text-base font-semibold text-gray-900 tracking-tight">Order Verification Tool</h2>
      <p className="text-xs text-gray-500 mt-0.5">
        Test order retrieval against the deterministic local mock database (case-insensitive with auto-trim).
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Enter Order ID (e.g., ORD-101, ORD-102, ORD-103)"
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !inputVal.trim()}
          className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Checking...</span>
            </>
          ) : (
            <span>Check Order</span>
          )}
        </button>
      </form>

      {errorMessage && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            {errorCode && <span className="font-bold uppercase tracking-wider block text-[10px] text-red-800">{errorCode}</span>}
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
