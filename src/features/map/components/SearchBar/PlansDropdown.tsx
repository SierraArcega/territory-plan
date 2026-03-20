"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useTerritoryPlans } from "@/features/plans/lib/queries";

interface PlansDropdownProps {
  onClose: () => void;
}

const STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "working", label: "Working" },
  { value: "stale", label: "Stale" },
  { value: "archived", label: "Archived" },
];

const FISCAL_YEARS = [
  { value: 24, label: "FY24" },
  { value: 25, label: "FY25" },
  { value: 26, label: "FY26" },
  { value: 27, label: "FY27" },
];

export default function PlansDropdown({ onClose }: PlansDropdownProps) {
  const filters = useMapV2Store((s) => s.layerFilters.plans);
  const setLayerFilter = useMapV2Store((s) => s.setLayerFilter);
  const openResultsPanel = useMapV2Store((s) => s.openResultsPanel);
  const ref = useRef<HTMLDivElement>(null);

  const { data: plans } = useTerritoryPlans();

  const [planSearch, setPlanSearch] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const toggleStatus = useCallback((status: string) => {
    const current = filters.status ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setLayerFilter("plans", { status: next.length ? next : null });
  }, [filters.status, setLayerFilter]);

  const setFiscalYear = useCallback((fy: number | null) => {
    setLayerFilter("plans", { fiscalYear: fy });
  }, [setLayerFilter]);

  const setOwnerScope = useCallback((scope: "mine" | "all") => {
    setLayerFilter("plans", { ownerScope: scope, ownerIds: null });
  }, [setLayerFilter]);

  const togglePlanId = useCallback((planId: string) => {
    const current = filters.planIds ?? [];
    const next = current.includes(planId)
      ? current.filter((id) => id !== planId)
      : [...current, planId];
    setLayerFilter("plans", { planIds: next.length ? next : null });
    if (next.length > 0) openResultsPanel("plans");
  }, [filters.planIds, setLayerFilter, openResultsPanel]);

  const toggleOwnerId = useCallback((ownerId: string) => {
    const current = filters.ownerIds ?? [];
    const next = current.includes(ownerId)
      ? current.filter((id) => id !== ownerId)
      : [...current, ownerId];
    setLayerFilter("plans", { ownerIds: next.length ? next : null, ownerScope: "all" });
  }, [filters.ownerIds, setLayerFilter]);

  // Derive unique owners from plans data
  const owners = useMemo(() => {
    if (!plans) return [];
    const seen = new Map<string, { id: string; fullName: string; avatarUrl: string | null }>();
    for (const plan of plans) {
      if (plan.owner && !seen.has(plan.owner.id)) {
        seen.set(plan.owner.id, {
          id: plan.owner.id,
          fullName: plan.owner.fullName ?? "Unknown",
          avatarUrl: plan.owner.avatarUrl ?? null,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [plans]);

  // Filtered lists for search
  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    const q = planSearch.toLowerCase();
    return q ? plans.filter((p) => p.name.toLowerCase().includes(q)) : plans;
  }, [plans, planSearch]);

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.toLowerCase();
    return q ? owners.filter((o) => o.fullName.toLowerCase().includes(q)) : owners;
  }, [owners, ownerSearch]);

  const selectedPlanIds = filters.planIds ?? [];
  const selectedOwnerIds = filters.ownerIds ?? [];

  return (
    <div ref={ref} className="bg-white rounded-lg shadow-lg border border-[#D4CFE2] p-4 min-w-[300px] max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#7B6BA4]" />
          <h3 className="text-sm font-semibold text-[#544A78]">Plans</h3>
        </div>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Specific Plans */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Plans</h4>
          <input
            type="text"
            value={planSearch}
            onChange={(e) => setPlanSearch(e.target.value)}
            placeholder="Search plans..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#D4CFE2] text-xs text-[#544A78] bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 mb-1.5 placeholder:text-[#A69DC0]"
          />
          <div className="max-h-[140px] overflow-y-auto space-y-0.5">
            {filteredPlans.map((plan) => (
              <label key={plan.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPlanIds.includes(plan.id)}
                  onChange={() => togglePlanId(plan.id)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: plan.color }}
                />
                <span className="text-xs text-[#544A78] truncate">{plan.name}</span>
              </label>
            ))}
            {filteredPlans.length === 0 && (
              <p className="text-xs text-[#A69DC0] px-2 py-1">No plans found</p>
            )}
          </div>
          {selectedPlanIds.length > 0 && (
            <button
              onClick={() => setLayerFilter("plans", { planIds: null })}
              className="mt-1 text-[10px] text-coral hover:text-coral/80 font-medium"
            >
              Clear {selectedPlanIds.length} selected
            </button>
          )}
        </div>

        {/* Status */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Status</h4>
          <div className="space-y-1">
            {STATUSES.map((s) => (
              <label key={s.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.status ?? []).includes(s.value)}
                  onChange={() => toggleStatus(s.value)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78]">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Fiscal Year */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Fiscal Year</h4>
          <select
            value={filters.fiscalYear ?? ""}
            onChange={(e) => setFiscalYear(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#D4CFE2] text-xs text-[#544A78] bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30"
          >
            <option value="">All Years</option>
            {FISCAL_YEARS.map((fy) => (
              <option key={fy.value} value={fy.value}>{fy.label}</option>
            ))}
          </select>
        </div>

        {/* Owner */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Owner</h4>
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setOwnerScope("mine")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                (filters.ownerScope ?? "mine") === "mine" && !selectedOwnerIds.length
                  ? "bg-[#403770] text-white"
                  : "bg-[#F0EDF5] text-[#544A78] hover:bg-[#E2DEEC]"
              }`}
            >
              My Plans
            </button>
            <button
              onClick={() => setOwnerScope("all")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filters.ownerScope === "all" && !selectedOwnerIds.length
                  ? "bg-[#403770] text-white"
                  : "bg-[#F0EDF5] text-[#544A78] hover:bg-[#E2DEEC]"
              }`}
            >
              All Plans
            </button>
          </div>

          {/* Specific owners */}
          <input
            type="text"
            value={ownerSearch}
            onChange={(e) => setOwnerSearch(e.target.value)}
            placeholder="Search owners..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#D4CFE2] text-xs text-[#544A78] bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 mb-1.5 placeholder:text-[#A69DC0]"
          />
          <div className="max-h-[120px] overflow-y-auto space-y-0.5">
            {filteredOwners.map((owner) => (
              <label key={owner.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedOwnerIds.includes(owner.id)}
                  onChange={() => toggleOwnerId(owner.id)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                {owner.avatarUrl ? (
                  <img src={owner.avatarUrl} alt="" className="w-4 h-4 rounded-full shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-[#E2DEEC] shrink-0 flex items-center justify-center text-[8px] font-bold text-[#8A80A8]">
                    {owner.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-xs text-[#544A78] truncate">{owner.fullName}</span>
              </label>
            ))}
            {filteredOwners.length === 0 && (
              <p className="text-xs text-[#A69DC0] px-2 py-1">No owners found</p>
            )}
          </div>
          {selectedOwnerIds.length > 0 && (
            <button
              onClick={() => setLayerFilter("plans", { ownerIds: null, ownerScope: "mine" })}
              className="mt-1 text-[10px] text-coral hover:text-coral/80 font-medium"
            >
              Clear {selectedOwnerIds.length} selected
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
