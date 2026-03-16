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
  // Read existing filter values for this column from the store
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const existingFilter = searchFilters.find((f) => f.column === column && f.op === "between");
  const existingValues = existingFilter && Array.isArray(existingFilter.value)
    ? (existingFilter.value as [number, number])
    : [min, max];

  const [minVal, setMinVal] = useState(existingValues[0] !== undefined ? String(existingValues[0]) : "");
  const [maxVal, setMaxVal] = useState(existingValues[1] !== undefined ? String(existingValues[1]) : "");

  // Sync when existing filter changes externally (e.g., cleared from pills)
  useEffect(() => {
    setMinVal(existingValues[0] !== undefined ? String(existingValues[0]) : "");
    setMaxVal(existingValues[1] !== undefined ? String(existingValues[1]) : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingFilter?.id]);

  const handleApply = () => {
    const lo = minVal ? Number(minVal) : min;
    const hi = maxVal ? Number(maxVal) : max;
    if (!isNaN(lo) && !isNaN(hi) && lo <= hi) {
      onApply(column, lo, hi);
      setMinVal("");
      setMaxVal("");
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-[#8A80A8] mb-1 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={minVal}
          onChange={(e) => setMinVal(e.target.value)}
          placeholder="Min"
          step={step}
          className="w-20 px-2 py-1 rounded border border-[#C2BBD4] text-xs focus:outline-none focus:ring-1 focus:ring-plum/30"
        />
        <span className="text-[#A69DC0] text-xs">–</span>
        <input
          type="number"
          value={maxVal}
          onChange={(e) => setMaxVal(e.target.value)}
          placeholder="Max"
          step={step}
          className="w-20 px-2 py-1 rounded border border-[#C2BBD4] text-xs focus:outline-none focus:ring-1 focus:ring-plum/30"
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
