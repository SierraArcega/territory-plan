"use client";

import { useState } from "react";
import { formatCurrency } from "@/features/shared/lib/format";
import type { ThisWeekColumn, ThisWeekDeal } from "@/features/home/lib/pipeline";

const TOP_N = 5;

// WoW delta colors (good vs bad direction; flat is neutral plum-grey).
const WOW_GOOD = "#2E7D5B";
const WOW_BAD = "#F37167";
const WOW_FLAT = "#8A80A8";

// The tag line: motion · product · (Nd to close | stage). Nulls drop out so there
// are never stray separators.
function tagLine(d: ThisWeekDeal): string {
  const trailing = d.daysToClose != null ? `${d.daysToClose}d to close` : d.stage;
  return [d.motion, d.product, trailing].filter(Boolean).join(" · ");
}

// Floor–ceiling range (min commit – max budget).
const rangeLabel = (min: number, max: number) => `${formatCurrency(min, true)} – ${formatCurrency(max, true)}`;

const signedCount = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;
const signedMoney = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatCurrency(Math.abs(n), true)}`;
// % is on dollars; "new" when last week was $0 (avoids ∞%), "—" when there's nothing either week.
const wowPctLabel = (pct: number | null, total: number) =>
  pct !== null ? `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%` : total > 0 ? "new" : "—";

export default function ThisWeekColumnCard({
  title,
  accent,
  sign,
  goodWhenUp,
  column,
}: {
  title: string;
  accent: string;
  sign: string; // "+" or "−"
  goodWhenUp: boolean; // Won/Created: up is good; Lost: down is good
  column: ThisWeekColumn;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? column.deals : column.deals.slice(0, TOP_N);

  // Week-over-week vs the prior 7 days (days 8-14).
  const dCount = column.count - column.prevCount;
  const dTotal = column.total - column.prevTotal;
  const wowPct = column.prevTotal > 0 ? Math.round((dTotal / column.prevTotal) * 100) : null;
  const showWow = column.count > 0 || column.prevCount > 0 || column.prevTotal > 0;
  const wowFlat = dCount === 0 && dTotal === 0;
  const wowColor = wowFlat ? WOW_FLAT : (goodWhenUp ? dTotal >= 0 : dTotal <= 0) ? WOW_GOOD : WOW_BAD;
  const wowArrow = dTotal > 0 ? "↑" : dTotal < 0 ? "↓" : "→";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {/* Column header: label + signed-count pill */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: accent }}>
          {title}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap"
          style={{ color: accent, backgroundColor: `${accent}1A` }}
        >
          {sign}
          {column.count}
        </span>
      </div>

      {/* Count + $ total */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
          {column.count}
        </span>
        <span className="text-sm font-medium text-[#8A80A8] tabular-nums whitespace-nowrap">
          {formatCurrency(column.total, true)}
        </span>
      </div>

      {/* Column floor–ceiling (Σ min commit – Σ max budget) */}
      {(column.totalMin > 0 || column.totalMax > 0) && (
        <div className="-mt-1 text-[11px] tabular-nums whitespace-nowrap text-[#8A80A8]">
          {rangeLabel(column.totalMin, column.totalMax)} <span className="text-[#C9C2DC]">floor–ceiling</span>
        </div>
      )}

      {/* Week-over-week vs the prior 7 days: Δcount · Δ$ · Δ% */}
      {showWow && (
        <div className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap" style={{ color: wowColor }}>
          <span>{wowArrow}</span>
          <span className="tabular-nums">{signedCount(dCount)}</span>
          <span className="text-[#C9C2DC]">·</span>
          <span className="tabular-nums">{signedMoney(dTotal)}</span>
          <span className="text-[#C9C2DC]">·</span>
          <span className="tabular-nums">{wowPctLabel(wowPct, column.total)}</span>
          <span className="font-normal text-[#8A80A8]">vs last wk</span>
        </div>
      )}

      {/* Deals */}
      {column.deals.length === 0 ? (
        <p className="text-xs text-[#8A80A8]">No deals.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((d, i) => (
            <li key={`${d.account}-${i}`} className="rounded-md border border-[#EFEDF5] bg-white px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-[#403770]">{d.account}</span>
                <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: accent }}>
                  {sign}
                  {formatCurrency(d.value, true)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px] text-[#8A80A8]">
                <span className="truncate">{tagLine(d)}</span>
                {(d.min > 0 || d.max > 0) && (
                  <span className="tabular-nums whitespace-nowrap text-[#9A8FC0]">{rangeLabel(d.min, d.max)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {column.deals.length > TOP_N && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="self-start text-xs font-medium text-[#F37167] hover:underline"
        >
          {expanded ? "Show less" : `Show ${column.deals.length - TOP_N} more`}
        </button>
      )}
    </div>
  );
}
