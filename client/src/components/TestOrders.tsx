import type { MockOrder } from '../types/order';

interface TestOrdersProps {
  orders: MockOrder[];
  selectedOrderId?: string;
  onSelectOrder: (orderId: string) => void;
  isLoading: boolean;
}

export function TestOrders({ orders, selectedOrderId, onSelectOrder, isLoading }: TestOrdersProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-teal-100/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Evaluator Sample Orders</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pre-configured assessment test fixtures. Click any order to load into verification engine.
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
          Scenario Fixtures
        </span>
      </div>

      {isLoading && (
        <div className="py-6 text-center text-xs text-gray-400">Loading sample orders from backend...</div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="py-6 text-center text-xs text-gray-400">
          No test orders available. Please ensure backend is running.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {orders.map((order) => {
          const isSelected = selectedOrderId === order.orderId;
          const statusBadgeColor =
            order.status === 'Processing'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : order.status === 'Out for Delivery'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200';

          return (
            <button
              key={order.orderId}
              type="button"
              onClick={() => onSelectOrder(order.orderId)}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-600'
                  : 'border-gray-200/80 bg-gray-50/40 hover:bg-white hover:border-teal-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-teal-900">{order.orderId}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadgeColor}`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-800 truncate">{order.customer}</p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">{order.product}</p>
              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                <span className="font-semibold text-gray-700">₹{order.valueInr}</span>
                <span className="text-teal-600 font-medium hover:underline">Select &rarr;</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
