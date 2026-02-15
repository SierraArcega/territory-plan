"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import { getLayerConfig } from "@/lib/map-v2-layers";
import SearchBar from "../SearchBar";
import LayerPicker from "../LayerPicker";
import LayerLegend from "../LayerLegend";

export default function BrowsePanel() {
  const activeLayer = useMapV2Store((s) => s.activeLayer);
  const config = getLayerConfig(activeLayer);

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

      {/* Layer list */}
      <div className="flex-1 px-3 pt-3 pb-1 overflow-y-auto min-h-0">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          {activeLayer === "customers" && "Districts by Status"}
          {activeLayer === "state" && "States"}
          {activeLayer === "owner" && "Sales Executives"}
          {activeLayer === "territory_plan" && "Territory Plans"}
          {activeLayer === "competitors" && "Competitors"}
          {activeLayer === "enrollment" && "Districts by Enrollment"}
          {activeLayer === "revenue" && "Districts by Revenue"}
        </div>

        {/* Legend entries as clickable list items */}
        <div className="space-y-1">
          {config.legend.map((entry) => (
            <button
              key={entry.label}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-left group"
            >
              <span
                className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="flex-1 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                {entry.label}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="text-gray-300 group-hover:text-gray-400 transition-colors"
              >
                <path
                  d="M4.5 3L7.5 6L4.5 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Compact legend */}
      <LayerLegend />
    </div>
  );
}
