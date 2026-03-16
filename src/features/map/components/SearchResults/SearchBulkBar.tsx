"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useTerritoryPlans, useAddDistrictsToPlan } from "@/lib/api";

interface SearchBulkBarProps {
  selectedCount: number;
}

export default function SearchBulkBar({ selectedCount }: SearchBulkBarProps) {
  const selectedDistrictLeaids = useMapV2Store((s) => s.selectedDistrictLeaids);
  const clearDistrictSelection = useMapV2Store((s) => s.clearDistrictSelection);
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: plans } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();

  useEffect(() => {
    if (!showPlanDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPlanDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlanDropdown]);

  const handleAddToPlan = async (planId: string) => {
    try {
      const leaids = [...selectedDistrictLeaids];
      await addDistricts.mutateAsync({ planId, leaids });
      setShowPlanDropdown(false);
      clearDistrictSelection();
    } catch (error) {
      console.error("Failed to add districts to plan:", error);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 bg-white border-t border-[#D4CFE2] px-3 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#6E6390]">
          {selectedCount} selected
        </span>

        <div className="flex items-center gap-1.5">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowPlanDropdown(!showPlanDropdown)}
              disabled={addDistricts.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-plum hover:bg-plum/90 disabled:opacity-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {addDistricts.isPending ? "Adding..." : "Add to Plan"}
            </button>

            {showPlanDropdown && plans && (
              <div className="absolute right-0 bottom-full mb-1 w-56 bg-white rounded-lg shadow-xl border border-[#D4CFE2] overflow-hidden z-50">
                <div className="max-h-48 overflow-y-auto">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleAddToPlan(plan.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#EFEDF5] transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                      <span className="truncate text-[#544A78]">{plan.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={clearDistrictSelection}
            className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#8A80A8] hover:text-[#544A78] hover:bg-[#EFEDF5] transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
