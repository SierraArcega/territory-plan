"use client";

import { useState } from "react";
import { useSchoolsByDistrict } from "@/lib/api";
import type { SchoolListItem, SchoolsSummary } from "@/features/shared/types/api-types";

const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Primary",
  2: "Middle",
  3: "High",
  4: "Other",
};

const TITLE_I_LABELS: Record<number, string> = {
  1: "Eligible (No Program)",
  2: "Targeted",
  3: "Eligible (Not Participating)",
  4: "Eligible (Unknown)",
  5: "Schoolwide",
  6: "Not Eligible",
};

type SortKey = "schoolName" | "enrollment" | "titleI" | "frpl" | "frplPct";
type SortDir = "asc" | "desc";

function sortSchools(schools: SchoolListItem[], key: SortKey, dir: SortDir) {
  return [...schools].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;

    switch (key) {
      case "schoolName":
        av = a.schoolName.toLowerCase();
        bv = b.schoolName.toLowerCase();
        return dir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
      case "enrollment":
        av = a.enrollment ?? -1;
        bv = b.enrollment ?? -1;
        break;
      case "titleI":
        av = a.titleIStatus ?? 99;
        bv = b.titleIStatus ?? 99;
        break;
      case "frpl":
        av = a.frplTotal ?? -1;
        bv = b.frplTotal ?? -1;
        break;
      case "frplPct":
        av = a.frplTotal && a.enrollment ? a.frplTotal / a.enrollment : -1;
        bv = b.frplTotal && b.enrollment ? b.frplTotal / b.enrollment : -1;
        break;
    }
    return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

interface SchoolsCardProps {
  leaid: string;
}

export default function SchoolsCard({ leaid }: SchoolsCardProps) {
  const { data, isLoading } = useSchoolsByDistrict(leaid);
  const [sortKey, setSortKey] = useState<SortKey>("schoolName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="px-3 py-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Schools
        </h3>
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-gray-100 rounded" />
          <div className="h-6 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const schools = data?.schools || [];
  const summary: SchoolsSummary | undefined = data?.summary;
  if (schools.length === 0) return null;

  const sorted = sortSchools(schools, sortKey, sortDir);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "schoolName" ? "asc" : "desc");
    }
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left mb-2"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Schools
          </h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
            {schools.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <>
          {/* Title I Summary */}
          {summary && summary.titleISchools > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              <span className="font-medium text-gray-700">Title I:</span>{" "}
              {summary.titleISchools} of {summary.totalSchools} schools
              {summary.titleISchoolwide > 0 && ` (${summary.titleISchoolwide} schoolwide)`}
              {summary.frplRate != null && ` · ${summary.frplRate}% FRPL`}
            </p>
          )}

          {/* Table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-1 pr-2 font-medium cursor-pointer hover:text-gray-600" onClick={() => toggleSort("schoolName")}>
                    Name{arrow("schoolName")}
                  </th>
                  <th className="pb-1 px-1 font-medium text-right cursor-pointer hover:text-gray-600 whitespace-nowrap" onClick={() => toggleSort("enrollment")}>
                    Enr{arrow("enrollment")}
                  </th>
                  <th className="pb-1 px-1 font-medium cursor-pointer hover:text-gray-600 whitespace-nowrap" onClick={() => toggleSort("titleI")}>
                    Title I{arrow("titleI")}
                  </th>
                  <th className="pb-1 pl-1 font-medium text-right cursor-pointer hover:text-gray-600 whitespace-nowrap" onClick={() => toggleSort("frplPct")}>
                    FRPL %{arrow("frplPct")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((school) => {
                  const frplPct =
                    school.frplTotal != null && school.enrollment
                      ? Math.round((school.frplTotal / school.enrollment) * 1000) / 10
                      : null;

                  return (
                    <tr key={school.ncessch} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-1.5 pr-2">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">
                          {school.schoolName}
                        </p>
                        <span className="text-gray-400">
                          {school.schoolLevel != null && SCHOOL_LEVEL_LABELS[school.schoolLevel]
                            ? SCHOOL_LEVEL_LABELS[school.schoolLevel]
                            : ""}
                          {school.lograde && school.higrade ? ` ${school.lograde}–${school.higrade}` : ""}
                        </span>
                      </td>
                      <td className="py-1.5 px-1 text-right text-gray-700 tabular-nums">
                        {school.enrollment?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-1.5 px-1">
                        <TitleIBadge status={school.titleIStatus} />
                      </td>
                      <td className="py-1.5 pl-1 text-right text-gray-700 tabular-nums">
                        {frplPct != null ? `${frplPct}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TitleIBadge({ status }: { status: number | null }) {
  if (status == null) return <span className="text-gray-300">—</span>;

  const label = TITLE_I_LABELS[status] ?? `Code ${status}`;
  const isEligible = status !== 6;

  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
        status === 5
          ? "bg-[#403770]/10 text-[#403770]"
          : status === 2
            ? "bg-[#5B8DB8]/10 text-[#5B8DB8]"
            : isEligible
              ? "bg-gray-100 text-gray-600"
              : "bg-gray-50 text-gray-400"
      }`}
    >
      {label}
    </span>
  );
}
