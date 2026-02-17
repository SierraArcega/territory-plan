"use client";

import { useMapV2Store, type ExploreEntity } from "@/lib/map-v2-store";
import { useExploreData } from "@/lib/api";

const ENTITY_TABS: { key: ExploreEntity; label: string; path: string; stroke: boolean }[] = [
  { key: "districts", label: "Districts", path: "M3 3H7V7H3V3ZM9 3H13V7H9V3ZM3 9H7V13H3V9ZM9 9H13V13H9V9Z", stroke: false },
  { key: "activities", label: "Activities", path: "M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3", stroke: true },
  { key: "tasks", label: "Tasks", path: "M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13M3 12H5V14H3V12ZM7 12.5H13", stroke: true },
  { key: "contacts", label: "Contacts", path: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13", stroke: true },
];

export default function ExploreOverlay() {
  const isExploreActive = useMapV2Store((s) => s.isExploreActive);
  const exploreEntity = useMapV2Store((s) => s.exploreEntity);
  const setExploreEntity = useMapV2Store((s) => s.setExploreEntity);
  const setActiveIconTab = useMapV2Store((s) => s.setActiveIconTab);
  const exploreFilters = useMapV2Store((s) => s.exploreFilters);
  const exploreSort = useMapV2Store((s) => s.exploreSort);
  const explorePage = useMapV2Store((s) => s.explorePage);

  // Fetch data
  const { data: result, isLoading } = useExploreData(exploreEntity, {
    filters: exploreFilters[exploreEntity],
    sort: exploreSort[exploreEntity],
    page: explorePage,
  });

  if (!isExploreActive) return null;

  return (
    <div className="absolute inset-0 z-20 flex bg-white">
      {/* Left sidebar: back + entity tabs */}
      <div className="w-14 bg-white border-r border-gray-200/60 flex flex-col items-center pt-3 gap-1 shrink-0">
        {/* Back to map button */}
        <button
          onClick={() => setActiveIconTab("home")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all group relative"
          title="Back to Map"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8L10 4" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Back to Map
          </span>
        </button>

        <div className="w-6 border-t border-gray-200 my-1" />

        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setExploreEntity(tab.key)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all group relative ${
              exploreEntity === tab.key
                ? "bg-plum/10 shadow-sm"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            title={tab.label}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill={!tab.stroke && exploreEntity === tab.key ? "#403770" : "none"}
              stroke={tab.stroke || exploreEntity !== tab.key ? (exploreEntity === tab.key ? "#403770" : "#9CA3AF") : "none"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.path} />
            </svg>
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">
            Explore {exploreEntity.charAt(0).toUpperCase() + exploreEntity.slice(1)}
          </h1>
          <span className="text-sm text-gray-400">
            {result?.pagination?.total?.toLocaleString() || "\u2014"} total
          </span>
        </div>

        {/* Filter bar placeholder */}
        <div className="bg-white border-b border-gray-200 px-6 py-2 shrink-0">
          <span className="text-xs text-gray-400">Filters &amp; column picker will appear here</span>
        </div>

        {/* KPI cards placeholder */}
        <div className="px-6 py-3 shrink-0">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 h-[68px]">
                <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Table placeholder */}
        <div className="flex-1 px-6 pb-6 overflow-hidden">
          <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-plum/20 border-t-plum rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Loading {exploreEntity}...</span>
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                {result?.data?.length || 0} {exploreEntity} loaded — table coming next
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
