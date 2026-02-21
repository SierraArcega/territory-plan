"use client";

import { useState, useRef, useEffect } from "react";
import { useMapStore } from "@/lib/store";
import {
  useTerritoryPlans,
  useAddDistrictsToPlan,
  useCreateTerritoryPlan,
} from "@/lib/api";

const PLAN_COLORS = [
  { name: "Plum", value: "#403770" },
  { name: "Coral", value: "#F37167" },
  { name: "Steel Blue", value: "#6EA3BE" },
  { name: "Sage", value: "#8AA891" },
  { name: "Gold", value: "#D4A84B" },
];

// Get default fiscal year based on current date
function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

export default function MultiSelectActionBar() {
  const {
    multiSelectMode,
    selectedLeaids,
    clearSelectedDistricts,
    toggleMultiSelectMode,
  } = useMapStore();

  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanColor, setNewPlanColor] = useState(PLAN_COLORS[0].value);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: plans, isLoading } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();
  const createPlan = useCreateTerritoryPlan();

  const selectedCount = selectedLeaids.size;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowPlanDropdown(false);
        setShowNewPlanForm(false);
        setNewPlanName("");
      }
    }

    if (showPlanDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPlanDropdown]);

  // Focus input when showing new plan form
  useEffect(() => {
    if (showNewPlanForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewPlanForm]);

  if (!multiSelectMode || selectedCount === 0) {
    return null;
  }

  const handleAddToPlan = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({
        planId,
        leaids: Array.from(selectedLeaids),
      });
      clearSelectedDistricts();
      setShowPlanDropdown(false);
    } catch (error) {
      console.error("Failed to add districts to plan:", error);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPlanName.trim()) return;

    try {
      const plan = await createPlan.mutateAsync({
        name: newPlanName.trim(),
        color: newPlanColor,
        fiscalYear: getDefaultFiscalYear(),
      });
      await addDistricts.mutateAsync({
        planId: plan.id,
        leaids: Array.from(selectedLeaids),
      });
      clearSelectedDistricts();
      setShowPlanDropdown(false);
      setShowNewPlanForm(false);
      setNewPlanName("");
    } catch (error) {
      console.error("Failed to create plan:", error);
    }
  };

  const handleDone = () => {
    clearSelectedDistricts();
    toggleMultiSelectMode();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-3 bg-white rounded-xl shadow-xl border border-gray-200 px-4 py-3">
        {/* Selected count */}
        <div className="flex items-center gap-2 text-sm text-[#403770] font-medium pr-3 border-r border-gray-200">
          <div className="w-6 h-6 rounded-full bg-[#6EA3BE] flex items-center justify-center text-white text-xs font-bold">
            {selectedCount}
          </div>
          <span>
            district{selectedCount !== 1 ? "s" : ""} selected
          </span>
        </div>

        {/* Add to Plan button with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowPlanDropdown(!showPlanDropdown)}
            disabled={addDistricts.isPending || createPlan.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add to Plan
            <svg
              className={`w-4 h-4 transition-transform ${showPlanDropdown ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>

          {/* Dropdown - positioned above the button */}
          {showPlanDropdown && (
            <div className="absolute bottom-full mb-2 left-0 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading plans...
                </div>
              ) : showNewPlanForm ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-[#403770]">New Plan</h4>
                    <button
                      onClick={() => {
                        setShowNewPlanForm(false);
                        setNewPlanName("");
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Plan name"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateAndAdd();
                      if (e.key === "Escape") {
                        setShowNewPlanForm(false);
                        setNewPlanName("");
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                  />

                  {/* Color picker */}
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 mb-1.5 block">Color</label>
                    <div className="flex gap-2">
                      {PLAN_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNewPlanColor(color.value)}
                          className={`w-6 h-6 rounded-full transition-all ${
                            newPlanColor === color.value
                              ? "ring-2 ring-offset-2 ring-[#403770]"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleCreateAndAdd}
                    disabled={!newPlanName.trim() || createPlan.isPending}
                    className="w-full mt-4 px-3 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createPlan.isPending ? "Creating..." : `Create & Add ${selectedCount} Districts`}
                  </button>
                </div>
              ) : (
                <>
                  {/* Existing plans */}
                  <div className="max-h-48 overflow-y-auto">
                    {plans && plans.length > 0 ? (
                      plans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => handleAddToPlan(plan.id)}
                          disabled={addDistricts.isPending}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: plan.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#403770] truncate">
                              {plan.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        No plans yet. Create your first one below.
                      </div>
                    )}
                  </div>

                  {/* Create new plan option */}
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => setShowNewPlanForm(true)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#403770] hover:bg-gray-50 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Create new plan
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Clear selection */}
        <button
          onClick={clearSelectedDistricts}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Clear
        </button>

        {/* Done */}
        <button
          onClick={handleDone}
          className="px-3 py-2 text-sm font-medium text-[#8AA891] hover:text-[#6d8875] hover:bg-green-50 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
