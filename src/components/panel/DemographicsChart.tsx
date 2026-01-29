"use client";

import { useState } from "react";
import type { DistrictEnrollmentDemographics } from "@/lib/api";

interface DemographicsChartProps {
  demographics: DistrictEnrollmentDemographics;
}

// Color palette for demographics (accessible colors)
const COLORS = {
  white: { bg: "bg-slate-400", label: "White" },
  black: { bg: "bg-violet-500", label: "Black" },
  hispanic: { bg: "bg-amber-500", label: "Hispanic" },
  asian: { bg: "bg-emerald-500", label: "Asian" },
  americanIndian: { bg: "bg-red-500", label: "American Indian" },
  pacificIslander: { bg: "bg-cyan-500", label: "Pacific Islander" },
  twoOrMore: { bg: "bg-pink-500", label: "Two or More" },
};

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "0";
  return value.toLocaleString();
}

function formatPercent(value: number, total: number): string {
  if (!total || !value) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

export default function DemographicsChart({ demographics }: DemographicsChartProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const total = demographics.totalEnrollment || 0;

  if (!total) {
    return null;
  }

  // Build data array for the chart
  const data = [
    { key: "white", value: demographics.enrollmentWhite || 0, ...COLORS.white },
    { key: "black", value: demographics.enrollmentBlack || 0, ...COLORS.black },
    { key: "hispanic", value: demographics.enrollmentHispanic || 0, ...COLORS.hispanic },
    { key: "asian", value: demographics.enrollmentAsian || 0, ...COLORS.asian },
    { key: "americanIndian", value: demographics.enrollmentAmericanIndian || 0, ...COLORS.americanIndian },
    { key: "pacificIslander", value: demographics.enrollmentPacificIslander || 0, ...COLORS.pacificIslander },
    { key: "twoOrMore", value: demographics.enrollmentTwoOrMore || 0, ...COLORS.twoOrMore },
  ].filter((d) => d.value > 0)
   .sort((a, b) => b.value - a.value);

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Student Demographics</h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3 text-sm">
          {/* Total enrollment header */}
          <div className="flex items-baseline justify-between pb-2 border-b border-gray-100">
            <span className="text-gray-500">Total Enrollment</span>
            <span className="text-[#403770] font-semibold">{formatNumber(total)}</span>
          </div>

          {/* Horizontal bar chart */}
          <div className="space-y-2">
            {data.map((item) => {
              const pct = (item.value / total) * 100;
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${item.bg}`} />
                      <span className="text-gray-600">{item.label}</span>
                    </div>
                    <span className="text-gray-700 font-medium">
                      {formatNumber(item.value)} ({formatPercent(item.value, total)})
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.bg} rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Data year */}
          {demographics.demographicsDataYear && (
            <p className="text-gray-400 text-xs pt-2">
              {demographics.demographicsDataYear}-{demographics.demographicsDataYear + 1} school year
            </p>
          )}
        </div>
      )}
    </div>
  );
}
