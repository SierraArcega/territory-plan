"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

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

  for (const group of grouped.values()) {
    group.records.sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear));
  }

  return grouped;
}

export default function CompetitorSpend({ leaid }: CompetitorSpendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery<CompetitorSpendResponse>({
    queryKey: ["competitorSpend", leaid],
    queryFn: async () => {
      const res = await fetch(`/api/districts/${leaid}/competitor-spend`);
      if (!res.ok) throw new Error("Failed to fetch competitor spend");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading || error || !data) return null;
  if (data.competitorSpend.length === 0) return null;

  const groupedData = groupByCompetitor(data.competitorSpend);

  return (
    <div className="px-3 py-3 border-b border-gray-100">
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

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {Array.from(groupedData.entries()).map(([competitor, { color, records }]) => (
            <div key={competitor}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-semibold text-gray-700">{competitor}</span>
              </div>
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
