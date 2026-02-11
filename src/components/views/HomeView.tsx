"use client";

import { useState, useMemo } from "react";
import {
  useProfile,
  useGoalDashboard,
  useTerritoryPlans,
  useTasks,
  useActivities,
  useUpdateTask,
  useCreateTerritoryPlan,
  TaskItem,
  ActivityListItem,
} from "@/lib/api";
import { useMapStore } from "@/lib/store";
import ProgressCard, { getDefaultFiscalYear } from "@/components/goals/ProgressCard";
import GoalEditorModal from "@/components/goals/GoalEditorModal";
import TaskDetailModal from "@/components/tasks/TaskDetailModal";
import PlanFormModal, { PlanFormData } from "@/components/plans/PlanFormModal";

// ============================================================================
// Helpers
// ============================================================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateHeader(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatTimeRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "Unscheduled";
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  // Check if all-day (midnight to midnight or no time component)
  const startHours = start.getHours();
  const startMinutes = start.getMinutes();
  if (startHours === 0 && startMinutes === 0 && end) {
    const endHours = end.getHours();
    const endMinutes = end.getMinutes();
    if (endHours === 0 && endMinutes === 0) return "All day";
  }

  const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const startStr = start.toLocaleTimeString("en-US", timeOptions);
  if (!end) return startStr;
  const endStr = end.toLocaleTimeString("en-US", timeOptions);
  return `${startStr} - ${endStr}`;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  urgent: { bg: "bg-red-100", text: "text-red-700" },
  high: { bg: "bg-orange-100", text: "text-orange-700" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700" },
  low: { bg: "bg-gray-100", text: "text-gray-600" },
};

type ScheduleItem =
  | { type: "task"; data: TaskItem; sortKey: number }
  | { type: "activity"; data: ActivityListItem; sortKey: number };

// ============================================================================
// Sub-components
// ============================================================================

function TaskCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`
        w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center
        transition-all duration-200
        ${checked
          ? "bg-[#F37167] border-[#F37167]"
          : "border-gray-300 hover:border-[#F37167]"
        }
      `}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

