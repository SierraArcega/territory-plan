"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useCreateTerritoryPlan, useAddDistrictsToPlan } from "@/lib/api";

export default function PlanFormPanel() {
  const goBack = useMapV2Store((s) => s.goBack);
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const createPlan = useMapV2Store((s) => s.createPlan);
  const clearSelectedDistricts = useMapV2Store((s) => s.clearSelectedDistricts);

  const [name, setName] = useState("");
  const [fiscalYear, setFiscalYear] = useState(2026);
  const [description, setDescription] = useState("");

  const createMutation = useCreateTerritoryPlan();
  const addDistrictsMutation = useAddDistrictsToPlan();

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const plan = await createMutation.mutateAsync({
        name: name.trim(),
        fiscalYear,
        description: description.trim() || undefined,
        status: "planning",
      });

      // If we have pre-selected districts, add them
      if (selectedLeaids.size > 0 && plan.id) {
        await addDistrictsMutation.mutateAsync({
          planId: plan.id,
          leaids: Array.from(selectedLeaids),
        });
        clearSelectedDistricts();
      }

      // Transition to PLAN_ADD to let user add more districts
      createPlan(plan.id);
    } catch {
      // Error handled by mutation
    }
  };

  const isSubmitting = createMutation.isPending || addDistrictsMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          onClick={goBack}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Go back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          New Plan
        </span>
      </div>

      {/* Form */}
      <div className="flex-1 p-3 space-y-4">
        {selectedLeaids.size > 0 && (
          <div className="bg-plum/5 rounded-xl px-3 py-2 text-xs text-plum font-medium flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1C4.5 1 2.5 3.5 2.5 6C2.5 9 7 13 7 13S11.5 9 11.5 6C11.5 3.5 9.5 1 7 1Z" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="7" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {selectedLeaids.size} district{selectedLeaids.size !== 1 ? "s" : ""} will be added
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Plan Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Q3 Texas Expansion"
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Fiscal Year
          </label>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 text-gray-700"
          >
            <option value={2026}>FY 2026</option>
            <option value={2027}>FY 2027</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Description{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this plan..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400 resize-none"
          />
        </div>

        {createMutation.isError && (
          <div className="bg-red-50 text-red-600 text-xs rounded-xl px-3 py-2">
            Failed to create plan. Please try again.
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!name.trim() || isSubmitting}
          className="w-full py-2.5 bg-plum text-white text-sm font-medium rounded-xl hover:bg-plum/90 transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full tile-loading-spinner" />
              Creating...
            </span>
          ) : (
            "Create Plan"
          )}
        </button>
      </div>
    </div>
  );
}
