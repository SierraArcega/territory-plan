"use client";

import { useState, useMemo } from "react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn } from "./RevenueTable";
import type { LeaderboardEntry } from "../lib/types";

interface RevenueOverviewTabProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
}

export default function RevenueOverviewTab({ entries, isLoading }: RevenueOverviewTabProps) {
  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [entries, sortColumn, sortDirection]);

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

  return (
    <div>
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
