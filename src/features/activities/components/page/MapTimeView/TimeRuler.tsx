"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import type { Grain } from "@/features/activities/lib/filters-store";

/**
 * Horizontal time ruler that responds to the chrome `grain` setting. Renders
 * tick marks across the visible date range and dots for each activity timestamp
 * so the rep can visually scan the temporal density of work above the map.
 */
export default function TimeRuler({
  range,
  grain,
  timestamps,
}: {
  range: { start: Date; end: Date };
  grain: Grain;
  timestamps: Date[];
}) {
  const ticks = useMemo(() => {
    const start = range.start.getTime();
    const end = range.end.getTime();
    if (end <= start) return [] as { date: Date; pct: number; label: string }[];
    const out: { date: Date; pct: number; label: string }[] = [];

    if (grain === "day") {
      // hours: 8/12/16/20
      for (const h of [0, 6, 12, 18]) {
        const d = new Date(range.start);
        d.setHours(h, 0, 0, 0);
        const pct = ((d.getTime() - start) / (end - start)) * 100;
        out.push({ date: d, pct, label: format(d, "h a") });
      }
    } else if (grain === "week") {
      const cur = new Date(range.start);
      cur.setHours(0, 0, 0, 0);
      while (cur.getTime() <= end) {
        const pct = ((cur.getTime() - start) / (end - start)) * 100;
        out.push({ date: new Date(cur), pct, label: format(cur, "EEE") });
        cur.setDate(cur.getDate() + 1);
      }
    } else if (grain === "month") {
      const cur = new Date(range.start);
      cur.setHours(0, 0, 0, 0);
      while (cur.getTime() <= end) {
        const pct = ((cur.getTime() - start) / (end - start)) * 100;
        // Show every 7 days; otherwise too dense
        if (cur.getDate() === 1 || cur.getDate() % 7 === 0) {
          out.push({ date: new Date(cur), pct, label: format(cur, "MMM d") });
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      // quarter
      const cur = new Date(range.start);
      cur.setDate(1);
      cur.setHours(0, 0, 0, 0);
      while (cur.getTime() <= end) {
        const pct = ((cur.getTime() - start) / (end - start)) * 100;
        out.push({ date: new Date(cur), pct, label: format(cur, "MMM") });
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    return out;
  }, [range, grain]);

  const dots = useMemo(() => {
    const start = range.start.getTime();
    const end = range.end.getTime();
    if (end <= start) return [] as number[];
    return timestamps
      .map((t) => ((t.getTime() - start) / (end - start)) * 100)
      .filter((pct) => pct >= 0 && pct <= 100);
  }, [range, timestamps]);

  return (
    <div className="relative h-9 px-3 py-1 bg-white border border-[#E2DEEC] rounded-[10px]">
      {/* Tick marks */}
      <div className="absolute inset-x-3 top-1/2 h-px bg-[#E2DEEC]" aria-hidden />
      {ticks.map((t, i) => (
        <div
          key={i}
          className="absolute top-1 -translate-x-1/2 text-[10px] font-medium text-[#8A80A8] tabular-nums"
          style={{ left: `${t.pct}%` }}
        >
          {t.label}
        </div>
      ))}
      {/* Activity dots */}
      {dots.map((pct, i) => (
        <span
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-[#F37167] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct}%`, top: "calc(50% + 8px)", opacity: 0.85 }}
          aria-hidden
        />
      ))}
    </div>
  );
}
