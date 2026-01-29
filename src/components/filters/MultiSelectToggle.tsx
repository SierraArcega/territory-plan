"use client";

import { useMapStore } from "@/lib/store";

export default function MultiSelectToggle() {
  const { multiSelectMode, toggleMultiSelectMode, selectedLeaids } =
    useMapStore();

  const selectedCount = selectedLeaids.size;

  return (
    <button
      onClick={toggleMultiSelectMode}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
        multiSelectMode
          ? "bg-[#6EA3BE] text-white"
          : "text-gray-600 border border-gray-300 hover:border-[#403770] hover:text-[#403770]"
      }`}
      title={multiSelectMode ? "Exit multi-select mode" : "Select multiple districts"}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {multiSelectMode ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        )}
      </svg>
      {multiSelectMode ? "Multi-Select On" : "Multi-Select"}
      {/* Badge for selected count */}
      {multiSelectMode && selectedCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-[#F37167] text-white rounded-full">
          {selectedCount}
        </span>
      )}
    </button>
  );
}
