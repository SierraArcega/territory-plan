"use client";

import { useState, useEffect, useRef } from "react";
import { useMapV2Store } from "@/features/map/lib/store";

interface RangeFilterProps {
  label: string;
  column: string;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  onApply: (column: string, min: number, max: number) => void;
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
  prefix,
  suffix,
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
  const [loInput, setLoInput] = useState(String(existingValues ? existingValues[0] : min));
  const [hiInput, setHiInput] = useState(String(existingValues ? existingValues[1] : max));
  const [loFocused, setLoFocused] = useState(false);
  const [hiFocused, setHiFocused] = useState(false);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const filterRef = useRef(existingFilter);
  filterRef.current = existingFilter;

  // Sync when filter changes externally (cleared from pills, etc.) or when slider moves while inputs aren't focused.
  useEffect(() => {
    const nextLo = existingValues ? existingValues[0] : min;
    const nextHi = existingValues ? existingValues[1] : max;
    setLo(nextLo);
    setHi(nextHi);
    if (!loFocused) setLoInput(String(nextLo));
    if (!hiFocused) setHiInput(String(nextHi));
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

  const applyImmediate = (newLo: number, newHi: number) => {
    clearTimeout(applyTimer.current);
    if (newLo === min && newHi === max) {
      if (filterRef.current) removeSearchFilter(filterRef.current.id);
    } else {
      onApply(column, newLo, newHi);
    }
  };

  const handleSliderLo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), hi);
    setLo(v);
    if (!loFocused) setLoInput(String(v));
    scheduleApply(v, hi);
  };

  const handleSliderHi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), lo);
    setHi(v);
    if (!hiFocused) setHiInput(String(v));
    scheduleApply(lo, v);
  };

  const parseTyped = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return step < 1 ? n : Math.round(n);
  };

  const commitLo = () => {
    const parsed = parseTyped(loInput);
    if (parsed === null) {
      setLoInput(String(lo));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    let nextLo = clamped;
    let nextHi = hi;
    if (clamped > hi) {
      nextLo = hi;
      nextHi = clamped;
    }
    setLo(nextLo);
    setHi(nextHi);
    setLoInput(String(nextLo));
    setHiInput(String(nextHi));
    applyImmediate(nextLo, nextHi);
  };

  const commitHi = () => {
    const parsed = parseTyped(hiInput);
    if (parsed === null) {
      setHiInput(String(hi));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    let nextLo = lo;
    let nextHi = clamped;
    if (clamped < lo) {
      nextLo = clamped;
      nextHi = lo;
    }
    setLo(nextLo);
    setHi(nextHi);
    setLoInput(String(nextLo));
    setHiInput(String(nextHi));
    applyImmediate(nextLo, nextHi);
  };

  const handleRemove = () => {
    if (existingFilter) removeSearchFilter(existingFilter.id);
  };

  const isActive = !!existingFilter;
  const range = max - min || 1;
  const loPC = ((lo - min) / range) * 100;
  const hiPC = ((hi - min) / range) * 100;
  const inputMode = step < 1 ? "decimal" : "numeric";

  const inputCls = [
    "w-16 px-1.5 py-0.5 text-[10px] tabular-nums rounded",
    "bg-transparent border border-transparent",
    "hover:border-[#D4CFE2]",
    "focus:outline-none focus:ring-1 focus:ring-plum/30 focus:border-plum/30",
    isActive ? "text-plum font-medium" : "text-[#A69DC0]",
  ].join(" ");

  const adornmentCls = [
    "text-[10px] tabular-nums",
    isActive ? "text-plum font-medium" : "text-[#A69DC0]",
  ].join(" ");

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

      {/* Slider step bounds drag granularity; typed input bypasses step. */}
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
          onChange={handleSliderLo}
          aria-label={`${label} slider minimum`}
          className={`${thumbCls} z-10`}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={handleSliderHi}
          aria-label={`${label} slider maximum`}
          className={`${thumbCls} z-20`}
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-0.5">
          {prefix && <span className={adornmentCls}>{prefix}</span>}
          <input
            type="text"
            inputMode={inputMode}
            value={loInput}
            aria-label={`${label} minimum`}
            placeholder={String(min)}
            onChange={(e) => setLoInput(e.target.value)}
            onFocus={(e) => {
              setLoFocused(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              setLoFocused(false);
              commitLo();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setLoInput(String(lo));
                e.currentTarget.blur();
              }
            }}
            className={inputCls}
          />
          {suffix && <span className={adornmentCls}>{suffix}</span>}
        </div>
        <div className="flex items-center gap-0.5">
          {prefix && <span className={adornmentCls}>{prefix}</span>}
          <input
            type="text"
            inputMode={inputMode}
            value={hiInput}
            aria-label={`${label} maximum`}
            placeholder={String(max)}
            onChange={(e) => setHiInput(e.target.value)}
            onFocus={(e) => {
              setHiFocused(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              setHiFocused(false);
              commitHi();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setHiInput(String(hi));
                e.currentTarget.blur();
              }
            }}
            className={`${inputCls} text-right`}
          />
          {suffix && <span className={adornmentCls}>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
