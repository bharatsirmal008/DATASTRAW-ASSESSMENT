import type { MockOrder } from '../types/order';

interface OrderDetailsProps {
  order: MockOrder;
  onEvaluateCancellation?: (status: string) => void;
}

export function OrderDetails({ order, onEvaluateCancellation }: OrderDetailsProps) {
  const statusColors = {
    Processing: 'bg-blue-100 text-blue-800 border-blue-200',
    Shipped: 'bg-teal-100 text-teal-800 border-teal-200',
    'Out for Delivery': 'bg-amber-100 text-amber-800 border-amber-200',
    Delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-teal-100/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">{order.orderId}</span>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                statusColors[order.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {order.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Verified backend record from local mock database</p>
        </div>

        {order.isScenarioData && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Assessment Scenario Fixture
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 text-sm">
        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
          <span className="text-xs font-medium text-gray-400 block">Customer</span>
          <span className="font-semibold text-gray-800 text-sm mt-0.5 block">{order.customer}</span>
        </div>

        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
          <span className="text-xs font-medium text-gray-400 block">Product</span>
          <span className="font-semibold text-gray-800 text-sm mt-0.5 block">{order.product}</span>
        </div>

        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
          <span className="text-xs font-medium text-gray-400 block">Order Value</span>
          <span className="font-semibold text-teal-700 text-base mt-0.5 block">₹{order.valueInr}</span>
        </div>

        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
          <span className="text-xs font-medium text-gray-400 block">Courier &amp; Tracking</span>
          <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
            {order.courier ? `${order.courier} (${order.trackingNumber})` : 'Not dispatched yet'}
          </span>
        </div>
      </div>

      {order.estimatedDelivery && (
        <div className="mt-3.5 p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-teal-900 flex items-center justify-between">
          <span className="font-medium">Estimated Delivery:</span>
          <span className="font-semibold">{order.estimatedDelivery}</span>
        </div>
      )}

      {order.delivered && (
        <div className="mt-3.5 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900 flex items-center justify-between">
          <span className="font-medium">Delivery Timestamp:</span>
          <span className="font-semibold">{order.delivered}</span>
        </div>
      )}

      {order.note && (
        <div className="mt-3.5 p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 flex items-center justify-between">
          <span className="font-medium">Scenario Note:</span>
          <span className="font-semibold">{order.note}</span>
        </div>
      )}

      {onEvaluateCancellation && (
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Test cancellation policy for this status:</span>
          <button
            type="button"
            onClick={() => onEvaluateCancellation(order.status)}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition cursor-pointer"
          >
            Check Cancellation Eligibility &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
