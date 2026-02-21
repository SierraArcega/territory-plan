"use client";

import { useState, useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useTerritoryPlans, type TerritoryPlan } from "@/lib/api";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  working: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  planning: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  stale: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  archived: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

function PlanCard({ plan, onClick }: { plan: TerritoryPlan; onClick: () => void }) {
  const style = STATUS_STYLE[plan.status] ?? STATUS_STYLE.planning;
  const taskProgress =
    plan.taskCount > 0
      ? Math.round((plan.completedTaskCount / plan.taskCount) * 100)
      : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all p-4 group"
    >
      {/* Top row: color bar + name + status */}
      <div className="flex items-start gap-3">
        <div
          className="w-1.5 h-10 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: plan.color || "#403770" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-800 truncate group-hover:text-gray-950">
              {plan.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize shrink-0 ${style.bg} ${style.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {plan.status}
            </span>
          </div>

          {/* Description preview */}
          {plan.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mb-2.5 leading-relaxed">
              {plan.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5.5 7.5H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M5.5 10H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="font-medium text-gray-600">{plan.districtCount}</span> district{plan.districtCount !== 1 ? "s" : ""}
            </span>
            {plan.totalEnrollment > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                  <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M3 13.5C3 11.015 5.239 9 8 9C10.761 9 13 11.015 13 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="font-medium text-gray-600">{formatNumber(plan.totalEnrollment)}</span> students
              </span>
            )}
            {plan.stateCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                  <path d="M8 2L3 5V11L8 14L13 11V5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                <span className="font-medium text-gray-600">{plan.stateCount}</span> state{plan.stateCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Task progress bar */}
          {plan.taskCount > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all bg-plum/60"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                {plan.completedTaskCount}/{plan.taskCount} tasks
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function PlansListPanel() {
  const viewPlan = useMapV2Store((s) => s.viewPlan);
  const startNewPlan = useMapV2Store((s) => s.startNewPlan);
  const [activeTab, setActiveTab] = useState<"all" | number>("all");

  const { data: plans, isLoading } = useTerritoryPlans();

  // Derive unique fiscal years sorted descending
  const fiscalYears = useMemo(() => {
    if (!plans) return [];
    const years = [...new Set(plans.map((p) => p.fiscalYear))];
    return years.sort((a, b) => b - a);
  }, [plans]);

  // Filter plans by selected tab
  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (activeTab === "all") return plans;
    return plans.filter((p) => p.fiscalYear === activeTab);
  }, [plans, activeTab]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Territory Plans
        </span>
        <button
          onClick={startNewPlan}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-plum bg-plum/5 hover:bg-plum/10 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Plan
        </button>
      </div>

      {/* FY Tabs */}
      {!isLoading && fiscalYears.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-150 hover:text-gray-600"
              }`}
            >
              All
            </button>
            {fiscalYears.map((fy) => (
              <button
                key={fy}
                onClick={() => setActiveTab(fy)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === fy
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-150 hover:text-gray-600"
                }`}
              >
                FY{String(fy).slice(-2)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-3" />
                    <div className="flex gap-4">
                      <div className="h-3 bg-gray-100 rounded w-20" />
                      <div className="h-3 bg-gray-100 rounded w-24" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredPlans.length > 0 ? (
          <>
            {/* Quick summary */}
            <div className="text-[11px] text-gray-400 px-0.5 pb-0.5">
              {filteredPlans.length} plan{filteredPlans.length !== 1 ? "s" : ""}
              {activeTab !== "all" && ` in FY${String(activeTab).slice(-2)}`}
            </div>
            {filteredPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClick={() => viewPlan(plan.id)}
              />
            ))}
          </>
        ) : (
          <div className="text-center py-10">
            <div className="text-gray-300 mb-3">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="mx-auto">
                <rect x="6" y="6" width="24" height="24" rx="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 13H23M13 18H23M13 23H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-gray-400 mb-1">
              {activeTab === "all" ? "No plans yet" : `No plans for FY${String(activeTab).slice(-2)}`}
            </p>
            <p className="text-xs text-gray-300 mb-4">
              Create a plan to organize your territory strategy
            </p>
            <button
              onClick={startNewPlan}
              className="px-5 py-2.5 bg-plum text-white text-xs font-medium rounded-xl hover:bg-plum/90 transition-all shadow-sm"
            >
              Create Your First Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
