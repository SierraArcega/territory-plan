"use client";

import { useState } from "react";
import type { FeatureCollection, Point, Feature } from "geojson";
import ContactCard from "./ContactCard";

const PAGE_SIZE = 50;

interface ContactsTabProps {
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
            <div className="h-2.5 bg-[#f0edf5] rounded w-1/2" />
            <div className="flex gap-2">
              <div className="h-2.5 bg-[#f0edf5] rounded w-16" />
              <div className="h-2.5 bg-[#f0edf5] rounded w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContactsTab({ data, isLoading }: ContactsTabProps) {
  const features = data?.features ?? [];
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (isLoading) return <SkeletonCards />;

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm text-[#8A80A8]">No contacts in the current view</p>
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
        <ContactCard
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
