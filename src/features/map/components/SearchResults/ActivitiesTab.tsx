"use client";

import type { FeatureCollection, Point, Feature } from "geojson";
import ActivityCard from "./ActivityCard";

interface ActivitiesTabProps {
  data: FeatureCollection<Point> | undefined;
  isLoading: boolean;
}

function SkeletonCards() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-[#E2DEEC] animate-pulse">
          <div className="space-y-2">
            <div className="h-3.5 bg-[#f0edf5] rounded w-2/3" />
            <div className="flex gap-2">
              <div className="h-4 bg-[#f0edf5] rounded w-16" />
              <div className="h-2.5 bg-[#f0edf5] rounded w-24" />
            </div>
            <div className="flex gap-2">
              <div className="h-2.5 bg-[#f0edf5] rounded w-28" />
              <div className="h-2.5 bg-[#f0edf5] rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ActivitiesTab({ data, isLoading }: ActivitiesTabProps) {
  const features = data?.features ?? [];

  if (isLoading) return <SkeletonCards />;

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-[#8A80A8]">No activities in the current view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {features.map((feature, i) => (
        <ActivityCard
          key={feature.properties?.id ?? feature.id ?? i}
          feature={feature as Feature<Point>}
        />
      ))}
    </div>
  );
}
