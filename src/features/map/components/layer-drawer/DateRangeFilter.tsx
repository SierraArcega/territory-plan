"use client";

import type { DatePreset, DateRange } from "@/features/map/lib/store";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

/** Compute date range from a preset. */
function presetToRange(preset: DatePreset): { start: string | null; end: string | null } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];

  switch (preset) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { start: d.toISOString().split("T")[0], end };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { start: d.toISOString().split("T")[0], end };
    }
    case "90d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return { start: d.toISOString().split("T")[0], end };
    }
    case "ytd": {
      return { start: `${now.getFullYear()}-01-01`, end };
    }
    case "all":
      return { start: null, end: null };
  }
}

interface DateRangeFilterProps {
  dateRange: DateRange;
  onChange: (range: Partial<DateRange>) => void;
}

export default function DateRangeFilter({ dateRange, onChange }: DateRangeFilterProps) {
  const handlePresetClick = (preset: DatePreset) => {
    if (dateRange.preset === preset) {
      // Deselect preset — clear date range
      onChange({ start: null, end: null, preset: null });
    } else {
      const { start, end } = presetToRange(preset);
      onChange({ start, end, preset });
    }
  };

  const handleStartChange = (value: string) => {
    onChange({ start: value || null, preset: null });
  };

  const handleEndChange = (value: string) => {
    onChange({ end: value || null, preset: null });
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-medium text-[#8A80A8] uppercase tracking-wider">
        Date Range
      </div>

      {/* Quick presets */}
      <div className="flex gap-1">
        {PRESETS.map((p) => {
          const isActive = dateRange.preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => handlePresetClick(p.value)}
              className={[
                "flex-1 py-1 text-[10px] font-medium rounded-lg transition-colors",
                isActive
                  ? "bg-[#403770] text-white"
                  : "bg-[#F7F5FA] text-[#8A80A8] hover:bg-[#EFEDF5]",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom date inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-[#A69DC0] mb-0.5">From</label>
          <input
            type="date"
            value={dateRange.start ?? ""}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full px-2 py-1 text-[10px] border border-[#C2BBD4] rounded-lg bg-white text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#A69DC0] mb-0.5">To</label>
          <input
            type="date"
            value={dateRange.end ?? ""}
            min={dateRange.start ?? undefined}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-full px-2 py-1 text-[10px] border border-[#C2BBD4] rounded-lg bg-white text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
