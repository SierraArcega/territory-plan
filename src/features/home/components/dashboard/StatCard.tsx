"use client";

import { formatCurrency } from "@/features/shared/lib/format";

interface StatCardProps {
  label: string;
  value: number;
  rank: number;
  totalReps: number;
  inRoster: boolean;
}

// Interim topline card: label, value, and a subtle rank-vs-team line. Full card
// anatomy (segment bar, legend, sparkline, deltas, open affordance) lands in
// Phase 2.
export default function StatCard({ label, value, rank, totalReps, inRoster }: StatCardProps) {
  return (
    <div className="group rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-4 transition-colors hover:border-[#B8B0D0] flex flex-col gap-2 min-w-[180px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
        {label}
      </span>
      <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">
        {formatCurrency(value, true)}
      </span>
      <span className="text-xs text-[#8A80A8] whitespace-nowrap">
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
