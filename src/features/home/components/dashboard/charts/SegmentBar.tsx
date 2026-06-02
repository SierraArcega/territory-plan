"use client";

// Stacked horizontal source bar + color-coded legend, shared by the topline
// financial cards (currency) and the Targets card (counts). Colors are by source
// per the Fullmind tokens (see segments.ts): Return=plum, New biz=coral,
// Win-back=steel, Expansion=golden.

import { SEGMENT_COLORS } from "@/features/home/lib/segments";

export interface Segment {
  key: string;
  label: string;
  value: number;
}

const colorFor = (key: string) => SEGMENT_COLORS[key as keyof typeof SEGMENT_COLORS] ?? "#8A80A8";

export default function SegmentBar({
  segments,
  format,
}: {
  segments: Segment[];
  format: (value: number) => string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-[#E2DEEC]">
        {segments.map((s) => {
          const pct = (s.value / total) * 100;
          if (pct <= 0) return null;
          return <div key={s.key} style={{ width: `${pct}%`, backgroundColor: colorFor(s.key) }} />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[11px] whitespace-nowrap">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: colorFor(s.key) }} />
            <span style={{ color: colorFor(s.key) }} className="font-medium">{s.label}</span>
            <span className="font-bold text-[#403770] tabular-nums">{format(s.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
