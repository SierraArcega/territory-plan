"use client";

import { useState } from "react";
import useSWR from "swr";

interface CompetitorSpendRecord {
  competitor: string;
  fiscalYear: string;
  totalSpend: number;
  poCount: number;
  color: string;
}

interface CompetitorSpendResponse {
  competitorSpend: CompetitorSpendRecord[];
  totalAllCompetitors: number;
}

interface CompetitorSpendProps {
  leaid: string;
}

// Format currency for display
function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Group spend records by competitor
function groupByCompetitor(
  records: CompetitorSpendRecord[]
): Map<string, { color: string; records: CompetitorSpendRecord[] }> {
  const grouped = new Map<string, { color: string; records: CompetitorSpendRecord[] }>();

  for (const record of records) {
    if (!grouped.has(record.competitor)) {
      grouped.set(record.competitor, { color: record.color, records: [] });
    }
    grouped.get(record.competitor)!.records.push(record);
  }

  // Sort records within each competitor by FY descending
  for (const group of grouped.values()) {
    group.records.sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear));
  }

  return grouped;
}

export default function CompetitorSpend({ leaid }: CompetitorSpendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useSWR<CompetitorSpendResponse>(
    `/api/districts/${leaid}/competitor-spend`,
    fetcher
  );

  // Don't render if loading, error, or no data
  if (isLoading || error || !data) {
    return null;
  }

  // Don't render if no competitor spend
  if (data.competitorSpend.length === 0) {
    return null;
  }

  const groupedData = groupByCompetitor(data.competitorSpend);

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Competitor Spend</h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-3 space-y-4">
          {Array.from(groupedData.entries()).map(([competitor, { color, records }]) => (
            <div key={competitor}>
              {/* Competitor name with color dot */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-semibold text-gray-700">{competitor}</span>
              </div>

              {/* FY breakdown */}
              <div className="ml-4 space-y-1">
                {records.map((record) => (
                  <div
                    key={`${record.competitor}-${record.fiscalYear}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-500 uppercase">{record.fiscalYear}</span>
                    <span className="text-gray-700">
                      {formatCurrency(record.totalSpend)}{" "}
                      <span className="text-gray-400">
                        ({record.poCount} {record.poCount === 1 ? "PO" : "POs"})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Total across all competitors */}
          {data.totalAllCompetitors > 0 && groupedData.size > 1 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-600">Total Competitor Spend</span>
                <span className="font-semibold text-gray-700">
                  {formatCurrency(data.totalAllCompetitors)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
