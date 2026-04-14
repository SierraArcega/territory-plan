"use client";

import { useState } from "react";
import type { FeatureCollection, Point, Feature } from "geojson";
import ActivityCard from "./ActivityCard";

const PAGE_SIZE = 50;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const visibleFeatures = features.slice(0, visibleCount);
  const hasMore = visibleCount < features.length;

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {features.length > 200 && (
        <div className="flex items-center gap-2 rounded-lg bg-[#C4E7E6]/30 px-3 py-2">
          <svg className="w-3.5 h-3.5 text-[#6EA3BE] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <p className="text-[11px] text-[#544A78]">
            <span className="font-semibold">{features.length.toLocaleString()} results</span>
            {" \u2014 try adding filters to narrow down"}
          </p>
        </div>
      )}
      {visibleFeatures.map((feature, i) => (
        <ActivityCard
          key={feature.properties?.id ?? feature.id ?? i}
          feature={feature as Feature<Point>}
        />
      ))}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-2 rounded-lg text-xs font-medium text-[#544A78] bg-[#F7F5FA] hover:bg-[#EFEDF5] transition-colors"
        >
          Show more ({features.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}
