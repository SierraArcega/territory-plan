"use client";

import SearchBar from "../SearchBar";

export default function SearchPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3">
        <SearchBar />
      </div>

      {/* Placeholder for future browse/filter features */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-gray-200 mb-3">
          <circle cx="18" cy="18" r="11" stroke="currentColor" strokeWidth="2" />
          <path d="M27 27L35 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-gray-400">
          Search for a district by name to explore details and add to plans.
        </p>
      </div>
    </div>
  );
}
