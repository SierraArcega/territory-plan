"use client";

import { useTargets } from "@/features/home/lib/queries";
import { formatNumber, formatPercent } from "@/features/shared/lib/format";
import SegmentBar, { type Segment } from "./charts/SegmentBar";

interface TargetsCardProps {
  fy: number;
}

const SEGMENT_LABELS: { key: "new" | "winback" | "expansion"; label: string }[] = [
  { key: "new", label: "New biz" },
  { key: "winback", label: "Win-back" },
  { key: "expansion", label: "Expansion" },
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
  const untargetedFrac = total > 0 ? card.untargeted / total : 0;
  const segments: Segment[] = SEGMENT_LABELS.map(({ key, label }) => ({
    key,
    label,
    value: card.segments[key],
  })).filter((s) => s.value > 0);

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
      <SegmentBar segments={segments} format={formatNumber} />

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
        <SubRow
          label="No targets set"
          num={card.untargeted}
          total={total}
          frac={untargetedFrac}
          color="#C2BBD4"
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
