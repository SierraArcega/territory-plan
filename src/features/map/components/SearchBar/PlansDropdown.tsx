"use client";

import { useRef, useEffect, useCallback } from "react";
import { useMapV2Store } from "@/features/map/lib/store";

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
  const ref = useRef<HTMLDivElement>(null);

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
    setLayerFilter("plans", { ownerScope: scope });
  }, [setLayerFilter]);

  return (
    <div ref={ref} className="bg-white rounded-lg shadow-lg border border-[#D4CFE2] p-4 min-w-[280px] max-h-[60vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOwnerScope("mine")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                (filters.ownerScope ?? "mine") === "mine"
                  ? "bg-[#403770] text-white"
                  : "bg-[#F0EDF5] text-[#544A78] hover:bg-[#E2DEEC]"
              }`}
            >
              My Plans
            </button>
            <button
              onClick={() => setOwnerScope("all")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filters.ownerScope === "all"
                  ? "bg-[#403770] text-white"
                  : "bg-[#F0EDF5] text-[#544A78] hover:bg-[#E2DEEC]"
              }`}
            >
              All Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
