"use client";

import { rankPercentile } from "@/features/home/lib/rank-percentile";

interface RankPillProps {
  rank: number;
  totalReps: number;
  inRoster: boolean;
}

// Bottom-right standing pill: "#3/12 · top 25%". Leader (#1) gets the plum fill +
// golden accent; everyone else a subtle plum-neutral chip. Out-of-roster (the
// admin viewing her own dashboard) shows a muted "Not ranked".
export default function RankPill({ rank, totalReps, inRoster }: RankPillProps) {
  if (!inRoster) {
    return <span className="text-[11px] font-medium text-[#A69DC0] whitespace-nowrap">Not ranked</span>;
  }
  const isLeader = rank === 1;
  const pct = rankPercentile(rank, totalReps);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
        isLeader ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#5C5378]"
      }`}
    >
      <span className="tabular-nums">#{rank}/{totalReps}</span>
      <span className={isLeader ? "text-[#FFCF70]" : "text-[#8A80A8]"}>
        {isLeader ? "leader" : `top ${pct}%`}
      </span>
    </span>
  );
}
