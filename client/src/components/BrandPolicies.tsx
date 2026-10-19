import type { BrandPolicies as BrandPoliciesType } from '../types/policy';

interface BrandPoliciesProps {
  policies: BrandPoliciesType | null;
  isLoading: boolean;
}

export function BrandPolicies({ policies, isLoading }: BrandPoliciesProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-teal-100/60 p-6 text-center text-xs text-gray-400">
        Loading published brand policies...
      </div>
    );
  }

  if (!policies) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-teal-100/60 p-6">
      <div className="border-b border-gray-100 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">
            Aura Skincare Brand Knowledge &amp; Policies
          </h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">{policies.brand.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Shipping */}
        <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-100/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-teal-900 text-sm">🚚 Shipping Policy</span>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full">
                {policies.shipping.deliveryTimeframe}
              </span>
            </div>
            <ul className="space-y-1 text-gray-600 mt-2">
              <li>&bull; <strong>Free Shipping:</strong> Strictly &gt; ₹499</li>
              <li>&bull; <strong>Standard Fee:</strong> ₹50 for orders &lt; ₹499</li>
              <li className="text-amber-800 font-medium bg-amber-50/80 p-1.5 rounded mt-1 border border-amber-200/50">
                ⚠️ <strong>Boundary:</strong> Exactly ₹499 is ambiguous in brand rules (UNSPECIFIED_POLICY_BOUNDARY).
              </li>
            </ul>
          </div>
        </div>

        {/* Cancellation */}
        <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-100/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-teal-900 text-sm">🛑 Cancellation Policy</span>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                Processing Only
              </span>
            </div>
            <ul className="space-y-1 text-gray-600 mt-2">
              <li>&bull; <strong>Eligible:</strong> Only while order status is <em>Processing</em>.</li>
              <li>&bull; <strong>In Transit:</strong> Cannot cancel Shipped or Out for Delivery.</li>
              <li>&bull; <strong>Doorstep Refusal:</strong> Customers may refuse delivery at doorstep.</li>
              <li>&bull; <strong>Delivered:</strong> Cannot cancel delivered orders.</li>
            </ul>
          </div>
        </div>

        {/* Returns */}
        <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-100/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-teal-900 text-sm">🔄 Return Policy</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                7 Days Window
              </span>
            </div>
            <p className="text-gray-600 mt-2 leading-relaxed">
              Returns accepted within <strong>7 days of delivery</strong> provided the product is <strong>unopened</strong>, <strong>unused</strong>, and in its <strong>original packaging</strong>.
            </p>
          </div>
        </div>

        {/* Damage Replacement & COD */}
        <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-100/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-teal-900 text-sm">📸 Damage &amp; COD</span>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full">
                48h / ≤₹2,500
              </span>
            </div>
            <ul className="space-y-1 text-gray-600 mt-2">
              <li>&bull; <strong>Damaged Goods:</strong> Must report within 48h with photos for replacement.</li>
              <li>&bull; <strong>Cash on Delivery (COD):</strong> Up to &amp; including ₹2,500.</li>
              <li>&bull; <strong>Doorstep Modes:</strong> Cash or UPI accepted.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
