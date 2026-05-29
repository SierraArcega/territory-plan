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
  wow?: number | null;
}

const DELTA_UP = "#2E7D5B";
const DELTA_DOWN = "#F37167";
const MUTED = "#8A80A8";

function deltaColor(pct: number) {
  return pct === 0 ? MUTED : pct > 0 ? DELTA_UP : DELTA_DOWN;
}

// Topline financial card: label, value, source segment bar, a current-vs-prior-FY
// sparkline, a YoY same-point delta chip, and a subtle rank-vs-team line.
export default function StatCard({ label, value, rank, totalReps, inRoster, segments, sparkline, priorFyLabel, wow }: StatCardProps) {
  const yoy = sparkline?.yoy;
  const yoyPct = yoy != null ? Math.round(yoy * 100) : null;
  const wowPct = wow != null ? Math.round(wow * 100) : null;

  return (
    <div className="group rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-4 transition-colors hover:border-[#B8B0D0] flex flex-col gap-3 min-w-[180px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
        {label}
      </span>

      <div className="flex flex-col gap-0.5">
        <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">
          {formatCurrency(value, true)}
        </span>
        {yoyPct != null && priorFyLabel && (
          <span className="flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap">
            <span style={{ color: deltaColor(yoyPct) }} className="tabular-nums">
              {yoyPct > 0 ? "+" : ""}{yoyPct}%
            </span>
            <span className="text-[#A69DC0]">vs {priorFyLabel}</span>
          </span>
        )}
        {wowPct != null && (
          <span className="flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap">
            <span style={{ color: deltaColor(wowPct) }} className="tabular-nums">
              {wowPct > 0 ? "+" : ""}{wowPct}%
            </span>
            <span className="text-[#A69DC0]">7d</span>
          </span>
        )}
      </div>

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
