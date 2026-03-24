"use client";

import type { ServiceTypeRevenue } from "@/features/shared/types/api-types";

function formatCurrency(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function ServiceTypeBreakdown({
  data,
  fiscalYear,
}: {
  data: ServiceTypeRevenue[];
  fiscalYear: number;
}) {
  const fyShort = String(fiscalYear).slice(-2);
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = sorted.length > 0 ? sorted[0].revenue : 0;

  return (
    <div className="bg-[#f4f2f8] px-3 py-2.5 border-t border-[#E2DEEC]">
      <div className="text-[8px] font-bold uppercase tracking-wider text-[#8A80A8] mb-2">
        Revenue by Service Type (FY{fyShort})
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-[10px] text-[#C2BBD4] italic py-2">
          No Session Data available
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((item) => {
            const widthPct = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
            return (
              <div key={item.serviceType} className="flex items-center gap-2 text-[11px]">
                <span
                  data-testid="service-type-label"
                  className="w-[90px] flex-shrink-0 text-[#4a3f5c] truncate"
                  title={item.serviceType}
                >
                  {item.serviceType}
                </span>
                <div className="flex-1 bg-[#e0dce8] rounded h-[14px] overflow-hidden">
                  <div
                    className="bg-[#7c5cbf] rounded h-full transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-[50px] flex-shrink-0 text-right font-semibold text-[#4a3f5c] tabular-nums text-[10px]">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
