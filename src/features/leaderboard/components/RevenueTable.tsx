"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry } from "../lib/types";
import { formatRevenue, getInitials } from "../lib/format";

export type RevenueSortColumn = "revenue" | "priorYearRevenue" | "pipeline" | "revenueTargeted";

interface RevenueTableProps {
  entries: LeaderboardEntry[];
  sortColumn: RevenueSortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: RevenueSortColumn) => void;
}

const COLUMNS: { key: RevenueSortColumn; label: string }[] = [
  { key: "revenue", label: "Current Revenue" },
  { key: "priorYearRevenue", label: "Prior Year Closed" },
  { key: "pipeline", label: "Pipeline" },
  { key: "revenueTargeted", label: "Targeted" },
];

export default function RevenueTable({
  entries,
  sortColumn,
  sortDirection,
  onSort,
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
            return (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`text-right text-[11px] font-semibold uppercase tracking-wider px-3 py-2.5 border-b-2 border-[#EFEDF5] cursor-pointer select-none transition-colors hover:text-[#5B2E91] ${
                  isActive ? "text-[#5B2E91]" : "text-[#8A849A]"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {isActive && <SortIcon className="w-3 h-3" />}
                </span>
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
    </table>
  );
}
