"use client";

import { useMemo } from "react";
import { useSchoolsByDistrict } from "@/lib/api";

const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Primary",
  2: "Middle",
  3: "High",
  4: "Other",
};

interface SchoolsTabProps {
  leaid: string;
}

export default function SchoolsTab({ leaid }: SchoolsTabProps) {
  const { data, isLoading } = useSchoolsByDistrict(leaid);

  const schools = useMemo(() => {
    if (!data?.schools) return [];
    return [...data.schools].sort((a, b) => {
      const levelA = a.schoolLevel ?? 99;
      const levelB = b.schoolLevel ?? 99;
      if (levelA !== levelB) return levelA - levelB;
      return (a.schoolName || "").localeCompare(b.schoolName || "");
    });
  }, [data?.schools]);

  const charterCount = useMemo(
    () => schools.filter((s) => s.charter === 1).length,
    [schools]
  );

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (schools.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No schools found
      </div>
    );
  }

  return (
    <div className="p-3">
      <p className="text-xs text-gray-500 mb-3">
        {schools.length} school{schools.length !== 1 ? "s" : ""}
        {charterCount > 0 && (
          <span> ({charterCount} charter)</span>
        )}
      </p>

      <div className="space-y-1">
        {schools.map((school) => (
          <div
            key={school.ncessch}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {school.schoolName}
                </p>
                {school.charter === 1 && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#F37167]/10 text-[#F37167]">
                    Charter
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {school.schoolLevel != null &&
                  SCHOOL_LEVEL_LABELS[school.schoolLevel] && (
                    <span>{SCHOOL_LEVEL_LABELS[school.schoolLevel]}</span>
                  )}
                {school.lograde && school.higrade && (
                  <span>
                    Grades {school.lograde}–{school.higrade}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right ml-2 shrink-0">
              {school.enrollment != null && (
                <span className="text-sm font-medium text-gray-700">
                  {school.enrollment.toLocaleString()}
                </span>
              )}
              {school.enrollmentHistory &&
                school.enrollmentHistory.length > 1 && (
                  <MiniSparkline data={school.enrollmentHistory} />
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniSparkline({
  data,
}: {
  data: { year: number; enrollment: number | null }[];
}) {
  const values = data
    .filter((d) => d.enrollment != null)
    .map((d) => d.enrollment!);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 40;
  const height = 16;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trend = values[values.length - 1] - values[0];
  const color = trend >= 0 ? "#22C55E" : "#EF4444";

  return (
    <svg width={width} height={height} className="mt-0.5">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
