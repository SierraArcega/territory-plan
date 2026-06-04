"use client";

import { useVelocity } from "@/features/home/lib/queries";
import VelocityCell from "./VelocityCell";

interface VelocityCardProps {
  fy: number;
  repScope: string;
}

// Velocity card at the top of the Pipeline tab: four ranked "how fast and how
// cleanly you're closing" metrics. Owns its own query so it mounts/unmounts with
// the tab.
export default function VelocityCard({ fy, repScope }: VelocityCardProps) {
  const { data, isLoading, isError, refetch } = useVelocity(fy, repScope);

  return (
    <div className="rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-[#403770] whitespace-nowrap">Velocity</h3>
        <p className="text-sm text-[#8A80A8]">How fast and how cleanly you&apos;re closing.</p>
      </div>

      {isError ? (
        <div className="text-center py-4">
          <p className="text-sm text-[#5C5378]">Couldn&apos;t load velocity metrics.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#F37167] hover:underline">
            Retry
          </button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-lg bg-[#F7F5FA] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
          {data.cells.map((c) => (
            <VelocityCell key={c.metricKey} cell={c} />
          ))}
        </div>
      )}
    </div>
  );
}
