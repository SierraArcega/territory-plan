"use client";

import { useSchoolsByDistrict } from "@/lib/api";

const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Primary",
  2: "Middle",
  3: "High",
  4: "Other",
};

interface CharterSchoolsProps {
  leaid: string;
}

export default function CharterSchools({ leaid }: CharterSchoolsProps) {
  const { data, isLoading } = useSchoolsByDistrict(leaid);

  const charterSchools = data?.schools.filter((s) => s.charter === 1) || [];

  if (isLoading) {
    return (
      <div className="px-3 py-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Charter Schools
        </h3>
        <div className="animate-pulse h-8 bg-gray-100 rounded" />
      </div>
    );
  }

  if (charterSchools.length === 0) return null;

  const totalCharterEnrollment = charterSchools.reduce(
    (sum, s) => sum + (s.enrollment || 0),
    0
  );

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Charter Schools
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F37167]/10 text-[#F37167]">
          {charterSchools.length}
        </span>
      </div>
      {totalCharterEnrollment > 0 && (
        <p className="text-xs text-gray-500 mb-2">
          Total charter enrollment: {totalCharterEnrollment.toLocaleString()}
        </p>
      )}
      <div className="space-y-1">
        {charterSchools.slice(0, 10).map((school) => (
          <div
            key={school.ncessch}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {school.schoolName}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {school.schoolLevel && SCHOOL_LEVEL_LABELS[school.schoolLevel] && (
                  <span>{SCHOOL_LEVEL_LABELS[school.schoolLevel]}</span>
                )}
                {school.lograde && school.higrade && (
                  <span>Grades {school.lograde}-{school.higrade}</span>
                )}
              </div>
            </div>
            <div className="text-right ml-2 shrink-0">
              {school.enrollment != null && (
                <span className="text-sm font-medium text-gray-700">
                  {school.enrollment.toLocaleString()}
                </span>
              )}
              {school.enrollmentHistory && school.enrollmentHistory.length > 1 && (
                <MiniSparkline data={school.enrollmentHistory} />
              )}
            </div>
          </div>
        ))}
        {charterSchools.length > 10 && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{charterSchools.length - 10} more
          </p>
        )}
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
