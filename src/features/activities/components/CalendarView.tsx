"use client";

import { useState, useMemo, useRef, useEffect, useCallback, memo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isSameWeek,
  isToday,
  eachDayOfInterval,
} from "date-fns";
import {
  useCreateActivity,
  type ActivityListItem,
} from "@/lib/api";
import {
  type ActivityType,
  type ActivityCategory,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
  CATEGORY_LABELS,
} from "@/lib/activityTypes";

// ============================================================================
// Types
// ============================================================================

interface CalendarViewProps {
  activities: ActivityListItem[];
  isLoading: boolean;
  onEditActivity: (activity: ActivityListItem) => void;
  onDeleteActivity: (activityId: string) => void;
  unscheduledActivities: ActivityListItem[];
  // New: callback to open the create-activity modal from the right panel
  onNewActivity: () => void;
}

// Shared empty array to avoid new reference on every render for days with no activities
const EMPTY_ACTIVITIES: ActivityListItem[] = [];

// ============================================================================
// CalendarView (main component)
// ============================================================================

export default function CalendarView({
  activities,
  isLoading,
  onEditActivity,
  onDeleteActivity,
  unscheduledActivities,
  onNewActivity,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Build a map of date -> activities for quick lookup
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, ActivityListItem[]>();
    for (const activity of activities) {
      if (!activity.startDate) continue;
      const start = new Date(activity.startDate.split("T")[0] + "T00:00:00");
      const end = activity.endDate ? new Date(activity.endDate.split("T")[0] + "T00:00:00") : start;
      let days: Date[];
      try {
        days = eachDayOfInterval({ start, end });
      } catch {
        days = [start];
      }
      for (const day of days) {
        const key = format(day, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(activity);
      }
    }
    return map;
  }, [activities]);

  // Navigate by week (no more month mode)
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goPrev = useCallback(() => setCurrentDate((d) => subWeeks(d, 1)), []);
  const goNext = useCallback(() => setCurrentDate((d) => addWeeks(d, 1)), []);

  // When a date is clicked in the mini-month, jump to that week
  const handleMiniMonthDateClick = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    setQuickAddDate(date);
  }, []);

  const handleQuickAddClose = useCallback(() => {
    setQuickAddDate(null);
  }, []);

  const handleTogglePanel = useCallback(
    () => setPanelOpen((prev) => !prev),
    []
  );

  return (
    <div className="flex h-full">
      {/* Calendar main area — week view is the only view now */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Acuity-style centered header */}
        <CalendarHeader
          currentDate={currentDate}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToToday}
          panelOpen={panelOpen}
          onTogglePanel={handleTogglePanel}
          unscheduledCount={unscheduledActivities.length}
        />

        {/* Week Grid */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#F37167] border-t-transparent mx-auto mb-3" />
              <p className="text-sm text-[#403770] font-medium">Loading calendar...</p>
            </div>
          </div>
        ) : (
          <WeekGrid
            currentDate={currentDate}
            activitiesByDate={activitiesByDate}
            onDayClick={handleDayClick}
            onActivityClick={onEditActivity}
            quickAddDate={quickAddDate}
            onQuickAddClose={handleQuickAddClose}
          />
        )}
      </div>

      {/* Right Panel: mini-month + add button + unscheduled list */}
      {panelOpen && (
        <RightPanel
          currentDate={currentDate}
          onDateClick={handleMiniMonthDateClick}
          onNewActivity={onNewActivity}
          unscheduledActivities={unscheduledActivities}
          onActivityClick={onEditActivity}
        />
      )}
    </div>
  );
}

// ============================================================================
// CalendarHeader — Acuity-style centered navigation
// ============================================================================

