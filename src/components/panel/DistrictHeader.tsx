"use client";

import type { District, FullmindData, Tag } from "@/lib/api";

interface DistrictHeaderProps {
  district: District;
  fullmindData: FullmindData | null;
  tags: Tag[];
}

function formatEnrollment(enrollment: number | null): string {
  if (!enrollment) return "N/A";
  return enrollment.toLocaleString();
}

function formatGrades(lograde: string | null, higrade: string | null): string {
  if (!lograde && !higrade) return "N/A";
  const lo = lograde || "?";
  const hi = higrade || "?";
  // Convert codes to readable
  const gradeMap: Record<string, string> = {
    PK: "Pre-K",
    KG: "K",
    "01": "1",
    "02": "2",
    "03": "3",
    "04": "4",
    "05": "5",
    "06": "6",
    "07": "7",
    "08": "8",
    "09": "9",
    "10": "10",
    "11": "11",
    "12": "12",
    UG: "Ungraded",
  };
  return `${gradeMap[lo] || lo} - ${gradeMap[hi] || hi}`;
}

export default function DistrictHeader({
  district,
  fullmindData,
  tags,
}: DistrictHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-b from-[#FFFCFA] to-white">
      {/* District Name */}
      <h2 className="text-xl font-bold text-[#403770] pr-8 leading-tight">
        {district.name}
      </h2>

      {/* State, County & LEAID */}
      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
        <span>{district.stateAbbrev}</span>
        {district.countyName && (
          <>
            <span>•</span>
            <span>{district.countyName} County</span>
          </>
        )}
        <span>•</span>
        <span className="font-mono">{district.leaid}</span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* District Info */}
      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
        <div>
          <span className="text-gray-500">Enrollment</span>
          <p className="font-medium text-[#403770]">
            {formatEnrollment(district.enrollment)}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Grades</span>
          <p className="font-medium text-[#403770]">
            {formatGrades(district.lograde, district.higrade)}
          </p>
        </div>
      </div>

      {/* Sales Executive */}
      {fullmindData?.salesExecutive && (
        <div className="mt-3 text-sm">
          <span className="text-gray-500">Sales Executive</span>
          <p className="font-medium text-[#403770]">
            {fullmindData.salesExecutive}
          </p>
        </div>
      )}

      {/* Account Name (if different from district name) */}
      {fullmindData?.accountName &&
        fullmindData.accountName !== district.name && (
          <div className="mt-3 text-sm">
            <span className="text-gray-500">Account Name</span>
            <p className="font-medium text-[#403770]">
              {fullmindData.accountName}
            </p>
          </div>
        )}
    </div>
  );
}
