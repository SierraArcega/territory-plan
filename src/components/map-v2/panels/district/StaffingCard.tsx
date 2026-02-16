"use client";

import type { DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface StaffingCardProps {
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

function formatCurrency(val: number | null): string {
  if (val == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatFte(val: number | null): string {
  if (val == null) return "N/A";
  return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(1);
}

export default function StaffingCard({
  educationData,
  trends,
}: StaffingCardProps) {
  const ratio = trends?.studentTeacherRatio;
  const spedRatio = trends?.spedStudentTeacherRatio;

  // Composite signal: worst of staffing trend, ratio trend, vacancy pressure
  const signals = [
    trends?.staffingTrend3yr,
    trends?.studentTeacherRatioTrend3yr != null ? -trends.studentTeacherRatioTrend3yr : null,
    trends?.vacancyPressureSignal != null ? -trends.vacancyPressureSignal : null,
  ].filter((v): v is number => v != null);

  const worstSignal = signals.length > 0 ? Math.min(...signals) : null;

  const avgTeacherSalary = educationData?.salariesInstruction && educationData?.teachersFte
    ? educationData.salariesInstruction / educationData.teachersFte
    : null;
  const avgAdminSalary = educationData?.salariesSupportAdmin && educationData?.adminFte
    ? educationData.salariesSupportAdmin / educationData.adminFte
    : null;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      }
      title="Staffing & Capacity"
      badge={<SignalBadge trend={worstSignal} />}
      detail={
        <div className="space-y-3 pt-2">
          {educationData?.staffTotalFte != null && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Breakdown</h4>
              <div className="space-y-1 text-sm">
                {[
                  { label: "Teachers", value: educationData.teachersFte },
                  { label: "Admin", value: educationData.adminFte },
                  { label: "Counselors", value: educationData.guidanceCounselorsFte },
                  { label: "Instructional Aides", value: educationData.instructionalAidesFte },
                ].filter(r => r.value != null).map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-600">{r.label}</span>
                    <span className="font-medium text-[#403770]">{formatFte(r.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-600 font-medium">Total Staff</span>
                  <span className="font-medium text-[#403770]">{formatFte(educationData.staffTotalFte)}</span>
                </div>
              </div>
            </div>
          )}
          {(avgTeacherSalary || avgAdminSalary) && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Compensation</h4>
              <div className="space-y-1 text-sm">
                {avgTeacherSalary != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Teacher Salary</span>
                    <span className="font-medium text-[#403770]">{formatCurrency(avgTeacherSalary)}</span>
                  </div>
                )}
                {avgAdminSalary != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Admin Salary</span>
                    <span className="font-medium text-[#403770]">{formatCurrency(avgAdminSalary)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1.5">
        {ratio != null ? (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-[#403770]">{ratio.toFixed(1)}:1</span>
            <TrendArrow value={trends?.studentTeacherRatioTrend3yr ?? null} unit="ratio" invertColor />
          </div>
        ) : (
          <span className="text-lg text-gray-400">No ratio data</span>
        )}
        <div className="text-xs text-gray-500">Student-teacher ratio</div>
        <QuartileContext quartile={trends?.studentTeacherRatioQuartileState ?? null} invertLabel />
        {spedRatio != null && (
          <div className="mt-2 text-sm text-gray-600">
            SPED student-teacher ratio: <span className="font-medium text-[#403770]">{spedRatio.toFixed(1)}:1</span>
          </div>
        )}
      </div>
    </SignalCard>
  );
}
