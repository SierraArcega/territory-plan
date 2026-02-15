"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail, useRemoveDistrictFromPlan } from "@/lib/api";

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `${value.toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `${value.toFixed(1)}:1`;
}

const LOCALE_LABELS: Record<number, string> = {
  1: "City - Large",
  2: "City - Midsize",
  3: "City - Small",
  4: "Suburb - Large",
  5: "Suburb - Midsize",
  6: "Suburb - Small",
  7: "Town - Fringe",
  8: "Town - Distant",
  9: "Town - Remote",
  10: "Rural - Fringe",
  11: "Rural - Distant",
  12: "Rural - Remote",
};

export default function DistrictCard({ leaid }: { leaid: string }) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const setPlanSection = useMapV2Store((s) => s.setPlanSection);

  const { data, isLoading } = useDistrictDetail(leaid);
  const removeMutation = useRemoveDistrictFromPlan();

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-xs text-gray-400">
        District not found
      </div>
    );
  }

  const { district, educationData } = data;

  const localeLabel = district.urbanCentricLocale
    ? LOCALE_LABELS[district.urbanCentricLocale] || `Code ${district.urbanCentricLocale}`
    : null;

  const subtitleParts = [
    district.stateAbbrev,
    district.countyName ? `${district.countyName} County` : null,
    localeLabel,
  ].filter(Boolean);

  const handleRemove = () => {
    if (!activePlanId) return;
    removeMutation.mutate(
      { planId: activePlanId, leaid },
      {
        onSuccess: () => {
          setShowRemoveConfirm(false);
          closeRightPanel();
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 leading-tight">
          {district.name}
        </h3>
        {subtitleParts.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">
            {subtitleParts.join(" \u00b7 ")}
          </p>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatCard
          label="Enrollment"
          value={formatNumber(district.enrollment)}
        />
        <StatCard
          label="Schools"
          value={formatNumber(district.numberOfSchools)}
        />
        <StatCard
          label="Student:Teacher"
          value={
            educationData?.teachersFte && district.enrollment
              ? formatRatio(district.enrollment / educationData.teachersFte)
              : "\u2014"
          }
        />
        <StatCard
          label="% FRPL"
          value={formatPercent(educationData?.childrenPovertyPercent)}
        />
        <StatCard
          label="Grad Rate"
          value={formatPercent(educationData?.graduationRateTotal)}
        />
      </div>

      {/* Action buttons */}
      <div className="space-y-1.5">
        <ActionButton
          label="Add Task"
          icon={
            <path
              d="M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          }
          onClick={() => openRightPanel({ type: "task_form", id: leaid })}
        />
        <ActionButton
          label="View Contacts"
          icon={
            <path
              d="M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          }
          onClick={() => setPlanSection("contacts")}
        />
        <ActionButton
          label="Open Full Profile"
          icon={
            <path
              d="M5 3H3V13H13V11M8 8L13 3M13 3H9M13 3V7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          }
          onClick={() => selectDistrict(leaid)}
        />

        {/* Remove from plan */}
        {!showRemoveConfirm ? (
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-red-500 hover:bg-red-50 transition-colors text-xs font-medium"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0"
            >
              <path
                d="M3 5H13M5 5V3C5 2.4 5.4 2 6 2H10C10.6 2 11 2.4 11 3V5M6 8V12M10 8V12M4 5L5 14H11L12 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Remove from Plan
          </button>
        ) : (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
            <p className="text-xs text-red-600 font-medium">
              Remove this district from the plan?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRemove}
                disabled={removeMutation.isPending}
                className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {removeMutation.isPending ? "Removing..." : "Remove"}
              </button>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className="text-xs font-semibold text-gray-700">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 text-gray-400"
      >
        {icon}
      </svg>
      {label}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div>
        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mt-1.5 animate-pulse" />
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg bg-gray-50 p-2 animate-pulse">
            <div className="h-2 bg-gray-200 rounded w-2/3 mb-1.5" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Action buttons skeleton */}
      <div className="space-y-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-9 bg-gray-50 rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
