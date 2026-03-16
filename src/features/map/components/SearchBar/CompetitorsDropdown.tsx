"use client";

import { useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import ToggleChips from "./controls/ToggleChips";


const COMPETITOR_VENDORS = [
  { id: "proximity", label: "Proximity Learning" },
  { id: "elevate", label: "Elevate K-12" },
  { id: "tbt", label: "TBT (Teach by Tech)" },
  { id: "educere", label: "Educere" },
];

interface CompetitorsDropdownProps {
  onClose: () => void;
}

export default function CompetitorsDropdown({ onClose }: CompetitorsDropdownProps) {
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

  const addFilter = (column: string, op: string, value: any) => {
    addSearchFilter({ id: crypto.randomUUID(), column, op: op as any, value });
  };

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] p-4 w-[340px] animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#544A78]">Competitors</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-[#8A80A8] mb-1.5 block">Has Competitor</label>
          <div className="space-y-1.5">
            {COMPETITOR_VENDORS.map((v) => (
              <label key={v.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#EFEDF5] transition-colors">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Filter for districts that have this competitor (engagement != null/empty)
                      addFilter(`competitor_${v.id}`, "is_not_empty", true);
                    }
                  }}
                  className="w-4 h-4 rounded border-[#C2BBD4] text-plum focus:ring-plum/30"
                />
                <span className="text-sm text-[#544A78]">{v.label}</span>
              </label>
            ))}
          </div>
        </div>

        <ToggleChips
          label="Competitor Engagement"
          options={[
            { label: "Any Active", column: "competitorEngagement", op: "is_not_empty", value: true },
            { label: "Churned", column: "competitorChurned", op: "is_true", value: true },
          ]}
          onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
        />

        <p className="text-[10px] text-[#A69DC0] italic">
          More competitor filters (spend ranges, engagement levels) coming soon.
        </p>
      </div>
    </div>
  );
}
