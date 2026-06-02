"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import type { OppView } from "@/features/home/lib/pipeline";
import { HEALTH_STYLE } from "./health";

const fmt = (v: number) => formatCurrency(v, true);

function reason(o: OppView): string {
  if (o.health === "slip") return "Close date passed";
  return `Stalled ${Math.round(o.daysInStage)}d in ${o.stageName}`;
}

// At-risk deals: the stalled / slipped subset of the open book, most-valuable first.
export default function AtRiskCard({ atRisk }: { atRisk: OppView[] }) {
  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">At risk</h3>
        <span className="rounded-full bg-[#F37167]/12 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#F37167]">{atRisk.length}</span>
      </div>

      {atRisk.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#8A80A8]">Nothing at risk — your open book is healthy.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#E2DEEC]">
          {atRisk.map((o, i) => {
            const h = HEALTH_STYLE[o.health];
            return (
              <li key={`${o.account}-${i}`} className="flex items-center gap-2 py-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: h.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#403770]">{o.account ?? "—"}</div>
                  <div className="text-[11px] whitespace-nowrap" style={{ color: h.color }}>{reason(o)}</div>
                </div>
                <span className="text-[12px] font-bold tabular-nums text-[#403770] whitespace-nowrap">{fmt(o.minPurchase)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
