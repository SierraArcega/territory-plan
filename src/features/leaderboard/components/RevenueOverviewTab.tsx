"use client";

import { useState, useMemo, useCallback } from "react";
import { Check } from "lucide-react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn, RevenueTableTotals } from "./RevenueTable";
import { useLeaderboard } from "../lib/queries";
import type { LeaderboardEntry } from "../lib/types";

interface FYChecked {
  prior: boolean;
  current: boolean;
  next: boolean;
}

const DEFAULT_FY_CHECKED: FYChecked = { prior: false, current: true, next: true };

/** Convert school year "2025-26" to display "FY26" */
function formatFYLabel(schoolYr: string): string {
  const parts = schoolYr.split("-");
  return `FY${parts[1] ?? schoolYr}`;
}

/** Sum the checked FY values for pipeline */
function getPipelineValue(entry: LeaderboardEntry, checked: FYChecked): number {
  let sum = 0;
  if (checked.prior) sum += entry.pipelinePriorFY;
  if (checked.current) sum += entry.pipelineCurrentFY;
  if (checked.next) sum += entry.pipelineNextFY;
  return sum;
}

/** Sum the checked FY values for targeted */
function getTargetedValue(entry: LeaderboardEntry, checked: FYChecked): number {
  let sum = 0;
  if (checked.prior) sum += entry.targetedPriorFY;
  if (checked.current) sum += entry.targetedCurrentFY;
  if (checked.next) sum += entry.targetedNextFY;
  return sum;
}

/** Count how many FYs are checked */
function checkedCount(fy: FYChecked): number {
  return (fy.prior ? 1 : 0) + (fy.current ? 1 : 0) + (fy.next ? 1 : 0);
}

export default function RevenueOverviewTab() {
  const [pipelineFY, setPipelineFY] = useState<FYChecked>({ ...DEFAULT_FY_CHECKED });
  const [targetedFY, setTargetedFY] = useState<FYChecked>({ ...DEFAULT_FY_CHECKED });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: leaderboard, isLoading } = useLeaderboard();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const handleToggle = useCallback(
    (
      current: FYChecked,
      setter: (fy: FYChecked) => void,
      key: keyof FYChecked
    ) => {
      if (current[key] && checkedCount(current) === 1) {
        showToast("At least one fiscal year must be selected");
        return;
      }
      setter({ ...current, [key]: !current[key] });
    },
    [showToast]
  );

  // Project entries with computed pipeline/targeted values based on FY selection
  const projectedEntries = useMemo(() => {
    return (leaderboard?.entries ?? []).map((entry) => ({
      ...entry,
      pipeline: getPipelineValue(entry, pipelineFY),
      revenueTargeted: getTargetedValue(entry, targetedFY),
    }));
  }, [leaderboard?.entries, pipelineFY, targetedFY]);

  const projectedTotals = useMemo<RevenueTableTotals | undefined>(() => {
    const t = leaderboard?.teamTotals;
    if (!t) return undefined;

    const sumFY = (
      prior: number,
      current: number,
      next: number,
      checked: FYChecked
    ): number => {
      let sum = 0;
      if (checked.prior) sum += prior;
      if (checked.current) sum += current;
      if (checked.next) sum += next;
      return sum;
    };

    return {
      revenue: t.revenue,
      priorYearRevenue: t.priorYearRevenue,
      pipeline: sumFY(t.pipelinePriorFY, t.pipelineCurrentFY, t.pipelineNextFY, pipelineFY),
      revenueTargeted: sumFY(t.targetedPriorFY, t.targetedCurrentFY, t.targetedNextFY, targetedFY),
      unassignedRevenue: t.unassignedRevenue,
      unassignedPriorYearRevenue: t.unassignedPriorYearRevenue,
      unassignedPipeline: sumFY(
        t.unassignedPipelinePriorFY,
        t.unassignedPipelineCurrentFY,
        t.unassignedPipelineNextFY,
        pipelineFY
      ),
      unassignedRevenueTargeted: sumFY(
        t.unassignedTargetedPriorFY,
        t.unassignedTargetedCurrentFY,
        t.unassignedTargetedNextFY,
        targetedFY
      ),
    };
  }, [leaderboard?.teamTotals, pipelineFY, targetedFY]);

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

  const fyOptions: { key: keyof FYChecked; label: string; fyLabel: string }[] = fy
    ? [
        { key: "prior", label: "Previous", fyLabel: formatFYLabel(fy.priorFY) },
        { key: "current", label: "Current", fyLabel: formatFYLabel(fy.currentFY) },
        { key: "next", label: "Next", fyLabel: formatFYLabel(fy.nextFY) },
      ]
    : [];

  return (
    <div className="relative">
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-[#403770] text-white text-xs font-medium rounded-lg shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* FY checkbox selectors */}
      {fy && (
        <div className="flex flex-col gap-2 px-4 py-2.5 bg-[#F7F5FA] border-b border-[#EFEDF5]">
          <FYCheckboxGroup
            label="Pipeline"
            options={fyOptions}
            checked={pipelineFY}
            onToggle={(key) => handleToggle(pipelineFY, setPipelineFY, key)}
          />
          <FYCheckboxGroup
            label="Targeted"
            options={fyOptions}
            checked={targetedFY}
            onToggle={(key) => handleToggle(targetedFY, setTargetedFY, key)}
          />
        </div>
      )}

      <RevenuePodium entries={sortedEntries} />
      <RevenueTable
        entries={sortedEntries}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        teamTotals={projectedTotals}
      />
    </div>
  );
}

function FYCheckboxGroup({
  label,
  options,
  checked,
  onToggle,
}: {
  label: string;
  options: { key: keyof FYChecked; label: string; fyLabel: string }[];
  checked: FYChecked;
  onToggle: (key: keyof FYChecked) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A849A] w-16">
        {label}:
      </span>
      <div className="flex items-center gap-2.5">
        {options.map((opt) => {
          const isChecked = checked[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onToggle(opt.key)}
              className="flex items-center gap-1.5 group"
            >
              <div
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                  isChecked
                    ? "bg-[#403770] border-[#403770]"
                    : "bg-white border-[#D4CFE2] group-hover:border-[#403770]"
                }`}
              >
                {isChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <span className="text-xs font-medium text-[#403770]">
                {opt.label}
              </span>
              <span className="text-[10px] text-[#8A80A8]">
                ({opt.fyLabel})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
