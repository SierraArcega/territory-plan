"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useActivitiesChrome, type Grain } from "@/features/activities/lib/filters-store";

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

/**
 * One bordered pill: [Today] | [<] [label] [>]. Grain is set implicitly by
 * the upper-right ViewToggle (Schedule/Week/Month/Quarter/Map), so this row
 * just owns navigation, not aggregation.
 */
export default function ActivitiesDateRange() {
  const grain = useActivitiesChrome((s) => s.grain);
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const setAnchor = useActivitiesChrome((s) => s.setAnchor);

  return (
    <div className="inline-flex items-center gap-0 p-[3px] rounded-[10px] bg-white border border-[#D4CFE2]">
      <button
        type="button"
        onClick={() => setAnchor(new Date().toISOString())}
        className="px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] uppercase rounded-[7px] text-[#403770] hover:bg-[#EFEDF5]"
      >
        Today
      </button>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      <button
        type="button"
        aria-label="Previous"
        onClick={() => setAnchor(shiftAnchor(anchorIso, grain, -1))}
        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[#544A78] hover:bg-[#EFEDF5]"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="min-w-[200px] max-w-[320px] px-2.5 text-sm font-bold text-[#403770] text-center tabular-nums truncate">
        {labelFor(anchorIso, grain)}
      </div>

      <button
        type="button"
        aria-label="Next"
        onClick={() => setAnchor(shiftAnchor(anchorIso, grain, 1))}
        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[#544A78] hover:bg-[#EFEDF5]"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
