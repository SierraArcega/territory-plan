"use client";

import { useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

const HOUR_HEIGHT = 44;
const FIRST_HOUR = 6;
const LAST_HOUR = 22;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => i + FIRST_HOUR);

const CATEGORY_BORDERS: Record<string, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

interface PlacedBlock {
  act: ActivityListItem;
  top: number;
  height: number;
}

function buildBlocks(activities: ActivityListItem[], day: Date): PlacedBlock[] {
  return activities
    .filter((a) => a.startDate && isSameDay(new Date(a.startDate), day))
    .map((a) => {
      const start = new Date(a.startDate!);
      const end = a.endDate ? new Date(a.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
      const startHours = start.getHours() + start.getMinutes() / 60;
      const endHours = Math.min(end.getHours() + end.getMinutes() / 60, LAST_HOUR + 1);
      const top = (Math.max(startHours, FIRST_HOUR) - FIRST_HOUR) * HOUR_HEIGHT;
      const height = Math.max(20, (endHours - Math.max(startHours, FIRST_HOUR)) * HOUR_HEIGHT);
      return { act: a, top, height };
    });
}

export default function WeekGridView({
  activities,
  onActivityClick,
}: {
  activities: ActivityListItem[];
  onActivityClick: (id: string) => void;
}) {
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const days = useMemo(() => {
    const start = startOfWeek(new Date(anchorIso), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorIso]);

  const today = new Date();
  const isCurrentWeek = days.some((d) => isSameDay(d, today));
  const nowOffset =
    (today.getHours() + today.getMinutes() / 60 - FIRST_HOUR) * HOUR_HEIGHT;

  return (
    <div className="flex-1 overflow-auto bg-[#FFFCFA]">
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-[#E2DEEC] bg-white sticky top-0 z-10">
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`px-2 py-2 border-l border-[#E2DEEC] text-center ${
                isToday ? "bg-[#FEF2F1]" : ""
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
                {format(d, "EEE")}
              </div>
              <div className="text-base font-bold text-[#403770]">{format(d, "d")}</div>
            </div>
          );
        })}
      </div>

      <div
        className="relative grid grid-cols-[60px_repeat(7,minmax(0,1fr))]"
        style={{ height: HOURS.length * HOUR_HEIGHT }}
      >
        {/* Hour labels */}
        <div className="border-r border-[#E2DEEC]">
          {HOURS.map((h) => (
            <div
              key={h}
              style={{ height: HOUR_HEIGHT }}
              className="text-[10px] text-[#A69DC0] px-2 pt-0.5"
            >
              {format(new Date().setHours(h, 0, 0, 0), "h a")}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const blocks = buildBlocks(activities, day);
          return (
            <div
              key={day.toISOString()}
              className="relative border-l border-[#E2DEEC]"
            >
              {/* Hour gridlines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT }}
                  className="border-b border-[#F0EDF7]"
                />
              ))}

              {/* Current time line */}
              {isCurrentWeek && isSameDay(day, today) && (
                <div
                  className="absolute left-0 right-0 h-px bg-[#F37167] z-10 pointer-events-none"
                  style={{ top: nowOffset }}
                  aria-hidden
                />
              )}

              {/* Blocks */}
              {blocks.map(({ act, top, height }) => {
                const border = CATEGORY_BORDERS[act.category] ?? "#A69DC0";
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => onActivityClick(act.id)}
                    style={{ top, height, borderLeftColor: border }}
                    className="absolute left-1 right-1 px-2 py-1 bg-white border border-[#E2DEEC] border-l-4 rounded-md text-left overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="text-[11px] font-semibold text-[#403770] truncate">
                      {act.title}
                    </div>
                    <div className="text-[10px] text-[#8A80A8]">
                      {act.startDate ? format(new Date(act.startDate), "h:mm a") : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
