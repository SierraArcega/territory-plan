"use client";

import type { ThisWeek } from "@/features/home/lib/pipeline-source";

// Last-7-days movement: deals won / lost / created.
export default function ThisWeekCard({ thisWeek }: { thisWeek: ThisWeek }) {
  const cells: { label: string; value: number; color: string }[] = [
    { label: "Won", value: thisWeek.won, color: "#2E7D5B" },
    { label: "Lost", value: thisWeek.lost, color: "#F37167" },
    { label: "Created", value: thisWeek.created, color: "#403770" },
  ];
  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">This week</h3>
        <p className="text-xs text-[#8A80A8]">Your deal movement over the last 7 days.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col items-center gap-0.5 rounded-md bg-[#F7F5FA] py-3">
            <span className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
