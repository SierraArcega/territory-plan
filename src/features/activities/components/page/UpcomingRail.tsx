"use client";

import { useMemo } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { addDays, format, isAfter, isBefore, isSameDay } from "date-fns";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

const CATEGORY_DOTS: Record<string, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

interface Group {
  label: string;
  items: ActivityListItem[];
}

function bucketize(activities: ActivityListItem[]): Group[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const inAWeek = addDays(today, 7);
  const inTwoWeeks = addDays(today, 14);

  const groups: Group[] = [
    { label: "Today", items: [] },
    { label: "Tomorrow", items: [] },
    { label: "This week", items: [] },
    { label: "Next week", items: [] },
  ];

  for (const a of activities) {
    if (!a.startDate) continue;
    const d = new Date(a.startDate);
    if (isSameDay(d, today)) groups[0].items.push(a);
    else if (isSameDay(d, tomorrow)) groups[1].items.push(a);
    else if (isAfter(d, tomorrow) && isBefore(d, inAWeek)) groups[2].items.push(a);
    else if (isAfter(d, inAWeek) && isBefore(d, inTwoWeeks)) groups[3].items.push(a);
  }

  for (const g of groups) {
    g.items.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }
  return groups;
}

export default function UpcomingRail({
  activities,
  onActivityClick,
  scope,
}: {
  activities: ActivityListItem[];
  onActivityClick: (id: string) => void;
  scope: "mine" | "team";
}) {
  const collapsed = useActivitiesChrome((s) => s.railCollapsed);
  const setCollapsed = useActivitiesChrome((s) => s.setRailCollapsed);
  const groups = useMemo(() => bucketize(activities), [activities]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Expand upcoming rail"
        className="w-10 h-full border-l border-[#E2DEEC] bg-[#FFFCFA] hover:bg-[#F7F5FA] transition-colors flex flex-col items-center justify-start pt-3 gap-2"
      >
        <ChevronLeft className="w-4 h-4 text-[#6E6390]" />
        <span className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] [writing-mode:vertical-rl]">
          Upcoming
        </span>
      </button>
    );
  }

  return (
    <aside className="w-[320px] flex-shrink-0 flex flex-col h-full border-l border-[#E2DEEC] bg-[#FFFCFA]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2DEEC] bg-white">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
            Upcoming
          </div>
          <div className="text-sm font-semibold text-[#403770]">
            {scope === "mine" ? "Your day" : "Team day"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse upcoming rail"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-[#F7F5FA] text-[#6E6390]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#A69DC0] mb-1.5 px-1">
              {g.label}
            </div>
            {g.items.length === 0 ? (
              <div className="text-xs text-[#C2BBD4] px-1">—</div>
            ) : (
              <ul className="space-y-1">
                {g.items.map((act) => {
                  const dot = CATEGORY_DOTS[act.category] ?? "#A69DC0";
                  return (
                    <li key={act.id}>
                      <button
                        type="button"
                        onClick={() => onActivityClick(act.id)}
                        className="w-full flex items-start gap-2 px-2 py-1.5 text-left rounded-md hover:bg-white transition-colors"
                      >
                        <span
                          className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dot }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[#403770] truncate">
                            {act.startDate ? format(new Date(act.startDate), "h:mm a") : "All-day"} ·{" "}
                            {act.title}
                          </div>
                          {act.stateAbbrevs.length > 0 && (
                            <div className="text-[10px] text-[#8A80A8] truncate">
                              {act.stateAbbrevs.slice(0, 3).join(" · ")}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
