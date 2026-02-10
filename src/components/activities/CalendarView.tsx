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
}

type CalendarMode = "month" | "week";

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
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Build a map of date -> activities for quick lookup
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, ActivityListItem[]>();
    for (const activity of activities) {
      if (!activity.startDate) continue;
      const start = new Date(activity.startDate);
      const end = activity.endDate ? new Date(activity.endDate) : start;
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

  // Memoized navigation callbacks
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goPrev = useCallback(
    () =>
      setCurrentDate((d) =>
        calendarMode === "month" ? subMonths(d, 1) : subWeeks(d, 1)
      ),
    [calendarMode]
  );
  const goNext = useCallback(
    () =>
      setCurrentDate((d) =>
        calendarMode === "month" ? addMonths(d, 1) : addWeeks(d, 1)
      ),
    [calendarMode]
  );

  const handleDayClick = useCallback((date: Date) => {
    setQuickAddDate(date);
  }, []);

  const handleQuickAddClose = useCallback(() => {
    setQuickAddDate(null);
  }, []);

  const handleToggleSidebar = useCallback(
    () => setSidebarOpen((prev) => !prev),
    []
  );

  return (
    <div className="flex h-full">
      {/* Calendar main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Calendar Header */}
        <CalendarHeader
          currentDate={currentDate}
          calendarMode={calendarMode}
          onModeChange={setCalendarMode}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToToday}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          unscheduledCount={unscheduledActivities.length}
        />

        {/* Calendar Grid */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#F37167] border-t-transparent mx-auto mb-3" />
              <p className="text-sm text-[#403770] font-medium">Loading calendar...</p>
            </div>
          </div>
        ) : calendarMode === "month" ? (
          <MonthGrid
            currentDate={currentDate}
            activitiesByDate={activitiesByDate}
            onDayClick={handleDayClick}
            onActivityClick={onEditActivity}
            quickAddDate={quickAddDate}
            onQuickAddClose={handleQuickAddClose}
          />
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

      {/* Unscheduled Sidebar */}
      {sidebarOpen && (
        <UnscheduledSidebar
          activities={unscheduledActivities}
          onActivityClick={onEditActivity}
        />
      )}
    </div>
  );
}

// ============================================================================
// CalendarHeader
// ============================================================================

