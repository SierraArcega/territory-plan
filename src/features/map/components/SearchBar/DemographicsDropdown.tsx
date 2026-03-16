"use client";

import { useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import RangeFilter from "./controls/RangeFilter";


interface DemographicsDropdownProps {
  onClose: () => void;
}

export default function DemographicsDropdown({ onClose }: DemographicsDropdownProps) {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
  const updateSearchFilter = useMapV2Store((s) => s.updateSearchFilter);
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

  const handleApply = (column: string, min: number, max: number) => {
    const existing = searchFilters.find((f) => f.column === column && f.op === "between");
    if (existing) {
      updateSearchFilter(existing.id, { value: [min, max] });
    } else {
      addSearchFilter({ id: crypto.randomUUID(), column, op: "between", value: [min, max] });
    }
  };

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] p-4 w-[340px] max-h-[calc(100vh-140px)] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#544A78]">Demographics</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <RangeFilter label="Enrollment" column="enrollment" step={500} onApply={handleApply} />
        <RangeFilter label="ELL %" column="ell_percent" step={1} onApply={handleApply} />
        <RangeFilter label="SWD %" column="sped_percent" step={1} onApply={handleApply} />
        <RangeFilter label="Poverty %" column="free_lunch_percent" step={1} onApply={handleApply} />
        <RangeFilter label="Median Household Income" column="medianHouseholdIncome" step={5000} onApply={handleApply} />
        <RangeFilter label="Enrollment Trend (3yr)" column="enrollmentTrend3yr" step={0.01} onApply={handleApply} />
      </div>
    </div>
  );
}
