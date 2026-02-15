"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useProfile,
  useGoalDashboard,
  useTerritoryPlans,
  useTasks,
} from "@/lib/api";
import { useMapV2Store } from "@/lib/map-v2-store";
import { formatCurrency } from "@/components/goals/ProgressCard";

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
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTaskDate(dueDate: string | null): string {
  if (!dueDate) return "";
  const datePart = dueDate.split("T")[0];
  const date = new Date(datePart + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Mini Donut (compact for panel)
// ============================================================================

function MiniDonut({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const size = 44;
  const strokeWidth = 4;
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
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
        <span className="text-[10px] font-bold text-plum">{Math.round(percent)}%</span>
      </div>
    </div>
  );
}

// ============================================================================
// HomePanel
// ============================================================================

const FISCAL_YEARS = [2026, 2027, 2028, 2029];

export default function HomePanel() {
  const today = getToday();
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getDefaultFiscalYear());

  const { data: profile } = useProfile();
  const { data: dashboard } = useGoalDashboard(selectedFiscalYear);
  const { data: plans } = useTerritoryPlans();
  const { data: allTasksData } = useTasks({});

  const viewPlan = useMapV2Store((s) => s.viewPlan);
  const startNewPlan = useMapV2Store((s) => s.startNewPlan);

  const firstName = profile?.fullName?.split(" ")[0] || "there";

  // Task counts
  const { upcomingTasks, overdueTasks } = useMemo(() => {
    const allTasks = allTasksData?.tasks || [];
    return {
      upcomingTasks: allTasks.filter((t) => t.status !== "done" && (!t.dueDate || t.dueDate >= today)),
      overdueTasks: allTasks.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate < today),
    };
  }, [allTasksData, today]);

  // Goal metrics
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

  const displayPlans = plans?.slice(0, 5) || [];

  return (
    <div className="p-4 space-y-4">
      {/* Greeting header */}
      <div className="rounded-xl bg-gradient-to-br from-plum to-plum/80 px-4 py-3 text-white">
        <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{formatDateHeader()}</p>
        <p className="text-sm font-semibold mt-0.5">{getGreeting()}, {firstName}</p>
        {overdueTasks.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse" />
            <span className="text-[11px] text-white/80">{overdueTasks.length} overdue task{overdueTasks.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Goals section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-plum uppercase tracking-wide">Goals</h3>
          <div className="flex gap-0.5">
            {FISCAL_YEARS.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedFiscalYear(year)}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  selectedFiscalYear === year
                    ? "bg-plum text-white"
                    : "text-gray-400 hover:text-plum"
                }`}
              >
                FY{String(year).slice(-2)}
              </button>
            ))}
          </div>
        </div>

        {goalMetrics ? (
          <div className="space-y-1.5">
            {goalMetrics.map((metric) => {
              const percent = metric.target && metric.target > 0 ? Math.min((metric.current / metric.target) * 100, 100) : 0;
              const currentFmt = metric.format === "currency" ? formatCurrency(metric.current, true) : metric.current.toLocaleString();
              const targetFmt = metric.format === "currency" ? formatCurrency(metric.target, true) : metric.target?.toLocaleString() || "-";
              return (
                <div key={metric.label} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50/80 hover:bg-gray-50 transition-colors">
                  <MiniDonut percent={percent} color={metric.color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{metric.label}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-plum">{currentFmt}</span>
                      <span className="text-[10px] text-gray-400">/ {targetFmt}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-gray-50 py-6 text-center">
            <p className="text-xs text-gray-400">No goals set for FY{String(selectedFiscalYear).slice(-2)}</p>
          </div>
        )}
      </div>

      {/* Plans section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-plum uppercase tracking-wide">Plans</h3>
          <span className="text-[10px] text-gray-400">{plans?.length || 0} total</span>
        </div>
        <div className="space-y-1">
          {displayPlans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => viewPlan(plan.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left group"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]"
                style={{ backgroundColor: plan.color }}
              >
                {plan.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-plum truncate group-hover:text-plum/80">{plan.name}</p>
                <p className="text-[10px] text-gray-400">{plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}</p>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0">
                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
          <button
            onClick={startNewPlan}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 hover:border-coral hover:bg-coral/5 transition-all text-left group"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-50 group-hover:bg-coral/10 flex items-center justify-center flex-shrink-0 transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-400 group-hover:text-coral transition-colors">
                <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-400 group-hover:text-coral transition-colors">Create plan</span>
          </button>
        </div>
      </div>

      {/* Tasks summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-plum uppercase tracking-wide">Tasks</h3>
        </div>
        <div className="space-y-1">
          {upcomingTasks.slice(0, 5).map((task) => {
            const isOverdue = task.dueDate && task.dueDate < today;
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOverdue ? "bg-coral" : "bg-steel-blue"}`} />
                <span className="text-xs text-plum truncate flex-1">{task.title}</span>
                {task.dueDate && (
                  <span className={`text-[10px] flex-shrink-0 ${isOverdue ? "text-coral font-medium" : "text-gray-400"}`}>
                    {formatTaskDate(task.dueDate)}
                  </span>
                )}
              </div>
            );
          })}
          {upcomingTasks.length === 0 && overdueTasks.length === 0 && (
            <div className="rounded-xl bg-gray-50 py-4 text-center">
              <p className="text-xs text-gray-400">No upcoming tasks</p>
            </div>
          )}
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-coral" />
              <span className="text-[11px] text-coral font-medium">
                +{overdueTasks.length} overdue
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
