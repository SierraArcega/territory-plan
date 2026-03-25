"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useTasks,
  useActivities,
  useUpdateTask,
  useCalendarInbox,
  type TaskItem,
  type ActivityListItem,
} from "@/lib/api";
import { useFeedAlerts } from "@/features/home/lib/queries";
import FeedSummaryCards from "./FeedSummaryCards";
import FeedSection from "./FeedSection";
import DayNavigator from "./DayNavigator";
import FeedControls from "./FeedControls";
import { TaskRow, MeetingRow, UpcomingActivityRow } from "./FeedRows";
import { AlertRow } from "./AlertRow";
import OutcomeModal from "@/features/activities/components/OutcomeModal";
import TaskDetailModal from "@/features/tasks/components/TaskDetailModal";
import { ACTIVITY_TYPE_LABELS } from "@/features/activities/types";
import { Rocket, Users } from "lucide-react";
import Link from "next/link";

// ============================================================================
// Helpers
// ============================================================================

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDatePlusDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(isoDate: string): string {
  const datePart = isoDate.split("T")[0];
  const date = new Date(datePart + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayHeader(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Extract YYYY-MM-DD from a date string (may include time component). */
function toDateKey(date: string): string {
  return date.split("T")[0];
}

/** Priority sort order: urgent=0, high=1, medium=2, low=3. */
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortByPriority(a: TaskItem, b: TaskItem): number {
  return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
}

// ============================================================================
// FeedTab — Three-zone layout
// ============================================================================

interface FeedTabProps {
  onBadgeCountChange?: (count: number) => void;
}

export default function FeedTab({ onBadgeCountChange }: FeedTabProps) {
  const today = getToday();
  const weekEnd = getDatePlusDays(today, 7);

  // ---- Data fetching ----
  const { data: allTasksData } = useTasks({});
  const { data: activitiesData } = useActivities({});
  const { data: calendarData } = useCalendarInbox("pending");
  const { data: alertsData } = useFeedAlerts();
  const updateTask = useUpdateTask();

  // ---- Modal state ----
  const [outcomeActivity, setOutcomeActivity] = useState<ActivityListItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // ---- Day navigation state ----
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState<number>(5);

  // ---- All tasks & activities ----
  const allTasks = useMemo(() => allTasksData?.tasks || [], [allTasksData]);
  const allActivities = useMemo(() => activitiesData?.activities || [], [activitiesData]);

  // ============================================================================
  // ZONE 1: TODAY'S FOCUS
  // ============================================================================

  // Overdue tasks (always pinned above today's items)
  // When showCompleted is on, include tasks completed today
  const overdueTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (!t.dueDate || toDateKey(t.dueDate) >= today) return false;
      if (t.status === "done") {
        return showCompleted && t.updatedAt && toDateKey(t.updatedAt) === today;
      }
      return true;
    });
  }, [allTasks, today, showCompleted]);

  // Non-overdue tasks for day grouping
  const nonOverdueTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (t.status !== "done" && t.dueDate !== null && toDateKey(t.dueDate) < today) {
        return false;
      }
      return true;
    });
  }, [allTasks, today]);

  // Planned activities (for day navigation + today view)
  const plannedActivities = useMemo(() => {
    return allActivities.filter((a) => a.status === "planned");
  }, [allActivities]);

  // Days with tasks or activities (for day navigator)
  const daysWithItems = useMemo(() => {
    const dateSet = new Set<string>();
    let hasNoDueDate = false;

    for (const task of nonOverdueTasks) {
      if (task.dueDate === null) {
        hasNoDueDate = true;
      } else {
        dateSet.add(toDateKey(task.dueDate));
      }
    }

    for (const activity of plannedActivities) {
      if (activity.startDate) {
        dateSet.add(toDateKey(activity.startDate));
      }
    }

    const sortedDates = Array.from(dateSet).sort();
    if (hasNoDueDate) {
      sortedDates.push("no-due-date");
    }
    return sortedDates;
  }, [nonOverdueTasks, plannedActivities]);

  // Auto-select nearest day on mount
  useEffect(() => {
    if (daysWithItems.length === 0) return;
    if (daysWithItems.includes(selectedDate)) return;

    const realDates = daysWithItems.filter((d) => d !== "no-due-date");
    const futureDay = realDates.find((d) => d >= today);
    if (futureDay) { setSelectedDate(futureDay); return; }

    const pastDay = realDates[realDates.length - 1];
    if (pastDay) { setSelectedDate(pastDay); return; }

    setSelectedDate("no-due-date");
  }, [daysWithItems, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selected day's tasks
  const selectedDayTasks = useMemo(() => {
    let tasks: TaskItem[];
    if (selectedDate === "no-due-date") {
      tasks = nonOverdueTasks.filter((t) => t.dueDate === null);
    } else {
      tasks = nonOverdueTasks.filter(
        (t) => t.dueDate !== null && toDateKey(t.dueDate) === selectedDate
      );
    }
    if (!showCompleted) {
      tasks = tasks.filter((t) => t.status !== "done");
    } else {
      // Only show tasks completed today (not old completed tasks)
      tasks = tasks.filter((t) =>
        t.status !== "done" || (t.updatedAt && toDateKey(t.updatedAt) === today)
      );
    }
    return tasks.sort(sortByPriority);
  }, [nonOverdueTasks, selectedDate, showCompleted, today]);

  // Selected day's activities
  const selectedDayActivities = useMemo(() => {
    if (selectedDate === "no-due-date") return [];
    return plannedActivities
      .filter((a) => a.startDate && toDateKey(a.startDate) === selectedDate)
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }, [plannedActivities, selectedDate]);

  // Paginated tasks
  const paginatedTasks = useMemo(() => {
    return selectedDayTasks.slice(0, pageSize);
  }, [selectedDayTasks, pageSize]);

  // Day navigation
  const currentIndex = daysWithItems.indexOf(selectedDate);
  const prevDay = currentIndex > 0 ? daysWithItems[currentIndex - 1] : null;
  const nextDay = currentIndex < daysWithItems.length - 1 ? daysWithItems[currentIndex + 1] : null;

  // Today's Focus item count
  const todayFocusCount = overdueTasks.length + selectedDayTasks.length + selectedDayActivities.length;

  // Meetings to log
  const meetingsToLog = useMemo(() => calendarData?.events || [], [calendarData]);

  // ============================================================================
  // ZONE 2: NEEDS ATTENTION
  // ============================================================================

  const districtsWithoutContacts = alertsData?.districtsWithoutContacts || [];
  const stalePlans = alertsData?.stalePlans || [];

  const activitiesNeedNextSteps = useMemo(() => {
    return allActivities.filter(
      (a) => a.status === "completed" && !a.outcomeType
    );
  }, [allActivities]);

  const totalAlerts = districtsWithoutContacts.length + stalePlans.length + activitiesNeedNextSteps.length;

  // ============================================================================
  // ZONE 3: COMING UP (Next 7 Days)
  // ============================================================================

  const comingUpTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (t.status === "done" || !t.dueDate) return false;
      const key = toDateKey(t.dueDate);
      return key > today && key <= weekEnd;
    }).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [allTasks, today, weekEnd]);

  const comingUpActivities = useMemo(() => {
    return plannedActivities.filter((a) => {
      if (!a.startDate) return false;
      const key = toDateKey(a.startDate);
      return key > today && key <= weekEnd;
    }).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }, [plannedActivities, today, weekEnd]);

  // Group coming up items by date
  const comingUpByDate = useMemo(() => {
    const dateMap = new Map<string, { tasks: TaskItem[]; activities: ActivityListItem[] }>();

    for (const task of comingUpTasks) {
      const key = toDateKey(task.dueDate!);
      if (!dateMap.has(key)) dateMap.set(key, { tasks: [], activities: [] });
      dateMap.get(key)!.tasks.push(task);
    }

    for (const activity of comingUpActivities) {
      const key = toDateKey(activity.startDate!);
      if (!dateMap.has(key)) dateMap.set(key, { tasks: [], activities: [] });
      dateMap.get(key)!.activities.push(activity);
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, ...items }));
  }, [comingUpTasks, comingUpActivities]);

  const comingUpCount = comingUpTasks.length + comingUpActivities.length;

  // Overflow — items beyond 7 days
  const overflowCount = useMemo(() => {
    const futureTasks = allTasks.filter((t) => {
      if (t.status === "done" || !t.dueDate) return false;
      return toDateKey(t.dueDate) > weekEnd;
    }).length;
    const futureActivities = plannedActivities.filter((a) => {
      if (!a.startDate) return false;
      return toDateKey(a.startDate) > weekEnd;
    }).length;
    return futureTasks + futureActivities;
  }, [allTasks, plannedActivities, weekEnd]);

  // ============================================================================
  // Badge & empty state
  // ============================================================================

  const totalBadge = todayFocusCount + totalAlerts + comingUpCount;

  useMemo(() => {
    onBadgeCountChange?.(totalBadge);
  }, [totalBadge, onBadgeCountChange]);

  const isTrulyEmpty =
    todayFocusCount === 0 &&
    totalAlerts === 0 &&
    comingUpCount === 0 &&
    meetingsToLog.length === 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Day Navigator */}
      <DayNavigator
        selectedDate={selectedDate}
        onPrev={() => prevDay && setSelectedDate(prevDay)}
        onNext={() => nextDay && setSelectedDate(nextDay)}
        hasPrev={prevDay !== null}
        hasNext={nextDay !== null}
      />

      {/* Summary Cards */}
      <FeedSummaryCards
        dueToday={todayFocusCount}
        alerts={totalAlerts}
        thisWeek={comingUpCount}
      />

      {/* Controls */}
      <FeedControls
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted((prev) => !prev)}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      {/* ================================================================== */}
      {/* ZONE 1: TODAY'S FOCUS                                              */}
      {/* ================================================================== */}

      {/* Overdue Tasks — always pinned */}
      {overdueTasks.length > 0 && (
        <FeedSection
          title="Overdue Tasks"
          dotColor="#F37167"
          itemCount={overdueTasks.length}
        >
          {overdueTasks.map((task) => (
            <TaskRow
              key={task.id}
              title={task.title}
              territory={task.plans?.[0]?.planName}
              territoryColor={task.plans?.[0]?.planColor}
              priority={task.priority !== "low" ? task.priority : undefined}
              dueDate={task.dueDate ? formatShortDate(task.dueDate) : undefined}
              isCompleted={task.status === "done"}
              onClick={() => setSelectedTask(task)}
              onComplete={() =>
                updateTask.mutate({ taskId: task.id, status: "done" })
              }
            />
          ))}
        </FeedSection>
      )}

      {/* Today's Tasks */}
      {paginatedTasks.length > 0 && (
        <FeedSection
          title={
            selectedDate === "no-due-date"
              ? "No Due Date"
              : `Tasks · ${formatShortDate(selectedDate + "T00:00:00")}`
          }
          dotColor="#403770"
          itemCount={selectedDayTasks.length}
        >
          {paginatedTasks.map((task) => (
            <TaskRow
              key={task.id}
              title={task.title}
              territory={task.plans?.[0]?.planName}
              territoryColor={task.plans?.[0]?.planColor}
              priority={task.priority !== "low" ? task.priority : undefined}
              dueDate={task.dueDate ? formatShortDate(task.dueDate) : undefined}
              isCompleted={task.status === "done"}
              onClick={() => setSelectedTask(task)}
              onComplete={() =>
                updateTask.mutate({
                  taskId: task.id,
                  status: task.status === "done" ? "todo" : "done",
                })
              }
            />
          ))}
        </FeedSection>
      )}

      {/* Task count footer */}
      {selectedDayTasks.length > pageSize && (
        <p className="text-xs text-[#8A80A8] text-center">
          Showing {paginatedTasks.length} of {selectedDayTasks.length} tasks
        </p>
      )}

      {/* Today's Activities */}
      {selectedDayActivities.length > 0 && (
        <FeedSection
          title={`Activities · ${formatShortDate(selectedDate + "T00:00:00")}`}
          dotColor="#E8735A"
          itemCount={selectedDayActivities.length}
        >
          {selectedDayActivities.map((activity) => (
            <UpcomingActivityRow
              key={activity.id}
              title={activity.title}
              type={ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
              date={activity.startDate ? formatShortDate(activity.startDate) : undefined}
              districtCount={activity.districtCount}
            />
          ))}
        </FeedSection>
      )}

      {/* Meetings to Log */}
      {meetingsToLog.length > 0 && (
        <FeedSection
          title="Meetings to Log"
          dotColor="#8AA891"
          itemCount={meetingsToLog.length}
        >
          {meetingsToLog.map((event) => (
            <MeetingRow
              key={event.id}
              title={event.title}
              source="Google Calendar"
              time={formatTime(event.startTime)}
            />
          ))}
        </FeedSection>
      )}

      {/* ================================================================== */}
      {/* ZONE 2: NEEDS ATTENTION                                            */}
      {/* ================================================================== */}

      {totalAlerts > 0 && (
        <FeedSection
          title="Needs Attention"
          dotColor="#F37167"
          itemCount={totalAlerts}
        >
          {/* Districts without contacts */}
          {districtsWithoutContacts.map((d) => (
            <AlertRow
              key={`no-contacts-${d.leaid}-${d.planId}`}
              variant="no-contacts"
              title={d.districtName}
              subtitle={`${d.planName} · No contacts`}
              dotColor={d.planColor}
              actionLabel="Add Contacts"
              href={`/?panel=district&leaid=${d.leaid}`}
            />
          ))}

          {/* Stale plans */}
          {stalePlans.map((p) => (
            <AlertRow
              key={`stale-${p.planId}`}
              variant="stale-plan"
              title={p.planName}
              subtitle={`No tasks or activities in 30 days · ${p.districtCount} district${p.districtCount !== 1 ? "s" : ""}`}
              dotColor={p.planColor}
              actionLabel="View Plan"
              href={`/?panel=plan&planId=${p.planId}`}
            />
          ))}

          {/* Completed activities without outcomes */}
          {activitiesNeedNextSteps.map((activity) => (
            <AlertRow
              key={`outcome-${activity.id}`}
              variant="needs-outcome"
              title={activity.title}
              subtitle={`Completed ${activity.startDate ? formatShortDate(activity.startDate) : ""} · No next steps`}
              dotColor="#F37167"
              actionLabel="Add Next Steps"
              onAction={() => setOutcomeActivity(activity)}
            />
          ))}
        </FeedSection>
      )}

      {/* ================================================================== */}
      {/* ZONE 3: COMING UP (Next 7 Days)                                    */}
      {/* ================================================================== */}

      {comingUpByDate.length > 0 && (
        <FeedSection
          title="Coming Up"
          dotColor="#6EA3BE"
          itemCount={comingUpCount}
        >
          {comingUpByDate.map(({ date, tasks, activities }) => (
            <div key={date}>
              {/* Date header */}
              <div className="px-5 py-2 bg-[#F7F5FA]">
                <span className="text-xs font-semibold text-[#544A78] uppercase tracking-wide">
                  {formatDayHeader(date)}
                </span>
              </div>

              {/* Tasks for this date */}
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  territory={task.plans?.[0]?.planName}
                  territoryColor={task.plans?.[0]?.planColor}
                  priority={task.priority !== "low" ? task.priority : undefined}
                  dueDate={task.dueDate ? formatShortDate(task.dueDate) : undefined}
                  isCompleted={task.status === "done"}
                  onClick={() => setSelectedTask(task)}
                  onComplete={() =>
                    updateTask.mutate({
                      taskId: task.id,
                      status: task.status === "done" ? "todo" : "done",
                    })
                  }
                />
              ))}

              {/* Activities for this date */}
              {activities.map((activity) => (
                <UpcomingActivityRow
                  key={activity.id}
                  title={activity.title}
                  type={ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
                  date={activity.startDate ? formatShortDate(activity.startDate) : undefined}
                  districtCount={activity.districtCount}
                />
              ))}
            </div>
          ))}
        </FeedSection>
      )}

      {/* Overflow count */}
      {overflowCount > 0 && (
        <p className="text-xs text-[#8A80A8] text-center">
          + {overflowCount} more item{overflowCount !== 1 ? "s" : ""} beyond this week
        </p>
      )}

      {/* ================================================================== */}
      {/* Empty state                                                        */}
      {/* ================================================================== */}

      {isTrulyEmpty && (
        <div className="bg-white rounded-lg border border-[#D4CFE2] flex flex-col items-center justify-center gap-3 py-10">
          <Rocket className="w-10 h-10 text-[#C2BBD4]" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-[#6E6390]">
            You&apos;re all set — what&apos;s next?
          </p>
          <p className="text-xs text-[#A69DC0] text-center max-w-[280px]">
            Start planning your next move
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/?tab=plans"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
            >
              <Rocket className="w-4 h-4" />
              Create a Plan
            </Link>
            <Link
              href="/?tab=activities"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#403770] text-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
            >
              <Users className="w-4 h-4" />
              Add Contacts
            </Link>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
      {outcomeActivity && (
        <OutcomeModal
          activity={outcomeActivity}
          onClose={() => setOutcomeActivity(null)}
        />
      )}
    </div>
  );
}
