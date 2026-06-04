"use client";

import type { ThisWeek } from "@/features/home/lib/pipeline";
import ThisWeekColumnCard from "./ThisWeekColumnCard";

// "Mar 17 → Mar 23" — the trailing 7-day window ending today (display-only).
function weekRangeLabel(now: Date): string {
  const start = new Date(now.getTime() - 6 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} → ${fmt(now)}`;
}

export default function ThisWeekSection({ thisWeek }: { thisWeek: ThisWeek }) {
  const range = weekRangeLabel(new Date());
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[#D4CFE2] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#403770] whitespace-nowrap">This week</h3>
          <p className="text-xs text-[#8A80A8]">
            Movement in your book over the last 7 days — won, lost, and newly created.
          </p>
        </div>
        <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">{range}</span>
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
        <ThisWeekColumnCard title="Closed Won" accent="#2E7D5B" sign="+" goodWhenUp column={thisWeek.won} />
        <ThisWeekColumnCard title="Closed Lost" accent="#F37167" sign="−" goodWhenUp={false} column={thisWeek.lost} />
        <ThisWeekColumnCard title="Newly Created" accent="#403770" sign="+" goodWhenUp column={thisWeek.created} />
      </div>
    </div>
  );
}
