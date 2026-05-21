"use client";

import { useState, useMemo } from "react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn, RevenueTableTotals } from "./RevenueTable";
import { useLeaderboard } from "../lib/queries";
import type { LeaderboardEntry } from "../lib/types";

/** Convert school year "2025-26" to display "FY26" */
function formatFYLabel(schoolYr: string): string {
  const parts = schoolYr.split("-");
  return `FY${parts[1] ?? schoolYr}`;
}

type Period = "prior" | "current" | "next";

function getColumnValues(entry: LeaderboardEntry, period: Period) {
  switch (period) {
    case "prior":
      return {
        revenue: entry.revenuePriorFY,
        minPurchases: entry.minPurchasesPriorFY,
        pipeline: entry.pipelinePriorFY,
        targeted: entry.targetedPriorFY,
      };
    case "current":
      return {
        revenue: entry.revenueCurrentFY,
        minPurchases: entry.minPurchasesCurrentFY,
        pipeline: entry.pipelineCurrentFY,
        targeted: entry.targetedCurrentFY,
      };
    case "next":
      return {
        revenue: entry.revenueNextFY,
        minPurchases: entry.minPurchasesNextFY,
        pipeline: entry.pipelineNextFY,
        targeted: entry.targetedNextFY,
      };
  }
}

export default function RevenueOverviewTab() {
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === "undefined") return "current";
    return (sessionStorage.getItem("leaderboard-period") as Period) ?? "current";
  });

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    sessionStorage.setItem("leaderboard-period", p);
  };

  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: leaderboard, isLoading } = useLeaderboard();

  // Project entries with computed values based on period selection.
  // `revenue` and `priorYearRevenue` are overridden so the sort logic
  // reads the projected values for those columns.
  const projectedEntries = useMemo(() => {
    return (leaderboard?.entries ?? []).map((entry) => {
      const vals = getColumnValues(entry, period);
      return {
        ...entry,
        revenue: vals.revenue,
        priorYearRevenue: vals.minPurchases,
        pipeline: vals.pipeline,
        revenueTargeted: vals.targeted,
      };
    });
  }, [leaderboard?.entries, period]);

  const projectedTotals = useMemo<RevenueTableTotals | undefined>(() => {
    const t = leaderboard?.teamTotals;
    if (!t) return undefined;

    const maps: Record<Period, RevenueTableTotals> = {
      prior: {
        revenue: t.revenuePriorFY,
        priorYearRevenue: t.minPurchasesPriorFY,
        pipeline: t.pipelinePriorFY,
        revenueTargeted: t.targetedPriorFY,
        unassignedRevenue: t.unassignedRevenuePriorFY,
        unassignedPriorYearRevenue: t.unassignedMinPurchasesPriorFY,
        unassignedPipeline: t.unassignedPipelinePriorFY,
        unassignedRevenueTargeted: t.unassignedTargetedPriorFY,
      },
      current: {
        revenue: t.revenueCurrentFY,
        priorYearRevenue: t.minPurchasesCurrentFY,
        pipeline: t.pipelineCurrentFY,
        revenueTargeted: t.targetedCurrentFY,
        unassignedRevenue: t.unassignedRevenueCurrentFY,
        unassignedPriorYearRevenue: t.unassignedMinPurchasesCurrentFY,
        unassignedPipeline: t.unassignedPipelineCurrentFY,
        unassignedRevenueTargeted: t.unassignedTargetedCurrentFY,
      },
      next: {
        revenue: t.revenueNextFY,
        priorYearRevenue: t.minPurchasesNextFY,
        pipeline: t.pipelineNextFY,
        revenueTargeted: t.targetedNextFY,
        unassignedRevenue: t.unassignedRevenueNextFY,
        unassignedPriorYearRevenue: t.unassignedMinPurchasesNextFY,
        unassignedPipeline: t.unassignedPipelineNextFY,
        unassignedRevenueTargeted: t.unassignedTargetedNextFY,
      },
    };
    return maps[period];
  }, [leaderboard?.teamTotals, period]);

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

  const columnLabels: Partial<Record<RevenueSortColumn, string>> = {
    revenue: "Revenue",
    priorYearRevenue: "Min Purchases",
    pipeline: "Pipeline",
    revenueTargeted: "Targeted",
  };

  const columnTooltips: Partial<Record<RevenueSortColumn, string>> = {
    revenue: "Sum of Subscriptions + Sessions",
    priorYearRevenue: "Contracted floor per contract, summed across distinct contracts",
    pipeline: "Sum of Open Opportunities (stages 0–5)",
    revenueTargeted: "Sum of Plan District Targets minus Pipeline (untapped target)",
  };

  return (
    <div>
      {/* Period pill selector */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F7F5FA] border-b border-[#EFEDF5]">
        {(["prior", "current", "next"] as Period[]).map((p) => {
          const label =
            p === "prior" ? `Prior Year${fy ? ` (${formatFYLabel(fy.priorFY)})` : ""}` :
            p === "current" ? `Current Year${fy ? ` (${formatFYLabel(fy.currentFY)})` : ""}` :
            `Next Year${fy ? ` (${formatFYLabel(fy.nextFY)})` : ""}`;
          return (
            <button
              key={p}
              onClick={() => handlePeriod(p)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                period === p
                  ? "bg-[#403770] text-white"
                  : "bg-[#EFEDF5] text-[#8A80A8] hover:text-[#403770]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <RevenuePodium entries={sortedEntries} />
      <div className="overflow-x-auto">
        <RevenueTable
          entries={sortedEntries}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          teamTotals={projectedTotals}
          columnLabels={columnLabels}
          columnTooltips={columnTooltips}
        />
      </div>
    </div>
  );
}
