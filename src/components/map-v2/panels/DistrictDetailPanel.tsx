"use client";

import { useMapV2Store } from "@/lib/map-v2-store";

export default function DistrictDetailPanel() {
  const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
  const goBack = useMapV2Store((s) => s.goBack);

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100">
        <button
          onClick={goBack}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Go back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M9 3L5 7L9 11"
              stroke="#6B7280"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">
          District Detail
        </span>
      </div>

      {/* Content placeholder */}
      <div className="flex-1 p-3 space-y-3">
        {/* Name placeholder */}
        <div>
          <div className="h-5 bg-gray-200 rounded w-4/5 mb-1 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
        </div>

        {/* Status badge placeholder */}
        <div className="h-6 bg-plum/10 rounded-full w-28 animate-pulse" />

        {/* Metrics placeholder */}
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
              <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>

        {/* Add to plan button placeholder */}
        <button className="w-full py-2.5 bg-plum text-white text-sm font-medium rounded-xl hover:bg-plum/90 transition-all">
          + Add to Plan
        </button>

        {/* Expandable sections placeholder */}
        {["Financials", "Demographics", "Staffing", "Contacts"].map(
          (section) => (
            <div
              key={section}
              className="border border-gray-100 rounded-xl p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  {section}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          )
        )}

        <p className="text-xs text-gray-400 text-center pt-2">
          LEAID: {selectedLeaid || "—"}
        </p>
      </div>
    </div>
  );
}
