"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn } from "./RevenueTable";
import { useLeaderboard } from "../lib/queries";
import type { LeaderboardEntry } from "../lib/types";

type FYSelection = "current" | "next" | "both";

/** Convert school year "2025-26" to display "FY26" */
function formatFYLabel(schoolYr: string): string {
  const parts = schoolYr.split("-");
  return `FY${parts[1] ?? schoolYr}`;
}

/** Compute the display value for pipeline based on FY selection */
function getPipelineValue(entry: LeaderboardEntry, fy: FYSelection): number {
  if (fy === "current") return entry.pipelineCurrentFY;
  if (fy === "next") return entry.pipelineNextFY;
  return entry.pipelineCurrentFY + entry.pipelineNextFY;
}

/** Compute the display value for targeted based on FY selection */
function getTargetedValue(entry: LeaderboardEntry, fy: FYSelection): number {
  if (fy === "current") return entry.targetedCurrentFY;
  if (fy === "next") return entry.targetedNextFY;
  return entry.targetedCurrentFY + entry.targetedNextFY;
}

export default function RevenueOverviewTab() {
  const [pipelineFY, setPipelineFY] = useState<FYSelection>("both");
  const [targetedFY, setTargetedFY] = useState<FYSelection>("both");
  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: leaderboard, isLoading } = useLeaderboard();

  // Project entries with computed pipeline/targeted values based on FY selection
  const projectedEntries = useMemo(() => {
    return (leaderboard?.entries ?? []).map((entry) => ({
      ...entry,
      pipeline: getPipelineValue(entry, pipelineFY),
      revenueTargeted: getTargetedValue(entry, targetedFY),
    }));
  }, [leaderboard?.entries, pipelineFY, targetedFY]);

  const sortedEntries = useMemo(() => {
    return [...projectedEntries].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [projectedEntries, sortColumn, sortDirection]);

  const handleSort = (column: RevenueSortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#403770] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fy = leaderboard?.fiscalYears;
  const fyOptions: { value: FYSelection; label: string }[] = fy
    ? [
        { value: "current", label: formatFYLabel(fy.currentFY) },
        { value: "next", label: formatFYLabel(fy.nextFY) },
        { value: "both", label: "Both" },
      ]
    : [];

  return (
    <div>
      {/* FY selectors */}
      {fy && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-[#F7F5FA] border-b border-[#EFEDF5]">
          <FYSelect
            label="Pipeline"
            value={pipelineFY}
            options={fyOptions}
            onChange={(v) => setPipelineFY(v as FYSelection)}
          />
          <FYSelect
            label="Targeted"
            value={targetedFY}
            options={fyOptions}
            onChange={(v) => setTargetedFY(v as FYSelection)}
          />
        </div>
      )}

      <RevenuePodium entries={sortedEntries} />
      <RevenueTable
        entries={sortedEntries}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  );
}

function FYSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A849A]">
        {label}:
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none text-xs font-semibold text-[#403770] bg-white border border-[#E2DEEC] rounded-md pl-2.5 pr-6 py-1 cursor-pointer hover:border-[#403770] transition-colors focus:outline-none focus:ring-1 focus:ring-[#403770]"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8A849A] pointer-events-none" />
      </div>
    </div>
  );
}
