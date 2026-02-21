"use client";

import { useTerritoryPlan } from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  planning: { bg: "#6EA3BE18", text: "#4d7285" },
  working:  { bg: "#40377018", text: "#403770" },
  stale:    { bg: "#FFCF7020", text: "#997c43" },
  archived: { bg: "#9CA3AF18", text: "#6B7280" },
};

function formatCurrency(val: number | null): string {
  if (!val) return "\u2014";
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString()}`;
}

export default function PlanCard({ planId }: { planId: string }) {
  const { data: plan, isLoading } = useTerritoryPlan(planId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-4 text-sm text-gray-400 italic">Plan not found</div>
    );
  }

  const statusStyle = STATUS_STYLES[plan.status] || STATUS_STYLES.archived;

  // Compute rollups from districts
  const rollups = (plan.districts || []).reduce(
    (acc, d) => ({
      renewal: acc.renewal + (d.renewalTarget || 0),
      expansion: acc.expansion + (d.expansionTarget || 0),
      winback: acc.winback + (d.winbackTarget || 0),
      newBusiness: acc.newBusiness + (d.newBusinessTarget || 0),
    }),
    { renewal: 0, expansion: 0, winback: 0, newBusiness: 0 }
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5 mb-2">
          <span
            className="w-4 h-4 rounded-full shrink-0 border border-black/10"
            style={{ backgroundColor: plan.color }}
          />
          <h2 className="text-[15px] font-semibold text-[#403770] leading-tight flex-1 truncate">
            {plan.name}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 text-[10px] font-medium rounded-full capitalize"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
          >
            {plan.status}
          </span>
          <span className="text-[11px] text-gray-400 font-medium">
            FY{String(plan.fiscalYear).slice(-2)}
          </span>
        </div>
      </div>

      {/* Owner */}
      <div className="px-4 py-2.5 border-b border-gray-100">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Owner</span>
        <div className="text-[13px] text-gray-700 mt-0.5">
          {plan.owner?.fullName || <span className="text-gray-300 italic">Unassigned</span>}
        </div>
      </div>

      {/* Target rollups */}
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Target Rollups</span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
          <div>
            <div className="text-[10px] text-gray-400">Renewal</div>
            <div className="text-[14px] font-semibold text-[#403770]">{formatCurrency(rollups.renewal)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400">Expansion</div>
            <div className="text-[14px] font-semibold text-[#403770]">{formatCurrency(rollups.expansion)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400">Win Back</div>
            <div className="text-[14px] font-semibold text-[#403770]">{formatCurrency(rollups.winback)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400">New Business</div>
            <div className="text-[14px] font-semibold text-[#403770]">{formatCurrency(rollups.newBusiness)}</div>
          </div>
        </div>
      </div>

      {/* District list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
          Districts ({plan.districts?.length || 0})
        </span>
        <div className="mt-2 space-y-1.5">
          {(plan.districts || []).map((d) => {
            const total = (d.renewalTarget || 0) + (d.expansionTarget || 0) + (d.winbackTarget || 0) + (d.newBusinessTarget || 0);
            return (
              <div key={d.leaid} className="p-2 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#403770] truncate flex-1">{d.name}</span>
                  {d.stateAbbrev && (
                    <span className="text-[10px] text-gray-400 ml-1 shrink-0">{d.stateAbbrev}</span>
                  )}
                </div>
                {total > 0 && (
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {formatCurrency(total)} total
                  </div>
                )}
              </div>
            );
          })}
          {(!plan.districts || plan.districts.length === 0) && (
            <div className="text-[12px] text-gray-400 italic py-2">No districts in this plan</div>
          )}
        </div>
      </div>
    </div>
  );
}
