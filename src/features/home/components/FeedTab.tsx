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
import FeedSummaryCards from "./FeedSummaryCards";
import FeedSection from "./FeedSection";
import DayNavigator from "./DayNavigator";
import FeedControls from "./FeedControls";
import { TaskRow, ActivityRow, MeetingRow, UpcomingActivityRow } from "./FeedRows";
import OutcomeModal from "@/features/activities/components/OutcomeModal";
import TaskDetailModal from "@/features/tasks/components/TaskDetailModal";
import { ACTIVITY_TYPE_LABELS } from "@/features/activities/types";
import { Rocket, Users, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useSavedReports } from "@/features/reports/lib/queries";

// ============================================================================
// Helpers
// ============================================================================

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(isoDate: string): string {
  const datePart = isoDate.split("T")[0];
  const date = new Date(datePart + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Extract YYYY-MM-DD from a dueDate string (may include time component). */
function toDateKey(dueDate: string): string {
  return dueDate.split("T")[0];
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
// FeedTab
// ============================================================================

interface FeedTabProps {
  onBadgeCountChange?: (count: number) => void;
}

export default function FeedTab({ onBadgeCountChange }: FeedTabProps) {
  const today = getToday();
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const { data: savedReports } = useSavedReports();

  // Data fetching
  const { data: allTasksData } = useTasks({});
  const { data: activitiesData } = useActivities({});
  const { data: calendarData } = useCalendarInbox("pending");
  const updateTask = useUpdateTask();
  const [outcomeActivity, setOutcomeActivity] = useState<ActivityListItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // New state for day navigation, pagination, and completed toggle
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [pageSize, setPageSize] = useState<number>(5);
  const [showCompleted, setShowCompleted] = useState<boolean>(true);

  // ---- All tasks ----
  const allTasks = useMemo(() => allTasksData?.tasks || [], [allTasksData]);

  // ---- Overdue tasks (always pinned, regardless of selected day) ----
  const overdueTasks = useMemo(() => {
    return allTasks.filter(
      (t) => t.status !== "done" && t.dueDate !== null && toDateKey(t.dueDate) < today
    );
  }, [allTasks, today]);

  // ---- Incomplete tasks (for empty state check) ----
  const incompleteTasks = useMemo(() => {
    return allTasks.filter((t) => t.status !== "done");
  }, [allTasks]);

  // ---- Activities needing next steps ----
  const activitiesNeedNextSteps = useMemo(() => {
    const activities = activitiesData?.activities || [];
    return activities.filter(
      (a) => a.status === "completed" && !a.outcomeType
    );
  }, [activitiesData]);

  // ---- Upcoming activities (planned, sorted by date) ----
  const upcomingActivities = useMemo(() => {
    const activities = activitiesData?.activities || [];
    return activities
      .filter((a) => a.status === "planned")
      .sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return a.startDate.localeCompare(b.startDate);
      });
  }, [activitiesData]);

  // ---- Meetings to log ----
  const meetingsToLog = useMemo(() => {
    return calendarData?.events || [];
  }, [calendarData]);

  // ---- Non-overdue tasks (for day grouping) ----
  const nonOverdueTasks = useMemo(() => {
    return allTasks.filter((t) => {
      // Exclude overdue incomplete tasks (they appear in the pinned section)
      if (t.status !== "done" && t.dueDate !== null && toDateKey(t.dueDate) < today) {
        return false;
      }
      return true;
    });
  }, [allTasks, today]);

  // ---- Days with tasks or activities (sorted dates + optional "no-due-date") ----
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

    // Include planned activity dates
    for (const activity of upcomingActivities) {
      if (activity.startDate) {
        dateSet.add(toDateKey(activity.startDate));
      }
    }

    const sortedDates = Array.from(dateSet).sort();
    if (hasNoDueDate) {
      sortedDates.push("no-due-date");
    }

    return sortedDates;
  }, [nonOverdueTasks, upcomingActivities]);

  // ---- Auto-select nearest day with tasks on mount / when data changes ----
  useEffect(() => {
    if (daysWithItems.length === 0) return;

    // If the current selectedDate is already in the list, keep it
    if (daysWithItems.includes(selectedDate)) return;

    // Find the nearest day with tasks relative to today
    const realDates = daysWithItems.filter((d) => d !== "no-due-date");

    // Try to find the nearest future day
    const futureDay = realDates.find((d) => d >= today);
    if (futureDay) {
      setSelectedDate(futureDay);
      return;
    }

    // Fall back to the most recent past day
    const pastDay = realDates[realDates.length - 1];
    if (pastDay) {
      setSelectedDate(pastDay);
      return;
    }

    // Only "no-due-date" tasks exist
    setSelectedDate("no-due-date");
  }, [daysWithItems, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Selected day's tasks ----
  const selectedDayTasks = useMemo(() => {
    let tasks: TaskItem[];

    if (selectedDate === "no-due-date") {
      tasks = nonOverdueTasks.filter((t) => t.dueDate === null);
    } else {
      tasks = nonOverdueTasks.filter(
        (t) => t.dueDate !== null && toDateKey(t.dueDate) === selectedDate
      );
    }

    // Filter by completed toggle
    if (!showCompleted) {
      tasks = tasks.filter((t) => t.status !== "done");
    }

    // Sort by priority
    return tasks.sort(sortByPriority);
  }, [nonOverdueTasks, selectedDate, showCompleted]);

  // ---- Paginated tasks ----
  const paginatedTasks = useMemo(() => {
    return selectedDayTasks.slice(0, pageSize);
  }, [selectedDayTasks, pageSize]);

  // ---- Prev / Next day navigation ----
  const currentIndex = daysWithItems.indexOf(selectedDate);
  const prevDay = currentIndex > 0 ? daysWithItems[currentIndex - 1] : null;
  const nextDay = currentIndex < daysWithItems.length - 1 ? daysWithItems[currentIndex + 1] : null;

  // ---- Summary counts ----
  const counts = {
    dueToday: overdueTasks.length,
    alerts: activitiesNeedNextSteps.length + meetingsToLog.length,
    thisWeek: 0,
  };

  const totalBadge = counts.dueToday + counts.alerts;

  // Report badge count to parent
  useMemo(() => {
    onBadgeCountChange?.(totalBadge);
  }, [totalBadge, onBadgeCountChange]);

  // ---- True empty state check ----
  const isTrulyEmpty =
    incompleteTasks.length === 0 &&
    activitiesNeedNextSteps.length === 0 &&
    upcomingActivities.length === 0 &&
    meetingsToLog.length === 0;

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
      <FeedSummaryCards {...counts} />

      {/* Reports Quick Access */}
      <button
        onClick={() => setActiveTab("reports")}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] transition-colors duration-100 text-left"
      >
        <BarChart3 className="w-5 h-5 text-[#6EA3BE] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#403770]">Reports</p>
          <p className="text-xs text-[#8A80A8]">
            {savedReports && savedReports.length > 0
              ? `${savedReports.length} saved report${savedReports.length === 1 ? "" : "s"}`
              : "Build custom reports from your data"}
          </p>
        </div>
        <svg className="w-4 h-4 text-[#A69DC0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Controls: completed toggle + page size */}
      <FeedControls
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted((prev) => !prev)}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

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

      {/* Day's Tasks */}
      {paginatedTasks.length > 0 && (
        <FeedSection
          title={
            selectedDate === "no-due-date"
              ? "No Due Date"
              : `Tasks for ${formatShortDate(selectedDate + "T00:00:00")}`
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
      {selectedDayTasks.length > 0 && (
        <p className="text-xs text-[#8A80A8] text-center">
          Showing {paginatedTasks.length} of {selectedDayTasks.length} tasks
        </p>
      )}

      {/* Activities Need Next Steps */}
      {activitiesNeedNextSteps.length > 0 && (
        <FeedSection
          title="Activities Need Next Steps"
          dotColor="#6EA3BE"
          itemCount={activitiesNeedNextSteps.length}
        >
          {activitiesNeedNextSteps.map((activity) => (
            <ActivityRow
              key={activity.id}
              title={activity.title}
              completedDate={
                activity.startDate
                  ? formatShortDate(activity.startDate)
                  : undefined
              }
              details={
                activity.districtCount > 0
                  ? `${activity.districtCount} district${activity.districtCount > 1 ? "s" : ""}`
                  : undefined
              }
              onAddNextSteps={() => setOutcomeActivity(activity)}
            />
          ))}
        </FeedSection>
      )}

      {/* Upcoming Activities */}
      {upcomingActivities.length > 0 && (
        <FeedSection
          title="Upcoming Activities"
          dotColor="#E8735A"
          itemCount={upcomingActivities.length}
        >
          {upcomingActivities.map((activity) => (
            <UpcomingActivityRow
              key={activity.id}
              title={activity.title}
              type={ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
              date={
                activity.startDate
                  ? formatShortDate(activity.startDate)
                  : undefined
              }
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

      {/* True empty state — CTA */}
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

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Outcome Modal */}
      {outcomeActivity && (
        <OutcomeModal
          activity={outcomeActivity}
          onClose={() => setOutcomeActivity(null)}
        />
      )}
    </div>
  );
}
