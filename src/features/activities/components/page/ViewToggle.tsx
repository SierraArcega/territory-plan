"use client";

import { Calendar, CalendarDays, CalendarRange, ListChecks, Map } from "lucide-react";
import type { CalendarView, Grain } from "@/features/activities/lib/filters-store";

// One combined picker for view + grain. Each option pins both: clicking
// "Quarter" puts you on the month-grid view paginating by quarter; clicking
// "Schedule" puts you on the day-by-day list paginating by week. The lower
// grain selector is gone — these five buttons are now the single source.
interface ViewOption {
  id: string;
  label: string;
  view: CalendarView;
  grain: Grain;
  Icon: typeof Calendar;
}

const OPTIONS: ViewOption[] = [
  { id: "schedule", label: "Schedule", view: "schedule", grain: "week", Icon: ListChecks },
  { id: "week", label: "Week", view: "week", grain: "week", Icon: CalendarDays },
  { id: "month", label: "Month", view: "month", grain: "month", Icon: Calendar },
  { id: "quarter", label: "Quarter", view: "month", grain: "quarter", Icon: CalendarRange },
  { id: "map", label: "Map", view: "map", grain: "week", Icon: Map },
];

function activeId(view: CalendarView, grain: Grain): string | null {
  if (view === "schedule") return "schedule";
  if (view === "week") return "week";
  if (view === "map") return "map";
  if (view === "month") return grain === "quarter" ? "quarter" : "month";
  return null;
}

export default function ViewToggle({
  view,
  grain,
  onChange,
}: {
  view: CalendarView;
  grain: Grain;
  onChange: (next: { view: CalendarView; grain: Grain }) => void;
}) {
  const active = activeId(view, grain);
  return (
    <div
      role="tablist"
      aria-label="Activities view"
      className="inline-flex items-center gap-0.5 p-0.5 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg"
    >
      {OPTIONS.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange({ view: opt.view, grain: opt.grain })}
            className={`fm-focus-ring inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium [transition-duration:120ms] transition-colors ${
              isActive
                ? "bg-white text-[#403770] shadow-sm"
                : "text-[#8A80A8] hover:text-[#403770]"
            }`}
          >
            <opt.Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
