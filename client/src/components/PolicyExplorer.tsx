import { useState } from 'react';
import type { PolicyEvaluationResult } from '../types/policy';
import { evaluatePolicy } from '../services/policies.api';

interface PolicyExplorerProps {
  initialCancellationStatus?: string;
}

export function PolicyExplorer({ initialCancellationStatus }: PolicyExplorerProps) {
  const [activeTab, setActiveTab] = useState<'CANCELLATION' | 'SHIPPING' | 'RETURN' | 'DAMAGE' | 'COD'>('CANCELLATION');

  // Cancellation State
  const [cancelStatus, setCancelStatus] = useState<string>(initialCancellationStatus || 'Processing');

  // Shipping State
  const [shippingValue, setShippingValue] = useState<number>(499);

  // Return State
  const [returnDays, setReturnDays] = useState<number>(7);
  const [isUnopened, setIsUnopened] = useState<boolean>(true);
  const [isUnused, setIsUnused] = useState<boolean>(true);
  const [hasPackaging, setHasPackaging] = useState<boolean>(true);

  // Damage Replacement State
  const [damageHours, setDamageHours] = useState<number>(48);
  const [hasPhotos, setHasPhotos] = useState<boolean>(true);

  // COD State
  const [codValue, setCodValue] = useState<number>(2500);

  // Evaluation Output State
  const [evalResult, setEvalResult] = useState<PolicyEvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async (type: string, payload: Record<string, unknown>) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await evaluatePolicy({ policyType: type, ...payload });
      setEvalResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed.');
      setEvalResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-teal-100/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Policy Guardrails Explorer</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Test business rules against the deterministic policy engine.
          </p>
        </div>
        <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
          Deterministic Guardrails
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-gray-100/80 rounded-xl text-xs mb-5">
        <button
          type="button"
          onClick={() => { setActiveTab('CANCELLATION'); setEvalResult(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'CANCELLATION' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Cancellation
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('SHIPPING'); setEvalResult(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'SHIPPING' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Shipping (Boundary)
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('RETURN'); setEvalResult(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'RETURN' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Returns
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('DAMAGE'); setEvalResult(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'DAMAGE' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Damage
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('COD'); setEvalResult(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'COD' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          COD
        </button>
      </div>

      {/* Tab Panels */}
      <div className="text-xs">
        {activeTab === 'CANCELLATION' && (
          <div className="space-y-3">
            <label className="block text-gray-700 font-medium">Test Order Status:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Processing', 'Out for Delivery', 'Shipped', 'Delivered'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCancelStatus(s)}
                  className={`p-2.5 rounded-xl border text-center font-medium cursor-pointer transition ${
                    cancelStatus === s
                      ? 'border-teal-600 bg-teal-50 text-teal-900 ring-1 ring-teal-600'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleEvaluate('CANCELLATION', { orderStatus: cancelStatus })}
              disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer"
            >
              Evaluate Cancellation Rule
            </button>
          </div>
        )}

        {activeTab === 'SHIPPING' && (
          <div className="space-y-3">
            <label className="block text-gray-700 font-medium">Order Value (INR):</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={shippingValue}
                onChange={(e) => setShippingValue(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setShippingValue(400)}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
              >
                ₹400 (&lt; ₹499)
              </button>
              <button
                type="button"
                onClick={() => setShippingValue(499)}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded-md text-amber-800 font-bold"
              >
                ₹499 (Exact Boundary)
              </button>
              <button
                type="button"
                onClick={() => setShippingValue(699)}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
              >
                ₹699 (&gt; ₹499)
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleEvaluate('SHIPPING', { orderValueInr: shippingValue })}
              disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer"
            >
              Evaluate Shipping Fee
            </button>
          </div>
        )}

        {activeTab === 'RETURN' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Days Since Delivery:</label>
                <input
                  type="number"
                  value={returnDays}
                  onChange={(e) => setReturnDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-gray-400">Boundary is ≤ 7 days</span>
              </div>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUnopened}
                    onChange={(e) => setIsUnopened(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Unopened</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUnused}
                    onChange={(e) => setIsUnused(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Unused</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPackaging}
                    onChange={(e) => setHasPackaging(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Original Packaging</span>
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                handleEvaluate('RETURN', {
                  daysSinceDelivery: returnDays,
                  isUnopened,
                  isUnused,
                  hasOriginalPackaging: hasPackaging,
                })
              }
              disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer"
            >
              Evaluate Return Eligibility
            </button>
          </div>
        )}

        {activeTab === 'DAMAGE' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Hours Since Delivery:</label>
                <input
                  type="number"
                  value={damageHours}
                  onChange={(e) => setDamageHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-gray-400">Boundary is ≤ 48 hours</span>
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPhotos}
                    onChange={(e) => setHasPhotos(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Photographic evidence attached</span>
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                handleEvaluate('DAMAGE_REPLACEMENT', {
                  hoursSinceDelivery: damageHours,
                  hasPhotos,
                })
              }
              disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer"
            >
              Evaluate Damage Replacement Rule
            </button>
          </div>
        )}

        {activeTab === 'COD' && (
          <div className="space-y-3">
            <label className="block text-gray-700 font-medium">Order Value for COD (INR):</label>
            <input
              type="number"
              value={codValue}
              onChange={(e) => setCodValue(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setCodValue(2500)}
                className="px-2.5 py-1 bg-teal-100 hover:bg-teal-200 rounded-md text-teal-800 font-bold"
              >
                ₹2,500 (Max Limit)
              </button>
              <button
                type="button"
                onClick={() => setCodValue(2501)}
                className="px-2.5 py-1 bg-red-100 hover:bg-red-200 rounded-md text-red-800 font-bold"
              >
                ₹2,501 (Over Limit)
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleEvaluate('COD', { orderValueInr: codValue })}
              disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer"
            >
              Evaluate Cash on Delivery Rule
            </button>
          </div>
        )}
      </div>

      {/* Result Display */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {evalResult && (
        <div className="mt-4 p-4 rounded-xl border bg-gray-50/70 border-gray-200 text-xs animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-gray-800">Engine Evaluation:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] border ${
                evalResult.status === 'eligible'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : evalResult.status === 'unspecified'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {evalResult.status}
            </span>
          </div>
          <div className="text-[11px] font-mono text-teal-900 bg-teal-50/60 px-2 py-1 rounded mb-2">
            Policy Code: {evalResult.policyCode}
          </div>
          <p className="text-gray-700 leading-relaxed">{evalResult.message}</p>
        </div>
      )}
    </div>
  );
}
