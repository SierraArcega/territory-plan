"use client";

import { useState } from "react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import { cn } from "@/features/shared/lib/cn";

const PRESETS = [
  { id: "anytime", label: "Anytime" },
  { id: "today", label: "Today" },
  { id: "this-week", label: "This week" },
  { id: "last-7", label: "Last 7 days" },
  { id: "last-30", label: "Last 30 days" },
  { id: "last-90", label: "Last 90 days" },
] as const;

type PresetId = typeof PRESETS[number]["id"];

function presetRange(id: PresetId): { from: string | null; to: string | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (id) {
    case "anytime":
      return { from: null, to: null };
    case "today":
      return { from: today.toISOString(), to: today.toISOString() };
    case "this-week": {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "last-7":
    case "last-30":
    case "last-90": {
      const days = id === "last-7" ? 7 : id === "last-30" ? 30 : 90;
      const start = new Date(today);
      start.setDate(start.getDate() - days);
      return { from: start.toISOString(), to: today.toISOString() };
    }
  }
}

export default function DateRangeFilter({ onClose }: { onClose: () => void }) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);

  const [customFrom, setCustomFrom] = useState(filters.dateFrom?.slice(0, 10) ?? "");
  const [customTo, setCustomTo] = useState(filters.dateTo?.slice(0, 10) ?? "");

  function applyPreset(id: PresetId) {
    const { from, to } = presetRange(id);
    patchFilters({ dateFrom: from, dateTo: to });
    onClose();
  }

  function applyCustom() {
    patchFilters({
      dateFrom: customFrom ? new Date(customFrom).toISOString() : null,
      dateTo: customTo ? new Date(customTo).toISOString() : null,
    });
    onClose();
  }

  return (
    <div className="p-2 w-72">
      <div className="grid grid-cols-2 gap-1 mb-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            className={cn(
              "px-2 py-1.5 text-xs rounded-md text-left transition-colors",
              "text-[#403770] hover:bg-[#F7F5FA]"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="border-t border-[#EFEDF5] pt-2">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#8A80A8] mb-1.5">
          Custom range
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 px-2 py-1 text-xs text-[#403770] border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#F37167]"
          />
          <span className="text-[10px] text-[#8A80A8]">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 px-2 py-1 text-xs text-[#403770] border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#F37167]"
          />
        </div>
        <div className="flex items-center justify-end gap-1 mt-2">
          <button
            type="button"
            onClick={() => { setCustomFrom(""); setCustomTo(""); patchFilters({ dateFrom: null, dateTo: null }); onClose(); }}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8A80A8] hover:text-[#F37167]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={applyCustom}
            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white bg-[#403770] rounded-md hover:bg-[#322a5a]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
