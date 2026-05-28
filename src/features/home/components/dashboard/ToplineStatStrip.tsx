"use client";

import { useTopline } from "@/features/home/lib/queries";
import StatCard from "./StatCard";

interface ToplineStatStripProps {
  fy: number;
}

export default function ToplineStatStrip({ fy }: ToplineStatStripProps) {
  const { data, isLoading, isError, refetch } = useTopline(fy);

  if (isError) {
    return (
      <div className="rounded-lg border border-[#D4CFE2] bg-white p-6 text-center">
        <p className="text-sm text-[#5C5378]">Couldn&apos;t load your topline metrics.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-[#F37167] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[110px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {data.cards.map((card) => (
        <StatCard
          key={card.metricKey}
          label={card.label}
          value={card.value}
          rank={card.rank}
          totalReps={card.totalReps}
          inRoster={card.inRoster}
        />
      ))}
    </div>
  );
}
