"use client";

import { TRANSITION_BUCKETS, type TransitionBucket } from "@/features/map/lib/comparison";
import { useComparisonSummary } from "@/features/map/lib/useComparisonSummary";
import { useMapV2Store } from "@/features/map/lib/store";

function formatFy(fy: string): string {
  return fy.replace("fy", "FY");
}

function Skeleton() {
  return (
    <div className="space-y-2 px-3 py-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-plum/10 animate-pulse" />
          <div className="h-3 w-20 bg-plum/10 rounded animate-pulse" />
          <div className="h-3 w-16 bg-plum/10 rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function TransitionLegend() {
  const compareFyA = useMapV2Store((s) => s.compareFyA);
  const compareFyB = useMapV2Store((s) => s.compareFyB);
  const { data, isLoading } = useComparisonSummary();

  return (
    <div className="absolute bottom-6 left-6 z-10">
      <div
        className="bg-off-white/85 backdrop-blur-md rounded-xl ring-1 ring-plum/[0.06] border border-white/60 min-w-[260px]"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)" }}
      >
        {/* Header */}
        <div className="px-3 pt-3 pb-1.5">
          <span className="text-xs font-semibold text-plum">
            {formatFy(compareFyA)} → {formatFy(compareFyB)} Changes
          </span>
        </div>

        {isLoading ? (
          <Skeleton />
        ) : (
          <div className="px-3 pb-3 space-y-1">
            {TRANSITION_BUCKETS.map((bucket) => {
              const bucketData = data?.buckets[bucket.id as TransitionBucket];
              const count = bucketData?.count ?? 0;
              const isUnchanged = bucket.id === "unchanged";

              return (
                <div key={bucket.id} className="flex items-center gap-2">
                  {/* Colored dot -- unchanged uses open circle */}
                  {isUnchanged ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border-2"
                      style={{ borderColor: bucket.color }}
                    />
                  ) : (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: bucket.color }}
                    />
                  )}

                  <span className="text-xs font-medium text-plum/70 flex-1">
                    {bucket.label}
                  </span>

                  <span className="text-xs tabular-nums text-plum">
                    {count.toLocaleString()} {count === 1 ? "district" : "districts"}
                  </span>
                </div>
              );
            })}

            {/* Total */}
            {data && (
              <div className="flex items-center gap-2 pt-1 border-t border-plum/10 mt-1">
                <span className="text-xs font-semibold text-plum/70 flex-1">
                  Total
                </span>
                <span className="text-xs font-semibold tabular-nums text-plum">
                  {data.total.count.toLocaleString()} districts
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
