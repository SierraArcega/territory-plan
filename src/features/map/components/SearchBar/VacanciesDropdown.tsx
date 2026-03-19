"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useMapV2Store, type DatePreset } from "@/features/map/lib/store";

interface VacanciesDropdownProps {
  onClose: () => void;
}

const CATEGORIES = ["SPED", "ELL", "General Ed", "Admin", "Specialist", "Counseling", "Related Services", "Other"];
const STATUSES = ["open", "closed", "expired"];
const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

export default function VacanciesDropdown({ onClose }: VacanciesDropdownProps) {
  const filters = useMapV2Store((s) => s.layerFilters.vacancies);
  const dateRange = useMapV2Store((s) => s.dateRange.vacancies);
  const setLayerFilter = useMapV2Store((s) => s.setLayerFilter);
  const setDateRange = useMapV2Store((s) => s.setDateRange);
  const ref = useRef<HTMLDivElement>(null);

  // Local state for custom date inputs
  const [customFrom, setCustomFrom] = useState(dateRange.start ?? "");
  const [customTo, setCustomTo] = useState(dateRange.end ?? "");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const toggleCategory = useCallback((cat: string) => {
    const current = filters.category ?? [];
    const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    setLayerFilter("vacancies", { category: next.length ? next : null });
  }, [filters.category, setLayerFilter]);

  const toggleStatus = useCallback((status: string) => {
    const current = filters.status ?? [];
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    setLayerFilter("vacancies", { status: next.length ? next : null });
  }, [filters.status, setLayerFilter]);

  const toggleFullmindRelevant = useCallback(() => {
    setLayerFilter("vacancies", { fullmindRelevant: !filters.fullmindRelevant });
  }, [filters.fullmindRelevant, setLayerFilter]);

  const handlePreset = useCallback((preset: DatePreset) => {
    setDateRange("vacancies", { preset, start: null, end: null });
    setCustomFrom("");
    setCustomTo("");
  }, [setDateRange]);

  const applyCustomDate = useCallback(() => {
    if (customFrom || customTo) {
      setDateRange("vacancies", {
        start: customFrom || null,
        end: customTo || null,
        preset: null,
      });
    }
  }, [customFrom, customTo, setDateRange]);

  // Age slider local state
  const minDays = filters.minDaysOpen ?? 0;
  const maxDays = filters.maxDaysOpen ?? 365;

  return (
    <div ref={ref} className="bg-white rounded-lg shadow-lg border border-[#D4CFE2] p-4 min-w-[280px] max-h-[60vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFCF70]" />
          <h3 className="text-sm font-semibold text-[#544A78]">Vacancies</h3>
        </div>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Category */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Category</h4>
          <div className="space-y-1">
            {CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.category ?? []).includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78]">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Status</h4>
          <div className="space-y-1">
            {STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.status ?? []).includes(status)}
                  onChange={() => toggleStatus(status)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78] capitalize">{status}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Fullmind Relevant */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-[#544A78]">Fullmind Relevant</span>
          <button
            onClick={toggleFullmindRelevant}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              filters.fullmindRelevant ? "bg-[#403770]" : "bg-[#D4CFE2]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                filters.fullmindRelevant ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Age of Listing */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Age of Listing</h4>
          <div className="px-2">
            <div className="flex items-center justify-between text-[10px] text-[#8A80A8] mb-1">
              <span>{minDays}d</span>
              <span>{maxDays}d</span>
            </div>
            <div className="relative h-6 flex items-center">
              {/* Track background */}
              <div className="absolute inset-x-0 h-1.5 bg-[#E2DEEC] rounded-full" />
              {/* Active track */}
              <div
                className="absolute h-1.5 bg-[#403770] rounded-full"
                style={{
                  left: `${(minDays / 365) * 100}%`,
                  right: `${100 - (maxDays / 365) * 100}%`,
                }}
              />
              {/* Min handle */}
              <input
                type="range"
                min={0}
                max={365}
                value={minDays}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v <= maxDays) setLayerFilter("vacancies", { minDaysOpen: v });
                }}
                className="absolute inset-x-0 w-full h-6 opacity-0 cursor-pointer z-10"
                style={{ pointerEvents: "auto" }}
              />
              {/* Max handle */}
              <input
                type="range"
                min={0}
                max={365}
                value={maxDays}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= minDays) setLayerFilter("vacancies", { maxDaysOpen: v });
                }}
                className="absolute inset-x-0 w-full h-6 opacity-0 cursor-pointer z-20"
                style={{ pointerEvents: "auto" }}
              />
              {/* Visual handles */}
              <div
                className="absolute w-4 h-4 bg-white border-2 border-[#403770] rounded-full shadow -translate-x-1/2 pointer-events-none"
                style={{ left: `${(minDays / 365) * 100}%` }}
              />
              <div
                className="absolute w-4 h-4 bg-white border-2 border-[#403770] rounded-full shadow -translate-x-1/2 pointer-events-none"
                style={{ left: `${(maxDays / 365) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Date Range</h4>
          <div className="flex items-center gap-1 mb-2">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                  dateRange.preset === p.value
                    ? "bg-[#403770] text-white"
                    : "bg-[#F0EDF5] text-[#544A78] hover:bg-[#E2DEEC]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-2">
            <div className="flex-1">
              <label className="text-[10px] text-[#8A80A8] block mb-0.5">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                onBlur={applyCustomDate}
                className="w-full px-1.5 py-1 rounded border border-[#D4CFE2] text-[10px] text-[#544A78] focus:outline-none focus:ring-1 focus:ring-[#403770]/30"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[#8A80A8] block mb-0.5">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                onBlur={applyCustomDate}
                className="w-full px-1.5 py-1 rounded border border-[#D4CFE2] text-[10px] text-[#544A78] focus:outline-none focus:ring-1 focus:ring-[#403770]/30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
