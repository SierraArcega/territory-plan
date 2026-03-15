"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useDistrictDetail, useTerritoryPlans, useAddDistrictsToPlan } from "@/lib/api";

// ─── DistrictSelectionRow ────────────────────────────────────────────────────
// One row per selected district: deselect checkbox, name/meta, per-district
// "+ Plan" dropdown, and an "Explore" button that drills into the district panel.

function DistrictSelectionRow({ leaid }: { leaid: string }) {
  const toggleLeaidSelection = useMapV2Store((s) => s.toggleLeaidSelection);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const { data, isLoading } = useDistrictDetail(leaid);
  const district = data?.district;

  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only fetch plans lazily — when the dropdown is actually opened
  const { data: plans } = useTerritoryPlans({ enabled: planDropdownOpen });
  const addDistricts = useAddDistrictsToPlan();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!planDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPlanDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [planDropdownOpen]);

  const handleAddToPlan = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: [leaid] });
      setPlanDropdownOpen(false);
    } catch {
      // Silent — user can retry; server errors surface in network panel
    }
  };

  // Show skeleton while the district detail loads
  if (isLoading || !district) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
          <div className="h-2.5 bg-gray-100 rounded w-1/3 animate-pulse" />
        </div>
      </div>
    );
  }

  const districtName = district.name ?? `District ${leaid}`;
  const meta = [
    district.stateAbbrev,
    district.enrollment ? `${district.enrollment.toLocaleString()} students` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-50 last:border-0 group">
      {/* Checkbox — clicking deselects this district from the multi-select set */}
      <button
        onClick={() => toggleLeaidSelection(leaid)}
        aria-label={`Deselect ${districtName}`}
        className="w-4 h-4 rounded bg-plum flex items-center justify-center flex-shrink-0 hover:bg-plum/80 transition-colors"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path
            d="M1.5 4.5L3.5 6.5L7.5 2.5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* District name and state / enrollment meta */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-900 truncate">{districtName}</div>
        {meta && <div className="text-[10px] text-gray-400 mt-0.5">{meta}</div>}
      </div>

      {/* Per-row actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* "+ Plan" dropdown — add just this district to a plan */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setPlanDropdownOpen((v) => !v)}
            className="text-[10px] font-semibold bg-plum text-white rounded-md px-2 py-1 hover:bg-plum/90 transition-colors"
          >
            + Plan
          </button>
          {planDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="max-h-40 overflow-y-auto">
                {plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleAddToPlan(plan.id)}
                      disabled={addDistricts.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: plan.color || "#403770" }}
                      />
                      <span className="text-xs text-gray-800 truncate">{plan.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">No plans yet</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Explore — drills into this district's detail panel */}
        <button
          onClick={() => selectDistrict(leaid)}
          aria-label={`Explore ${districtName}`}
          className="text-[10px] font-semibold border border-plum text-plum rounded-md px-2 py-1 hover:bg-plum/5 transition-colors"
        >
          Explore
        </button>
      </div>
    </div>
  );
}

// ─── BulkAddBar ──────────────────────────────────────────────────────────────
// Shown when at least one district is selected; lets the user add all of them
// to a plan in one shot rather than district-by-district.

function BulkAddBar({ leaids }: { leaids: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only fetch plans lazily when the dropdown is open
  const { data: plans } = useTerritoryPlans({ enabled: open });
  const addDistricts = useAddDistrictsToPlan();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAddAll = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids });
      setOpen(false);
    } catch {
      // Silent — user can retry
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#f8f6ff] border-b border-[#ede9fb]">
      <span className="text-[11px] text-[#5a4e8a] flex-1">Add all {leaids.length} to a plan</span>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-semibold bg-plum text-white rounded-md px-3 py-1.5 hover:bg-plum/90 transition-colors"
        >
          + Add All
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {plans && plans.length > 0 ? (
                plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleAddAll(plan.id)}
                    disabled={addDistricts.isPending}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: plan.color || "#403770" }}
                    />
                    <span className="text-sm text-gray-800 truncate">{plan.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">No plans yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SelectionListPanel ───────────────────────────────────────────────────────
// Rendered when panelState === "MULTI_DISTRICT". Shows the full list of
// selected districts, a bulk-add bar, and per-row Explore / Add to Plan actions.

export default function SelectionListPanel() {
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const clearSelectedDistricts = useMapV2Store((s) => s.clearSelectedDistricts);

  // Sort for stable ordering so the list doesn't jump around as the set changes
  const leaids = [...selectedLeaids].sort();
  const count = leaids.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header: count + clear all */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <div className="text-sm font-bold text-gray-900">
            {count} {count === 1 ? "District" : "Districts"} Selected
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Click map to add more</div>
        </div>
        <button
          onClick={clearSelectedDistricts}
          aria-label="Clear all"
          className="text-[11px] font-semibold text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Bulk-add bar — only shown when there are districts to act on */}
      {count > 0 && <BulkAddBar leaids={leaids} />}

      {/* Scrollable list of district rows */}
      <div className="flex-1 overflow-y-auto">
        {leaids.map((leaid) => (
          <DistrictSelectionRow key={leaid} leaid={leaid} />
        ))}
      </div>
    </div>
  );
}
