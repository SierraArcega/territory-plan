"use client";

import { useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { Clock, MapPin } from "lucide-react";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_CONFIG,
  type ActivityType,
} from "@/features/activities/types";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import WeekStrip, { type WeekStripDay } from "./WeekStrip";

const CATEGORY_DOTS: Record<string, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "All-day";
  return format(new Date(iso), "h:mm a");
}

function rangeForWeek(anchorIso: string): Date[] {
  const start = startOfWeek(new Date(anchorIso), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
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
  const setAnchor = useActivitiesChrome((s) => s.setAnchor);
  const setGrain = useActivitiesChrome((s) => s.setGrain);

  const days = useMemo(() => rangeForWeek(anchorIso), [anchorIso]);

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityListItem[]>();
    for (const day of days) map.set(format(day, "yyyy-MM-dd"), []);
    for (const act of activities) {
      if (!act.startDate) continue;
      const key = format(new Date(act.startDate), "yyyy-MM-dd");
      const bucket = map.get(key);
      if (bucket) bucket.push(act);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
    }
    return map;
  }, [activities, days]);

  const stripData: WeekStripDay[] = useMemo(
    () =>
      days.map((d) => ({
        date: d,
        count: byDay.get(format(d, "yyyy-MM-dd"))?.length ?? 0,
        dealKinds: [],
      })),
    [days, byDay]
  );

  const today = new Date();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <WeekStrip
        daysData={stripData}
        onDayClick={(d) => {
          setAnchor(d.toISOString());
          setGrain("day");
        }}
      />

      <div className="flex-1 overflow-auto px-6 py-4 space-y-3 bg-[#FFFCFA]">
        {isLoading ? (
          <div className="text-center py-12 text-[#8A80A8] text-sm">Loading activities…</div>
        ) : (
          days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const isToday = isSameDay(day, today);
            return (
              <section
                key={key}
                className="bg-white border border-[#E2DEEC] rounded-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E2DEEC] bg-[#FFFCFA]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#403770]">
                      {format(day, "EEEE, MMM d")}
                    </span>
                    {isToday && (
                      <span className="px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold text-white bg-[#F37167] rounded-md">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#A69DC0]">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-[#A69DC0]">Nothing scheduled.</div>
                ) : (
                  <ul className="divide-y divide-[#F0EDF7]">
                    {items.map((act) => {
                      const dot = CATEGORY_DOTS[act.category] ?? "#A69DC0";
                      const statusCfg =
                        ACTIVITY_STATUS_CONFIG[act.status as keyof typeof ACTIVITY_STATUS_CONFIG];
                      return (
                        <li key={act.id}>
                          <button
                            type="button"
                            onClick={() => onActivityClick(act.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F7F5FA] transition-colors"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: dot }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#403770] truncate">
                                  {act.title}
                                </span>
                                {statusCfg && (
                                  <span
                                    className="px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded"
                                    style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                                  >
                                    {statusCfg.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#8A80A8]">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {fmtTime(act.startDate)}
                                </span>
                                <span>{ACTIVITY_TYPE_LABELS[act.type as ActivityType] ?? act.type}</span>
                                {act.stateAbbrevs.length > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {act.stateAbbrevs.slice(0, 3).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
