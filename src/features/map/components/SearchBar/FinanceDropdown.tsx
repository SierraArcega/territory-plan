"use client";

import { useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import RangeFilter from "./controls/RangeFilter";


interface FinanceDropdownProps {
  onClose: () => void;
}

export default function FinanceDropdown({ onClose }: FinanceDropdownProps) {
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
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
    addSearchFilter({ id: crypto.randomUUID(), column, op: "between", value: [min, max] });
  };

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] p-4 w-[340px] max-h-[calc(100vh-140px)] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#544A78]">Finance</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <RangeFilter label="Expenditure / Pupil" column="expenditurePerPupil" step={500} onApply={handleApply} />
        <RangeFilter label="Total Revenue" column="totalRevenue" step={100000} onApply={handleApply} />
        <RangeFilter label="Federal Revenue" column="federalRevenue" step={50000} onApply={handleApply} />
        <RangeFilter label="State Revenue" column="stateRevenue" step={100000} onApply={handleApply} />
        <RangeFilter label="Local Revenue" column="localRevenue" step={100000} onApply={handleApply} />
        <RangeFilter label="Tech Spending" column="techSpending" step={10000} onApply={handleApply} />
        <RangeFilter label="Title I Revenue" column="titleIRevenue" step={50000} onApply={handleApply} />
        <RangeFilter label="ESSER Funding" column="esserFundingTotal" step={50000} onApply={handleApply} />
      </div>
    </div>
  );
}
