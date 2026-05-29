"use client";

import { useTargets, type TargetsCardData } from "@/features/home/lib/queries";
import { formatNumber, formatPercent } from "@/features/shared/lib/format";

interface TargetsCardProps {
  fy: number;
}

const SEGMENTS: { key: keyof TargetsCardData["segments"]; label: string; color: string }[] = [
  { key: "new", label: "New biz", color: "#F37167" },
  { key: "winback", label: "Win-back", color: "#6EA3BE" },
  { key: "expansion", label: "Expansion", color: "#FFCF70" },
];

export default function TargetsCard({ fy }: TargetsCardProps) {
  const { data, isLoading, isError } = useTargets(fy);

  if (isError) {
    return (
      <div className="rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-4 text-sm text-[#5C5378]">
        Couldn&apos;t load targets.
      </div>
    );
  }
  if (isLoading || !data) {
    return <div className="h-[200px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse" />;
  }

  const card = data.card;
  const total = card.value;
  const convertedFrac = total > 0 ? card.convertedToPipeline / total : 0;
  const activeFrac = total > 0 ? card.active90 / total : 0;

  return (
    <div className="group rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-4 transition-colors hover:border-[#B8B0D0] flex flex-col gap-3 min-w-[180px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
        Targets
      </span>

      <div>
        <span className="text-2xl font-bold text-[#403770] tabular-nums">{formatNumber(total)}</span>
        <span className="ml-1.5 text-xs text-[#8A80A8] whitespace-nowrap">districts being worked</span>
      </div>

      {/* Segment bar */}
      <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-[#E2DEEC]">
        {SEGMENTS.map((s) => {
          const count = card.segments[s.key];
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={s.key} style={{ width: `${pct}%`, backgroundColor: s.color }} />;
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[11px] whitespace-nowrap">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} />
            <span style={{ color: s.color }} className="font-medium">{s.label}</span>
            <span className="font-bold text-[#403770] tabular-nums">{formatNumber(card.segments[s.key])}</span>
          </span>
        ))}
      </div>

      {/* Sub-rows */}
      <div className="flex flex-col gap-1.5 pt-1">
        <SubRow
          label="Converted to pipeline"
          num={card.convertedToPipeline}
          total={total}
          frac={convertedFrac}
          color="#403770"
        />
        <SubRow
          label="Active · 90d"
          num={card.active90}
          total={total}
          frac={activeFrac}
          color="#6BA368"
          stale={card.stale}
        />
      </div>
    </div>
  );
}

function SubRow({
  label,
  num,
  total,
  frac,
  color,
  stale,
}: {
  label: string;
  num: number;
  total: number;
  frac: number;
  color: string;
  stale?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px] whitespace-nowrap">
        <span className="text-[#5C5378]">{label}</span>
        <span className="text-[#8A80A8] tabular-nums">
          <span className="font-semibold text-[#403770]">{formatNumber(num)}</span> / {formatNumber(total)}{" "}
          ({formatPercent(frac, 0)})
          {stale != null && stale > 0 && (
            <span className="ml-1.5 text-[#C77] font-medium">· {formatNumber(stale)} stale</span>
          )}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#EFEDF5]">
        <div style={{ width: `${Math.min(100, frac * 100)}%`, backgroundColor: color }} className="h-full" />
      </div>
    </div>
  );
}
