"use client";

import { useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useTerritoryPlan, useTasks } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  available,
  note,
}: {
  label: string;
  value: string;
  available: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-2.5">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div
        className={`text-sm font-semibold ${
          available ? "text-gray-700" : "text-gray-300"
        }`}
      >
        {value}
      </div>
      {!available && note && (
        <div className="text-[9px] text-gray-300 mt-0.5">{note}</div>
      )}
    </div>
  );
}

function StatusRow({
  label,
  value,
  progress,
  alert,
}: {
  label: string;
  value: string;
  progress?: number; // 0-100
  alert?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="text-xs text-gray-500 flex-1">{label}</div>
      {progress != null && (
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-plum rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
      <div
        className={`text-xs font-medium ${
          alert ? "text-red-500" : "text-gray-700"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {/* 2x2 metric cards skeleton */}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-2.5 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Status bars skeleton */}
      <div className="space-y-1 px-1">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2 py-1 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-24" />
            <div className="flex-1" />
            <div className="h-3 bg-gray-200 rounded w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function PlanPerfSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const { data: plan, isLoading: planLoading } =
    useTerritoryPlan(activePlanId);
  const { data: tasksData, isLoading: tasksLoading } = useTasks({
    planId: activePlanId ?? undefined,
  });

  const isLoading = planLoading || tasksLoading;

  /* -- Derived metrics -------------------------------------------- */

  const totalTargeted = useMemo(() => {
    if (!plan) return 0;
    return plan.districts.reduce(
      (sum, d) => sum + (d.renewalTarget ?? 0) + (d.winbackTarget ?? 0) + (d.expansionTarget ?? 0) + (d.newBusinessTarget ?? 0),
      0
    );
  }, [plan]);

  const districtCount = plan?.districts.length ?? 0;

  const tasks = tasksData?.tasks ?? [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const overdueTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.dueDate != null &&
        new Date(t.dueDate) < now
    ).length;
  }, [tasks]);

  const taskProgress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  /* -- Render ----------------------------------------------------- */

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!plan) {
    return (
      <div className="p-3 text-center py-8 text-xs text-gray-400">
        Plan not found
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Metric cards — 2x2 grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Total Targeted"
          value={totalTargeted > 0 ? formatCurrency(totalTargeted) : "\u2014"}
          available={totalTargeted > 0}
        />
        <MetricCard
          label="Open Pipeline"
          value="\u2014"
          available={false}
          note="Data not yet available"
        />
        <MetricCard
          label="Closed Won"
          value="\u2014"
          available={false}
          note="Data not yet available"
        />
        <MetricCard
          label="Revenue"
          value="\u2014"
          available={false}
          note="Data not yet available"
        />
      </div>

      {/* Status bars */}
      <div className="space-y-0.5">
        <StatusRow
          label="Districts in plan"
          value={String(districtCount)}
        />
        {totalTasks > 0 && (
          <StatusRow
            label="Tasks completed"
            value={`${completedTasks} of ${totalTasks}`}
            progress={taskProgress}
          />
        )}
        {overdueTasks > 0 && (
          <StatusRow
            label="Overdue tasks"
            value={String(overdueTasks)}
            alert
          />
        )}
      </div>

      {/* Footer note */}
      <div className="text-[10px] text-gray-300 px-1">
        Pipeline and revenue metrics will update as data becomes available
      </div>
    </div>
  );
}
