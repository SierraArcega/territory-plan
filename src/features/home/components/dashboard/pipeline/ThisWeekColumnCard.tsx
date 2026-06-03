"use client";

import { useState } from "react";
import { formatCurrency } from "@/features/shared/lib/format";
import type { ThisWeekColumn, ThisWeekDeal } from "@/features/home/lib/pipeline";

const TOP_N = 5;

// The tag line: motion · product · (Nd to close | stage). Nulls drop out so there
// are never stray separators.
function tagLine(d: ThisWeekDeal): string {
  const trailing = d.daysToClose != null ? `${d.daysToClose}d to close` : d.stage;
  return [d.motion, d.product, trailing].filter(Boolean).join(" · ");
}

export default function ThisWeekColumnCard({
  title,
  accent,
  sign,
  column,
}: {
  title: string;
  accent: string;
  sign: string; // "+" or "−"
  column: ThisWeekColumn;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? column.deals : column.deals.slice(0, TOP_N);

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
              <div className="mt-0.5 truncate text-[11px] text-[#8A80A8]">{tagLine(d)}</div>
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
