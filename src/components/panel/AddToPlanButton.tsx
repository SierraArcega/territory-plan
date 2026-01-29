"use client";

import { useState, useRef, useEffect } from "react";
import {
  useTerritoryPlans,
  useAddDistrictsToPlan,
  useCreateTerritoryPlan,
  type TerritoryPlan,
} from "@/lib/api";

interface AddToPlanButtonProps {
  leaid: string;
  existingPlanIds?: string[]; // Plans this district is already in
}

// Available plan colors
const PLAN_COLORS = [
  { name: "Plum", value: "#403770" },
  { name: "Coral", value: "#F37167" },
  { name: "Steel Blue", value: "#6EA3BE" },
  { name: "Sage", value: "#8AA891" },
  { name: "Gold", value: "#D4A84B" },
];

export default function AddToPlanButton({
  leaid,
  existingPlanIds = [],
}: AddToPlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanColor, setNewPlanColor] = useState(PLAN_COLORS[0].value);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: plans, isLoading } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();
  const createPlan = useCreateTerritoryPlan();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowNewPlanForm(false);
        setNewPlanName("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when showing new plan form
  useEffect(() => {
    if (showNewPlanForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewPlanForm]);

  const existingPlanIdsSet = new Set(existingPlanIds);

  const handleAddToPlan = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: leaid });
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to add district to plan:", error);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPlanName.trim()) return;

    try {
      const plan = await createPlan.mutateAsync({
        name: newPlanName.trim(),
        color: newPlanColor,
      });
      await addDistricts.mutateAsync({ planId: plan.id, leaids: leaid });
      setIsOpen(false);
      setShowNewPlanForm(false);
      setNewPlanName("");
    } catch (error) {
      console.error("Failed to create plan:", error);
    }
  };

  const isInPlan = (plan: TerritoryPlan) => existingPlanIdsSet.has(plan.id);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
        disabled={addDistricts.isPending || createPlan.isPending}
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
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
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
                {createPlan.isPending ? "Creating..." : "Create & Add District"}
              </button>
            </div>
          ) : (
            <>
              {/* Existing plans */}
              <div className="max-h-64 overflow-y-auto">
                {plans && plans.length > 0 ? (
                  plans.map((plan) => {
                    const alreadyIn = isInPlan(plan);
                    return (
                      <button
                        key={plan.id}
                        onClick={() => !alreadyIn && handleAddToPlan(plan.id)}
                        disabled={alreadyIn || addDistricts.isPending}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          alreadyIn
                            ? "bg-gray-50 cursor-default"
                            : "hover:bg-gray-50"
                        }`}
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
                        {alreadyIn && (
                          <svg
                            className="w-5 h-5 text-[#8AA891] flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })
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
  );
}
