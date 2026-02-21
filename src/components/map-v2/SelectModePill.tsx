"use client";

import { useMapV2Store } from "@/features/map/lib/store";

export default function SelectModePill() {
  const multiSelectMode = useMapV2Store((s) => s.multiSelectMode);
  const toggleMultiSelectMode = useMapV2Store((s) => s.toggleMultiSelectMode);
  const selectedCount = useMapV2Store((s) => s.selectedLeaids.size);

  return (
    <div className="absolute bottom-6 right-6 z-10 mr-[140px]">
      <button
        onClick={toggleMultiSelectMode}
        className={`
          flex items-center gap-2 px-3 py-2
          backdrop-blur-sm rounded-xl shadow-lg border transition-all duration-150
          ${
            multiSelectMode
              ? "bg-plum text-white border-plum/60 ring-2 ring-plum/20 shadow-plum/20"
              : "bg-white/95 text-gray-700 border-gray-200/60 hover:shadow-xl"
          }
        `}
        aria-label={multiSelectMode ? "Exit multi-select mode" : "Enter multi-select mode"}
      >
        {/* Cursor-click icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9l-2 12 4.5-3.5L15 22l2-7 7-2-12-4z" />
          <path d="M1 1l6.5 6.5" />
          <path d="M7 1h-6v6" />
        </svg>
        <span className="text-sm font-medium">
          {multiSelectMode
            ? selectedCount > 0
              ? `${selectedCount} selected`
              : "Selecting..."
            : "Select"}
        </span>
      </button>
    </div>
  );
}
