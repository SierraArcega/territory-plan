"use client";

// DealChip — three densities for rendering a deal event in the calendar.
// pip:     14×14 colored square with a kind glyph (smallest)
// compact: month-cell chip with district name + amount inline
// row:     full-width row for schedule view; if `fromStage` is supplied for a
//          `progressed` deal, renders the "Discovery → Proposal" transition.
//
// Per-kind colors come from OPP_STYLE and stay inline (Tailwind can't generate
// dynamic class names from runtime values). Static styles use Tailwind.

import type { MouseEvent as ReactMouseEvent } from "react";
import type { OppEvent } from "@/features/shared/types/api-types";
import { OPP_STYLE } from "./oppStyle";
import { formatMoney } from "./formatMoney";

export type DealChipDensity = "pip" | "compact" | "row";

interface DealChipProps {
  deal: OppEvent;
  density?: DealChipDensity;
  /** Previous stage for `progressed` deals — `OppEvent` doesn't carry this
   *  field today, so it's an optional prop the caller threads in if known. */
  fromStage?: string | null;
  onClick?: (deal: OppEvent) => void;
}

const DASH = "—";

function safeDistrict(deal: OppEvent): string {
  return deal.districtName?.trim() ? deal.districtName : "Unknown district";
}

function tooltip(deal: OppEvent, sty: { label: string }): string {
  const pieces = [
    `${sty.label}: ${safeDistrict(deal)}`,
    formatMoney(deal.amount),
  ];
  if (deal.stage) pieces.push(deal.stage);
  return pieces.join(" — ");
}

export default function DealChip({
  deal,
  density = "compact",
  fromStage,
  onClick,
}: DealChipProps) {
  const sty = OPP_STYLE[deal.kind];
  const Icon = sty.icon;

  const handle = (e: ReactMouseEvent) => {
    if (!onClick) return;
    e.stopPropagation();
    onClick(deal);
  };

  if (density === "pip") {
    return (
      <span
        role="img"
        aria-label={`${sty.label} ${safeDistrict(deal)}`}
        title={tooltip(deal, sty)}
        className="inline-flex items-center justify-center rounded-[3px] text-white"
        style={{
          width: 14,
          height: 14,
          background: sty.color,
        }}
      >
        <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      </span>
    );
  }

  if (density === "row") {
    const showTransition =
      deal.kind === "progressed" && !!fromStage && !!deal.stage;
    return (
      <div
        onClick={onClick ? handle : undefined}
        title={tooltip(deal, sty)}
        className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5"
        style={{
          border: `1px solid ${sty.color}55`,
          borderLeft: `3px solid ${sty.color}`,
          cursor: onClick ? "pointer" : "default",
        }}
      >
        <span
          className="inline-flex items-center justify-center rounded-md flex-shrink-0"
          style={{
            width: 26,
            height: 26,
            background: sty.bg,
            color: sty.color,
          }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 text-[13px] font-semibold text-[#403770]">
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-bold tracking-wide uppercase"
              style={{ background: sty.bg, color: sty.color }}
            >
              {sty.label}
            </span>
            <span className="truncate whitespace-nowrap overflow-hidden">
              {safeDistrict(deal)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] text-[#6E6390]">
            {showTransition ? (
              <span>
                <span className="text-[#8A80A8]">{fromStage}</span>
                <span
                  className="font-bold mx-1"
                  style={{ color: sty.color }}
                  aria-hidden
                >
                  →
                </span>
                <span className="font-semibold text-[#403770]">
                  {deal.stage}
                </span>
              </span>
            ) : (
              <span>{deal.stage ?? DASH}</span>
            )}
          </div>
        </div>
        <div
          className="text-[14px] font-bold tabular-nums flex-shrink-0"
          style={{ color: sty.color }}
        >
          {formatMoney(deal.amount)}
        </div>
      </div>
    );
  }

  // compact — month-cell chip
  return (
    <div
      onClick={onClick ? handle : undefined}
      title={tooltip(deal, sty)}
      className="flex items-center gap-1.5 rounded-[3px] bg-white text-[10px] font-semibold text-[#403770] overflow-hidden"
      style={{
        padding: "2.5px 5px 2.5px 4px",
        border: `1px solid ${sty.color}`,
        borderLeft: `3px solid ${sty.color}`,
        cursor: onClick ? "pointer" : "default",
        lineHeight: 1.25,
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-[2px] text-white flex-shrink-0"
        style={{ width: 12, height: 12, background: sty.color }}
      >
        <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      </span>
      <span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
        {safeDistrict(deal)}
      </span>
      <span
        className="tabular-nums font-bold text-[10px] flex-shrink-0"
        style={{ color: sty.color }}
      >
        {formatMoney(deal.amount)}
      </span>
    </div>
  );
}
