"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry } from "../lib/types";
import { formatRevenue, getInitials } from "../lib/format";

export type RevenueSortColumn = "revenue" | "priorYearRevenue" | "pipeline" | "revenueTargeted";

export type RevenueTableTotals = {
  revenue: number;
  priorYearRevenue: number;
  pipeline: number;
  revenueTargeted: number;
  unassignedRevenue: number;
  unassignedPriorYearRevenue: number;
  unassignedPipeline: number;
  unassignedRevenueTargeted: number;
};

interface RevenueTableProps {
  entries: LeaderboardEntry[];
  sortColumn: RevenueSortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: RevenueSortColumn) => void;
  teamTotals?: RevenueTableTotals;
  columnLabels?: Partial<Record<RevenueSortColumn, string>>;
  columnTooltips?: Partial<Record<RevenueSortColumn, string>>;
}

const COLUMNS: { key: RevenueSortColumn; label: string }[] = [
  { key: "revenue", label: "Current Revenue" },
  { key: "priorYearRevenue", label: "Min Purchases" },
  { key: "pipeline", label: "Pipeline" },
  { key: "revenueTargeted", label: "Targeted" },
];

export default function RevenueTable({
  entries,
  sortColumn,
  sortDirection,
  onSort,
  teamTotals,
  columnLabels,
  columnTooltips,
}: RevenueTableProps) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A849A] px-3 py-2.5 border-b-2 border-[#EFEDF5] w-12">
            #
          </th>
          <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A849A] px-3 py-2.5 border-b-2 border-[#EFEDF5]">
            Rep
          </th>
          {COLUMNS.map((col) => {
            const isActive = sortColumn === col.key;
            const SortIcon = sortDirection === "asc" ? ChevronUp : ChevronDown;
            const label = columnLabels?.[col.key] ?? col.label;
            const tooltip = columnTooltips?.[col.key];
            return (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`relative text-right text-[11px] font-semibold uppercase tracking-wider px-3 py-2.5 border-b-2 border-[#EFEDF5] cursor-pointer select-none transition-colors hover:text-[#5B2E91] group ${
                  isActive ? "text-[#5B2E91]" : "text-[#8A849A]"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {label}
                  {isActive && <SortIcon className="w-3 h-3" />}
                </span>
                {tooltip && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 bottom-full z-30 mb-1.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-[#403770] px-3 py-1.5 text-xs font-medium normal-case tracking-normal text-white opacity-0 shadow-lg transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    {tooltip}
                  </span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr
            key={entry.userId}
            className="border-b border-[#EFEDF5] transition-colors hover:bg-[#F7F5FA]"
          >
            <td className="px-3 py-3.5 text-sm font-semibold text-[#8A849A]">
              {index + 1}
            </td>
            <td className="px-3 py-3.5">
              <div className="flex items-center gap-2.5">
                {entry.avatarUrl ? (
                  <img
                    src={entry.avatarUrl}
                    alt={entry.fullName}
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#5B2E91] flex items-center justify-center">
                    <span className="text-xs font-semibold text-white">
                      {getInitials(entry.fullName)}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-[#2D2440]">
                  {entry.fullName}
                </span>
              </div>
            </td>
            {COLUMNS.map((col) => {
              const isActive = sortColumn === col.key;
              return (
                <td
                  key={col.key}
                  className={`px-3 py-3.5 text-right text-sm tabular-nums ${
                    isActive
                      ? "text-[#5B2E91] font-semibold"
                      : "text-[#2D2440] font-medium"
                  }`}
                >
                  {formatRevenue(entry[col.key])}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      {teamTotals && entries.length > 0 && (
        <tfoot>
          <tr className="border-t-2 border-[#EFEDF5] bg-[#F7F5FA]">
            <td />
            <td className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A849A]">
              Team Total
            </td>
            {COLUMNS.map((col) => {
              const total = teamTotals[col.key];
              const unassignedKey = (
                "unassigned" + col.key[0].toUpperCase() + col.key.slice(1)
              ) as keyof RevenueTableTotals;
              const unassigned = teamTotals[unassignedKey];
              return (
                <td
                  key={col.key}
                  className="px-3 py-3 text-right text-sm tabular-nums font-semibold text-[#2D2440]"
                >
                  {formatRevenue(total)}
                  {unassigned > 0 && (
                    <div className="text-[10px] text-[#8A849A] font-normal mt-0.5">
                      incl. {formatRevenue(unassigned)} unassigned
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
