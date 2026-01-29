"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { DistrictEducationData } from "@/lib/api";

interface FinanceDataProps {
  educationData: DistrictEducationData;
}

// Brand-compatible colors for revenue sources
const REVENUE_COLORS = {
  federal: { hex: "#6EA3BE", label: "Federal" },
  state: { hex: "#48bb78", label: "State" },
  local: { hex: "#F37167", label: "Local" },
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return value.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

interface RevenueDataItem {
  key: string;
  value: number;
  pct: number;
  hex: string;
  label: string;
}

interface TooltipPayloadItem {
  payload: RevenueDataItem;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

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
        {formatCurrency(data.value)} ({data.pct.toFixed(1)}%)
      </div>
    </div>
  );
}

export default function FinanceData({ educationData }: FinanceDataProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasFinanceData =
    educationData.expenditurePerPupil !== null ||
    educationData.totalExpenditure !== null ||
    educationData.totalRevenue !== null;

  const hasPovertyData =
    educationData.childrenPovertyPercent !== null ||
    educationData.medianHouseholdIncome !== null;

  if (!hasFinanceData && !hasPovertyData) {
    return null;
  }

  // Calculate revenue percentages and build chart data
  const totalRevenue = educationData.totalRevenue || 0;
  const federalRevenue = educationData.federalRevenue || 0;
  const stateRevenue = educationData.stateRevenue || 0;
  const localRevenue = educationData.localRevenue || 0;

  const revenueData: RevenueDataItem[] = [
    {
      key: "federal",
      value: federalRevenue,
      pct: totalRevenue > 0 ? (federalRevenue / totalRevenue) * 100 : 0,
      ...REVENUE_COLORS.federal
    },
    {
      key: "state",
      value: stateRevenue,
      pct: totalRevenue > 0 ? (stateRevenue / totalRevenue) * 100 : 0,
      ...REVENUE_COLORS.state
    },
    {
      key: "local",
      value: localRevenue,
      pct: totalRevenue > 0 ? (localRevenue / totalRevenue) * 100 : 0,
      ...REVENUE_COLORS.local
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Finance & Economic Data</h3>
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
        <div className="mt-3 space-y-4 text-sm">
          {/* Per-Pupil Spending - Highlighted */}
          {educationData.expenditurePerPupil !== null && (
            <div className="bg-[#F5F3FF] rounded-lg p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600 text-xs uppercase tracking-wide">Per-Pupil Spending</span>
                <span className="text-[#403770] font-semibold text-lg">
                  {formatCurrency(educationData.expenditurePerPupil)}
                </span>
              </div>
              {educationData.financeDataYear && (
                <p className="text-gray-400 text-xs mt-1">FY{educationData.financeDataYear}</p>
              )}
            </div>
          )}

          {/* Revenue Sources Pie Chart */}
          {totalRevenue > 0 && revenueData.length > 0 && (
            <div>
              <p className="text-gray-500 mb-2">Revenue Sources</p>

              {/* Donut Chart */}
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="label"
                    >
                      {revenueData.map((entry) => (
                        <Cell key={entry.key} fill={entry.hex} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend with dollar amounts */}
              <div className="space-y-1 mt-2">
                {revenueData.map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.hex }}
                      />
                      <span className="text-gray-600 text-xs">{item.label}</span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {formatCurrency(item.value)} ({item.pct.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-gray-400 text-xs mt-2">
                Total Revenue: {formatCurrency(totalRevenue)}
              </p>
            </div>
          )}

          {/* Total Expenditure */}
          {educationData.totalExpenditure !== null && (
            <div>
              <span className="text-gray-500">Total Expenditure: </span>
              <span className="text-gray-700 font-medium">
                {formatCurrency(educationData.totalExpenditure)}
              </span>
            </div>
          )}

          {/* Poverty Data Section */}
          {hasPovertyData && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-gray-500 mb-2">Economic Indicators</p>
              <div className="space-y-2">
                {educationData.childrenPovertyPercent !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Child Poverty Rate</span>
                    <span className={`font-medium ${
                      educationData.childrenPovertyPercent > 20
                        ? "text-red-600"
                        : educationData.childrenPovertyPercent > 10
                        ? "text-amber-600"
                        : "text-green-600"
                    }`}>
                      {formatPercent(educationData.childrenPovertyPercent)}
                    </span>
                  </div>
                )}
                {educationData.childrenPovertyCount !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Children in Poverty</span>
                    <span className="text-gray-700 font-medium">
                      {formatNumber(educationData.childrenPovertyCount)}
                    </span>
                  </div>
                )}
                {educationData.medianHouseholdIncome !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Median Household Income</span>
                    <span className="text-gray-700 font-medium">
                      {formatCurrency(educationData.medianHouseholdIncome)}
                    </span>
                  </div>
                )}
              </div>
              {educationData.saipeDataYear && (
                <p className="text-gray-400 text-xs mt-2">
                  SAIPE {educationData.saipeDataYear}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
