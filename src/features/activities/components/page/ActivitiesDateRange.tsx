"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useActivitiesChrome, type Grain } from "@/features/activities/lib/filters-store";

const GRAINS: { id: Grain; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
];

function shiftAnchor(iso: string, grain: Grain, dir: 1 | -1): string {
  const d = new Date(iso);
  switch (grain) {
    case "day":
      d.setDate(d.getDate() + dir);
      break;
    case "week":
      d.setDate(d.getDate() + dir * 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + dir);
      break;
    case "quarter":
      d.setMonth(d.getMonth() + dir * 3);
      break;
  }
  return d.toISOString();
}

function labelFor(iso: string, grain: Grain): string {
  const d = new Date(iso);
  switch (grain) {
    case "day":
      return format(d, "EEE, MMM d, yyyy");
    case "week": {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    case "month":
      return format(d, "MMMM yyyy");
    case "quarter": {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q} ${format(d, "yyyy")}`;
    }
  }
}

export default function ActivitiesDateRange() {
  const grain = useActivitiesChrome((s) => s.grain);
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const setGrain = useActivitiesChrome((s) => s.setGrain);
  const setAnchor = useActivitiesChrome((s) => s.setAnchor);

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center gap-0.5 p-0.5 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg">
        {GRAINS.map(({ id, label }) => {
          const active = grain === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setGrain(id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                active
                  ? "bg-white text-[#403770] shadow-sm"
                  : "text-[#8A80A8] hover:text-[#403770]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => setAnchor(shiftAnchor(anchorIso, grain, -1))}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-[#F7F5FA] text-[#6E6390]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setAnchor(new Date().toISOString())}
          className="px-2 py-1 text-xs font-medium text-[#403770] hover:bg-[#F7F5FA] rounded-md"
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => setAnchor(shiftAnchor(anchorIso, grain, 1))}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-[#F7F5FA] text-[#6E6390]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="text-sm font-semibold text-[#403770]">{labelFor(anchorIso, grain)}</div>
    </div>
  );
}
