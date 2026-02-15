"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import SearchBar from "../SearchBar";
import LayerPicker from "../LayerPicker";

export default function BrowsePanel() {
  const activeLayer = useMapV2Store((s) => s.activeLayer);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 pb-0">
        <SearchBar />
      </div>

      {/* Layer picker */}
      <div className="px-3 pt-3">
        <LayerPicker />
      </div>

      {/* Layer list placeholder */}
      <div className="flex-1 px-3 pt-3 pb-3 overflow-y-auto">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          {activeLayer === "customers" && "Districts by Status"}
          {activeLayer === "state" && "States"}
          {activeLayer === "owner" && "Sales Executives"}
          {activeLayer === "territory_plan" && "Territory Plans"}
          {activeLayer === "competitors" && "Competitors"}
          {activeLayer === "enrollment" && "Districts by Enrollment"}
          {activeLayer === "revenue" && "Districts by Revenue"}
        </div>

        {/* Placeholder items */}
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-gray-50 p-3 animate-pulse"
            >
              <div className="h-3.5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
