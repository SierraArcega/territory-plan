"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { formatCurrency } from "@/features/shared/lib/format";
import type { OppView } from "@/features/home/lib/pipeline";
import { TIER_STYLE } from "./health";

const fmt = (v: number) => formatCurrency(v, true);
const INITIAL_ROWS = 12; // cap the list; reveal the rest behind "Show more" per CLAUDE.md

function reason(o: OppView): string {
  const base = `${TIER_STYLE[o.tier].label} · ${Math.round(o.daysInStage)}d in ${o.stageName}`;
  return o.overdue ? `${base} · close date passed` : base;
}

// At-risk deals: every non-on-track tier (watch/concerning/stale) plus overdue
// closes, most-valuable first. Capped at INITIAL_ROWS with a show-more toggle.
export default function AtRiskCard({ atRisk }: { atRisk: OppView[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? atRisk : atRisk.slice(0, INITIAL_ROWS);
  const hidden = atRisk.length - shown.length;

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">At risk</h3>
        <span className="rounded-full bg-[#F37167]/12 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#F37167]">{atRisk.length}</span>
      </div>

      {atRisk.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#8A80A8]">Nothing at risk — your open book is healthy.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-[#E2DEEC]">
            {shown.map((o, i) => {
              const h = TIER_STYLE[o.tier];
              return (
                <li key={`${o.account}-${i}`} className="flex items-center gap-2 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: h.color }} />
                  <div className="min-w-0 flex-1">
                    {o.detailsLink ? (
                      <a
                        href={o.detailsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in LMS"
                        className="group flex items-center gap-1 text-[13px] font-semibold text-[#403770] hover:text-[#6E5FA8] transition-colors duration-100"
                      >
                        <span className="truncate">{o.account ?? "—"}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-[#A69DC0] group-hover:text-[#6E5FA8]" aria-hidden />
                      </a>
                    ) : (
                      <div className="truncate text-[13px] font-semibold text-[#403770]">{o.account ?? "—"}</div>
                    )}
                    <div className="text-[11px] whitespace-nowrap" style={{ color: h.color }}>{reason(o)}</div>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-[#403770] whitespace-nowrap">{fmt(o.minPurchase)}</span>
                </li>
              );
            })}
          </ul>
          {atRisk.length > INITIAL_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-center text-[12px] font-semibold text-[#6E5FA8] hover:text-[#403770] transition-colors duration-100"
            >
              {expanded ? "Show less" : `Show ${hidden} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
