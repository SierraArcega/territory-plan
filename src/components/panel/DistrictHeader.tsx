"use client";

import type { District, FullmindData } from "@/lib/api";

interface DistrictHeaderProps {
  district: District;
  fullmindData: FullmindData | null;
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
}: DistrictHeaderProps) {
  const isCustomer = fullmindData?.isCustomer || false;
  const hasOpenPipeline = fullmindData?.hasOpenPipeline || false;

  return (
    <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-b from-[#FFFCFA] to-white">
      {/* District Name */}
      <h2 className="text-xl font-bold text-[#403770] pr-8 leading-tight">
        {district.name}
      </h2>

      {/* State & LEAID */}
      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
        <span>{district.stateAbbrev}</span>
        <span>•</span>
        <span className="font-mono">{district.leaid}</span>
      </div>

      {/* Status Chips */}
      <div className="flex flex-wrap gap-2 mt-3">
        {isCustomer && (
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-[#F37167] text-white">
            <svg
              className="w-3 h-3 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Customer
          </span>
        )}
        {hasOpenPipeline && (
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-[#6EA3BE] text-white">
            <svg
              className="w-3 h-3 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
            </svg>
            Pipeline
          </span>
        )}
        {!isCustomer && !hasOpenPipeline && (
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
            No Fullmind Data
          </span>
        )}
      </div>

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
