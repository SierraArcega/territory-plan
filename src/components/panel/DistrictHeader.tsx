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

      {/* External Links */}
      {(district.websiteUrl || district.jobBoardUrl) && (
        <div className="flex items-center gap-2 mt-2">
          {district.websiteUrl && (
            <a
              href={district.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 hover:bg-[#403770] hover:text-white text-gray-600 transition-colors"
              title="Visit Website"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </a>
          )}
          {district.jobBoardUrl && (
            <a
              href={district.jobBoardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 hover:bg-[#403770] hover:text-white text-gray-600 transition-colors"
              title="View Job Board"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </a>
          )}
        </div>
      )}

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
      <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
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
        <div>
          <span className="text-gray-500">Schools</span>
          <p className="font-medium text-[#403770]">
            {district.numberOfSchools?.toLocaleString() ?? "N/A"}
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
