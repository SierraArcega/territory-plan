"use client";

import { useMapV2Store } from "@/lib/map-v2-store";

export default function SearchBar() {
  const searchQuery = useMapV2Store((s) => s.searchQuery);
  const setSearchQuery = useMapV2Store((s) => s.setSearchQuery);

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10.5 10.5L14 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search districts..."
        className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400 transition-all"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
          aria-label="Clear search"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 2L8 8M8 2L2 8"
              stroke="#6B7280"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
