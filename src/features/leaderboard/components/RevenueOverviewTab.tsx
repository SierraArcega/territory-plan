"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn, RevenueTableTotals } from "./RevenueTable";
import { useLeaderboard } from "../lib/queries";
import type { LeaderboardEntry } from "../lib/types";

type ForwardFYSelection = "current" | "next" | "both";
type BackwardFYSelection = "current" | "prior" | "both";

/** Convert school year "2025-26" to display "FY26" */
function formatFYLabel(schoolYr: string): string {
  const parts = schoolYr.split("-");
  return `FY${parts[1] ?? schoolYr}`;
}

/** Compute the display value for pipeline based on FY selection */
function getPipelineValue(entry: LeaderboardEntry, fy: ForwardFYSelection): number {
  if (fy === "current") return entry.pipelineCurrentFY;
  if (fy === "next") return entry.pipelineNextFY;
  return entry.pipelineCurrentFY + entry.pipelineNextFY;
}

/** Compute the display value for targeted based on FY selection */
function getTargetedValue(entry: LeaderboardEntry, fy: ForwardFYSelection): number {
  if (fy === "current") return entry.targetedCurrentFY;
  if (fy === "next") return entry.targetedNextFY;
  return entry.targetedCurrentFY + entry.targetedNextFY;
}

/** Compute the display value for revenue based on backward FY selection (current/prior/both) */
function getRevenueValue(entry: LeaderboardEntry, fy: BackwardFYSelection): number {
  if (fy === "current") return entry.revenueCurrentFY;
  if (fy === "prior") return entry.revenuePriorFY;
  return entry.revenueCurrentFY + entry.revenuePriorFY;
}

/** Compute the display value for min purchases based on backward FY selection */
function getMinPurchasesValue(entry: LeaderboardEntry, fy: BackwardFYSelection): number {
  if (fy === "current") return entry.minPurchasesCurrentFY;
  if (fy === "prior") return entry.minPurchasesPriorFY;
  return entry.minPurchasesCurrentFY + entry.minPurchasesPriorFY;
}

