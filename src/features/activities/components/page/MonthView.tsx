"use client";

import { useMemo } from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import {
  type ActivityCategory,
  CATEGORY_LABELS,
} from "@/features/activities/types";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

const CATEGORY_STYLE: Record<ActivityCategory, { bg: string; ink: string; dot: string; label: string }> = {
  meetings: { bg: "#EFEDF5", ink: "#403770", dot: "#403770", label: CATEGORY_LABELS.meetings },
  events: { bg: "#EEF5F8", ink: "#3A6B85", dot: "#6EA3BE", label: CATEGORY_LABELS.events },
  campaigns: { bg: "#FFF8E6", ink: "#7A5F00", dot: "#FFCF70", label: CATEGORY_LABELS.campaigns },
  gift_drop: { bg: "#FEF2F1", ink: "#A8463F", dot: "#F37167", label: CATEGORY_LABELS.gift_drop },
  sponsorships: { bg: "#EFF5F0", ink: "#5A6F61", dot: "#8AA891", label: CATEGORY_LABELS.sponsorships },
  thought_leadership: { bg: "#F5F0FA", ink: "#6B5292", dot: "#A78BCA", label: CATEGORY_LABELS.thought_leadership },
};

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MAX_CHIPS_PER_DAY = 4;

function fmtTime(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

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
  const dealDisplay = useActivitiesChrome((s) => s.dealDisplay);
  const showOpps = dealDisplay !== "overlay";

  const days = useMemo(() => {
    const anchor = new Date(anchorIso);
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [anchorIso]);

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityListItem[]>();
    for (const a of activities) {
      if (!a.startDate) continue;
      const k = format(new Date(a.startDate), "yyyy-MM-dd");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
    }
    return map;
  }, [activities]);

  const today = new Date();
  const currentMonth = new Date(anchorIso);
  const totalRows = Math.ceil(days.length / 7);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FFFCFA]">
      <div className="flex flex-col gap-3 px-6 pt-4 pb-6 flex-1 min-h-0">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-[#D4CFE2]">
          {WEEKDAY_LABELS.map((lbl) => (
            <div
              key={lbl}
              className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A80A8]"
            >
              {lbl}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div
          className="flex-1 grid grid-cols-7 border border-t-0 border-[#E2DEEC] rounded-b-xl overflow-hidden bg-white"
          style={{ gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))` }}
        >
          {days.map((day, i) => {
            const inMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const visible = items.slice(0, MAX_CHIPS_PER_DAY);
            const overflow = items.length - visible.length;
            const dow = day.getDay();
            const weekend = dow === 0 || dow === 6;
            const colIdx = i % 7;
            const rowIdx = Math.floor(i / 7);
            const isLastCol = colIdx === 6;
            const isLastRow = rowIdx === totalRows - 1;

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  setAnchor(day.toISOString());
                  setGrain("day");
                }}
                className={`relative flex flex-col gap-1 p-1.5 cursor-pointer transition-colors duration-120 hover:bg-[#F7F5FA] ${
                  !inMonth
                    ? "bg-[#FBF9FC]"
                    : weekend
                      ? "bg-[#FFFCFA]"
                      : "bg-white"
                } ${!isLastCol ? "border-r border-[#E2DEEC]" : ""} ${
                  !isLastRow ? "border-b border-[#E2DEEC]" : ""
                }`}
              >
                {/* Day number — squared plum/coral pill */}
                <div className="flex items-center justify-between">
                  <div
                    className="inline-flex items-center justify-center text-[11px] font-bold text-white rounded"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: isToday
                        ? "#F37167"
                        : inMonth
                          ? "#403770"
                          : "#D4CFE2",
                    }}
                  >
                    {day.getDate()}
                  </div>
                  {isToday && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#F37167]">
                      Today
                    </span>
                  )}
                </div>

                {/* Opp signal bar — Wave 6 will replace with <OppDayBar /> */}
                {showOpps && inMonth && (
                  <div
                    className="h-1 rounded-full bg-[#EFEDF5]"
                    aria-hidden
                    title="Pipeline activity placeholder (Wave 6)"
                  />
                )}

                {/* Activity chips — category-filled with time prefix */}
                <div className="flex flex-col gap-[3px] min-h-0 overflow-hidden">
                  {visible.map((a) => {
                    const style = CATEGORY_STYLE[a.category];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onActivityClick(a.id);
                        }}
                        title={a.title}
                        className="flex items-center gap-1 px-1.5 py-[3px] rounded-[3px] text-[10.5px] font-medium leading-tight text-left whitespace-nowrap overflow-hidden"
                        style={{ backgroundColor: style.bg, color: style.ink }}
                      >
                        <span className="tabular-nums opacity-70 font-semibold flex-shrink-0">
                          {a.startDate ? fmtTime(a.startDate) : ""}
                        </span>
                        <span className="overflow-hidden text-ellipsis">{a.title}</span>
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="px-1.5 py-[2px] text-[10px] font-semibold text-[#8A80A8]">
                      +{overflow} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend strip */}
        <div className="flex items-center gap-4 flex-wrap pt-3.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#403770]">
            Key
          </span>
          {(Object.keys(CATEGORY_STYLE) as ActivityCategory[]).map((k) => {
            const s = CATEGORY_STYLE[k];
            return (
              <span key={k} className="inline-flex items-center gap-2">
                <span
                  className="rounded-[2px]"
                  style={{ width: 18, height: 12, backgroundColor: s.bg }}
                />
                <span className="text-[11px] font-medium text-[#6E6390]">{s.label}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
