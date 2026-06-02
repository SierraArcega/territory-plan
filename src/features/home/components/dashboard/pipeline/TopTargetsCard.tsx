"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import { useLowHangingFruitList } from "@/features/leaderboard/lib/queries";
import type { IncreaseTargetCategory } from "@/features/leaderboard/lib/types";

const CATEGORY_LABEL: Record<IncreaseTargetCategory, string> = {
  missing_renewal: "Renewal at risk",
  fullmind_winback: "Win-back",
  ek12_winback: "Win-back · EK12",
};

// Top accounts the rep should be working but that aren't in pipeline yet — reuses
// the leaderboard's increase-targets ("low-hanging fruit") list, top by revenue.
export default function TopTargetsCard() {
  const { data, isLoading, isError } = useLowHangingFruitList();

  const top = [...(data?.districts ?? [])]
    .sort((a, b) => b.fy26Revenue - a.fy26Revenue)
    .slice(0, 8);

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">Top targets not in pipeline</h3>
        <p className="text-xs text-[#8A80A8]">Accounts worth working that have no open opp yet.</p>
      </div>

      {isError ? (
        <p className="py-4 text-center text-sm text-[#8A80A8]">Couldn&apos;t load targets.</p>
      ) : isLoading ? (
        <div className="h-24 rounded-md bg-[#F7F5FA] animate-pulse" />
      ) : top.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#8A80A8]">No untapped targets right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#E2DEEC]">
          {top.map((t) => (
            <li key={t.leaid} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[#403770]">{t.districtName}</div>
                <div className="text-[11px] text-[#8A80A8] whitespace-nowrap">
                  {t.state} · {CATEGORY_LABEL[t.category]}
                </div>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-[#403770] whitespace-nowrap">
                {formatCurrency(t.fy26Revenue, true)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
