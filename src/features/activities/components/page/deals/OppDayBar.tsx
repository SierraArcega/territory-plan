"use client";

// OppDayBar — small inline summary for month-view day cells.
// Renders one count per kind (won/lost/created/progressed) with the kind icon,
// followed by the total dollar amount on the right. Returns null for empty days.

import type { OppEvent, OppEventKind } from "@/features/shared/types/api-types";
import { OPP_STYLE } from "./oppStyle";
import { formatMoney } from "./formatMoney";

interface OppDayBarProps {
  opps: OppEvent[];
}

const KIND_ORDER: OppEventKind[] = ["won", "lost", "created", "progressed", "closing"];

export default function OppDayBar({ opps }: OppDayBarProps) {
  if (!opps || opps.length === 0) return null;

  const byKind: Record<OppEventKind, number> = {
    won: 0,
    lost: 0,
    created: 0,
    progressed: 0,
    closing: 0,
  };
  let total = 0;
  for (const o of opps) {
    byKind[o.kind] = (byKind[o.kind] ?? 0) + 1;
    total += typeof o.amount === "number" ? o.amount : 0;
  }

  const tooltip = opps
    .map(
      (o) =>
        `${o.districtName ?? "Unknown district"} — ${OPP_STYLE[o.kind].label} ${formatMoney(o.amount)}`
    )
    .join("\n");

  return (
    <div
      title={tooltip}
      className="flex items-center gap-1 rounded-[3px] bg-[#FBF9FC] text-[9px] font-semibold tabular-nums"
      style={{ padding: "2px 4px" }}
    >
      {KIND_ORDER.filter((k) => byKind[k] > 0).map((k) => {
        const sty = OPP_STYLE[k];
        const Icon = sty.icon;
        return (
          <span
            key={k}
            className="inline-flex items-center gap-0.5"
            style={{ color: sty.color }}
            aria-label={`${byKind[k]} ${sty.label}`}
          >
            <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
            {byKind[k]}
          </span>
        );
      })}
      <span className="ml-auto text-[#544A78] text-[9px]">
        {formatMoney(total)}
      </span>
    </div>
  );
}
