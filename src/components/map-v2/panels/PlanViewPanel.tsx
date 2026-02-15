"use client";

import { useMapV2Store } from "@/lib/map-v2-store";

export default function PlanViewPanel() {
  const goBack = useMapV2Store((s) => s.goBack);
  const activePlanId = useMapV2Store((s) => s.activePlanId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
        <span className="text-sm font-medium text-gray-700">Plan Details</span>
      </div>

      {/* Content placeholder */}
      <div className="flex-1 p-3 space-y-3">
        {/* Plan name placeholder */}
        <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-5 bg-plum/10 rounded-full w-16 animate-pulse" />
          <div className="h-5 bg-gray-100 rounded-full w-20 animate-pulse" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>

        {/* Districts list placeholder */}
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Plan Districts
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
              <div className="h-3.5 bg-gray-200 rounded w-3/4 mb-1" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center pt-2">
          Plan ID: {activePlanId || "—"}
        </p>
      </div>
    </div>
  );
}
