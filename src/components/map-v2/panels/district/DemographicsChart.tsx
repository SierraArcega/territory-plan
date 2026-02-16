"use client";

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { DistrictEnrollmentDemographics } from "@/lib/api";

interface DemographicsChartProps {
  demographics: DistrictEnrollmentDemographics;
}

// Brand-compatible color palette for demographics
const COLORS: Record<string, { hex: string; label: string }> = {
  white: { hex: "#6EA3BE", label: "White" },
  black: { hex: "#403770", label: "Black" },
  hispanic: { hex: "#F37167", label: "Hispanic" },
  asian: { hex: "#48bb78", label: "Asian" },
  americanIndian: { hex: "#ed8936", label: "American Indian" },
  pacificIslander: { hex: "#9f7aea", label: "Pacific Islander" },
  twoOrMore: { hex: "#38b2ac", label: "Two or More" },
};

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "0";
  return value.toLocaleString();
}

function formatPercent(value: number, total: number): string {
  if (!total || !value) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

interface ChartDataItem {
  key: string;
  value: number;
  hex: string;
  label: string;
}

interface TooltipPayloadItem {
  payload: ChartDataItem;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  total: number;
}

function CustomTooltip({ active, payload, total }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const pct = ((data.value / total) * 100).toFixed(1);

  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: data.hex }}
        />
        <span className="font-medium text-gray-700">{data.label}</span>
      </div>
      <div className="mt-1 text-gray-600">
        {formatNumber(data.value)} students ({pct}%)
      </div>
    </div>
  );
}

export default function DemographicsChart({ demographics }: DemographicsChartProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const total = demographics.totalEnrollment || 0;

  if (!total) {
    return null;
  }

  // Build data array for the chart (memoized to prevent recreating on every render)
  const data = useMemo<ChartDataItem[]>(() => {
    return [
      { key: "white", value: demographics.enrollmentWhite || 0, ...COLORS.white },
      { key: "black", value: demographics.enrollmentBlack || 0, ...COLORS.black },
      { key: "hispanic", value: demographics.enrollmentHispanic || 0, ...COLORS.hispanic },
      { key: "asian", value: demographics.enrollmentAsian || 0, ...COLORS.asian },
      { key: "americanIndian", value: demographics.enrollmentAmericanIndian || 0, ...COLORS.americanIndian },
      { key: "pacificIslander", value: demographics.enrollmentPacificIslander || 0, ...COLORS.pacificIslander },
      { key: "twoOrMore", value: demographics.enrollmentTwoOrMore || 0, ...COLORS.twoOrMore },
    ].filter((d) => d.value > 0)
     .sort((a, b) => b.value - a.value);
  }, [demographics]);

  return (
    <div className="px-3 py-3 border-b border-gray-100">
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
          <div className="text-center pb-2">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Total Enrollment</span>
            <div className="text-[#403770] font-bold text-2xl">{formatNumber(total)}</div>
          </div>

          {/* Donut Pie Chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="label"
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={entry.hex} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 2-column Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {data.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.hex }}
                />
                <span className="text-gray-600 text-xs truncate">{item.label}</span>
                <span className="text-gray-500 text-xs ml-auto">
                  {formatPercent(item.value, total)}
                </span>
              </div>
            ))}
          </div>

          {/* Data year */}
          {demographics.demographicsDataYear && (
            <p className="text-gray-400 text-xs pt-2 text-center">
              {demographics.demographicsDataYear}-{demographics.demographicsDataYear + 1} school year
            </p>
          )}
        </div>
      )}
    </div>
  );
}
