"use client";

import { useState } from "react";
import type { DistrictEducationData } from "@/lib/api";

interface FinanceDataProps {
  educationData: DistrictEducationData;
}

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

  // Calculate revenue percentages
  const totalRevenue = educationData.totalRevenue || 0;
  const federalPct = totalRevenue > 0 ? ((educationData.federalRevenue || 0) / totalRevenue) * 100 : 0;
  const statePct = totalRevenue > 0 ? ((educationData.stateRevenue || 0) / totalRevenue) * 100 : 0;
  const localPct = totalRevenue > 0 ? ((educationData.localRevenue || 0) / totalRevenue) * 100 : 0;

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

          {/* Revenue Breakdown Bar */}
          {totalRevenue > 0 && (
            <div>
              <p className="text-gray-500 mb-2">Revenue Sources</p>
              <div className="h-4 rounded-full overflow-hidden flex">
                {federalPct > 0 && (
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${federalPct}%` }}
                    title={`Federal: ${federalPct.toFixed(1)}%`}
                  />
                )}
                {statePct > 0 && (
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${statePct}%` }}
                    title={`State: ${statePct.toFixed(1)}%`}
                  />
                )}
                {localPct > 0 && (
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${localPct}%` }}
                    title={`Local: ${localPct.toFixed(1)}%`}
                  />
                )}
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-gray-600">Federal {federalPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-600">State {statePct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-gray-600">Local {localPct.toFixed(0)}%</span>
                </div>
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
