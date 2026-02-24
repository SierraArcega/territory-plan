"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useTerritoryPlans, useAddDistrictsToPlan } from "@/lib/api";

export default function MultiSelectChip() {
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const clearSelectedDistricts = useMapV2Store((s) => s.clearSelectedDistricts);
  const createPlanFromSelection = useMapV2Store((s) => s.createPlanFromSelection);
  const toggleMultiSelectMode = useMapV2Store((s) => s.toggleMultiSelectMode);
  const multiSelectMode = useMapV2Store((s) => s.multiSelectMode);
  const summaryBarVisible = useMapV2Store((s) => s.summaryBarVisible);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: plans } = useTerritoryPlans({ enabled: dropdownOpen });
  const addDistricts = useAddDistrictsToPlan();

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (selectedLeaids.size === 0) return null;

  const handleAddToPlan = async (planId: string, planName: string) => {
    const leaids = [...selectedLeaids];
    try {
      const result = await addDistricts.mutateAsync({ planId, leaids });
      setDropdownOpen(false);
      setToast(`Added ${result.added} district${result.added !== 1 ? "s" : ""} to ${planName}`);
      clearSelectedDistricts();
      if (multiSelectMode) toggleMultiSelectMode();
    } catch {
      setToast("Failed to add districts");
    }
  };

  const handleCreateNew = () => {
    setDropdownOpen(false);
    createPlanFromSelection();
  };

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 z-20 chip-enter ${summaryBarVisible ? "bottom-24" : "bottom-6"}`} ref={dropdownRef}>
      {/* Toast */}
      {toast && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-2.5 border border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          {selectedLeaids.size} district{selectedLeaids.size !== 1 ? "s" : ""}{" "}
          selected
        </span>

        {/* Add to Plan dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-xl transition-all hover:scale-105
              flex items-center gap-1.5
              ${dropdownOpen
                ? "bg-plum/90 text-white"
                : "bg-plum text-white hover:bg-plum/90"}
            `}
          >
            Add to Plan
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              className={`transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
            >
              <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="max-h-48 overflow-y-auto">
                {plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleAddToPlan(plan.id, plan.name)}
                      disabled={addDistricts.isPending}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: plan.color || "#403770" }}
                        />
                        <span className="text-sm text-gray-800 truncate">{plan.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {plan.districtCount} dist.
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">
                    No existing plans
                  </div>
                )}
              </div>

              {/* Divider + Create New */}
              <div className="border-t border-gray-100">
                <button
                  onClick={handleCreateNew}
                  className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-plum">
                    <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm font-medium text-plum">Create New Plan</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Clear selection */}
        <button
          onClick={() => {
            clearSelectedDistricts();
            if (multiSelectMode) toggleMultiSelectMode();
          }}
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
