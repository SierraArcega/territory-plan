"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import SignalCard from "./signals/SignalCard";

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

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

interface CompetitorSpendCardProps {
  leaid: string;
}

export default function CompetitorSpendCard({ leaid }: CompetitorSpendCardProps) {
  const { data, isLoading } = useQuery<CompetitorSpendResponse>({
    queryKey: ["competitorSpend", leaid],
    queryFn: async () => {
      const res = await fetch(`/api/districts/${leaid}/competitor-spend`);
      if (!res.ok) throw new Error("Failed to fetch competitor spend");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    if (!data?.competitorSpend?.length) return new Map<string, { color: string; total: number; records: CompetitorSpendRecord[] }>();
    const map = new Map<string, { color: string; total: number; records: CompetitorSpendRecord[] }>();
    for (const r of data.competitorSpend) {
      if (!map.has(r.competitor)) {
        map.set(r.competitor, { color: r.color, total: 0, records: [] });
      }
      const g = map.get(r.competitor)!;
      g.total += r.totalSpend;
      g.records.push(r);
    }
    for (const g of map.values()) {
      g.records.sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear));
    }
    return map;
  }, [data]);

  // Sort competitors by total spend descending
  const sortedCompetitors = useMemo(() => {
    return Array.from(grouped.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [grouped]);

  if (isLoading || !data || data.competitorSpend.length === 0) return null;

  const totalSpend = data.totalAllCompetitors;
  const competitorCount = grouped.size;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      }
      title="Competitor Spend"
      badge={
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#F37167]/15 text-[#9b4840]">
          {competitorCount} competitor{competitorCount !== 1 ? "s" : ""}
        </span>
      }
      detail={
        <div className="space-y-3 pt-2">
          {sortedCompetitors.map(([competitor, { color, records }]) => (
            <div key={competitor}>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-semibold text-gray-700">{competitor}</span>
              </div>
              <div className="ml-5 space-y-0.5">
                {records.map((r) => (
                  <div
                    key={`${r.competitor}-${r.fiscalYear}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-500 uppercase">{r.fiscalYear}</span>
                    <span className="text-gray-700">
                      {formatCurrency(r.totalSpend)}{" "}
                      <span className="text-gray-400">
                        ({r.poCount} {r.poCount === 1 ? "PO" : "POs"})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    >
      {/* Headline: total competitor spend */}
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-[#403770]">{formatCurrency(totalSpend)}</span>
        </div>
        <div className="text-xs text-gray-500">
          Total across {competitorCount} competitor{competitorCount !== 1 ? "s" : ""}
        </div>
        {/* Top competitor bar */}
        {sortedCompetitors.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            {sortedCompetitors.slice(0, 4).map(([name, { color, total }]) => (
              <div key={name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-gray-600 truncate max-w-[80px]">{name}</span>
                <span className="text-[11px] font-medium text-gray-500">{formatCurrency(total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SignalCard>
  );
}
