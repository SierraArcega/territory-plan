"use client";

import { Calendar, CalendarDays, ListChecks, Map } from "lucide-react";
import type { CalendarView } from "@/features/activities/lib/filters-store";

const OPTIONS: { id: CalendarView; label: string; Icon: typeof Calendar }[] = [
  { id: "schedule", label: "Schedule", Icon: ListChecks },
  { id: "month", label: "Month", Icon: Calendar },
  { id: "week", label: "Week", Icon: CalendarDays },
  { id: "map", label: "Map", Icon: Map },
];

export default function ViewToggle({
  value,
  onChange,
}: {
  value: CalendarView;
  onChange: (v: CalendarView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Activities view"
      className="inline-flex items-center gap-0.5 p-0.5 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg"
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              active
                ? "bg-white text-[#403770] shadow-sm"
                : "text-[#8A80A8] hover:text-[#403770]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
