"use client";

import { useMemo } from "react";
import type { FeatureCollection, Geometry, Feature } from "geojson";
import PlanCard from "./PlanCard";

interface PlansTabProps {
  data: FeatureCollection<Geometry> | undefined;
  isLoading: boolean;
}

/** Skeleton placeholder cards shown during loading. */
function SkeletonCards() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-[#E2DEEC] animate-pulse">
          <div className="space-y-2">
            <div className="h-3.5 bg-[#f0edf5] rounded w-3/4" />
            <div className="h-2.5 bg-[#f0edf5] rounded w-1/2" />
            <div className="flex gap-2">
              <div className="h-2.5 bg-[#f0edf5] rounded w-20" />
              <div className="h-2.5 bg-[#f0edf5] rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlansTab({ data, isLoading }: PlansTabProps) {
  // Plans can have multiple features per plan (one per district).
  // Group by planId and show one card per unique plan.
  const uniquePlans = useMemo(() => {
    if (!data?.features?.length) return [];
    const seen = new Map<string, Feature<Geometry>>();
    for (const feature of data.features) {
      const planId = feature.properties?.planId;
      if (planId && !seen.has(planId)) {
        seen.set(planId, feature);
      }
    }
    return [...seen.values()];
  }, [data]);

  if (isLoading) return <SkeletonCards />;

  if (uniquePlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm text-[#8A80A8]">No plans in the current view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {uniquePlans.map((feature) => (
        <PlanCard key={feature.properties?.planId ?? feature.id} feature={feature} />
      ))}
    </div>
  );
}
