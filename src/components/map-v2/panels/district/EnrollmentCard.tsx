"use client";

import type { District, DistrictEnrollmentDemographics, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import SignalCard from "./signals/SignalCard";
import DemographicsChart from "@/components/panel/DemographicsChart";
import CharterSchools from "./CharterSchools";

interface EnrollmentCardProps {
  district: District;
  demographics: DistrictEnrollmentDemographics | null;
  trends: DistrictTrends | null;
}

function formatGrades(lo: string, hi: string): string {
  const map: Record<string, string> = { PK: "Pre-K", KG: "K", "01": "1", "02": "2", "03": "3", "04": "4", "05": "5", "06": "6", "07": "7", "08": "8", "09": "9", "10": "10", "11": "11", "12": "12", UG: "Ungraded" };
  return `${map[lo] || lo} – ${map[hi] || hi}`;
}

export default function EnrollmentCard({
  district,
  demographics,
  trends,
}: EnrollmentCardProps) {
  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      title="Enrollment & Growth"
      badge={<SignalBadge trend={trends?.enrollmentTrend3yr ?? null} />}
      detail={
        <div className="space-y-4 pt-2">
          {demographics && <DemographicsChart demographics={demographics} />}
          <CharterSchools leaid={district.leaid} />
          {district.numberOfSchools != null && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Schools in district</span>
              <span className="font-medium text-[#403770]">{district.numberOfSchools}</span>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-[#403770]">
            {district.enrollment?.toLocaleString() ?? "N/A"}
          </span>
          <TrendArrow value={trends?.enrollmentTrend3yr ?? null} unit="percent" />
        </div>
        <div className="text-xs text-gray-500">
          {district.lograde && district.higrade && (
            <span>Grades {formatGrades(district.lograde, district.higrade)} · </span>
          )}
          {district.numberOfSchools != null && (
            <span>{district.numberOfSchools} schools</span>
          )}
        </div>
      </div>
    </SignalCard>
  );
}
