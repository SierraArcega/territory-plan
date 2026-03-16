"use client";

import { useState, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";

interface RangeFilterProps {
  label: string;
  column: string;
  min?: number;
  max?: number;
  step?: number;
  onApply: (column: string, min: number, max: number) => void;
}

export default function RangeFilter({ label, column, min = 0, max = 999999, step = 1, onApply }: RangeFilterProps) {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const removeSearchFilter = useMapV2Store((s) => s.removeSearchFilter);
  const existingFilter = searchFilters.find((f) => f.column === column && f.op === "between");
  const existingValues = existingFilter && Array.isArray(existingFilter.value)
    ? (existingFilter.value as [number, number])
    : null;

  const [minVal, setMinVal] = useState(existingValues ? String(existingValues[0]) : "");
  const [maxVal, setMaxVal] = useState(existingValues ? String(existingValues[1]) : "");

  // Sync when filter changes externally (e.g., cleared from pills, or updated)
  useEffect(() => {
    if (existingValues) {
      setMinVal(String(existingValues[0]));
      setMaxVal(String(existingValues[1]));
    } else {
      setMinVal("");
      setMaxVal("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingFilter?.id, existingValues?.[0], existingValues?.[1]]);

  const handleApply = () => {
    const lo = minVal ? Number(minVal) : min;
    const hi = maxVal ? Number(maxVal) : max;
    if (!isNaN(lo) && !isNaN(hi) && lo <= hi) {
      onApply(column, lo, hi);
    }
  };

  const handleRemove = () => {
    if (existingFilter) {
      removeSearchFilter(existingFilter.id);
    }
  };

  const isActive = !!existingFilter;

  return (
    <div className={`rounded-lg px-2 py-1.5 transition-colors ${isActive ? "bg-plum/5 ring-1 ring-plum/15" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-xs font-medium block ${isActive ? "text-plum" : "text-[#8A80A8]"}`}>{label}</label>
        {isActive && (
          <button
            onClick={handleRemove}
            className="text-[10px] text-coral/70 hover:text-coral font-medium"
          >
            Remove
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={minVal}
          onChange={(e) => setMinVal(e.target.value)}
          placeholder="Min"
          step={step}
          className={`w-20 px-2 py-1 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-plum/30 ${
            isActive ? "border-plum/25 bg-white" : "border-[#C2BBD4]"
          }`}
        />
        <span className="text-[#A69DC0] text-xs">–</span>
        <input
          type="number"
          value={maxVal}
          onChange={(e) => setMaxVal(e.target.value)}
          placeholder="Max"
          step={step}
          className={`w-20 px-2 py-1 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-plum/30 ${
            isActive ? "border-plum/25 bg-white" : "border-[#C2BBD4]"
          }`}
        />
        <button
          onClick={handleApply}
          className="px-2 py-1 rounded-lg text-[10px] font-bold text-white bg-plum hover:bg-plum/90 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