const CalendarHeader = memo(function CalendarHeader({
  currentDate,
  onPrev,
  onNext,
  onToday,
  panelOpen,
  onTogglePanel,
  unscheduledCount,
}: {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  unscheduledCount: number;
}) {
  // "Week of February 9, 2026" format like Acuity
  const weekStart = startOfWeek(currentDate);
  const title = `Week of ${format(weekStart, "MMMM d, yyyy")}`;

  // Check if the current week includes today (for the TODAY button accent)
  const isCurrentWeek = isSameWeek(currentDate, new Date());

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      {/* Left: Centered navigation — arrows around TODAY button */}
      <div className="flex items-center gap-3">
        {/* Previous week arrow */}
        <button
          onClick={onPrev}
          className="p-1.5 text-gray-400 hover:text-[#403770] hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Previous week"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* TODAY button between arrows */}
        <button
          onClick={onToday}
          className={`px-3 py-1 text-sm font-semibold tracking-wide uppercase rounded-md transition-colors ${
            isCurrentWeek
              ? "text-[#403770] bg-gray-100"
              : "text-[#403770] hover:bg-gray-100"
          }`}
        >
          Today
        </button>

        {/* Next week arrow */}
        <button
          onClick={onNext}
          className="p-1.5 text-gray-400 hover:text-[#403770] hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Next week"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Week title */}
        <h2 className="text-lg font-bold text-[#403770] ml-2">{title}</h2>
      </div>

      {/* Right: Panel toggle */}
      <button
        onClick={onTogglePanel}
        className={`relative p-1.5 rounded-md transition-colors ${
          panelOpen
            ? "text-[#403770] bg-[#403770]/10"
            : "text-gray-400 hover:text-[#403770] hover:bg-gray-100"
        }`}
        aria-label="Toggle side panel"
        title="Toggle side panel"
      >
        {/* Sidebar icon */}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        {/* Unscheduled badge — shows even when panel is collapsed so user knows there are items */}
        {unscheduledCount > 0 && !panelOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold text-white bg-[#F37167] rounded-full flex items-center justify-center">
            {unscheduledCount > 9 ? "9+" : unscheduledCount}
          </span>
        )}
      </button>
    </div>
  );
});

// ============================================================================
// WeekGrid — the primary (only) calendar view
// ============================================================================

