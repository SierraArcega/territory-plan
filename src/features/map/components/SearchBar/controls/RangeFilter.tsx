"use client";

import { useState, useEffect, useRef } from "react";
import { useMapV2Store } from "@/features/map/lib/store";

interface RangeFilterProps {
  label: string;
  column: string;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
  onApply: (column: string, min: number, max: number) => void;
}

export function formatCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(v / 1_000)}K`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

const thumbCls = [
  "absolute w-full appearance-none bg-transparent pointer-events-none",
  "[&::-webkit-slider-runnable-track]:bg-transparent",
  "[&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:pointer-events-auto",
  "[&::-webkit-slider-thumb]:w-3.5",
  "[&::-webkit-slider-thumb]:h-3.5",
  "[&::-webkit-slider-thumb]:rounded-full",
  "[&::-webkit-slider-thumb]:bg-plum",
  "[&::-webkit-slider-thumb]:border-2",
  "[&::-webkit-slider-thumb]:border-white",
  "[&::-webkit-slider-thumb]:shadow-sm",
  "[&::-webkit-slider-thumb]:cursor-pointer",
  "[&::-webkit-slider-thumb]:hover:scale-110",
  "[&::-webkit-slider-thumb]:transition-transform",
  "[&::-moz-range-track]:bg-transparent",
  "[&::-moz-range-thumb]:pointer-events-auto",
  "[&::-moz-range-thumb]:appearance-none",
  "[&::-moz-range-thumb]:w-3.5",
  "[&::-moz-range-thumb]:h-3.5",
  "[&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:bg-plum",
  "[&::-moz-range-thumb]:border-2",
  "[&::-moz-range-thumb]:border-white",
  "[&::-moz-range-thumb]:shadow-sm",
  "[&::-moz-range-thumb]:cursor-pointer",
].join(" ");

export default function RangeFilter({
  label,
  column,
  min,
  max,
  step = 1,
  formatValue = formatCompact,
  onApply,
}: RangeFilterProps) {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const removeSearchFilter = useMapV2Store((s) => s.removeSearchFilter);
  const existingFilter = searchFilters.find(
    (f) => f.column === column && f.op === "between"
  );
  const existingValues =
    existingFilter && Array.isArray(existingFilter.value)
      ? (existingFilter.value as [number, number])
      : null;

  const [lo, setLo] = useState(existingValues ? existingValues[0] : min);
  const [hi, setHi] = useState(existingValues ? existingValues[1] : max);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const filterRef = useRef(existingFilter);
  filterRef.current = existingFilter;

  // Sync when filter changes externally (cleared from pills, etc.)
  useEffect(() => {
    if (existingValues) {
      setLo(existingValues[0]);
      setHi(existingValues[1]);
    } else {
      setLo(min);
      setHi(max);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingFilter?.id, existingValues?.[0], existingValues?.[1], min, max]);

  useEffect(() => () => clearTimeout(applyTimer.current), []);

  const scheduleApply = (newLo: number, newHi: number) => {
    clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => {
      if (newLo === min && newHi === max) {
        if (filterRef.current) removeSearchFilter(filterRef.current.id);
      } else {
        onApply(column, newLo, newHi);
      }
    }, 300);
  };

  const handleLo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), hi);
    setLo(v);
    scheduleApply(v, hi);
  };

  const handleHi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), lo);
    setHi(v);
    scheduleApply(lo, v);
  };

  const handleRemove = () => {
    if (existingFilter) removeSearchFilter(existingFilter.id);
  };

  const isActive = !!existingFilter;
  const range = max - min || 1;
  const loPC = ((lo - min) / range) * 100;
  const hiPC = ((hi - min) / range) * 100;

  return (
    <div
      className={`rounded-lg px-2 py-1.5 transition-colors ${
        isActive ? "bg-plum/5 ring-1 ring-plum/15" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <label
          className={`text-xs font-medium block ${
            isActive ? "text-plum" : "text-[#8A80A8]"
          }`}
        >
          {label}
        </label>
        {isActive && (
          <button
            onClick={handleRemove}
            className="text-[10px] text-coral/70 hover:text-coral font-medium"
          >
            Remove
          </button>
        )}
      </div>

      {/* Dual-thumb range slider */}
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-[#E2DEEC]" />
        <div
          className={`absolute h-1 rounded-full transition-colors ${
            isActive ? "bg-plum" : "bg-plum/40"
          }`}
          style={{ left: `${loPC}%`, width: `${hiPC - loPC}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={handleLo}
          className={`${thumbCls} z-10`}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={handleHi}
          className={`${thumbCls} z-20`}
        />
      </div>

      {/* Value labels */}
      <div className="flex justify-between">
        <span
          className={`text-[10px] tabular-nums ${
            isActive ? "text-plum font-medium" : "text-[#A69DC0]"
          }`}
        >
          {formatValue(lo)}
        </span>
        <span
          className={`text-[10px] tabular-nums ${
            isActive ? "text-plum font-medium" : "text-[#A69DC0]"
          }`}
        >
          {formatValue(hi)}
        </span>
      </div>
    </div>
  );
}
