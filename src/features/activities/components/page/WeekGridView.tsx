"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import type { ActivityListItem, OppEvent } from "@/features/shared/types/api-types";
import { type ActivityCategory } from "@/features/activities/types";
import {
  useActivitiesChrome,
  getRangeForChrome,
} from "@/features/activities/lib/filters-store";
import { useDealEvents, useOpenDeals } from "@/features/activities/lib/queries";
import DealChip from "./deals/DealChip";
import { OPP_STYLE } from "./deals/oppStyle";
import { formatMoney } from "./deals/formatMoney";
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

const HOUR_START = 7;
const HOUR_END = 21;
const PX_PER_HOUR = 52;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const MAX_PIPS_PER_DAY = 5;

interface PlacedBlock {
  act: ActivityListItem;
  top: number;
  height: number;
  durationMin: number;
}

function fmtHour(h: number): string {
  const h12 = ((h + 11) % 12) + 1;
  const ap = h >= 12 ? "PM" : "AM";
  return `${h12} ${ap}`;
}

function buildBlocks(activities: ActivityListItem[], day: Date): PlacedBlock[] {
  return activities
    .filter((a) => a.startDate && isSameDay(new Date(a.startDate), day))
    .map((a) => {
      const start = new Date(a.startDate!);
      const end = a.endDate ? new Date(a.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
      const startH = start.getHours() + start.getMinutes() / 60;
      const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
      const durH = Math.max(0.5, durationMin / 60);
      const top = Math.max(0, (startH - HOUR_START) * PX_PER_HOUR);
      const height = Math.max(30, durH * PX_PER_HOUR - 2);
      return { act: a, top, height, durationMin };
    })
    .sort((a, b) => (a.act.startDate ?? "").localeCompare(b.act.startDate ?? ""));
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

export default function WeekGridView({
  activities,
  onActivityClick,
}: {
  activities: ActivityListItem[];
  onActivityClick: (id: string) => void;
}) {
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const grain = useActivitiesChrome((s) => s.grain);
  const dealKindsFilter = useActivitiesChrome((s) => s.filters.dealKinds);
  const ownersFilter = useActivitiesChrome((s) => s.filters.owners);
  const statesFilter = useActivitiesChrome((s) => s.filters.states);

  // Always render summary + per-deal objects (the former "both" mode).
  const showOpps = true;
  const showSummary = true;
  const showObjects = true;

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

  const days = useMemo(() => {
    const start = startOfWeek(new Date(anchorIso), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
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

  const today = new Date();
  const isCurrentWeek = days.some((d) => isSameDay(d, today));
  const nowOffset =
    (today.getHours() + today.getMinutes() / 60 - HOUR_START) * PX_PER_HOUR;

  const headerColTemplate = "grid-cols-[64px_repeat(7,minmax(0,1fr))]";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKind, setDrawerKind] = useState<OppDrawerKind>("all");
  const onOpenDrawer = (kind: OppDrawerKind) => {
    setDrawerKind(kind);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FFFCFA]">
      <div className="flex flex-col px-6 pt-4 pb-6 flex-1 min-h-0">
        {/* Day header row */}
        <div
          className={`grid ${headerColTemplate} bg-white border border-[#E2DEEC] rounded-t-xl`}
        >
          <div />
          {days.map((d) => {
            const items = byDay.get(format(d, "yyyy-MM-dd")) ?? [];
            const isToday = isSameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className="px-2.5 py-3 text-center border-l border-[#E2DEEC]"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A80A8]">
                  {format(d, "EEE")}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <div
                    className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-full text-base font-bold tabular-nums"
                    style={{
                      backgroundColor: isToday ? "#F37167" : "transparent",
                      color: isToday ? "#fff" : "#403770",
                    }}
                  >
                    {d.getDate()}
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] text-[#8A80A8]">
                  {items.length === 0
                    ? "No activity"
                    : `${items.length} ${items.length === 1 ? "item" : "items"}`}
                </div>
              </div>
            );
          })}
        </div>

        {showSummary && (
          <div className="mt-2">
            <OppSummaryStrip
              events={events}
              overdueDeals={overdueDeals}
              coldList={coldList}
              rangeLabel={fmtRange(range)}
              onOpen={onOpenDrawer}
            />
          </div>
        )}

        {/* Pinned Pipeline (deals-as-objects) row — pip-density chips */}
        {showObjects && (
          <div
            className={`grid ${headerColTemplate} border-x border-[#E2DEEC] bg-white border-t border-t-[#EFEDF5] mt-2`}
          >
            <div className="px-2 py-2 text-[9px] font-bold uppercase tracking-[0.06em] text-[#403770] flex items-start justify-end leading-tight">
              Pipeline
            </div>
            {days.map((d) => {
              const dayEvents = eventsByDay.get(format(d, "yyyy-MM-dd")) ?? [];
              const visible = dayEvents.slice(0, MAX_PIPS_PER_DAY);
              const overflow = dayEvents.length - visible.length;
              return (
                <div
                  key={d.toISOString()}
                  className="border-l border-[#E2DEEC] p-1.5 flex flex-wrap gap-1 min-h-[32px] items-center"
                >
                  {visible.map((ev) => (
                    <DealChip
                      key={ev.id}
                      density="pip"
                      deal={ev}
                      onClick={() => onOpenDrawer("all")}
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[9px] font-semibold text-[#8A80A8]">
                      +{overflow}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Deals overlay row — per-day kind icons + total */}
        {showOpps && (
          <div
            className={`grid ${headerColTemplate} border-x border-[#E2DEEC] bg-[#FBF9FC] ${showObjects ? "" : "mt-2 border-t border-t-[#EFEDF5]"}`}
          >
            <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#8A80A8] flex items-center justify-end">
              Deals
            </div>
            {days.map((d) => {
              const dayEvents = eventsByDay.get(format(d, "yyyy-MM-dd")) ?? [];
              if (dayEvents.length === 0) {
                return (
                  <div
                    key={d.toISOString()}
                    className="border-l border-[#E2DEEC] px-2 py-1.5 min-h-[28px] flex items-center gap-1 text-[10px] text-[#C2BBD4]"
                    aria-hidden
                  >
                    —
                  </div>
                );
              }
              const total = dayEvents.reduce(
                (s, e) => s + (typeof e.amount === "number" ? e.amount : 0),
                0
              );
              const kindsSeen = new Set(dayEvents.map((e) => e.kind));
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => onOpenDrawer("all")}
                  title={`${dayEvents.length} deal event${dayEvents.length === 1 ? "" : "s"} · ${formatMoney(total)}`}
                  className="border-l border-[#E2DEEC] px-2 py-1.5 min-h-[28px] flex items-center gap-1 text-[10px] font-semibold tabular-nums hover:bg-[#F2EFF7] transition-colors text-left"
                >
                  {Array.from(kindsSeen).map((k) => {
                    const sty = OPP_STYLE[k];
                    const Icon = sty.icon;
                    return (
                      <span
                        key={k}
                        className="inline-flex items-center"
                        style={{ color: sty.color }}
                        aria-label={sty.label}
                      >
                        <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                      </span>
                    );
                  })}
                  <span className="ml-auto text-[#403770]">
                    {formatMoney(total)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Hour body */}
        <div
          className="flex-1 overflow-auto bg-white border border-t-[#EFEDF5] border-[#E2DEEC] rounded-b-xl"
        >
          <div
            className={`relative grid ${headerColTemplate}`}
            style={{ height: HOURS.length * PX_PER_HOUR }}
          >
            {/* Hour labels */}
            <div>
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  className={`text-right text-[10px] text-[#A69DC0] px-2 pt-1 ${
                    i === 0 ? "" : "border-t border-[#EFEDF5]"
                  }`}
                  style={{ height: PX_PER_HOUR }}
                >
                  {fmtHour(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const blocks = buildBlocks(byDay.get(format(day, "yyyy-MM-dd")) ?? [], day);
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className="relative border-l border-[#E2DEEC]"
                  style={{
                    backgroundColor: isToday ? "rgba(196, 231, 230, 0.15)" : "#fff",
                  }}
                >
                  {/* Hour gridlines */}
                  {HOURS.map((h, i) => (
                    <div
                      key={h}
                      style={{ height: PX_PER_HOUR }}
                      className={i === 0 ? "" : "border-t border-[#EFEDF5]"}
                    />
                  ))}

                  {/* Now line */}
                  {isCurrentWeek && isToday && nowOffset >= 0 && (
                    <>
                      <div
                        className="absolute left-[-4px] right-0 z-[5]"
                        style={{
                          top: nowOffset,
                          height: 2,
                          backgroundColor: "#F37167",
                        }}
                        aria-hidden
                      />
                      <div
                        className="absolute z-[6] rounded-full"
                        style={{
                          left: -8,
                          top: nowOffset - 4,
                          width: 10,
                          height: 10,
                          backgroundColor: "#F37167",
                        }}
                        aria-hidden
                      />
                    </>
                  )}

                  {/* Activity blocks */}
                  {blocks.map(({ act, top, height }) => {
                    const style = CATEGORY_STYLE[act.category];
                    const district =
                      act.stateAbbrevs.length > 0 ? act.stateAbbrevs[0] : null;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onActivityClick(act.id);
                        }}
                        title={act.title}
                        className="absolute left-1 right-1 px-[7px] py-1 rounded-md text-left overflow-hidden flex flex-col gap-0.5 shadow-[0_1px_2px_rgba(64,55,112,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F37167] focus-visible:ring-offset-1"
                        style={{
                          top,
                          height,
                          backgroundColor: style.bg,
                          color: style.ink,
                          borderLeft: `3px solid ${style.dot}`,
                        }}
                      >
                        <span className="text-[10px] font-bold tabular-nums opacity-80">
                          {format(new Date(act.startDate!), "h:mm a")}
                        </span>
                        <span className="text-[11px] font-semibold leading-snug overflow-hidden text-ellipsis line-clamp-2">
                          {act.title}
                        </span>
                        {height > 55 && district && (
                          <span className="text-[10px] opacity-75 whitespace-nowrap overflow-hidden text-ellipsis">
                            {district}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
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
