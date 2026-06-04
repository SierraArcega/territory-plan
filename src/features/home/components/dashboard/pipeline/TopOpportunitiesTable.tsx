"use client";

import { ExternalLink } from "lucide-react";
import { formatCurrency } from "@/features/shared/lib/format";
import type { OppView } from "@/features/home/lib/pipeline";
import { TIER_STYLE, sourceLabel, sourceColor, fmtShortDate } from "./health";
import OverdueBadge from "./OverdueBadge";

const fmt = (v: number) => formatCurrency(v, true);

// Top open opportunities by minimum commitment (already sorted + capped server-side).
// No "next action" column — there's no per-opp next-step source (locked decision).
export default function TopOpportunitiesTable({ opps }: { opps: OppView[] }) {
  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">Top open opportunities</h3>
        <p className="text-xs text-[#8A80A8]">Your largest open deals by minimum commitment.</p>
      </div>

      {opps.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#8A80A8]">No open opportunities this fiscal year.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
                <th className="py-1.5 pr-3 font-semibold">Account</th>
                <th className="py-1.5 pr-3 font-semibold">Source</th>
                <th className="py-1.5 pr-3 font-semibold">Stage</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Min commit</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Max budget</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Close</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Age</th>
                <th className="py-1.5 font-semibold">Health</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((o, i) => {
                const h = TIER_STYLE[o.tier];
                return (
                  <tr key={`${o.account}-${i}`} className="border-t border-[#E2DEEC]">
                    <td className="py-2 pr-3">
                      {o.detailsLink ? (
                        <a
                          href={o.detailsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in LMS"
                          className="group inline-flex items-center gap-1 text-[13px] font-semibold text-[#403770] whitespace-nowrap hover:text-[#6E5FA8] transition-colors duration-100"
                        >
                          {o.account ?? "—"}
                          <ExternalLink className="w-3 h-3 text-[#A69DC0] group-hover:text-[#6E5FA8]" aria-hidden />
                        </a>
                      ) : (
                        <div className="text-[13px] font-semibold text-[#403770] whitespace-nowrap">{o.account ?? "—"}</div>
                      )}
                      {o.state && <div className="text-[10px] text-[#8A80A8]">{o.state}</div>}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap" style={{ color: sourceColor(o.source) }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: sourceColor(o.source) }} />
                        {sourceLabel(o.source)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[12px] text-[#5C5378] whitespace-nowrap">{o.stageName}</td>
                    <td className="py-2 pr-3 text-right text-[13px] font-bold tabular-nums text-[#403770]">{fmt(o.minPurchase)}</td>
                    <td className="py-2 pr-3 text-right text-[13px] tabular-nums text-[#8A80A8]">{fmt(o.maxBudget)}</td>
                    <td className="py-2 pr-3 text-right text-[12px] tabular-nums text-[#5C5378] whitespace-nowrap">{fmtShortDate(o.closeDate)}</td>
                    <td className="py-2 pr-3 text-right text-[12px] tabular-nums text-[#5C5378]">{Math.round(o.daysInStage)}d</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: h.color, background: h.bg }}>
                          {h.label}
                        </span>
                        {o.overdue && <OverdueBadge />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
