"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { CalendarDays, MapPin, User } from "lucide-react";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import WeekStrip, { type WeekStripDay } from "./WeekStrip";

const CATEGORY_STYLE: Record<ActivityCategory, { bg: string; ink: string; dot: string }> = {
  meetings: { bg: "#EFEDF5", ink: "#403770", dot: "#403770" },
  events: { bg: "#EEF5F8", ink: "#3A6B85", dot: "#6EA3BE" },
  campaigns: { bg: "#FFF8E6", ink: "#7A5F00", dot: "#FFCF70" },
  gift_drop: { bg: "#FEF2F1", ink: "#A8463F", dot: "#F37167" },
  sponsorships: { bg: "#EFF5F0", ink: "#5A6F61", dot: "#8AA891" },
  thought_leadership: { bg: "#F5F0FA", ink: "#6B5292", dot: "#A78BCA" },
};

function fmtTime(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const d = Math.round(h / 24);
    return `${d}d`;
  }
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function durationMinutes(act: ActivityListItem): number {
  if (!act.startDate) return 0;
  const start = new Date(act.startDate).getTime();
  const end = act.endDate ? new Date(act.endDate).getTime() : start + 60 * 60 * 1000;
  return Math.max(15, Math.round((end - start) / 60000));
}

export default function ScheduleView({
  activities,
  isLoading,
  onActivityClick,
}: {
  activities: ActivityListItem[];
  isLoading: boolean;
  onActivityClick: (id: string) => void;
}) {
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const dealDisplay = useActivitiesChrome((s) => s.dealDisplay);
  const showOpps = dealDisplay !== "overlay";

  const weekAnchor = useMemo(() => new Date(anchorIso), [anchorIso]);
  const days = useMemo(() => {
    const start = startOfWeek(weekAnchor, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekAnchor]);

  const today = useMemo(() => new Date(), []);

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

  const stripData: WeekStripDay[] = useMemo(
    () =>
      days.map((d) => {
        const items = byDay.get(format(d, "yyyy-MM-dd")) ?? [];
        const cats = Array.from(new Set(items.map((a) => a.category))) as ActivityCategory[];
        return {
          date: d,
          count: items.length,
          categories: cats,
          dealKinds: [], // Wave 6 fills in real deal data
          oppTotal: 0,
          dealCount: 0,
        };
      }),
    [days, byDay]
  );

  const weekStartIso = days[0].toISOString();

  // Internal selected-day state — defaults to today if visible, otherwise the
  // first day with activity, otherwise the start of the week. When the anchor
  // week changes (i.e. weekStartIso shifts), we re-pick a fallback during
  // render rather than via setState-in-effect.
  const [selectedDayIso, setSelectedDayIso] = useState<string>(() => {
    const fallback =
      days.find((d) => isSameDay(d, today)) ??
      days.find((d) => (byDay.get(format(d, "yyyy-MM-dd")) ?? []).length > 0) ??
      days[0];
    return fallback.toISOString();
  });
  const [trackedWeekIso, setTrackedWeekIso] = useState(weekStartIso);
  if (trackedWeekIso !== weekStartIso) {
    const fallback =
      days.find((d) => isSameDay(d, today)) ??
      days.find((d) => (byDay.get(format(d, "yyyy-MM-dd")) ?? []).length > 0) ??
      days[0];
    setTrackedWeekIso(weekStartIso);
    setSelectedDayIso(fallback.toISOString());
  }
  const selectedDay = useMemo(() => new Date(selectedDayIso), [selectedDayIso]);
  const setSelectedDay = (d: Date) => setSelectedDayIso(d.toISOString());

  const selectedItems = byDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [];
  const isSelectedToday = isSameDay(selectedDay, today);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FFFCFA]">
      <div className="flex flex-col gap-5 px-6 pt-4 pb-6 flex-1 min-h-0">
        <WeekStrip
          weekAnchor={weekAnchor}
          daysData={stripData}
          selectedDate={selectedDay}
          onDayClick={setSelectedDay}
          showOpps={showOpps}
        />

        <div className="flex-1 bg-white border border-[#E2DEEC] rounded-xl flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-4 border-b border-[#EFEDF5]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A80A8]">
                {format(selectedDay, "EEEE")}
                {isSelectedToday && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-[#F37167] text-white text-[10px] font-bold normal-case tracking-normal">
                    Today
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xl font-bold text-[#403770] tracking-[-0.01em]">
                {format(selectedDay, "MMMM d, yyyy")}
              </div>
            </div>
            <div className="text-[13px] font-medium text-[#6E6390]">
              {selectedItems.length === 0
                ? "Nothing scheduled"
                : `${selectedItems.length} ${selectedItems.length === 1 ? "activity" : "activities"}`}
            </div>
          </div>

          <div className="flex-1 overflow-auto py-2">
            {isLoading ? (
              <div className="px-6 py-12 text-center text-sm text-[#8A80A8]">
                Loading activities…
              </div>
            ) : selectedItems.length === 0 ? (
              <div className="px-6 py-12 flex flex-col items-center gap-2.5 text-center">
                <CalendarDays className="w-10 h-10 text-[#E2DEEC]" />
                <div className="text-sm text-[#6E6390]">No activities on this day.</div>
                <div className="text-xs text-[#8A80A8]">
                  Click a day in the strip above or switch views to browse.
                </div>
              </div>
            ) : (
              <>
                {showOpps && (
                  <div className="px-5 pt-2 pb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8]">
                    Pipeline events
                    <span className="ml-2 text-[#C2BBD4] font-normal normal-case">
                      Connect deals via the deal toggle to see events here.
                    </span>
                  </div>
                )}
                {selectedItems.length > 0 && showOpps && (
                  <div className="px-5 pt-2 pb-1 mt-1 border-t border-[#EFEDF5] text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8]">
                    Activities
                  </div>
                )}
                <ul>
                  {selectedItems.map((act) => {
                    const style = CATEGORY_STYLE[act.category];
                    const start = act.startDate;
                    const dur = durationMinutes(act);
                    const end = start
                      ? new Date(new Date(start).getTime() + dur * 60000)
                      : null;
                    const stateLabel =
                      act.stateAbbrevs.length > 0
                        ? act.stateAbbrevs.slice(0, 3).join(" · ")
                        : null;
                    return (
                      <li key={act.id}>
                        <button
                          type="button"
                          onClick={() => onActivityClick(act.id)}
                          className="w-full grid grid-cols-[110px_1fr_auto] gap-4 items-start px-5 py-3.5 text-left border-b border-[#F7F5FA] hover:bg-[#FBF9FC] transition-colors duration-120 last:border-b-0 focus:outline-none focus-visible:bg-[#FBF9FC]"
                        >
                          <div className="tabular-nums pt-0.5 text-[#403770]">
                            <div className="text-[13px] font-semibold">
                              {start ? fmtTime(start) : "All-day"}
                            </div>
                            {end && (
                              <div className="text-[11px] text-[#8A80A8] font-medium">
                                → {fmtTime(end.toISOString())}
                              </div>
                            )}
                          </div>

                          <div
                            className="pl-3 border-l-[3px]"
                            style={{ borderLeftColor: style.dot }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ backgroundColor: style.bg, color: style.ink }}
                              >
                                {ACTIVITY_TYPE_LABELS[act.type as ActivityType] ?? act.type}
                              </span>
                              {act.status === "completed" && (
                                <span className="text-[10px] font-semibold text-[#5f665b]">
                                  ✓ Completed
                                </span>
                              )}
                              {act.status === "in_progress" && (
                                <span className="text-[10px] font-semibold text-[#997c43]">
                                  ● In progress
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-[#403770]">
                              {act.title}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-[#6E6390]">
                              {stateLabel && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {stateLabel}
                                </span>
                              )}
                              {act.districtCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {act.districtCount} district
                                  {act.districtCount === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-1 text-[11px] font-medium text-[#8A80A8]">
                            {fmtDuration(dur)}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
