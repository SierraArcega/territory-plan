"use client";

import { formatCurrency, formatNumber, formatPercent } from "@/features/shared/lib/format";
import { deltaColor } from "@/features/home/lib/delta";
import type { VelocityCell as Cell } from "@/features/home/lib/velocity";

const TOOLTIPS: Record<Cell["metricKey"], string> = {
  closeRate: "Share of your closed opportunities that were won (won ÷ won + lost) this year.",
  avgDealSize: "Average booking value of the deals you won this year.",
  grossMargin: "Your margin contribution — take divided by revenue on scheduled + delivered work.",
  dealsWon: "How many opportunities you closed-won this year.",
};

// Format a metric value in its own units. Percent metrics carry a fraction (0-1);
// gross margin shows one decimal, close rate none.
function fmt(cell: Pick<Cell, "format" | "metricKey">, v: number): string {
  if (cell.format === "currency") return formatCurrency(v, true);
  if (cell.format === "count") return formatNumber(v);
  return formatPercent(v, cell.metricKey === "grossMargin" ? 1 : 0);
}

function deltaText(delta: number, unit: Cell["deltaUnit"]): string {
  const sign = delta > 0 ? "+" : "";
  if (unit === "pts") return `${sign}${delta} pts`;
  if (unit === "pct") return `${sign}${delta}%`;
  return `${sign}${delta}`;
}

// One velocity metric: label + (i) tooltip, value, prior-FY delta chip, and a
// team-median + rank foot. Out-of-roster (admin) → "—" value + "Not ranked".
export default function VelocityCell({ cell }: { cell: Cell }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap"
        title={TOOLTIPS[cell.metricKey]}
      >
        <span>{cell.label}</span> <span aria-hidden="true" className="text-[#C2BBD4]">ⓘ</span>
      </span>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">
          {cell.inRoster ? fmt(cell, cell.value) : "—"}
        </span>
        {cell.inRoster && cell.delta != null && (
          <span className="text-[11px] font-semibold tabular-nums whitespace-nowrap" style={{ color: deltaColor(cell.delta) }}>
            {deltaText(cell.delta, cell.deltaUnit)}
          </span>
        )}
      </div>

      <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">
        {cell.inRoster ? (
          <>team median {fmt(cell, cell.teamMedian)} · <span className="font-semibold text-[#5C5378]">#{cell.rank}/{cell.totalReps}</span></>
        ) : (
          "Not ranked"
        )}
      </span>
    </div>
  );
}
