"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn } from "./RevenueTable";
import { useLeaderboard } from "../lib/queries";
import type { ResolvedFiscalYears } from "../lib/queries";

/** Convert school year "2025-26" to display "FY26" */
function formatFYLabel(schoolYr: string): string {
  const parts = schoolYr.split("-");
  return `FY${parts[1] ?? schoolYr}`;
}

/** Build FY options: current FY and next FY based on resolved defaults */
function buildFYOptions(resolved: ResolvedFiscalYears): { value: string; label: string }[] {
  const defaultYr = resolved.defaultSchoolYr;
  const parts = defaultYr.split("-");
  const startYear = parseInt(parts[0], 10);
  const nextYr = `${startYear + 1}-${String(startYear + 2).slice(-2)}`;

  return [
    { value: defaultYr, label: formatFYLabel(defaultYr) },
    { value: nextYr, label: formatFYLabel(nextYr) },
  ];
}

export default function RevenueOverviewTab() {
  const [pipelineFY, setPipelineFY] = useState<string | undefined>();
  const [targetedFY, setTargetedFY] = useState<string | undefined>();
  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: leaderboard, isLoading } = useLeaderboard(
    pipelineFY || targetedFY ? { pipelineFY, targetedFY } : undefined
  );

  const entries = leaderboard?.entries ?? [];
  const resolved = leaderboard?.resolvedFiscalYears;

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
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

  const fyOptions = resolved ? buildFYOptions(resolved) : [];
  const activePipelineFY = pipelineFY ?? resolved?.pipeline ?? "";
  const activeTargetedFY = targetedFY ?? resolved?.targeted ?? "";

  return (
    <div>
      {/* FY selectors */}
      {resolved && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-[#F7F5FA] border-b border-[#EFEDF5]">
          <FYSelect
            label="Pipeline"
            value={activePipelineFY}
            options={fyOptions}
            onChange={setPipelineFY}
          />
          <FYSelect
            label="Targeted"
            value={activeTargetedFY}
            options={[
              ...fyOptions,
              { value: "", label: "Both" },
            ]}
            onChange={(v) => setTargetedFY(v || undefined)}
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
