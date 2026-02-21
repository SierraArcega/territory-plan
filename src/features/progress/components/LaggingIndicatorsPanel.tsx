// LaggingIndicatorsPanel — "Results & Outcomes" card for the Home dashboard
// Shows outcome distribution, a horizontal sales funnel, district engagement,
// and outcome tagging rate. Complements the LeadingIndicatorsPanel.

"use client";

import { useState } from "react";
import {
  useOutcomeMetrics,
  type ProgressPeriod,
} from "@/lib/api";
import { OUTCOME_CONFIGS, type OutcomeType } from "@/lib/outcomeTypes";
import FunnelChart from "./FunnelChart";

const PERIOD_LABELS: Record<ProgressPeriod, string> = {
  month: "This Month",
  quarter: "This Quarter",
  fiscal_year: "This FY",
};

// SVG donut for the district engagement metric
function MiniDonut({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? value / total : 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * percent;

  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      {/* Track */}
      <circle
        cx="22" cy="22" r={radius}
        fill="none" stroke="#F3F4F6" strokeWidth="5"
      />
      {/* Filled arc */}
      <circle
        cx="22" cy="22" r={radius}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

export default function LaggingIndicatorsPanel() {
  const [period, setPeriod] = useState<ProgressPeriod>("month");
  const { data, isLoading } = useOutcomeMetrics(period);

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="h-5 w-36 bg-gray-100 rounded mb-4" />
        <div className="space-y-2 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 bg-gray-50 rounded" />
          ))}
        </div>
        <div className="h-12 bg-gray-50 rounded-xl" />
      </div>
    );
  }

  // Build funnel stages
  const funnelStages = [
    { label: "Discovery Calls", count: data.funnel.discoveryCallsCompleted, color: "#6EA3BE" },
    { label: "Demos", count: data.funnel.demosCompleted, color: "#403770" },
    { label: "Proposals", count: data.funnel.proposalsReviewed, color: "#F37167" },
    { label: "Positive Outcomes", count: data.funnel.positiveOutcomes, color: "#8AA891" },
  ];

  // Get top outcome types sorted by count
  const outcomeEntries = Object.entries(data.byOutcomeType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header with period selector */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#403770]">
          Results & Outcomes
        </h2>
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

      {/* Sales funnel */}
      <div className="px-5 pb-4">
        <FunnelChart stages={funnelStages} />
      </div>

      {/* Outcome distribution — pills with counts */}
      {outcomeEntries.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-400 mb-2 font-medium">Outcomes</p>
          <div className="flex flex-wrap gap-1.5">
            {outcomeEntries.map(([type, count]) => {
              const config = OUTCOME_CONFIGS[type as OutcomeType];
              if (!config) return null;
              return (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{ backgroundColor: config.bgColor, color: config.color }}
                >
                  {config.icon} {config.label}
                  <span className="font-bold ml-0.5">{count}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* District engagement + outcome rate */}
      <div className="px-5 pb-4 flex items-center gap-4">
        {/* District engagement donut */}
        <div className="flex items-center gap-2.5">
          <MiniDonut
            value={data.districtsEngaged}
            total={data.totalDistrictsInPlans}
            color="#403770"
          />
          <div>
            <p className="text-sm font-bold text-[#403770]">
              {data.districtsEngaged}
              <span className="font-normal text-gray-400">
                /{data.totalDistrictsInPlans}
              </span>
            </p>
            <p className="text-[11px] text-gray-400">Districts Engaged</p>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="w-px h-10 bg-gray-100" />

        {/* Outcome tagging rate */}
        <div>
          <p className="text-sm font-bold text-[#403770]">
            {data.outcomeRate}%
          </p>
          <p className="text-[11px] text-gray-400">
            {data.totalWithOutcome}/{data.totalCompleted} tagged
          </p>
        </div>
      </div>
    </div>
  );
}
