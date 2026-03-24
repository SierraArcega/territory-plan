"use client";

import { useMemo } from "react";
import type { FeatureCollection, Point, Feature } from "geojson";
import { useMapV2Store } from "@/features/map/lib/store";
import VacancyCard from "./VacancyCard";

interface VacanciesTabProps {
  data: FeatureCollection<Point> | undefined;
  isLoading: boolean;
}

function SkeletonCards() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-[#E2DEEC] animate-pulse">
          <div className="space-y-2">
            <div className="h-3.5 bg-[#f0edf5] rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-4 bg-[#f0edf5] rounded w-24" />
              <div className="h-4 bg-[#f0edf5] rounded w-16" />
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

export default function VacanciesTab({ data, isLoading }: VacanciesTabProps) {
  const pinnedVacancyIds = useMapV2Store((s) => s.pinnedVacancyIds);
  const setPinnedVacancyIds = useMapV2Store((s) => s.setPinnedVacancyIds);
  const setExploreModalLeaid = useMapV2Store((s) => s.setExploreModalLeaid);

  const allFeatures = data?.features ?? [];

  const features = useMemo(() => {
    if (!pinnedVacancyIds) return allFeatures;
    const pinned = new Set(pinnedVacancyIds);
    return allFeatures.filter((f) => pinned.has(String(f.properties?.id)));
  }, [allFeatures, pinnedVacancyIds]);

  if (isLoading) return <SkeletonCards />;

  if (features.length === 0 && !pinnedVacancyIds) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-[#8A80A8]">No vacancies in the current view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {pinnedVacancyIds && (
        <div className="flex items-center justify-between rounded-lg bg-[#F7F5FA] px-3 py-2 mb-1">
          <p className="text-xs text-[#403770]">
            <span className="font-semibold">{pinnedVacancyIds.length} vacancies</span>{" "}
            <span className="text-[#8A80A8]">in cluster</span>
          </p>
          <button
            onClick={() => setPinnedVacancyIds(null)}
            className="text-xs font-medium text-[#403770] hover:text-[#5B4E91] transition-colors cursor-pointer"
          >
            Show all
          </button>
        </div>
      )}
      {features.map((feature, i) => (
        <VacancyCard
          key={feature.properties?.id ?? feature.id ?? i}
          feature={feature as Feature<Point>}
          onClick={() =>
            setExploreModalLeaid(
              feature.properties?.leaid,
              "vacancies",
              feature.properties?.id
            )
          }
        />
      ))}
    </div>
  );
}
