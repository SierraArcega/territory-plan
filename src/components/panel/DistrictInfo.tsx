"use client";

import { useState } from "react";
import type { District } from "@/lib/api";

interface DistrictInfoProps {
  district: District;
}

// Locale code to display text and color mapping
const LOCALE_MAP: Record<number, { text: string; color: string }> = {
  11: { text: "City: Large", color: "bg-blue-100 text-blue-700" },
  12: { text: "City: Midsize", color: "bg-blue-100 text-blue-700" },
  13: { text: "City: Small", color: "bg-blue-100 text-blue-700" },
  21: { text: "Suburb: Large", color: "bg-teal-100 text-teal-700" },
  22: { text: "Suburb: Midsize", color: "bg-teal-100 text-teal-700" },
  23: { text: "Suburb: Small", color: "bg-teal-100 text-teal-700" },
  31: { text: "Town: Fringe", color: "bg-orange-100 text-orange-700" },
  32: { text: "Town: Distant", color: "bg-orange-100 text-orange-700" },
  33: { text: "Town: Remote", color: "bg-orange-100 text-orange-700" },
  41: { text: "Rural: Fringe", color: "bg-green-100 text-green-700" },
  42: { text: "Rural: Distant", color: "bg-green-100 text-green-700" },
  43: { text: "Rural: Remote", color: "bg-green-100 text-green-700" },
};

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return value.toLocaleString();
}

function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, "");
  // Format as (xxx) xxx-xxxx if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Otherwise return as-is
  return phone;
}

export default function DistrictInfo({ district }: DistrictInfoProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasAddress =
    district.streetLocation ||
    district.cityLocation ||
    district.stateLocation ||
    district.zipLocation;
  const hasAnyData =
    hasAddress ||
    district.phone ||
    district.countyName ||
    district.urbanCentricLocale ||
    district.numberOfSchools ||
    district.ellStudents ||
    district.specEdStudents;

  // Don't render if no data
  if (!hasAnyData) {
    return null;
  }

  const formattedPhone = formatPhone(district.phone);
  const locale = district.urbanCentricLocale
    ? LOCALE_MAP[district.urbanCentricLocale]
    : null;

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">District Info</h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3 text-sm">
          {/* Physical Address */}
          {hasAddress && (
            <div>
              {district.streetLocation && (
                <p className="text-gray-700">{district.streetLocation}</p>
              )}
              {(district.cityLocation ||
                district.stateLocation ||
                district.zipLocation) && (
                <p className="text-gray-700">
                  {[
                    district.cityLocation,
                    district.stateLocation
                      ? `${district.stateLocation} ${district.zipLocation || ""}`
                      : district.zipLocation,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Phone Number */}
          {formattedPhone && (
            <div>
              <a
                href={`tel:${district.phone}`}
                className="text-[#6EA3BE] hover:text-[#5a8ba3] hover:underline"
              >
                {formattedPhone}
              </a>
            </div>
          )}

          {/* County Name */}
          {district.countyName && (
            <div>
              <span className="text-gray-500">County: </span>
              <span className="text-gray-700">{district.countyName}</span>
            </div>
          )}

          {/* Locale Badge */}
          {locale && (
            <div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${locale.color}`}
              >
                {locale.text}
              </span>
            </div>
          )}

          {/* Number of Schools */}
          {district.numberOfSchools !== null && (
            <div>
              <span className="text-gray-500">Schools: </span>
              <span className="text-gray-700 font-medium">
                {formatNumber(district.numberOfSchools)}
              </span>
            </div>
          )}

          {/* Student Demographics */}
          {(district.ellStudents !== null ||
            district.specEdStudents !== null) && (
            <div>
              <p className="text-gray-500 mb-1">Student Demographics:</p>
              <div className="pl-3 space-y-0.5">
                {district.ellStudents !== null && (
                  <p className="text-gray-700">
                    <span className="text-gray-500">ELL Students:</span>{" "}
                    <span className="font-medium">
                      {formatNumber(district.ellStudents)}
                    </span>
                  </p>
                )}
                {district.specEdStudents !== null && (
                  <p className="text-gray-700">
                    <span className="text-gray-500">Special Ed:</span>{" "}
                    <span className="font-medium">
                      {formatNumber(district.specEdStudents)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
