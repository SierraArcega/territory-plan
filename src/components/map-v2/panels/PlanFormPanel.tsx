"use client";

import { useMapV2Store } from "@/lib/map-v2-store";

export default function PlanFormPanel() {
  const goBack = useMapV2Store((s) => s.goBack);
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);

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
        <span className="text-sm font-medium text-gray-700">New Plan</span>
      </div>

      {/* Form */}
      <div className="flex-1 p-3 space-y-4">
        {selectedLeaids.size > 0 && (
          <div className="bg-plum/5 rounded-xl px-3 py-2 text-xs text-plum font-medium">
            {selectedLeaids.size} district{selectedLeaids.size !== 1 ? "s" : ""}{" "}
            pre-selected
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Plan Name
          </label>
          <input
            type="text"
            placeholder="e.g., Q3 Texas Expansion"
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Fiscal Year
          </label>
          <select className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 text-gray-700">
            <option value="fy26">FY 2026</option>
            <option value="fy27">FY 2027</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Description{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            placeholder="Describe this plan..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400 resize-none"
          />
        </div>

        <button className="w-full py-2.5 bg-plum text-white text-sm font-medium rounded-xl hover:bg-plum/90 transition-all hover:shadow-md">
          Create Plan
        </button>
      </div>
    </div>
  );
}