const CalendarHeader = memo(function CalendarHeader({
  currentDate,
  calendarMode,
  onModeChange,
  onPrev,
  onNext,
  onToday,
  sidebarOpen,
  onToggleSidebar,
  unscheduledCount,
}: {
  currentDate: Date;
  calendarMode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  unscheduledCount: number;
}) {
  const title =
    calendarMode === "month"
      ? format(currentDate, "MMMM yyyy")
      : `${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}`;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      {/* Left: Navigation */}
      <div className="flex items-center gap-3">
        <div className="flex items-center">
          <button
            onClick={onPrev}
            className="p-1.5 text-gray-500 hover:text-[#403770] hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Previous"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={onNext}
            className="p-1.5 text-gray-500 hover:text-[#403770] hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Next"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <h2 className="text-lg font-semibold text-[#403770]">{title}</h2>
        <button
          onClick={onToday}
          className="px-3 py-1 text-xs font-medium text-[#403770] border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Right: Mode toggle + Sidebar toggle */}
      <div className="flex items-center gap-3">
        {/* Month / Week toggle */}
        <div className="inline-flex rounded-md border border-gray-300" role="group">
          <button
            onClick={() => onModeChange("month")}
            className={`px-3 py-1 text-xs font-medium rounded-l-md transition-colors ${
              calendarMode === "month"
                ? "bg-[#403770] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onModeChange("week")}
            className={`px-3 py-1 text-xs font-medium rounded-r-md transition-colors ${
              calendarMode === "week"
                ? "bg-[#403770] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Week
          </button>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className={`relative p-1.5 rounded-md transition-colors ${
            sidebarOpen
              ? "text-[#403770] bg-[#403770]/10"
              : "text-gray-500 hover:text-[#403770] hover:bg-gray-100"
          }`}
          aria-label="Toggle unscheduled sidebar"
          title="Unscheduled activities"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          {unscheduledCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold text-white bg-[#F37167] rounded-full flex items-center justify-center">
              {unscheduledCount > 9 ? "9+" : unscheduledCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// MonthGrid
// ============================================================================

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MonthGrid = memo(function MonthGrid({
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
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  // Build rows of 7 days
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

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="px-2 py-2 text-xs font-semibold text-gray-500 text-center uppercase tracking-wider"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {weeks.flat().map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayActivities = activitiesByDate.get(key) || EMPTY_ACTIVITIES;
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const isQuickAddTarget = quickAddDate && isSameDay(day, quickAddDate);

          return (
            <DayCell
              key={key}
              date={day}
              activities={dayActivities}
              inMonth={inMonth}
              isToday={today}
              onDayClick={onDayClick}
              onActivityClick={onActivityClick}
              showQuickAdd={!!isQuickAddTarget}
              onQuickAddClose={onQuickAddClose}
              compact
            />
          );
        })}
      </div>
    </div>
  );
});

// ============================================================================
// WeekGrid
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
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={format(day, "yyyy-MM-dd")}
              className="px-2 py-2 text-center"
            >
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {format(day, "EEE")}
              </div>
              <div
                className={`inline-flex items-center justify-center w-7 h-7 mt-0.5 text-sm font-medium rounded-full ${
                  today
                    ? "bg-[#F37167] text-white"
                    : "text-gray-700"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day columns */}
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
              inMonth
              isToday={today}
              onDayClick={onDayClick}
              onActivityClick={onActivityClick}
              showQuickAdd={!!isQuickAddTarget}
              onQuickAddClose={onQuickAddClose}
              compact={false}
            />
          );
        })}
      </div>
    </div>
  );
});

// ============================================================================
// DayCell
// ============================================================================

const DayCell = memo(function DayCell({
  date,
  activities,
  inMonth,
  isToday: today,
  onDayClick,
  onActivityClick,
  showQuickAdd,
  onQuickAddClose,
  compact,
}: {
  date: Date;
  activities: ActivityListItem[];
  inMonth: boolean;
  isToday: boolean;
  onDayClick: (date: Date) => void;
  onActivityClick: (activity: ActivityListItem) => void;
  showQuickAdd: boolean;
  onQuickAddClose: () => void;
  compact: boolean;
}) {
  const MAX_VISIBLE = compact ? 3 : 20;
  const visibleActivities = activities.slice(0, MAX_VISIBLE);
  const overflowCount = activities.length - MAX_VISIBLE;

  return (
    <div
      className={`relative border-b border-r border-gray-100 ${
        compact ? "min-h-[100px]" : "min-h-[400px]"
      } ${
        inMonth ? "bg-white" : "bg-gray-50/50"
      } hover:bg-blue-50/30 transition-colors cursor-pointer group`}
      onClick={(e) => {
        // Only open quick-add if clicking the cell background, not an event chip
        if ((e.target as HTMLElement).closest("[data-event-chip]")) return;
        onDayClick(date);
      }}
    >
      {/* Date number (only in month view) */}
      {compact && (
        <div className="px-2 py-1">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
              today
                ? "bg-[#F37167] text-white"
                : inMonth
                  ? "text-gray-700"
                  : "text-gray-300"
            }`}
          >
            {format(date, "d")}
          </span>
        </div>
      )}

      {/* Activity chips */}
      <div className={`px-1 ${compact ? "space-y-0.5" : "px-2 space-y-1 pt-1"}`}>
        {visibleActivities.map((activity) => (
          <EventChip
            key={activity.id}
            activity={activity}
            compact={compact}
            onActivityClick={onActivityClick}
          />
        ))}
        {overflowCount > 0 && (
          <button
            className="text-xs text-[#403770] font-medium hover:underline px-1"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            +{overflowCount} more
          </button>
        )}
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
// EventChip
// ============================================================================

const EventChip = memo(function EventChip({
  activity,
  compact,
  onActivityClick,
}: {
  activity: ActivityListItem;
  compact: boolean;
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
      className={`group/chip flex items-center gap-1 rounded cursor-pointer transition-all hover:shadow-sm ${
        compact ? "px-1 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
      }`}
      style={{
        borderLeft: `3px solid ${statusConfig.color}`,
        backgroundColor: statusConfig.bgColor,
      }}
      title={`${typeLabel}: ${activity.title} (${statusConfig.label})`}
    >
      <span className={compact ? "text-xs" : "text-sm"}>{typeIcon}</span>
      <span className="truncate font-medium text-gray-700">
        {activity.title}
      </span>
      {!compact && (
        <span className="ml-auto text-gray-400 text-[10px] uppercase tracking-wide flex-shrink-0">
          {typeLabel}
        </span>
      )}
    </div>
  );
});

// ============================================================================
// QuickAddForm
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
// UnscheduledSidebar
// ============================================================================

const UnscheduledSidebar = memo(function UnscheduledSidebar({
  activities,
  onActivityClick,
}: {
  activities: ActivityListItem[];
  onActivityClick: (activity: ActivityListItem) => void;
}) {
  return (
    <div className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#403770]">Unscheduled</h3>
          {activities.length > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#F37167] rounded-full min-w-[18px]">
              {activities.length}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Click to assign a date</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {activities.length === 0 ? (
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
            {activities.map((activity) => {
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