export default function RevenueOverviewTab() {
  // Forward-looking selectors (pipeline/targeted): current/next/both
  const [pipelineFY, setPipelineFY] = useState<ForwardFYSelection>("both");
  const [targetedFY, setTargetedFY] = useState<ForwardFYSelection>("both");
  // Backward-looking selectors (revenue/min purchases): current/prior/both
  const [revenueFY, setRevenueFY] = useState<BackwardFYSelection>("current");
  const [minPurchasesFY, setMinPurchasesFY] = useState<BackwardFYSelection>("prior");

  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: leaderboard, isLoading } = useLeaderboard();

  // Project entries with computed values based on FY selection.
  // `revenue` and `priorYearRevenue` are overridden so the sort logic
  // reads the projected values for those columns.
  const projectedEntries = useMemo(() => {
    return (leaderboard?.entries ?? []).map((entry) => ({
      ...entry,
      revenue: getRevenueValue(entry, revenueFY),
      priorYearRevenue: getMinPurchasesValue(entry, minPurchasesFY),
      pipeline: getPipelineValue(entry, pipelineFY),
      revenueTargeted: getTargetedValue(entry, targetedFY),
    }));
  }, [leaderboard?.entries, revenueFY, minPurchasesFY, pipelineFY, targetedFY]);

  const projectedTotals = useMemo<RevenueTableTotals | undefined>(() => {
    const t = leaderboard?.teamTotals;
    if (!t) return undefined;

    const projectForward = (cur: number, next: number, fy: ForwardFYSelection): number => {
      if (fy === "current") return cur;
      if (fy === "next") return next;
      return cur + next;
    };

    const projectBackward = (cur: number, prior: number, fy: BackwardFYSelection): number => {
      if (fy === "current") return cur;
      if (fy === "prior") return prior;
      return cur + prior;
    };

    return {
      revenue: projectBackward(t.revenueCurrentFY, t.revenuePriorFY, revenueFY),
      priorYearRevenue: projectBackward(
        t.minPurchasesCurrentFY,
        t.minPurchasesPriorFY,
        minPurchasesFY
      ),
      pipeline: projectForward(t.pipelineCurrentFY, t.pipelineNextFY, pipelineFY),
      revenueTargeted: projectForward(t.targetedCurrentFY, t.targetedNextFY, targetedFY),
      unassignedRevenue: projectBackward(
        t.unassignedRevenueCurrentFY,
        t.unassignedRevenuePriorFY,
        revenueFY
      ),
      unassignedPriorYearRevenue: projectBackward(
        t.unassignedMinPurchasesCurrentFY,
        t.unassignedMinPurchasesPriorFY,
        minPurchasesFY
      ),
      unassignedPipeline: projectForward(
        t.unassignedPipelineCurrentFY,
        t.unassignedPipelineNextFY,
        pipelineFY
      ),
      unassignedRevenueTargeted: projectForward(
        t.unassignedTargetedCurrentFY,
        t.unassignedTargetedNextFY,
        targetedFY
      ),
    };
  }, [leaderboard?.teamTotals, revenueFY, minPurchasesFY, pipelineFY, targetedFY]);

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

  const forwardFYOptions: { value: ForwardFYSelection; label: string }[] = fy
    ? [
        { value: "current", label: formatFYLabel(fy.currentFY) },
        { value: "next", label: formatFYLabel(fy.nextFY) },
        { value: "both", label: "Both" },
      ]
    : [];

  const backwardFYOptions: { value: BackwardFYSelection; label: string }[] = fy
    ? [
        { value: "current", label: formatFYLabel(fy.currentFY) },
        { value: "prior", label: formatFYLabel(fy.priorFY) },
        { value: "both", label: "Both" },
      ]
    : [];

  const forwardRangeLabel = (sel: ForwardFYSelection): string | null => {
    if (!fy) return null;
    if (sel === "current") return formatFYLabel(fy.currentFY);
    if (sel === "next") return formatFYLabel(fy.nextFY);
    return `${formatFYLabel(fy.currentFY)}+${formatFYLabel(fy.nextFY)}`;
  };

  const backwardRangeLabel = (sel: BackwardFYSelection): string | null => {
    if (!fy) return null;
    if (sel === "current") return formatFYLabel(fy.currentFY);
    if (sel === "prior") return formatFYLabel(fy.priorFY);
    return `${formatFYLabel(fy.priorFY)}+${formatFYLabel(fy.currentFY)}`;
  };

  const columnLabels: Partial<Record<RevenueSortColumn, string>> | undefined = fy
    ? {
        revenue: `Revenue (${backwardRangeLabel(revenueFY)})`,
        priorYearRevenue: `Min Purchases (${backwardRangeLabel(minPurchasesFY)})`,
        pipeline: `Pipeline (${forwardRangeLabel(pipelineFY)})`,
        revenueTargeted: `Targeted (${forwardRangeLabel(targetedFY)})`,
      }
    : undefined;

  return (
    <div>
      {/* FY selectors */}
      {fy && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 bg-[#F7F5FA] border-b border-[#EFEDF5]">
          <FYSelect
            label="Revenue"
            value={revenueFY}
            options={backwardFYOptions}
            onChange={(v) => setRevenueFY(v as BackwardFYSelection)}
          />
          <FYSelect
            label="Min Purchases"
            value={minPurchasesFY}
            options={backwardFYOptions}
            onChange={(v) => setMinPurchasesFY(v as BackwardFYSelection)}
          />
          <FYSelect
            label="Pipeline"
            value={pipelineFY}
            options={forwardFYOptions}
            onChange={(v) => setPipelineFY(v as ForwardFYSelection)}
          />
          <FYSelect
            label="Targeted"
            value={targetedFY}
            options={forwardFYOptions}
            onChange={(v) => setTargetedFY(v as ForwardFYSelection)}
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
        columnLabels={columnLabels}
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
