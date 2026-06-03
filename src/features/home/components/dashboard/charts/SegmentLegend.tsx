"use client";

import { SEGMENT_COLORS } from "@/features/home/lib/segments";
import type { Segment } from "@/features/home/lib/segments";

const colorFor = (key: string) => SEGMENT_COLORS[key as keyof typeof SEGMENT_COLORS] ?? "#8A80A8";

// Vertical source legend (● name … value %) for the unified stat cards.
// Percent is share of the segment total, rounded.
export default function SegmentLegend({
  segments,
  format,
}: {
  segments: Segment[];
  format: (value: number) => string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {segments.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-[11px] whitespace-nowrap">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: colorFor(s.key) }} />
          <span className="text-[#5C5378]">{s.label}</span>
          <span className="ml-auto font-bold text-[#403770] tabular-nums">{format(s.value)}</span>
          <span className="w-9 text-right text-[#8A80A8] tabular-nums">{Math.round((s.value / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
