"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import type { ToplineSegment } from "@/features/home/lib/topline";
import type { Sparkline as SparklineData } from "@/features/home/lib/sparkline";
import SegmentBar from "./charts/SegmentBar";
import Sparkline from "./charts/Sparkline";

interface StatCardProps {
  label: string;
  value: number;
  rank: number;
  totalReps: number;
  inRoster: boolean;
  segments: ToplineSegment[];
  sparkline?: SparklineData;
  priorFyLabel?: string;
}

const DELTA_UP = "#2E7D5B";
const DELTA_DOWN = "#F37167";
const MUTED = "#8A80A8";

// Topline financial card: label, value, source segment bar, a current-vs-prior-FY
// sparkline, a YoY same-point delta chip, and a subtle rank-vs-team line.
export default function StatCard({ label, value, rank, totalReps, inRoster, segments, sparkline, priorFyLabel }: StatCardProps) {
  const yoy = sparkline?.yoy;
  const yoyPct = yoy != null ? Math.round(yoy * 100) : null;
  const yoyColor = yoyPct == null || yoyPct === 0 ? MUTED : yoyPct > 0 ? DELTA_UP : DELTA_DOWN;

  return (
    <div className="group rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-4 transition-colors hover:border-[#B8B0D0] flex flex-col gap-3 min-w-[180px]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
          {label}
        </span>
        {yoyPct != null && priorFyLabel && (
          <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold">
            <span style={{ color: yoyColor }} className="tabular-nums">
              {yoyPct > 0 ? "+" : ""}{yoyPct}%
            </span>
            <span className="text-[#A69DC0]">vs {priorFyLabel}</span>
          </span>
        )}
      </div>

      <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">
        {formatCurrency(value, true)}
      </span>

      {segments.length > 0 && <SegmentBar segments={segments} format={(v) => formatCurrency(v, true)} />}

      {sparkline && sparkline.current.length >= 2 && (
        <Sparkline data={sparkline.current} priorData={sparkline.prior} width={160} height={32} />
      )}

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
