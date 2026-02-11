// LeadingIndicatorsPanel — "Activity This Month" card for the Home dashboard
// Shows activity counts by category with trend indicators, plan coverage bar,
// by-plan breakdown, and source split (calendar vs manual).

"use client";

import { useState } from "react";
import {
  useActivityMetrics,
  type ProgressPeriod,
} from "@/lib/api";

const PERIOD_LABELS: Record<ProgressPeriod, string> = {
  month: "This Month",
  quarter: "This Quarter",
  fiscal_year: "This FY",
};

// Category icons and labels for the top stats row
const CATEGORY_DISPLAY = [
  { key: "meetings" as const, label: "Meetings", icon: "🤝" },
  { key: "outreach" as const, label: "Outreach", icon: "📧" },
  { key: "events" as const, label: "Events", icon: "🎤" },
];

// Small trend arrow component
function TrendBadge({ changePercent }: { changePercent: number }) {
  if (changePercent === 0) return null;

  const isUp = changePercent > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-medium"
      style={{ color: isUp ? "#8AA891" : "#F37167" }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d={isUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
        />
      </svg>
      {Math.abs(changePercent)}%
    </span>
  );
}

export default function LeadingIndicatorsPanel() {
  const [period, setPeriod] = useState<ProgressPeriod>("month");
  const { data, isLoading } = useActivityMetrics(period);

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="h-5 w-36 bg-gray-100 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl" />
          ))}
        </div>
        <div className="h-3 bg-gray-100 rounded-full mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-4 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header with period selector */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-[#403770]">Activity</h2>
          <TrendBadge changePercent={data.trend.changePercent} />
        </div>
        <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
          {(Object.keys(PERIOD_LABELS) as ProgressPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-white text-[#403770] shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Top stats row — category counts */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-3">
        {CATEGORY_DISPLAY.map(({ key, label, icon }) => (
          <div
            key={key}
            className="bg-gray-50/80 rounded-xl px-3 py-2.5 text-center"
          >
            <span className="text-lg">{icon}</span>
            <p className="text-xl font-bold text-[#403770] mt-0.5">
              {data.byCategory[key]}
            </p>
            <p className="text-[11px] text-gray-400 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Plan coverage bar */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Plan Coverage</span>
          <span className="text-xs font-medium text-[#403770]">
            {data.planCoveragePercent}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#403770] rounded-full transition-all duration-500"
            style={{ width: `${data.planCoveragePercent}%` }}
          />
        </div>
      </div>

      {/* By plan breakdown */}
      {data.byPlan.length > 0 && (
        <div className="px-5 pb-3">
          <div className="space-y-1.5">
            {data.byPlan.slice(0, 4).map((plan) => (
              <div key={plan.planId} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: plan.planColor }}
                />
                <span className="text-xs text-gray-600 truncate flex-1">
                  {plan.planName}
                </span>
                <span className="text-xs font-medium text-[#403770]">
                  {plan.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source split footer */}
      <div className="px-5 py-3 border-t border-gray-50 flex items-center gap-3">
        <span className="text-[11px] text-gray-400">
          {data.bySource.calendar_sync} from calendar
        </span>
        <span className="text-gray-200">&middot;</span>
        <span className="text-[11px] text-gray-400">
          {data.bySource.manual} manual
        </span>
      </div>
    </div>
  );
}
