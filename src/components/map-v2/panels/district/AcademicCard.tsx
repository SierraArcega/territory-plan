"use client";

import type { DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface AcademicCardProps {
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

export default function AcademicCard({
  educationData,
  trends,
}: AcademicCardProps) {
  const gradRate = educationData?.graduationRateTotal;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
        </svg>
      }
      title="Academic Performance"
      badge={<SignalBadge trend={trends?.graduationTrend3yr ?? null} isPointChange />}
      detail={
        <div className="space-y-3 pt-2">
          {trends?.mathProficiencyTrend3yr != null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Math Proficiency</span>
                <QuartileContext quartile={trends.mathProficiencyQuartileState} />
              </div>
              <TrendArrow value={trends.mathProficiencyTrend3yr} unit="points" />
            </div>
          )}
          {trends?.readProficiencyTrend3yr != null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reading Proficiency</span>
                <QuartileContext quartile={trends.readProficiencyQuartileState} />
              </div>
              <TrendArrow value={trends.readProficiencyTrend3yr} unit="points" />
            </div>
          )}
          {educationData?.graduationDataYear && (
            <div className="text-xs text-gray-400 text-center pt-1">
              {educationData.graduationDataYear - 1}–{educationData.graduationDataYear} cohort
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1.5">
        {gradRate != null ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#403770]">{gradRate.toFixed(1)}%</span>
              <TrendArrow value={trends?.graduationTrend3yr ?? null} unit="points" />
            </div>
            <div className="text-xs text-gray-500">4-year graduation rate</div>
            <QuartileContext quartile={trends?.graduationQuartileState ?? null} />
          </>
        ) : (
          <span className="text-lg text-gray-400">No graduation data</span>
        )}
      </div>
    </SignalCard>
  );
}
