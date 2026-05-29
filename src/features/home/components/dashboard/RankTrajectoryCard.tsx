"use client";

import { useState } from "react";
import { Maximize2, Info } from "lucide-react";
import { useRankTrajectory } from "@/features/home/lib/queries";
import RankTrajectoryChart, { type RankSeries } from "./charts/RankTrajectoryChart";
import RankTrajectoryModal from "./RankTrajectoryModal";

// Positive rank movement (moved up the board) reads green; negative coral.
const DELTA_UP = "#2E7D5B";
const DELTA_DOWN = "#F37167";
const MUTED = "#8A80A8";

function deltaChip(entryRank: number, nowRank: number) {
  const delta = entryRank - nowRank; // lower rank number is better → positive = improved
  if (delta > 0) return { text: `+${delta}`, color: DELTA_UP };
  if (delta < 0) return { text: `${delta}`, color: DELTA_DOWN };
  return { text: "—", color: MUTED };
}

export default function RankTrajectoryCard({ fy }: { fy: number }) {
  const { data, isLoading, isError, refetch } = useRankTrajectory(fy);
  const [expanded, setExpanded] = useState(false);

  if (isError) {
    return (
      <div className="rounded-lg border border-[#D4CFE2] bg-white p-6 text-center">
        <p className="text-sm text-[#5C5378]">Couldn&apos;t load your rank trajectory.</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#F37167] hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="h-[320px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse" />;
  }

  const { columns, todayIndex, metrics } = data;
  // Active-rep roster size = the worst possible rank; caps the chart Y-axis.
  const totalReps = Math.max(1, ...metrics.map((m) => m.reps.length));

  const series: RankSeries[] = metrics.map((m) => ({ name: m.name, color: m.color, ranks: m.caller.ranks }));

  // Legend rows sorted by current rank (best first).
  const legend = [...metrics]
    .map((m) => ({
      name: m.name,
      color: m.color,
      nowRank: m.caller.ranks[todayIndex],
      entryRank: m.caller.ranks[0],
    }))
    .sort((a, b) => a.nowRank - b.nowRank);

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">Rank trajectory</h3>
          <span
            className="text-[#A69DC0]"
            title="Your monthly rank (1 = top of team) per metric. Cumulative YTD by source date; Pre-FY captures work on the books entering July. Months after today are held flat (projected)."
          >
            <Info size={13} />
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-xs font-medium text-[#5C5378] hover:text-[#403770] whitespace-nowrap"
        >
          <Maximize2 size={13} /> Expand
        </button>
      </div>

      {/* Chart + legend */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Horizontal scroll on narrow widths keeps the axis text legible. */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="min-w-[560px]">
            <RankTrajectoryChart series={series} months={columns as string[]} carryover todayIndex={todayIndex} totalRanks={totalReps} hideEndLabels />
          </div>
        </div>
        <div className="w-full shrink-0 lg:w-[248px]">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
            Metric · rank · FY Δ
          </div>
          <ul className="flex flex-col gap-1.5">
            {legend.map((row) => {
              const chip = deltaChip(row.entryRank, row.nowRank);
              return (
                <li
                  key={row.name}
                  className="flex items-center gap-2 rounded-r-md border-l-[3px] bg-[#F7F5FA] py-1.5 pl-2 pr-2.5"
                  style={{ borderLeftColor: row.color }}
                >
                  <span className="h-0.5 w-5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="flex-1 truncate text-[13px] font-bold text-[#403770] whitespace-nowrap">{row.name}</span>
                  <span className="text-xs font-semibold tabular-nums text-[#5C5378] whitespace-nowrap">#{row.nowRank}</span>
                  <span className="text-[11px] font-bold tabular-nums whitespace-nowrap" style={{ color: chip.color }}>{chip.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Insight strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#E2DEEC] pt-2 text-[11px] text-[#8A80A8]">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#403770" strokeWidth="2" strokeLinecap="round" /></svg>
          Delivered
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#403770" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4" opacity="0.55" /></svg>
          Projected (held flat)
        </span>
        <span className="whitespace-nowrap">Lower is better · #1 = top of {totalReps} reps</span>
      </div>

      <RankTrajectoryModal open={expanded} onClose={() => setExpanded(false)} fy={fy} />
    </div>
  );
}
