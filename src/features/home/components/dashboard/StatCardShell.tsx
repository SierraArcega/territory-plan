"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { deltaColor } from "@/features/home/lib/delta";
import MetricLabel from "./MetricLabel";

interface StatCardShellProps {
  label: string;
  labelTooltip?: string;         // plain-English definition shown on the (i) hover
  value: string;                 // pre-formatted headline (currency or count)
  deltaPct?: number | null;      // YoY → chip beside the value
  priorFyLabel?: string;         // e.g. "FY26" for the secondary line
  wowPct?: number | null;        // last-7d → mini chip on the secondary line
  minMaxLine?: ReactNode;        // sub-label / max-budget (or status) line
  children?: ReactNode;          // card body (legend, bars, mini-rows)
  footerLeft?: ReactNode;        // sparkline + FY legend
  footerRight?: ReactNode;       // rank pill
  onExpand?: () => void;         // when set, the card opens its detail modal
}

// Shared chrome for every topline card (Targets + 4 financial). Card-specific
// content goes in the slots; the layout, spacing, and tokens live here so the five
// cards can't drift. When `onExpand` is set the whole card is the single
// interactive control (role=button, mouse + keyboard) and the corner glyph is a
// decorative cue — one accessible control beats a card-button plus a duplicate
// glyph button with the same name. Without onExpand the glyph is purely decorative.
export default function StatCardShell({
  label,
  labelTooltip,
  value,
  deltaPct,
  priorFyLabel,
  wowPct,
  minMaxLine,
  children,
  footerLeft,
  footerRight,
  onExpand,
}: StatCardShellProps) {
  const hasYoy = deltaPct != null;
  const hasWow = wowPct != null;
  // Secondary line appears whenever there's any delta. The "vs FY same day" text is
  // shown only when we know the prior-FY label; the last-7d mini stands alone otherwise.
  const showSecondary = hasYoy || hasWow;
  const expandable = onExpand != null;
  const expandLabel = `Expand ${label} details`;
  return (
    <div
      className={`group relative flex min-w-[180px] flex-col gap-3 rounded-lg border border-[#D4CFE2] bg-white p-4 shadow-sm transition-colors hover:border-[#B8B0D0] ${expandable ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#403770]" : ""}`}
      {...(expandable
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": expandLabel,
            onClick: onExpand,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExpand!();
              }
            },
          }
        : {})}
    >
      <span
        className={`absolute right-3 top-3 text-[#C2BBD4] ${expandable ? "transition-colors group-hover:text-[#403770]" : ""}`}
        aria-hidden="true"
      >
        <ArrowUpRight size={15} />
      </span>

      <span className="pr-5 text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
        {labelTooltip ? <MetricLabel tip={labelTooltip}>{label}</MetricLabel> : label}
      </span>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">{value}</span>
        {hasYoy && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap" style={{ color: deltaColor(deltaPct!) }}>
            {deltaPct! > 0 ? "+" : ""}{deltaPct}%
          </span>
        )}
      </div>

      {showSecondary && (
        <div className="-mt-1.5 flex items-center gap-1.5 text-[10px] text-[#A69DC0] whitespace-nowrap">
          {priorFyLabel && <span>vs {priorFyLabel} same day</span>}
          {hasWow && (
            <span className="font-semibold tabular-nums" style={{ color: deltaColor(wowPct!) }}>
              {wowPct! > 0 ? "+" : ""}{wowPct}% · last 7d
            </span>
          )}
        </div>
      )}

      {minMaxLine && <div className="text-[10px] text-[#8A80A8]">{minMaxLine}</div>}

      {children}

      {(footerLeft || footerRight) && (
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-col gap-1">{footerLeft}</div>
          <div className="flex flex-col items-end">{footerRight}</div>
        </div>
      )}
    </div>
  );
}
