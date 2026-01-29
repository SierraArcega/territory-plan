"use client";

import { useState } from "react";
import type { District, DistrictEducationData } from "@/lib/api";

interface StudentPopulationsProps {
  district: District;
  educationData: DistrictEducationData | null;
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return value.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

function calculatePercent(count: number | null, total: number | null): number | null {
  if (!count || !total || total <= 0) return null;
  return (count / total) * 100;
}

export default function StudentPopulations({
  district,
  educationData,
}: StudentPopulationsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasEll = district.ellStudents !== null && district.ellStudents > 0;
  const hasSwd = district.specEdStudents !== null && district.specEdStudents > 0;
  const hasAbsenteeism = educationData?.chronicAbsenteeismCount !== null;

  if (!hasEll && !hasSwd && !hasAbsenteeism) {
    return null;
  }

  const enrollment = district.enrollment || 0;
  const ellPercent = calculatePercent(district.ellStudents, enrollment);
  const swdPercent = calculatePercent(district.specEdStudents, enrollment);

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Student Populations</h3>
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
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* ELL Population */}
            {hasEll && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">
                  ELL Students
                </div>
                <div className="text-lg font-semibold text-blue-900">
                  {formatNumber(district.ellStudents)}
                </div>
                {ellPercent !== null && (
                  <div className="text-xs text-blue-700">
                    {formatPercent(ellPercent)} of enrollment
                  </div>
                )}
              </div>
            )}

            {/* SWD Population */}
            {hasSwd && (
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-xs text-purple-600 uppercase tracking-wide mb-1">
                  Special Ed
                </div>
                <div className="text-lg font-semibold text-purple-900">
                  {formatNumber(district.specEdStudents)}
                </div>
                {swdPercent !== null && (
                  <div className="text-xs text-purple-700">
                    {formatPercent(swdPercent)} of enrollment
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chronic Absenteeism */}
          {hasAbsenteeism && educationData && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Chronic Absenteeism</span>
                <span className={`font-semibold ${
                  (educationData.chronicAbsenteeismRate || 0) > 20
                    ? "text-red-600"
                    : (educationData.chronicAbsenteeismRate || 0) > 10
                      ? "text-amber-600"
                      : "text-green-600"
                }`}>
                  {formatPercent(educationData.chronicAbsenteeismRate)}
                </span>
              </div>

              {/* Absenteeism Bar */}
              {educationData.chronicAbsenteeismRate !== null && (
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      educationData.chronicAbsenteeismRate > 20
                        ? "bg-red-500"
                        : educationData.chronicAbsenteeismRate > 10
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(educationData.chronicAbsenteeismRate, 100)}%` }}
                  />
                </div>
              )}

              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{formatNumber(educationData.chronicAbsenteeismCount)} students</span>
                {educationData.absenteeismDataYear && (
                  <span>CRDC {educationData.absenteeismDataYear}-{educationData.absenteeismDataYear + 1}</span>
                )}
              </div>

              {/* Threshold Legend */}
              <div className="flex gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-500">&lt;10%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-gray-500">10-20%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-gray-500">&gt;20%</span>
                </div>
              </div>
            </div>
          )}

          {/* Population Breakdown Visual */}
          {(hasEll || hasSwd) && enrollment > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-gray-500 mb-2">Enrollment Composition</p>
              <div className="h-3 rounded-full overflow-hidden flex bg-gray-200">
                {hasSwd && swdPercent && (
                  <div
                    className="bg-purple-500 h-full"
                    style={{ width: `${Math.min(swdPercent, 100)}%` }}
                    title={`Special Ed: ${formatPercent(swdPercent)}`}
                  />
                )}
                {hasEll && ellPercent && (
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${Math.min(ellPercent, 100)}%` }}
                    title={`ELL: ${formatPercent(ellPercent)}`}
                  />
                )}
              </div>
              <div className="flex justify-between mt-1.5 text-xs">
                {hasSwd && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-gray-600">Special Ed {formatPercent(swdPercent)}</span>
                  </div>
                )}
                {hasEll && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-gray-600">ELL {formatPercent(ellPercent)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
