"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { CalendarDays, MapPin, User } from "lucide-react";
import type { ActivityListItem, OppEvent } from "@/features/shared/types/api-types";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import {
  useActivitiesChrome,
  getRangeForChrome,
  type DealKind,
} from "@/features/activities/lib/filters-store";
import { useDealEvents, useOpenDeals } from "@/features/activities/lib/queries";
import WeekStrip, { type WeekStripDay } from "./WeekStrip";
import DealChip from "./deals/DealChip";
import OppSummaryStrip from "./deals/OppSummaryStrip";
import OppDrawer, { type OppDrawerKind } from "./deals/OppDrawer";
import type { ColdDistrict } from "./deals/ColdDistrictRow";

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

function drawerHeadingFor(kind: OppDrawerKind): string {
  switch (kind) {
    case "won":
      return "Closed won";
    case "lost":
      return "Closed lost";
    case "created":
      return "New deals";
    case "progressed":
      return "Progressed deals";
    case "closing":
      return "Closing soon";
    case "all":
      return "All deal activity";
    case "overdue":
      return "Past-due open deals";
    case "cold":
      return "Districts going cold";
  }
}

function fmtRange(range: { startIso: string; endIso: string }): string {
  return `${format(new Date(range.startIso), "MMM d")} – ${format(new Date(range.endIso), "MMM d")}`;
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
  const grain = useActivitiesChrome((s) => s.grain);
  const dealDisplay = useActivitiesChrome((s) => s.dealDisplay);
  const dealKindsFilter = useActivitiesChrome((s) => s.filters.dealKinds);
  const ownersFilter = useActivitiesChrome((s) => s.filters.owners);
  const statesFilter = useActivitiesChrome((s) => s.filters.states);

  const showOpps = dealDisplay !== "overlay";
  const showSummary = dealDisplay !== "objects";
  const showObjects = dealDisplay !== "overlay";

  const range = useMemo(
    () => getRangeForChrome(anchorIso, grain),
    [anchorIso, grain]
  );
  const ownerParam = ownersFilter.length === 1 ? ownersFilter[0] : "all";
  const stateParam = statesFilter.length > 0 ? statesFilter : undefined;

  const { data: dealEventsData } = useDealEvents({
    from: range.startIso,
    to: range.endIso,
    ownerId: ownerParam,
    state: stateParam,
  });
  const events = useMemo<OppEvent[]>(() => {
    let list = dealEventsData?.events ?? [];
    if (dealKindsFilter.length > 0) {
      const set = new Set(dealKindsFilter);
      list = list.filter((e) => set.has(e.kind));
    }
    return list;
  }, [dealEventsData, dealKindsFilter]);

  const { data: openDealsData } = useOpenDeals(
    { ownerId: ownerParam, state: stateParam, limit: 200 },
    { enabled: showSummary }
  );
  const overdueDeals = useMemo(
    () => (openDealsData?.deals ?? []).filter((d) => (d.daysToClose ?? 0) < 0),
    [openDealsData]
  );

  // TODO: cold districts data source — Wave 8
  const coldList: ColdDistrict[] = useMemo(() => [], []);

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

  // Bucket deal events by yyyy-MM-dd for both the strip and the day list.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, OppEvent[]>();
    for (const e of events) {
      if (!e.occurredAt) continue;
      const k = format(new Date(e.occurredAt), "yyyy-MM-dd");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [events]);

  const stripData: WeekStripDay[] = useMemo(
    () =>
      days.map((d) => {
        const dayKey = format(d, "yyyy-MM-dd");
        const items = byDay.get(dayKey) ?? [];
        const cats = Array.from(new Set(items.map((a) => a.category))) as ActivityCategory[];
        const dayEvents = eventsByDay.get(dayKey) ?? [];
        const dealKindSet = new Set<DealKind>();
        let oppTotal = 0;
        for (const e of dayEvents) {
          dealKindSet.add(e.kind as DealKind);
          oppTotal += typeof e.amount === "number" ? e.amount : 0;
        }
        return {
          date: d,
          count: items.length,
          categories: cats,
          dealKinds: Array.from(dealKindSet),
          oppTotal,
          dealCount: dayEvents.length,
        };
      }),
    [days, byDay, eventsByDay]
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
  const selectedDayEvents =
    eventsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [];
  const isSelectedToday = isSameDay(selectedDay, today);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKind, setDrawerKind] = useState<OppDrawerKind>("all");
  const onOpenDrawer = (kind: OppDrawerKind) => {
    setDrawerKind(kind);
    setDrawerOpen(true);
  };

  const hasContent = selectedItems.length > 0 || selectedDayEvents.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FFFCFA]">
      <div className="flex flex-col gap-5 px-6 pt-4 pb-6 flex-1 min-h-0">
        {showSummary && (
          <OppSummaryStrip
            events={events}
            overdueDeals={overdueDeals}
            coldList={coldList}
            rangeLabel={fmtRange(range)}
            onOpen={onOpenDrawer}
          />
        )}

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
            ) : !hasContent ? (
              <div className="px-6 py-12 flex flex-col items-center gap-2.5 text-center">
                <CalendarDays className="w-10 h-10 text-[#E2DEEC]" />
                <div className="text-sm text-[#6E6390]">No activities on this day.</div>
                <div className="text-xs text-[#8A80A8]">
                  Click a day in the strip above or switch views to browse.
                </div>
              </div>
            ) : (
              <>
                {showObjects && selectedDayEvents.length > 0 && (
                  <div className="px-5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8]">
                    Pipeline events
                  </div>
                )}
                {showObjects && selectedDayEvents.length > 0 && (
                  <div className="px-5 pb-2 flex flex-col gap-1.5">
                    {selectedDayEvents.map((ev) => (
                      <DealChip key={ev.id} density="row" deal={ev} />
                    ))}
                  </div>
                )}
                {showObjects &&
                  selectedDayEvents.length > 0 &&
                  selectedItems.length > 0 && (
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

      <OppDrawer
        open={drawerOpen}
        kind={drawerKind}
        heading={drawerHeadingFor(drawerKind)}
        rangeLabel={fmtRange(range)}
        events={events}
        overdueDeals={overdueDeals}
        coldList={coldList}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
