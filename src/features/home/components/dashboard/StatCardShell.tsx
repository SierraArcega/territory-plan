"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { deltaColor } from "@/features/home/lib/delta";

interface StatCardShellProps {
  label: string;
  value: string;                 // pre-formatted headline (currency or count)
  deltaPct?: number | null;      // YoY → chip beside the value
  priorFyLabel?: string;         // e.g. "FY26" for the secondary line
  wowPct?: number | null;        // last-7d → mini chip on the secondary line
  minMaxLine?: ReactNode;        // sub-label / max-budget (or status) line
  children?: ReactNode;          // card body (legend, bars, mini-rows)
  footerLeft?: ReactNode;        // sparkline + FY legend
  footerRight?: ReactNode;       // rank pill
}

// Shared chrome for every topline card (Targets + 4 financial). Card-specific
// content goes in the slots; the layout, spacing, and tokens live here so the five
// cards can't drift. The expand affordance is decorative in Phase 1 (wired to the
// detail modal in Phase 4).
export default function StatCardShell({
  label,
  value,
  deltaPct,
  priorFyLabel,
  wowPct,
  minMaxLine,
  children,
  footerLeft,
  footerRight,
}: StatCardShellProps) {
  const hasYoy = deltaPct != null;
  const hasWow = wowPct != null;
  // Secondary line appears whenever there's any delta. The "vs FY same day" text is
  // shown only when we know the prior-FY label; the last-7d mini stands alone otherwise.
  const showSecondary = hasYoy || hasWow;
  return (
    <div className="group relative flex min-w-[180px] flex-col gap-3 rounded-lg border border-[#D4CFE2] bg-white p-4 shadow-sm transition-colors hover:border-[#B8B0D0]">
      <span className="absolute right-3 top-3 text-[#C2BBD4]" aria-hidden="true">
        <ArrowUpRight size={15} />
      </span>

      <span className="pr-5 text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
        {label}
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
