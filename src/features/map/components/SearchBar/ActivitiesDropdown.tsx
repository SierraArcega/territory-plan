"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useMapV2Store, type DatePreset } from "@/features/map/lib/store";

interface ActivitiesDropdownProps {
  onClose: () => void;
}

const TYPES = [
  { value: "conference", label: "Conference" },
  { value: "road_trip", label: "Road Trip" },
  { value: "demo", label: "Demo" },
  { value: "discovery_call", label: "Discovery Call" },
  { value: "email_campaign", label: "Email Campaign" },
  { value: "proposal_review", label: "Proposal Review" },
  { value: "check_in", label: "Check-in" },
  { value: "onboarding", label: "Onboarding" },
  { value: "training", label: "Training" },
  { value: "internal", label: "Internal" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const OUTCOMES = [
  { value: "positive_progress", label: "Positive Progress" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
  { value: "follow_up_needed", label: "Follow-up Needed" },
  { value: "no_response", label: "No Response" },
  { value: "not_applicable", label: "Not Applicable" },
];

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

export default function ActivitiesDropdown({ onClose }: ActivitiesDropdownProps) {
  const filters = useMapV2Store((s) => s.layerFilters.activities);
  const dateRange = useMapV2Store((s) => s.dateRange.activities);
  const setLayerFilter = useMapV2Store((s) => s.setLayerFilter);
  const setDateRange = useMapV2Store((s) => s.setDateRange);
  const ref = useRef<HTMLDivElement>(null);

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

  const toggleArrayFilter = useCallback(
    (field: "type" | "status" | "outcome", value: string) => {
      const current = (filters[field] ?? []) as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setLayerFilter("activities", { [field]: next.length ? next : null });
    },
    [filters, setLayerFilter]
  );

  const handlePreset = useCallback((preset: DatePreset) => {
    setDateRange("activities", { preset, start: null, end: null });
    setCustomFrom("");
    setCustomTo("");
  }, [setDateRange]);

  const applyCustomDate = useCallback(() => {
    if (customFrom || customTo) {
      setDateRange("activities", {
        start: customFrom || null,
        end: customTo || null,
        preset: null,
      });
    }
  }, [customFrom, customTo, setDateRange]);

  return (
    <div ref={ref} className="bg-white rounded-lg shadow-lg border border-[#D4CFE2] p-4 min-w-[280px] max-h-[60vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#6EA3BE]" />
          <h3 className="text-sm font-semibold text-[#544A78]">Activities</h3>
        </div>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Type */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Type</h4>
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {TYPES.map((t) => (
              <label key={t.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.type ?? []).includes(t.value)}
                  onChange={() => toggleArrayFilter("type", t.value)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78]">{t.label}</span>
              </label>
            ))}
          </div>
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
                  onChange={() => toggleArrayFilter("status", s.value)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78]">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Outcome */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Outcome</h4>
          <div className="space-y-1">
            {OUTCOMES.map((o) => (
              <label key={o.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.outcome ?? []).includes(o.value)}
                  onChange={() => toggleArrayFilter("outcome", o.value)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78]">{o.label}</span>
              </label>
            ))}
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