const WeekGrid = memo(function WeekGrid({
  currentDate,
  activitiesByDate,
  onDayClick,
  onActivityClick,
  quickAddDate,
  onQuickAddClose,
}: {
  currentDate: Date;
  activitiesByDate: Map<string, ActivityListItem[]>;
  onDayClick: (date: Date) => void;
  onActivityClick: (activity: ActivityListItem) => void;
  quickAddDate: Date | null;
  onQuickAddClose: () => void;
}) {
  const weekStart = startOfWeek(currentDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i));
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-[#FFFCFA]">
      {/* Day column headers with day name + date number */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-white">
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={format(day, "yyyy-MM-dd")}
              className="px-2 py-2 text-center border-r border-gray-100 last:border-r-0"
            >
              {/* Day name: "Sun", "Mon", etc. */}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {format(day, "EEE")}
              </div>
              {/* Date number with today highlight */}
              <div
                className={`inline-flex items-center justify-center w-7 h-7 mt-0.5 text-sm font-medium rounded-full ${
                  today
                    ? "bg-[#F37167] text-white"
                    : "text-[#403770]"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day columns — full height, each day is a column */}
      <div className="flex-1 grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayActivities = activitiesByDate.get(key) || EMPTY_ACTIVITIES;
          const today = isToday(day);
          const isQuickAddTarget = quickAddDate && isSameDay(day, quickAddDate);

          return (
            <DayCell
              key={key}
              date={day}
              activities={dayActivities}
              isToday={today}
              onDayClick={onDayClick}
              onActivityClick={onActivityClick}
              showQuickAdd={!!isQuickAddTarget}
              onQuickAddClose={onQuickAddClose}
            />
          );
        })}
      </div>
    </div>
  );
});

// ============================================================================
// DayCell — a single day column in the week view
// ============================================================================

const DayCell = memo(function DayCell({
  date,
  activities,
  isToday: today,
  onDayClick,
  onActivityClick,
  showQuickAdd,
  onQuickAddClose,
}: {
  date: Date;
  activities: ActivityListItem[];
  isToday: boolean;
  onDayClick: (date: Date) => void;
  onActivityClick: (activity: ActivityListItem) => void;
  showQuickAdd: boolean;
  onQuickAddClose: () => void;
}) {
  return (
    <div
      className={`relative border-r border-gray-100 last:border-r-0 min-h-[400px] transition-colors cursor-pointer group ${
        today
          ? "bg-[#EDFFE3]/30"  /* Mint tint for today's column */
          : "bg-white hover:bg-[#C4E7E6]/10"  /* Robin's Egg tint on hover */
      }`}
      onClick={(e) => {
        // Only open quick-add if clicking the cell background, not an event chip
        if ((e.target as HTMLElement).closest("[data-event-chip]")) return;
        onDayClick(date);
      }}
    >
      {/* Activity chips */}
      <div className="px-2 space-y-1 pt-2">
        {activities.map((activity) => (
          <EventChip
            key={activity.id}
            activity={activity}
            onActivityClick={onActivityClick}
          />
        ))}
      </div>

      {/* Quick-Add Form */}
      {showQuickAdd && (
        <QuickAddForm
          date={date}
          onClose={onQuickAddClose}
        />
      )}
    </div>
  );
});

// ============================================================================
// EventChip — activity display within a day column
// ============================================================================

const EventChip = memo(function EventChip({
  activity,
  onActivityClick,
}: {
  activity: ActivityListItem;
  onActivityClick: (activity: ActivityListItem) => void;
}) {
  const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status];
  const typeIcon = ACTIVITY_TYPE_ICONS[activity.type];
  const typeLabel = ACTIVITY_TYPE_LABELS[activity.type];

  return (
    <div
      data-event-chip
      onClick={(e) => {
        e.stopPropagation();
        onActivityClick(activity);
      }}
      className="group/chip flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-all hover:shadow-sm text-xs"
      style={{
        borderLeft: `3px solid ${statusConfig.color}`,
        backgroundColor: statusConfig.bgColor,
      }}
      title={`${typeLabel}: ${activity.title} (${statusConfig.label})`}
    >
      <span className="text-sm flex-shrink-0">{typeIcon}</span>
      <span className="truncate font-medium text-gray-700">
        {activity.title}
      </span>
      <span className="ml-auto text-gray-400 text-[10px] uppercase tracking-wide flex-shrink-0">
        {typeLabel}
      </span>
    </div>
  );
});

// ============================================================================
// QuickAddForm — inline form when clicking a day cell
// ============================================================================

function QuickAddForm({
  date,
  onClose,
}: {
  date: Date;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>("conference");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const createActivity = useCreateActivity();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent the click that opened the form from closing it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createActivity.mutateAsync({
        type,
        title: title.trim(),
        startDate: format(date, "yyyy-MM-dd"),
        status: "planned",
      });
      onClose();
    } catch (error) {
      console.error("Failed to create activity:", error);
    }
  };

  return (
    <div
      ref={formRef}
      className="absolute z-20 left-1 right-1 top-8 bg-white rounded-lg shadow-xl border border-gray-200 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit}>
        {/* Date label */}
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
          {format(date, "EEEE, MMM d")}
        </div>

        {/* Title input */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Activity title..."
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent mb-2"
        />

        {/* Type selector */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ActivityType)}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent mb-3"
        >
          {(
            Object.entries(ACTIVITY_CATEGORIES) as [
              ActivityCategory,
              readonly ActivityType[],
            ][]
          ).map(([category, types]) => (
            <optgroup key={category} label={CATEGORY_LABELS[category]}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPE_ICONS[t]} {ACTIVITY_TYPE_LABELS[t]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || createActivity.isPending}
            className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createActivity.isPending ? "Adding..." : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// RightPanel — stacks mini-month, add button, and unscheduled list
// ============================================================================

const RightPanel = memo(function RightPanel({
  currentDate,
  onDateClick,
  onNewActivity,
  unscheduledActivities,
  onActivityClick,
}: {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onNewActivity: () => void;
  unscheduledActivities: ActivityListItem[];
  onActivityClick: (activity: ActivityListItem) => void;
}) {
  return (
    <div className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
      {/* Mini-month calendar at the top */}
      <MiniMonthCalendar
        currentDate={currentDate}
        onDateClick={onDateClick}
      />

      {/* Add activity button — Coral, full-width */}
      <div className="px-4 py-3 border-b border-gray-200">
        <button
          onClick={onNewActivity}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0605a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Activity
        </button>
        {/* Signature dashed line accent below the button */}
        <div className="mt-3 border-t border-dashed border-[#6EA3BE]" />
      </div>

      {/* Unscheduled activities list — scrollable */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#403770]">Unscheduled</h3>
          {unscheduledActivities.length > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#F37167] rounded-full min-w-[18px]">
              {unscheduledActivities.length}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Click to assign a date</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {unscheduledActivities.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg
              className="w-10 h-10 mx-auto text-gray-200 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-xs text-gray-400">No unscheduled activities</p>
          </div>
        ) : (
          <div className="py-1">
            {unscheduledActivities.map((activity) => {
              const typeIcon = ACTIVITY_TYPE_ICONS[activity.type];
              const typeLabel = ACTIVITY_TYPE_LABELS[activity.type];
              const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status];

              return (
                <button
                  key={activity.id}
                  onClick={() => onActivityClick(activity)}
                  className="w-full px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{typeIcon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {activity.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400">{typeLabel}</span>
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusConfig.color }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// MiniMonthCalendar — compact month calendar for navigating weeks
// ============================================================================

const MINI_DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

const MiniMonthCalendar = memo(function MiniMonthCalendar({
  currentDate,
  onDateClick,
}: {
  currentDate: Date;
  onDateClick: (date: Date) => void;
}) {
  // The mini-month tracks its own displayed month (independent from the week view)
  // but initializes to the month containing the current week
  const [displayMonth, setDisplayMonth] = useState(startOfMonth(currentDate));

  // When the week view navigates to a different month, sync the mini-month
  useEffect(() => {
    const weekMonth = startOfMonth(currentDate);
    if (!isSameMonth(displayMonth, weekMonth)) {
      setDisplayMonth(weekMonth);
    }
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  // Build rows of 7 days for the mini calendar
  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  // The week currently shown in the main week view
  const activeWeekStart = startOfWeek(currentDate);

  return (
    <div className="px-4 py-3 border-b border-gray-200">
      {/* Month name + navigation arrows */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#403770]">
          {format(displayMonth, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDisplayMonth((d) => subMonths(d, 1))}
            className="p-1 text-gray-400 hover:text-[#403770] rounded transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setDisplayMonth((d) => addMonths(d, 1))}
            className="p-1 text-gray-400 hover:text-[#403770] rounded transition-colors"
            aria-label="Next month"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day-of-week headers: S M T W T F S */}
      <div className="grid grid-cols-7 mb-1">
        {MINI_DAY_NAMES.map((name, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold text-gray-400 uppercase"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {weeks.flat().map((day, i) => {
          const inMonth = isSameMonth(day, displayMonth);
          const today = isToday(day);
          // Highlight the entire active week row with Robin's Egg
          const inActiveWeek = isSameWeek(day, activeWeekStart);

          return (
            <button
              key={i}
              onClick={() => onDateClick(day)}
              className={`flex items-center justify-center w-7 h-7 mx-auto text-xs rounded-full transition-colors ${
                today
                  ? "bg-[#F37167] text-white font-bold"          /* Today: Coral circle */
                  : inActiveWeek && inMonth
                    ? "bg-[#C4E7E6] text-[#403770] font-medium"  /* Active week: Robin's Egg */
                    : inMonth
                      ? "text-[#403770] hover:bg-gray-100"        /* Normal in-month day */
                      : "text-gray-300"                            /* Out-of-month day */
              }`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
});
