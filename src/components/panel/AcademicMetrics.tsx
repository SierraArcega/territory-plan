"use client";

import { useState } from "react";
import type { DistrictEducationData } from "@/lib/api";

interface AcademicMetricsProps {
  educationData: DistrictEducationData;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

function getGradRateColor(rate: number | null): string {
  if (rate === null) return "text-gray-500";
  if (rate >= 90) return "text-green-600";
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 70) return "text-amber-600";
  return "text-red-600";
}

function GradRateBar({ rate, label }: { rate: number | null; label: string }) {
  if (rate === null) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-600 w-16">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            rate >= 90
              ? "bg-green-500"
              : rate >= 80
              ? "bg-emerald-500"
              : rate >= 70
              ? "bg-amber-500"
              : "bg-red-500"
          }`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className={`font-medium w-14 text-right ${getGradRateColor(rate)}`}>
        {formatPercent(rate)}
      </span>
    </div>
  );
}

export default function AcademicMetrics({ educationData }: AcademicMetricsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasGraduationData =
    educationData.graduationRateTotal !== null ||
    educationData.graduationRateMale !== null ||
    educationData.graduationRateFemale !== null;

  if (!hasGraduationData) {
    return null;
  }

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Academic Outcomes</h3>
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
          {/* Graduation Rates Section */}
          <div>
            <p className="text-gray-500 mb-3">4-Year Graduation Rate</p>

            {/* Highlighted total rate */}
            {educationData.graduationRateTotal !== null && (
              <div className="bg-[#F5F3FF] rounded-lg p-3 mb-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-gray-600 text-xs uppercase tracking-wide">Overall</span>
                  <span className={`text-lg font-semibold ${getGradRateColor(educationData.graduationRateTotal)}`}>
                    {formatPercent(educationData.graduationRateTotal)}
                  </span>
                </div>
              </div>
            )}

            {/* Male/Female breakdown */}
            {(educationData.graduationRateMale !== null ||
              educationData.graduationRateFemale !== null) && (
              <div className="space-y-2">
                <GradRateBar rate={educationData.graduationRateFemale} label="Female" />
                <GradRateBar rate={educationData.graduationRateMale} label="Male" />
              </div>
            )}
          </div>

          {/* Data year */}
          {educationData.graduationDataYear && (
            <p className="text-gray-400 text-xs">
              {educationData.graduationDataYear - 1}-{educationData.graduationDataYear} cohort
            </p>
          )}
        </div>
      )}
    </div>
  );
}
