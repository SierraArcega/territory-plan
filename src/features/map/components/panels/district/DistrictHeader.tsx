"use client";

import type { District, FullmindData, Tag, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import { getAccountTypeLabel } from "@/features/shared/types/account-types";

interface DistrictHeaderProps {
  district: District;
  fullmindData: FullmindData | null;
  tags: Tag[];
  trends: DistrictTrends | null;
}

function formatGrades(lo: string, hi: string): string {
  const map: Record<string, string> = { PK: "Pre-K", KG: "K", "01": "1", "02": "2", "03": "3", "04": "4", "05": "5", "06": "6", "07": "7", "08": "8", "09": "9", "10": "10", "11": "11", "12": "12", UG: "Ungraded" };
  return `${map[lo] || lo} – ${map[hi] || hi}`;
}

export default function DistrictHeader({
  district,
  fullmindData,
  tags,
  trends,
}: DistrictHeaderProps) {
  return (
    <div className="px-3 pt-3 pb-2 border-b border-gray-100 bg-gradient-to-b from-[#FFFCFA] to-white">
      {/* District Name */}
      <h2 className="text-lg font-bold text-[#403770] pr-8 leading-tight">
        {district.name}
      </h2>
      {district.accountType && district.accountType !== "district" && (
        <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-plum/10 text-plum rounded-full">
          {getAccountTypeLabel(district.accountType)}
        </span>
      )}

      {/* State, County & LEAID */}
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>{district.stateAbbrev}</span>
        {district.countyName && (
          <>
            <span>·</span>
            <span>{district.countyName} County</span>
          </>
        )}
        <span>·</span>
        <span className="font-mono">{district.leaid}</span>
      </div>

      {/* External Links */}
      {(district.websiteUrl || district.jobBoardUrl) && (
        <div className="flex items-center gap-2 mt-2">
          {district.websiteUrl && (
            <a
              href={district.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 hover:bg-[#403770] hover:text-white text-gray-600 transition-colors"
              title="Visit Website"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </a>
          )}
          {district.jobBoardUrl && (
            <a
              href={district.jobBoardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 hover:bg-[#403770] hover:text-white text-gray-600 transition-colors"
              title="View Job Board"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Signal Strip */}
      {trends && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <SignalBadge trend={trends.enrollmentTrend3yr} compact label={
            trends.enrollmentTrend3yr != null
              ? `${trends.enrollmentTrend3yr > 0 ? "↑" : trends.enrollmentTrend3yr < -0.5 ? "↓" : "—"} Enrollment`
              : undefined
          } />
          <SignalBadge
            trend={trends.studentTeacherRatioTrend3yr != null ? -trends.studentTeacherRatioTrend3yr : null}
            compact
            label={trends.studentTeacherRatioTrend3yr != null
              ? `${trends.studentTeacherRatioTrend3yr > 0.5 ? "⚠" : "✓"} Staffing`
              : undefined}
          />
          <SignalBadge trend={trends.graduationTrend3yr} isPointChange compact label={
            trends.graduationTrend3yr != null
              ? `${trends.graduationTrend3yr > 0 ? "↑" : trends.graduationTrend3yr < -0.5 ? "↓" : "—"} Graduation`
              : undefined
          } />
          <SignalBadge trend={trends.expenditurePpTrend3yr} compact label={
            trends.expenditurePpTrend3yr != null
              ? `${trends.expenditurePpTrend3yr > 0 ? "↑" : trends.expenditurePpTrend3yr < -0.5 ? "↓" : "—"} Spend`
              : undefined
          } />
        </div>
      )}

      {/* Compact stats line */}
      <div className="mt-2 text-xs text-gray-500">
        {district.enrollment != null && (
          <span>{district.enrollment.toLocaleString()} students</span>
        )}
        {district.lograde && district.higrade && (
          <span> · {formatGrades(district.lograde, district.higrade)}</span>
        )}
        {district.numberOfSchools != null && (
          <span> · {district.numberOfSchools} schools</span>
        )}
      </div>

      {/* Sales Executive */}
      {fullmindData?.salesExecutive && (
        <div className="mt-1.5 text-xs text-gray-500">
          SE: <span className="font-medium text-[#403770]">{fullmindData.salesExecutive}</span>
        </div>
      )}
    </div>
  );
}
