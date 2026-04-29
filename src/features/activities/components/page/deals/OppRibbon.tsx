"use client";

// OppRibbon — per-day strip for week/schedule views.
// One column per day; each column shows up to 3 kind icons + the day's total.
// Empty days render an empty placeholder column to keep grid alignment.

import type { OppEvent } from "@/features/shared/types/api-types";
import { OPP_STYLE } from "./oppStyle";
import { formatMoney } from "./formatMoney";

interface OppRibbonProps {
  days: Date[];
  /** Map keyed by `startOfDay(d).toISOString()` -> events on that day. */
  oppsByDay: Map<string, OppEvent[]>;
}

function startOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

export default function OppRibbon({ days, oppsByDay }: OppRibbonProps) {
  return (
    <div
      className="grid gap-1.5 py-2"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((d) => {
        const key = startOfDayIso(d);
        const opps = oppsByDay.get(key) ?? [];
        if (opps.length === 0) {
          return <div key={key} style={{ minHeight: 28 }} />;
        }
        const total = opps.reduce(
          (s, o) => s + (typeof o.amount === "number" ? o.amount : 0),
          0
        );
        const tooltip = opps
          .map(
            (o) =>
              `${o.districtName ?? "Unknown district"}: ${OPP_STYLE[o.kind].label} ${formatMoney(o.amount)}`
          )
          .join("\n");
        return (
          <div
            key={key}
            title={tooltip}
            className="flex items-center gap-1 rounded-md bg-white border border-[#E2DEEC] text-[10px] font-semibold tabular-nums px-2 py-1"
            style={{ minHeight: 28 }}
          >
            {opps.slice(0, 3).map((o, i) => {
              const sty = OPP_STYLE[o.kind];
              const Icon = sty.icon;
              return (
                <span
                  key={`${o.id}-${i}`}
                  className="inline-flex items-center"
                  style={{ color: sty.color }}
                  aria-label={sty.label}
                >
                  <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                </span>
              );
            })}
            <span className="ml-auto text-[#403770]">
              {formatMoney(total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
