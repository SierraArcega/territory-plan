"use client";

import { useMemo } from "react";
import { ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { addDays, format, isAfter, isBefore, isSameDay, differenceInMinutes } from "date-fns";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

const CATEGORY_COLORS: Record<string, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

const TYPE_LABELS: Record<string, string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  campaign: "Campaign",
  event: "Event",
  gift_drop: "Gift drop",
  sponsorship: "Sponsorship",
  thought_leadership: "Thought leadership",
  other: "Other",
};

interface Group {
  date: Date;
  label: string;
  items: ActivityListItem[];
}

function bucketize(activities: ActivityListItem[]): Group[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const horizon = addDays(today, 14);

  const byKey = new Map<string, Group>();
  const ordered: Group[] = [];

  const dated = activities
    .filter((a) => a.startDate)
    .filter((a) => {
      const d = new Date(a.startDate!);
      return !isBefore(d, today) && isBefore(d, horizon);
    })
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
    .slice(0, 30);

  for (const a of dated) {
    const d = new Date(a.startDate!);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    let g = byKey.get(key);
    if (!g) {
      const label = isSameDay(d, today)
        ? "Today"
        : isSameDay(d, tomorrow)
          ? "Tomorrow"
          : format(d, "EEE");
      g = { date: d, label, items: [] };
      byKey.set(key, g);
      ordered.push(g);
    }
    g.items.push(a);
  }

  return ordered;
}

function formatDuration(start: string, end: string | null): string | null {
  if (!end) return null;
  const mins = differenceInMinutes(new Date(end), new Date(start));
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  activities: ActivityListItem[];
  onActivityClick: (id: string) => void;
  scope: "mine" | "team";
  onNewActivity?: () => void;
}

export default function UpcomingRail({
  activities,
  onActivityClick,
  scope,
  onNewActivity,
}: Props) {
  const collapsed = useActivitiesChrome((s) => s.railCollapsed);
  const setCollapsed = useActivitiesChrome((s) => s.setRailCollapsed);
  const groups = useMemo(() => bucketize(activities), [activities]);

  if (collapsed) {
    return (
      <aside className="w-9 flex-shrink-0 flex flex-col items-center pt-3.5 border-l border-[#E2DEEC] bg-[#FFFCFA]">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand upcoming rail"
          title="Expand rail"
          className="fm-focus-ring w-6 h-6 rounded-md border border-[#E2DEEC] bg-white text-[#544A78] hover:text-[#403770] hover:border-[#D4CFE2] inline-flex items-center justify-center mb-3 [transition-duration:120ms] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand upcoming rail"
          className="fm-focus-ring text-[11px] font-bold uppercase tracking-[0.12em] text-[#544A78] select-none [writing-mode:vertical-rl] [transform:rotate(180deg)]"
        >
          Upcoming
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] flex-shrink-0 flex flex-col h-full border-l border-[#E2DEEC] bg-[#FFFCFA]">
      <div className="px-[18px] pt-4 pb-3 border-b border-[#E2DEEC]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#403770] tracking-tight m-0">
            {scope === "team" ? "Team feed" : "Upcoming"}
          </h3>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse upcoming rail"
            title="Collapse rail"
            className="fm-focus-ring w-6 h-6 rounded-md border border-[#E2DEEC] bg-white text-[#8A80A8] hover:text-[#403770] inline-flex items-center justify-center [transition-duration:120ms] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-1.5 text-[11px] text-[#8A80A8]">
          {groups.length === 0
            ? "No upcoming activities"
            : `Next ${activities.length} · through ${format(groups[groups.length - 1].date, "MMM d")}`}
        </div>
        {onNewActivity && (
          <button
            type="button"
            onClick={onNewActivity}
            className="fm-focus-ring mt-2.5 w-full px-2.5 py-2 rounded-lg bg-[#F37167] hover:bg-[#E55A50] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 [transition-duration:120ms] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Log activity
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="px-6 py-6 text-center text-[#A69DC0] text-[13px]">
            No upcoming activities.
          </div>
        ) : (
          groups.map((g) => {
            const isToday = g.label === "Today";
            return (
              <div key={g.date.toISOString()}>
                <div
                  className="sticky top-0 z-[1] px-[18px] pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#FFFCFA] border-b border-[#F7F5FA]"
                  style={{ color: isToday ? "#F37167" : "#8A80A8" }}
                >
                  {g.label} · {format(g.date, "MMM d")}
                </div>
                {g.items.map((act) => {
                  const color = CATEGORY_COLORS[act.category] ?? "#A69DC0";
                  const typeLabel = TYPE_LABELS[act.type] ?? act.type;
                  const time = act.startDate
                    ? format(new Date(act.startDate), "h:mm a")
                    : "All-day";
                  const duration = act.startDate
                    ? formatDuration(act.startDate, act.endDate)
                    : null;
                  const stateAbbrev = act.stateAbbrevs[0];
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => onActivityClick(act.id)}
                      className="fm-focus-ring w-full text-left flex flex-col gap-[3px] px-[18px] py-2.5 border-b border-[#F7F5FA] hover:bg-white [transition-duration:100ms] transition-colors"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.04em]"
                          style={{ color }}
                        >
                          {typeLabel}
                        </span>
                        <span className="text-[11px] font-bold text-[#403770] tabular-nums">
                          {time}
                          {duration && (
                            <span className="ml-1 text-[#8A80A8] font-semibold">
                              · {duration}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold text-[#403770] leading-tight line-clamp-2">
                        {act.title}
                      </div>
                      {stateAbbrev && (
                        <div className="text-[11px] text-[#8A80A8] truncate">
                          {stateAbbrev}
                          {act.districtCount > 1 && (
                            <span className="text-[#C2BBD4]">
                              {" "}
                              · +{act.districtCount - 1}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
