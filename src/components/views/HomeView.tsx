"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useProfile,
  useGoalDashboard,
  useTerritoryPlans,
  useTasks,
  useActivities,
  useUpdateTask,
  useCreateTerritoryPlan,
  TaskItem,
} from "@/lib/api";
import { useMapStore } from "@/lib/store";
import { getDefaultFiscalYear, formatCurrency } from "@/components/goals/ProgressCard";
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

function formatTaskDate(dueDate: string | null): string {
  if (!dueDate) return "";
  const date = new Date(dueDate + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ============================================================================
// SVG Donut Chart
// ============================================================================

function DonutChart({
  percent,
  color,
  size = 100,
  strokeWidth = 8,
}: {
  percent: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(animatedPercent, 100) / 100);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercent(percent), 200);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-[#403770]">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Task Checkbox
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
        w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center
        transition-all duration-200
        ${checked
          ? "bg-[#F37167] border-[#F37167]"
          : "border-gray-300 hover:border-[#F37167]"
        }
      `}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// HomeView
// ============================================================================

type TaskTab = "upcoming" | "overdue" | "completed";
const MAX_VISIBLE_TASKS = 7;
const MAX_VISIBLE_PLANS = 7;
const FISCAL_YEARS = [2026, 2027, 2028, 2029];

export default function HomeView() {
  const currentFiscalYear = getDefaultFiscalYear();
  const today = getToday();

  // Goals fiscal year selection
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(2027);

  // Data fetching
  const { data: profile } = useProfile();
  const { data: dashboard } = useGoalDashboard(selectedFiscalYear);
  const { data: plans } = useTerritoryPlans();
  const { data: allTasksData } = useTasks({});
  const { data: activitiesData } = useActivities({ startDateFrom: today, startDateTo: today });
  const updateTask = useUpdateTask();
  const createPlan = useCreateTerritoryPlan();

  // Navigation
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  // UI State
  const [taskTab, setTaskTab] = useState<TaskTab>("upcoming");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  const firstName = profile?.fullName?.split(" ")[0] || "there";

  // Task filtering for tabs
  const { upcomingTasks, overdueTasks, completedTasks } = useMemo(() => {
    const allTasks = allTasksData?.tasks || [];
    return {
      upcomingTasks: allTasks.filter((t) => t.status !== "done" && (!t.dueDate || t.dueDate >= today)),
      overdueTasks: allTasks.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate < today),
      completedTasks: allTasks.filter((t) => t.status === "done"),
    };
  }, [allTasksData, today]);

  const displayedTasks =
    taskTab === "upcoming"
      ? upcomingTasks
      : taskTab === "overdue"
        ? overdueTasks
        : completedTasks;

  const visibleTasks = displayedTasks.slice(0, MAX_VISIBLE_TASKS);
  const hasMoreTasks = displayedTasks.length > MAX_VISIBLE_TASKS;

  // Plans
  const displayPlans = plans?.slice(0, MAX_VISIBLE_PLANS) || [];
  const hasMorePlans = (plans?.length || 0) > MAX_VISIBLE_PLANS;

  // Header stats
  const todayActivityCount = activitiesData?.activities?.length || 0;
  const totalOverdueCount = overdueTasks.length;

  // Goal metrics for donut charts
  const goalMetrics = useMemo(() => {
    if (!dashboard?.goals) return null;
    return [
      { label: "Earnings", current: dashboard.actuals.earnings, target: dashboard.goals.earningsTarget, color: "#F37167", format: "currency" as const },
      { label: "Take", current: dashboard.actuals.take, target: dashboard.goals.takeTarget, color: "#6EA3BE", format: "currency" as const },
      { label: "Revenue", current: dashboard.actuals.revenue, target: dashboard.goals.revenueTarget, color: "#8AA891", format: "currency" as const },
      { label: "Pipeline", current: dashboard.actuals.pipeline, target: dashboard.goals.pipelineTarget, color: "#D4A84B", format: "currency" as const },
      { label: "New Districts", current: dashboard.actuals.newDistricts, target: dashboard.goals.newDistrictsTarget, color: "#403770", format: "number" as const },
    ];
  }, [dashboard]);

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

      {/* ================================================================ */}
      {/* Gradient Header Banner                                           */}
      {/* ================================================================ */}
      <div
        className="px-8 pt-8 pb-28"
        style={{
          background: "linear-gradient(135deg, #403770 0%, #4e3d7a 40%, #5c4785 70%, #6b5a90 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/50">
                {formatDateHeader()}
              </p>
              <h1 className="text-3xl font-bold text-white mt-1">
                {getGreeting()}, {firstName}
              </h1>
              {/* Brand dashed accent */}
              <div className="mt-3 border-t-[3px] border-dashed border-white/25 w-16" />
            </div>

            {/* Summary stats */}
            <div className="flex items-center gap-2 mt-2">
              {totalOverdueCount > 0 && (
                <div className="flex items-center gap-1.5 bg-[#F37167]/25 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <svg className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-white/90 font-medium">{totalOverdueCount} overdue</span>
                </div>
              )}
              {todayActivityCount > 0 && (
                <button
                  onClick={() => setActiveTab("activities")}
                  className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-white/90 font-medium">
                    {todayActivityCount} activit{todayActivityCount === 1 ? "y" : "ies"} today
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Main Content (overlapping the banner)                            */}
      {/* ================================================================ */}
      <div className="relative -mt-20 px-8 pb-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ============================================================ */}
          {/* Two-Column: Tasks + Plans                                    */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ---- My Tasks Card (3 cols) ---- */}
            <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="px-5 pt-5">
                <h2 className="text-base font-semibold text-[#403770] mb-3">My Tasks</h2>

                {/* Tab bar */}
                <div className="flex gap-1 border-b border-gray-100">
                  {(
                    [
                      { key: "upcoming" as const, label: "Upcoming" },
                      { key: "overdue" as const, label: `Overdue${overdueTasks.length > 0 ? ` (${overdueTasks.length})` : ""}` },
                      { key: "completed" as const, label: "Completed" },
                    ]
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setTaskTab(key)}
                      className={`px-3 py-2.5 text-sm font-medium transition-colors relative ${
                        taskTab === key
                          ? "text-[#403770]"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {label}
                      {taskTab === key && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#403770]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task list */}
              <div className="flex-1 divide-y divide-gray-50">
                {visibleTasks.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    {taskTab === "overdue" ? (
                      <>
                        <svg className="w-8 h-8 mx-auto text-[#8AA891] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-500">All caught up!</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">
                        {taskTab === "upcoming" ? "No upcoming tasks" : "No completed tasks yet"}
                      </p>
                    )}
                  </div>
                ) : (
                  visibleTasks.map((task) => {
                    const isCompleted = task.status === "done";
                    const isOverdue = !isCompleted && task.dueDate && task.dueDate < today;

                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors cursor-pointer group"
                        onClick={() => setSelectedTask(task)}
                      >
                        <TaskCheckbox
                          checked={isCompleted}
                          onToggle={() =>
                            updateTask.mutate({
                              taskId: task.id,
                              status: isCompleted ? "todo" : "done",
                            })
                          }
                        />
                        <span
                          className={`flex-1 text-sm truncate ${
                            isCompleted ? "line-through text-gray-400" : "text-[#403770]"
                          }`}
                        >
                          {task.title}
                        </span>

                        {/* Plan tags */}
                        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                          {task.plans?.slice(0, 2).map((p) => (
                            <span
                              key={p.planId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 max-w-[80px] truncate"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: p.planColor }}
                              />
                              {p.planName}
                            </span>
                          ))}
                        </div>

                        {/* Due date */}
                        {task.dueDate && (
                          <span
                            className={`text-xs flex-shrink-0 ${
                              isOverdue ? "text-red-500 font-medium" : "text-gray-400"
                            }`}
                          >
                            {formatTaskDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Show more */}
              {hasMoreTasks && (
                <div className="px-5 py-3 border-t border-gray-50">
                  <button
                    onClick={() => setActiveTab("tasks")}
                    className="text-sm text-gray-400 hover:text-[#403770] transition-colors"
                  >
                    Show more
                  </button>
                </div>
              )}
            </div>

            {/* ---- My Plans Card (2 cols) ---- */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#403770]">My Plans</h2>
                {hasMorePlans && (
                  <button
                    onClick={() => setActiveTab("plans")}
                    className="text-xs text-gray-400 hover:text-[#403770] transition-colors"
                  >
                    View all &rarr;
                  </button>
                )}
              </div>

              <div className="flex-1 px-5 pb-5">
                <div className="grid grid-cols-2 gap-3">
                  {/* Create new plan */}
                  <button
                    onClick={() => setShowPlanForm(true)}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#F37167] hover:text-[#F37167] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-[#FEF2F1] flex items-center justify-center flex-shrink-0 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium">Create plan</span>
                  </button>

                  {/* Existing plans */}
                  {displayPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        const params = new URLSearchParams();
                        params.set("tab", "plans");
                        params.set("plan", plan.id);
                        window.history.replaceState(null, "", `?${params.toString()}`);
                        setActiveTab("plans");
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:shadow-md transition-all text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                        style={{ backgroundColor: plan.color }}
                      >
                        {plan.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#403770] truncate">{plan.name}</p>
                        <p className="text-xs text-gray-400">
                          {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Goal Progress with Donut Charts                              */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 pt-5 pb-0 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#403770] mb-3">Goals</h2>
                {/* Fiscal year tabs */}
                <div className="flex gap-1 border-b border-gray-100">
                  {FISCAL_YEARS.map((year) => (
                    <button
                      key={year}
                      onClick={() => setSelectedFiscalYear(year)}
                      className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                        selectedFiscalYear === year
                          ? "text-[#403770]"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      FY{String(year).slice(-2)}
                      {selectedFiscalYear === year && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#403770]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
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

            {goalMetrics ? (
              <div className="px-6 py-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8">
                  {goalMetrics.map((metric) => {
                    const percent =
                      metric.target && metric.target > 0
                        ? Math.min((metric.current / metric.target) * 100, 100)
                        : 0;
                    const currentFormatted =
                      metric.format === "currency"
                        ? formatCurrency(metric.current, true)
                        : metric.current.toLocaleString();
                    const targetFormatted =
                      metric.format === "currency"
                        ? formatCurrency(metric.target, true)
                        : metric.target?.toLocaleString() || "-";

                    return (
                      <div key={metric.label} className="flex flex-col items-center text-center">
                        <DonutChart percent={percent} color={metric.color} />
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {metric.label}
                          </p>
                          <p className="text-lg font-bold text-[#403770] mt-0.5">
                            {currentFormatted}
                          </p>
                          <p className="text-xs text-gray-400">of {targetFormatted}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-6 py-14 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-[#C4E7E6] mb-3"
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
                <p className="text-[#403770] font-medium mb-1">
                  Track your FY{String(selectedFiscalYear).slice(-2)} progress
                </p>
                <p className="text-sm text-gray-400 mb-4">Set your goals to see charts here</p>
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
          </div>

        </div>
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
        fiscalYear={selectedFiscalYear}
        currentGoals={dashboard?.goals || null}
      />
    </div>
  );
}