function CalendarIcon() {
  return (
    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[#6EA3BE]">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

// ============================================================================
// HomeView
// ============================================================================

export default function HomeView() {
  const currentFiscalYear = getDefaultFiscalYear();
  const today = getToday();
  const tomorrow = getTomorrow();

  // Data fetching
  const { data: profile } = useProfile();
  const { data: dashboard } = useGoalDashboard(currentFiscalYear);
  const { data: plans } = useTerritoryPlans();
  const { data: tasksData } = useTasks({ dueBefore: tomorrow });
  const { data: activitiesData } = useActivities({ startDateFrom: today, startDateTo: today });
  const updateTask = useUpdateTask();
  const createPlan = useCreateTerritoryPlan();

  // Navigation
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  // Modals
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  const firstName = profile?.fullName?.split(" ")[0] || "there";

  // Build merged schedule list
  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = [];

    // Add tasks (exclude done)
    const tasks = tasksData?.tasks?.filter((t) => t.status !== "done") || [];
    for (const task of tasks) {
      const isOverdue = task.dueDate && task.dueDate < today;
      const priorityVal = PRIORITY_ORDER[task.priority] ?? 3;
      // Overdue tasks get negative sortKey to appear first, then by priority
      items.push({
        type: "task",
        data: task,
        sortKey: isOverdue ? -100 + priorityVal : priorityVal,
      });
    }

    // Add today's activities
    const activities = activitiesData?.activities || [];
    for (const activity of activities) {
      const time = activity.startDate ? new Date(activity.startDate).getTime() : Infinity;
      items.push({
        type: "activity",
        data: activity,
        sortKey: 50 + (time / 1e12), // Activities come after tasks, sorted by time
      });
    }

    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [tasksData, activitiesData, today]);

  // Limit plans to 5 for dashboard
  const displayPlans = plans?.slice(0, 5) || [];
  const hasMorePlans = (plans?.length || 0) > 5;

  // Handle plan creation
  const handleCreatePlan = async (data: PlanFormData) => {
    await createPlan.mutateAsync({
      name: data.name,
      description: data.description || undefined,
      owner: data.owner || undefined,
      color: data.color,
      status: data.status,
      fiscalYear: data.fiscalYear,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });
    setShowPlanForm(false);
  };

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ================================================================ */}
        {/* Greeting Header                                                  */}
        {/* ================================================================ */}
        <header>
          <div className="rounded-2xl bg-gradient-to-r from-[#C4E7E6]/30 to-[#EDFFE3]/20 px-8 py-6">
            <p className="text-sm font-medium text-[#403770]/60">{formatDateHeader()}</p>
            <h1 className="text-2xl font-bold text-[#403770] mt-1">
              {getGreeting()}, {firstName}
            </h1>
            {/* Brand dashed accent line */}
            <div className="mt-4 border-t-[3px] border-dashed border-[#F37167] w-24" />
          </div>
        </header>

        {/* ================================================================ */}
        {/* Today's Schedule                                                 */}
        {/* ================================================================ */}
        <section>
          <h2 className="text-lg font-bold text-[#F37167] mb-4">TODAY&apos;S SCHEDULE</h2>

          {scheduleItems.length === 0 ? (
            <div className="bg-[#C4E7E6]/20 rounded-xl p-8 text-center">
              <svg
                className="w-10 h-10 mx-auto text-[#6EA3BE] mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-[#403770] font-medium">Nothing scheduled for today</p>
              <p className="text-sm text-[#403770]/50 mt-1">Your schedule is clear -- enjoy the day!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {scheduleItems.map((item) => {
                if (item.type === "task") {
                  const task = item.data;
                  const isOverdue = task.dueDate && task.dueDate < today;
                  const priorityStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;

                  return (
                    <div
                      key={`task-${task.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[#C4E7E6]/10 transition-colors cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      <TaskCheckbox
                        checked={false}
                        onToggle={() => updateTask.mutate({ taskId: task.id, status: "done" })}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#403770] truncate">{task.title}</p>
                        {task.plans?.length > 0 && (
                          <p className="text-xs text-[#403770]/50 truncate">
                            {task.plans.map((p) => p.planName).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isOverdue
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {isOverdue ? "Overdue" : "Due today"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyle.bg} ${priorityStyle.text}`}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Activity row
                const activity = item.data;
                return (
                  <div
                    key={`activity-${activity.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#C4E7E6]/10 transition-colors cursor-pointer"
                    onClick={() => setActiveTab("activities")}
                  >
                    <CalendarIcon />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#403770] truncate">{activity.title}</p>
                      {activity.stateAbbrevs?.length > 0 && (
                        <p className="text-xs text-[#403770]/50 truncate">
                          {activity.stateAbbrevs.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[#403770]/60 font-medium">
                        {formatTimeRange(activity.startDate, activity.endDate)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#C4E7E6]/40 text-[#403770]">
                        {activity.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ================================================================ */}
        {/* My Plans                                                         */}
        {/* ================================================================ */}
        <section>
          <h2 className="text-lg font-bold text-[#F37167] mb-4">MY PLANS</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Create New Plan card */}
            <button
              onClick={() => setShowPlanForm(true)}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-300 text-[#403770]/60 hover:border-[#F37167] hover:text-[#F37167] transition-colors min-h-[100px]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">Create New Plan</span>
            </button>

            {/* Existing plan cards */}
            {displayPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => {
                  // Navigate to plans tab with this plan selected
                  const params = new URLSearchParams();
                  params.set("tab", "plans");
                  params.set("plan", plan.id);
                  window.history.replaceState(null, "", `?${params.toString()}`);
                  setActiveTab("plans");
                }}
                className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow min-h-[100px]"
                style={{ borderLeftWidth: "4px", borderLeftColor: plan.color }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: plan.color }}
                  />
                  <h3 className="text-sm font-semibold text-[#403770] truncate">{plan.name}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#403770]/50">
                  <span>FY{String(plan.fiscalYear).slice(-2)}</span>
                  <span className="text-gray-300">|</span>
                  <span>{plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    plan.status === "active"
                      ? "bg-green-100 text-green-700"
                      : plan.status === "draft"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {hasMorePlans && (
            <div className="mt-3 text-right">
              <button
                onClick={() => setActiveTab("plans")}
                className="text-sm font-medium text-[#403770] hover:text-[#F37167] transition-colors"
              >
                View all plans &rarr;
              </button>
            </div>
          )}
        </section>

        {/* ================================================================ */}
        {/* Goal Progress                                                    */}
        {/* ================================================================ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#F37167]">
              FY{String(currentFiscalYear).slice(-2)} GOALS
            </h2>
            <button
              onClick={() => setShowGoalEditor(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e0605a] rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {dashboard?.goals ? "Edit Goals" : "Set Goals"}
            </button>
          </div>

          {dashboard?.goals ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <ProgressCard
                label="Earnings"
                current={dashboard.actuals.earnings}
                target={dashboard.goals.earningsTarget}
                color="#F37167"
              />
              <ProgressCard
                label="Take"
                current={dashboard.actuals.take}
                target={dashboard.goals.takeTarget}
                color="#6EA3BE"
              />
              <ProgressCard
                label="Revenue"
                current={dashboard.actuals.revenue}
                target={dashboard.goals.revenueTarget}
                color="#8AA891"
              />
              <ProgressCard
                label="Pipeline"
                current={dashboard.actuals.pipeline}
                target={dashboard.goals.pipelineTarget}
                color="#D4A84B"
              />
              <ProgressCard
                label="New Districts"
                current={dashboard.actuals.newDistricts}
                target={dashboard.goals.newDistrictsTarget}
                format="number"
                color="#403770"
              />
            </div>
          ) : (
            <div className="bg-[#C4E7E6]/20 rounded-xl p-8 text-center">
              <svg
                className="w-12 h-12 mx-auto text-[#6EA3BE] mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-[#403770] font-medium mb-2">
                Set your FY{String(currentFiscalYear).slice(-2)} goals to track progress
              </p>
              <p className="text-sm text-[#403770]/50 mb-4">
                Enter your target earnings and we&apos;ll calculate the rest
              </p>
              <button
                onClick={() => setShowGoalEditor(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e0605a] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Set Your Goals
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ================================================================ */}
      {/* Modals                                                           */}
      {/* ================================================================ */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <PlanFormModal
        isOpen={showPlanForm}
        onClose={() => setShowPlanForm(false)}
        onSubmit={handleCreatePlan}
        title="Create New Plan"
      />

      <GoalEditorModal
        isOpen={showGoalEditor}
        onClose={() => setShowGoalEditor(false)}
        fiscalYear={currentFiscalYear}
        currentGoals={dashboard?.goals || null}
      />
    </div>
  );
}
