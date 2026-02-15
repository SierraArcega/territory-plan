"use client";

import { useMapV2Store } from "@/lib/map-v2-store";

export default function MultiSelectChip() {
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const clearSelectedDistricts = useMapV2Store((s) => s.clearSelectedDistricts);
  const createPlanFromSelection = useMapV2Store((s) => s.createPlanFromSelection);

  if (selectedLeaids.size === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 z-20 chip-enter">
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-2.5 border border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          {selectedLeaids.size} district{selectedLeaids.size !== 1 ? "s" : ""}{" "}
          selected
        </span>

        <button
          onClick={createPlanFromSelection}
          className="px-3 py-1.5 bg-plum text-white text-xs font-medium rounded-xl hover:bg-plum/90 transition-all hover:scale-105"
        >
          Create Plan
        </button>

        <button
          onClick={clearSelectedDistricts}
          className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Clear selection"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 2L8 8M8 2L2 8"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
