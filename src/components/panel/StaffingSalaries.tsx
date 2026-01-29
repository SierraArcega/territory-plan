"use client";

import { useState } from "react";
import type { DistrictEducationData } from "@/lib/api";

interface StaffingSalariesProps {
  educationData: DistrictEducationData;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSalary(value: number | null): string {
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
  // Round to 1 decimal for FTE
  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(1);
}

function formatPercent(value: number, total: number): string {
  if (!total || !value) return "0%";
  return `${((value / total) * 100).toFixed(0)}%`;
}

function calculateAverage(salary: number | null, fte: number | null): number | null {
  if (!salary || !fte || fte <= 0) return null;
  return salary / fte;
}

export default function StaffingSalaries({ educationData }: StaffingSalariesProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasSalaryData = educationData.salariesTotal !== null;
  const hasStaffData = educationData.staffTotalFte !== null;

  if (!hasSalaryData && !hasStaffData) {
    return null;
  }

  const totalSalaries = educationData.salariesTotal || 0;
  const totalBenefits = educationData.benefitsTotal || 0;
  const totalCompensation = totalSalaries + totalBenefits;

  // Staff counts
  const teachersFte = educationData.teachersFte;
  const adminFte = educationData.adminFte;
  const staffTotalFte = educationData.staffTotalFte;

  // Calculate averages
  const avgTeacherSalary = calculateAverage(educationData.salariesInstruction, teachersFte);
  const avgAdminSalary = calculateAverage(educationData.salariesSupportAdmin, adminFte);
  const avgTotalCompPerEmployee = calculateAverage(totalCompensation, staffTotalFte);

  // Instruction vs other breakdown
  const instructionSalaries = educationData.salariesInstruction || 0;
  const otherSalaries = totalSalaries - instructionSalaries;

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Staffing & Salaries</h3>
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
          {/* Staff Count Summary */}
          {hasStaffData && (
            <div className="bg-[#F5F3FF] rounded-lg p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600 text-xs uppercase tracking-wide">Total Staff</span>
                <span className="text-[#403770] font-semibold text-lg">
                  {formatNumber(staffTotalFte)} FTE
                </span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                {teachersFte && <span>Teachers: {formatNumber(teachersFte)}</span>}
                {adminFte && <span>Admin: {formatNumber(adminFte)}</span>}
              </div>
            </div>
          )}

          {/* Average Salaries - Key Metrics */}
          {(avgTeacherSalary || avgAdminSalary || avgTotalCompPerEmployee) && (
            <div>
              <p className="text-gray-500 mb-2">Average Compensation</p>
              <div className="space-y-2">
                {avgTeacherSalary && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg Teacher Salary</span>
                    <span className="text-[#403770] font-semibold">
                      {formatSalary(avgTeacherSalary)}
                    </span>
                  </div>
                )}
                {avgAdminSalary && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg Admin Salary</span>
                    <span className="text-gray-700 font-medium">
                      {formatSalary(avgAdminSalary)}
                    </span>
                  </div>
                )}
                {avgTotalCompPerEmployee && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg Total Comp/Employee</span>
                    <span className="text-gray-700 font-medium">
                      {formatSalary(avgTotalCompPerEmployee)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Staff Breakdown */}
          {hasStaffData && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-gray-500 mb-2">Staff Breakdown</p>
              <div className="space-y-1.5">
                {educationData.teachersElementaryFte && educationData.teachersElementaryFte > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Elementary Teachers</span>
                    <span className="text-gray-700">{formatNumber(educationData.teachersElementaryFte)}</span>
                  </div>
                )}
                {educationData.teachersSecondaryFte && educationData.teachersSecondaryFte > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Secondary Teachers</span>
                    <span className="text-gray-700">{formatNumber(educationData.teachersSecondaryFte)}</span>
                  </div>
                )}
                {educationData.guidanceCounselorsFte && educationData.guidanceCounselorsFte > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Guidance Counselors</span>
                    <span className="text-gray-700">{formatNumber(educationData.guidanceCounselorsFte)}</span>
                  </div>
                )}
                {educationData.instructionalAidesFte && educationData.instructionalAidesFte > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Instructional Aides</span>
                    <span className="text-gray-700">{formatNumber(educationData.instructionalAidesFte)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total Compensation Breakdown */}
          {hasSalaryData && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-gray-500 mb-2">Total Compensation</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Salaries</span>
                  <span className="text-gray-700 font-medium">{formatCurrency(totalSalaries)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Benefits</span>
                  <span className="text-gray-700 font-medium">{formatCurrency(totalBenefits)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-50">
                  <span className="text-gray-700 font-medium">Total</span>
                  <span className="text-[#403770] font-semibold">{formatCurrency(totalCompensation)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Salary Distribution Bar */}
          {totalSalaries > 0 && (
            <div className="pt-2">
              <p className="text-gray-500 mb-2">Salary Distribution</p>
              <div className="h-3 rounded-full overflow-hidden flex">
                {instructionSalaries > 0 && (
                  <div
                    className="bg-violet-500 h-full"
                    style={{ width: `${(instructionSalaries / totalSalaries) * 100}%` }}
                    title={`Instruction: ${formatPercent(instructionSalaries, totalSalaries)}`}
                  />
                )}
                {otherSalaries > 0 && (
                  <div
                    className="bg-slate-400 h-full"
                    style={{ width: `${(otherSalaries / totalSalaries) * 100}%` }}
                    title={`Other: ${formatPercent(otherSalaries, totalSalaries)}`}
                  />
                )}
              </div>
              <div className="flex justify-between mt-1.5 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-gray-600">Instruction {formatPercent(instructionSalaries, totalSalaries)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-gray-600">Other {formatPercent(otherSalaries, totalSalaries)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Data years */}
          <div className="text-gray-400 text-xs pt-1 flex gap-3">
            {educationData.financeDataYear && (
              <span>Finance: FY{educationData.financeDataYear}</span>
            )}
            {educationData.staffDataYear && (
              <span>Staff: {educationData.staffDataYear}-{educationData.staffDataYear + 1}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
