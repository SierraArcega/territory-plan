"use client";

import { useMemo } from "react";
import {
  useTasks,
  useActivities,
  useUpdateTask,
  useCalendarInbox,
  type TaskItem,
  type ActivityListItem,
  type CalendarEvent,
} from "@/lib/api";
import FeedSummaryCards from "./FeedSummaryCards";
import FeedSection from "./FeedSection";
import { TaskRow, OpportunityRow, ActivityRow, MeetingRow } from "./FeedRows";
import { CheckCircle2 } from "lucide-react";

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

// ============================================================================
// FeedTab
// ============================================================================

interface FeedTabProps {
  onBadgeCountChange?: (count: number) => void;
}

export default function FeedTab({ onBadgeCountChange }: FeedTabProps) {
  const today = getToday();

  // Data fetching
  const { data: allTasksData } = useTasks({});
  const { data: activitiesData } = useActivities({});
  const { data: calendarData } = useCalendarInbox("pending");
  const updateTask = useUpdateTask();

  // ---- Overdue tasks ----
  const overdueTasks = useMemo(() => {
    const tasks = allTasksData?.tasks || [];
    return tasks.filter(
      (t) => t.status !== "done" && t.dueDate !== null && t.dueDate < today
    );
  }, [allTasksData, today]);

  // ---- Activities needing next steps ----
  const activitiesNeedNextSteps = useMemo(() => {
    const activities = activitiesData?.activities || [];
    return activities.filter(
      (a) => a.status === "completed" && !a.outcomeType
    );
  }, [activitiesData]);

  // ---- Meetings to log ----
  const meetingsToLog = useMemo(() => {
    return calendarData?.events || [];
  }, [calendarData]);

  // ---- Summary counts ----
  const counts = {
    overdueTasks: overdueTasks.length,
    unmappedOpps: 0, // Derived data — placeholder for now
    unmappedExpenses: 0, // No data model
    needNextSteps: activitiesNeedNextSteps.length,
    meetingsToLog: meetingsToLog.length,
  };

  const totalBadge = counts.overdueTasks + counts.unmappedOpps + counts.needNextSteps + counts.meetingsToLog;

  // Report badge count to parent
  useMemo(() => {
    onBadgeCountChange?.(totalBadge);
  }, [totalBadge, onBadgeCountChange]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <FeedSummaryCards {...counts} />

      {/* Overdue Tasks */}
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
              onComplete={() =>
                updateTask.mutate({ taskId: task.id, status: "done" })
              }
            />
          ))}
        </FeedSection>
      )}

      {/* Unmapped Opportunities — placeholder for now */}
      {/* Will be populated once we derive unmapped opps from plan/district data */}

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

      {/* Empty state — all caught up */}
      {overdueTasks.length === 0 &&
        activitiesNeedNextSteps.length === 0 &&
        meetingsToLog.length === 0 && (
          <div className="bg-white rounded-lg border border-[#D4CFE2] py-16 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-[#8AA891] mb-3" />
            <p className="text-sm font-medium text-[#403770]">All caught up!</p>
            <p className="text-xs text-[#8A80A8] mt-1">
              No action items at the moment
            </p>
          </div>
        )}
    </div>
  );
}
