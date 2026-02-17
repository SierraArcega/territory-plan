"use client";

import type { District, DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge, { getSignalLevel } from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface StudentPopulationsCardProps {
  district: District;
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

export default function StudentPopulationsCard({
  district,
  educationData,
  trends,
}: StudentPopulationsCardProps) {
  const swdPct = trends?.swdPct;
  const ellPct = trends?.ellPct;
  const swdCount = district.specEdStudents;
  const ellCount = district.ellStudents;

  // Pick the more dramatic trend for the badge
  const trendValues = [trends?.swdTrend3yr, trends?.ellTrend3yr].filter((v): v is number => v != null);
  const mostNotable = trendValues.length > 0
    ? trendValues.reduce((a, b) => Math.abs(a) > Math.abs(b) ? a : b)
    : null;

  const swdLevel = getSignalLevel(trends?.swdTrend3yr ?? null);
  const ellLevel = getSignalLevel(trends?.ellTrend3yr ?? null);

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      }
      title="Student Populations"
      badge={<SignalBadge trend={mostNotable} label={swdLevel && ellLevel ? "SWD & ELL Shifting" : undefined} />}
      detail={
        <div className="space-y-3 pt-2">
          {educationData?.chronicAbsenteeismRate != null && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Chronic Absenteeism</h4>
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-bold text-[#403770]">
                  {educationData.chronicAbsenteeismRate.toFixed(1)}%
                </span>
                <TrendArrow value={trends?.absenteeismTrend3yr ?? null} unit="points" invertColor />
              </div>
              <QuartileContext quartile={trends?.absenteeismQuartileState ?? null} invertLabel />
              {educationData.chronicAbsenteeismCount != null && (
                <div className="text-xs text-gray-500">
                  {educationData.chronicAbsenteeismCount.toLocaleString()} students chronically absent
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Special Ed</div>
          <div className="text-lg font-bold text-[#403770]">
            {swdPct != null ? `${swdPct.toFixed(1)}%` : swdCount != null ? swdCount.toLocaleString() : "N/A"}
          </div>
          {swdCount != null && swdPct != null && (
            <div className="text-xs text-gray-500">{swdCount.toLocaleString()} students</div>
          )}
          <TrendArrow value={trends?.swdTrend3yr ?? null} unit="percent" />
          <QuartileContext quartile={trends?.swdPctQuartileState ?? null} />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">ELL</div>
          <div className="text-lg font-bold text-[#403770]">
            {ellPct != null ? `${ellPct.toFixed(1)}%` : ellCount != null ? ellCount.toLocaleString() : "N/A"}
          </div>
          {ellCount != null && ellPct != null && (
            <div className="text-xs text-gray-500">{ellCount.toLocaleString()} students</div>
          )}
          <TrendArrow value={trends?.ellTrend3yr ?? null} unit="percent" />
          <QuartileContext quartile={trends?.ellPctQuartileState ?? null} />
        </div>
      </div>
    </SignalCard>
  );
}
