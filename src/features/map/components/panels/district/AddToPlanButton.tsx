"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  useTerritoryPlans,
  useAddDistrictsToPlan,
  useCreateTerritoryPlan,
  type TerritoryPlan,
} from "@/lib/api";

interface AddToPlanButtonProps {
  leaid: string;
  existingPlanIds?: string[];
  onAdded?: (planId: string) => void;
}

const PLAN_COLORS = [
  { name: "Plum", value: "#403770" },
  { name: "Coral", value: "#F37167" },
  { name: "Steel Blue", value: "#6EA3BE" },
  { name: "Sage", value: "#8AA891" },
  { name: "Gold", value: "#D4A84B" },
];

function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

export default function AddToPlanButton({
  leaid,
  existingPlanIds = [],
  onAdded,
}: AddToPlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanColor, setNewPlanColor] = useState(PLAN_COLORS[0].value);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: plans, isLoading } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();
  const createPlan = useCreateTerritoryPlan();

  // Position the portal dropdown relative to the trigger button
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Position above if near bottom of viewport, otherwise below
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 340; // approximate max height
    const top = spaceBelow < dropdownHeight
      ? rect.top - dropdownHeight - 4
      : rect.bottom + 4;
    const dropdownWidth = 288;
    // Align right edge of dropdown to right edge of button
    const left = rect.right - dropdownWidth;
    setDropdownPos({
      top,
      left: Math.max(8, left), // keep at least 8px from left edge of viewport
      width: dropdownWidth,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
        setShowNewPlanForm(false);
        setNewPlanName("");
        setSearch("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (showNewPlanForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewPlanForm]);

  useEffect(() => {
    if (isOpen && !showNewPlanForm && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, showNewPlanForm]);

  const existingPlanIdsSet = new Set(existingPlanIds);

  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (!search.trim()) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) => p.name.toLowerCase().includes(q));
  }, [plans, search]);

  const handleAddToPlan = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: leaid });
      setIsOpen(false);
      setSearch("");
      onAdded?.(planId);
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
        fiscalYear: getDefaultFiscalYear(),
      });
      await addDistricts.mutateAsync({ planId: plan.id, leaids: leaid });
      setIsOpen(false);
      setShowNewPlanForm(false);
      setNewPlanName("");
      setSearch("");
      onAdded?.(plan.id);
    } catch (error) {
      console.error("Failed to create plan:", error);
    }
  };

  const isInPlan = (plan: TerritoryPlan) => existingPlanIdsSet.has(plan.id);

  const dropdown = isOpen && dropdownPos ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-white rounded-lg shadow-xl border border-[#D4CFE2] z-[9999] overflow-hidden"
      style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
    >
      {isLoading ? (
        <div className="p-4 text-center text-[#8A80A8] text-sm">Loading plans...</div>
      ) : showNewPlanForm ? (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-[#403770]">New Plan</h4>
            <button
              onClick={() => { setShowNewPlanForm(false); setNewPlanName(""); }}
              className="text-[#A69DC0] hover:text-[#6E6390] transition-colors"
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
              if (e.key === "Escape") { setShowNewPlanForm(false); setNewPlanName(""); }
            }}
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
          />

          <div className="mt-3">
            <label className="text-xs text-[#8A80A8] mb-1.5 block">Color</label>
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
          {/* Search input */}
          <div className="p-2 border-b border-[#E2DEEC]">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search plans..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setIsOpen(false); setSearch(""); }
                }}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#E2DEEC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#403770] focus:border-[#403770] placeholder:text-[#A69DC0]"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filteredPlans.length > 0 ? (
              filteredPlans.map((plan) => {
                const alreadyIn = isInPlan(plan);
                return (
                  <button
                    key={plan.id}
                    onClick={() => !alreadyIn && handleAddToPlan(plan.id)}
                    disabled={alreadyIn || addDistricts.isPending}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      alreadyIn ? "bg-[#F7F5FA] cursor-default" : "hover:bg-[#EFEDF5]"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: plan.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#403770] truncate">{plan.name}</p>
                      <p className="text-xs text-[#8A80A8]">
                        {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {alreadyIn && (
                      <svg className="w-4 h-4 text-[#8AA891] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : search.trim() ? (
              <div className="px-4 py-6 text-center text-[#8A80A8] text-sm">
                No plans matching &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[#8A80A8] text-sm">
                No plans yet. Create your first one below.
              </div>
            )}
          </div>

          <div className="border-t border-[#E2DEEC]">
            <button
              onClick={() => setShowNewPlanForm(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#403770] hover:bg-[#EFEDF5] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create new plan
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
        disabled={addDistricts.isPending || createPlan.isPending}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add to Plan
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
