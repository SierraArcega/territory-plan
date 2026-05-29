"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import type { ToplineSegment } from "@/features/home/lib/topline";
import SegmentBar from "./charts/SegmentBar";

interface StatCardProps {
  label: string;
  value: number;
  rank: number;
  totalReps: number;
  inRoster: boolean;
  segments: ToplineSegment[];
}

// Topline financial card: label, value, source segment bar, and a subtle
// rank-vs-team line. Sparklines + the two deltas land in Phase 3.
export default function StatCard({ label, value, rank, totalReps, inRoster, segments }: StatCardProps) {
  return (
    <div className="group rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-4 transition-colors hover:border-[#B8B0D0] flex flex-col gap-3 min-w-[180px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
        {label}
      </span>
      <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">
        {formatCurrency(value, true)}
      </span>

      {segments.length > 0 && <SegmentBar segments={segments} format={(v) => formatCurrency(v, true)} />}

      <span className="text-xs text-[#8A80A8] whitespace-nowrap mt-auto">
        {inRoster ? (
          <>
            <span className="font-semibold text-[#F37167]">#{rank}</span> of {totalReps} reps
          </>
        ) : (
          <>Not ranked</>
        )}
      </span>
    </div>
  );
}
