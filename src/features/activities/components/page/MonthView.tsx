"use client";

import { useMemo } from "react";
import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({
  activities,
  onActivityClick,
}: {
  activities: ActivityListItem[];
  onActivityClick: (id: string) => void;
}) {
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const setAnchor = useActivitiesChrome((s) => s.setAnchor);
  const setGrain = useActivitiesChrome((s) => s.setGrain);

  const cells = useMemo(() => {
    const anchor = new Date(anchorIso);
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
    const end = endOfMonth(anchor);
    const totalCells = Math.ceil(((end.getTime() - start.getTime()) / 86400000 + 7) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => addDays(start, i));
  }, [anchorIso]);

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityListItem[]>();
    for (const a of activities) {
      if (!a.startDate) continue;
      const k = format(new Date(a.startDate), "yyyy-MM-dd");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return map;
  }, [activities]);

  const today = new Date();
  const month = new Date(anchorIso);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-7 px-6 py-2 bg-[#FFFCFA] border-b border-[#E2DEEC] text-[10px] uppercase tracking-wider font-bold text-[#A69DC0]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2">
            {d}
          </div>
        ))}
      </div>
      <div
        className="flex-1 overflow-auto px-6 py-3 grid gap-1"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {cells.map((d) => {
          const items = byDay.get(format(d, "yyyy-MM-dd")) ?? [];
          const visible = items.slice(0, 3);
          const overflow = items.length - visible.length;
          const isToday = isSameDay(d, today);
          const inMonth = isSameMonth(d, month);
          return (
            <div
              key={d.toISOString()}
              className={`min-h-[96px] flex flex-col gap-1 px-1.5 py-1.5 rounded-md border ${
                inMonth ? "bg-white border-[#E2DEEC]" : "bg-[#FFFCFA] border-[#F0EDF7]"
              } ${isToday ? "relative" : ""}`}
            >
              {isToday && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-[#F37167] rounded-bl-md" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => {
                  setAnchor(d.toISOString());
                  setGrain("day");
                }}
                className={`text-[11px] font-semibold text-left ${
                  inMonth ? "text-[#403770]" : "text-[#C2BBD4]"
                } hover:underline`}
              >
                {format(d, "d")}
              </button>
              {visible.map((a) => {
                const dot = CATEGORY_DOTS[a.category] ?? "#A69DC0";
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onActivityClick(a.id)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] truncate text-left hover:bg-[#F7F5FA]"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dot }}
                    />
                    <span className="truncate text-[#403770]">{a.title}</span>
                  </button>
                );
              })}
              {overflow > 0 && (
                <span className="text-[10px] text-[#8A80A8] px-1">+{overflow} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
