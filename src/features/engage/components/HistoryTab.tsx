"use client";

import { useState, useMemo } from "react";
import { useExecutions } from "../lib/queries";
import type { SequenceExecutionData } from "../types";
import { EXECUTION_STATUS_CONFIG } from "../types";
import ExecutionDetailView from "./ExecutionDetailView";

type DateFilter = "7" | "30" | "90" | "all";

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

interface HistoryTabProps {}

export default function HistoryTab({}: HistoryTabProps) {
  const { data: completedRuns, isLoading: completedLoading } =
    useExecutions("completed");
  const { data: cancelledRuns, isLoading: cancelledLoading } =
    useExecutions("cancelled");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30");
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(
    null
  );

  const isLoading = completedLoading || cancelledLoading;
  const allRuns = [...(completedRuns || []), ...(cancelledRuns || [])];

  // Filter by date range
  const filteredRuns = useMemo(() => {
    if (dateFilter === "all") return allRuns;
    const days = parseInt(dateFilter);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return allRuns.filter(
      (run) => new Date(run.completedAt || run.startedAt) >= cutoff
    );
  }, [allRuns, dateFilter]);

  // Sort by most recent first
  const sortedRuns = useMemo(() => {
    return [...filteredRuns].sort((a, b) => {
      const dateA = new Date(a.completedAt || a.startedAt).getTime();
      const dateB = new Date(b.completedAt || b.startedAt).getTime();
      return dateB - dateA;
    });
  }, [filteredRuns]);

  // If viewing a detail
  if (selectedExecutionId !== null) {
    return (
      <ExecutionDetailView
        executionId={selectedExecutionId}
        onClose={() => setSelectedExecutionId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="border border-[#D4CFE2] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#F7F5FA] px-4 py-3">
          <div className="h-4 w-32 bg-[#EFEDF5] rounded animate-pulse" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="px-4 py-3 border-t border-[#E2DEEC]">
            <div className="flex gap-4">
              <div className="h-4 w-36 bg-[#EFEDF5] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#EFEDF5] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#EFEDF5] rounded animate-pulse" />
              <div className="h-4 w-20 bg-[#EFEDF5] rounded animate-pulse" />
              <div className="h-4 w-24 bg-[#EFEDF5] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (allRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-[#EFEDF5] flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-[#A69DC0]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[#403770] mb-1">
          No completed runs yet
        </h3>
        <p className="text-sm text-[#8A80A8] text-center max-w-sm">
          Your completed runs will appear here with analytics.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-[#8A80A8]">
          {sortedRuns.length} run{sortedRuns.length !== 1 ? "s" : ""}
        </span>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="px-3 py-1.5 text-sm text-[#403770] border border-[#C2BBD4] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167]"
        >
          {DATE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-[#D4CFE2] rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F7F5FA]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                Sequence
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                Contacts
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                Sent
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                Skipped
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRuns.map((run, idx) => {
              const statusConfig = EXECUTION_STATUS_CONFIG[run.status];
              const totalSteps =
                run.contactCount *
                (run.sequence.steps?.length || 1);
              const skipped = totalSteps - run.completedCount;

              return (
                <tr
                  key={run.id}
                  onClick={() => setSelectedExecutionId(run.id)}
                  className={`hover:bg-[#EFEDF5] cursor-pointer transition-colors ${
                    idx > 0 ? "border-t border-[#E2DEEC]" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#403770]">
                      {run.sequence.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6B5F8A]">
                    {run.contactCount}
                  </td>
                  <td className="px-4 py-3 text-[#69B34A] font-medium">
                    {run.completedCount}
                  </td>
                  <td className="px-4 py-3 text-[#A69DC0]">
                    {skipped > 0 ? skipped : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                      style={{
                        color: statusConfig.color,
                        backgroundColor: statusConfig.bgColor,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8A80A8]">
                    {new Date(
                      run.completedAt || run.startedAt
                    ).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
