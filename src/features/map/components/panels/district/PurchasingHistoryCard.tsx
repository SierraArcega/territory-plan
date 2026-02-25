"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FullmindData } from "@/lib/api";
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

interface PurchasingHistoryCardProps {
  fullmindData: FullmindData | null;
  leaid: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

interface MetricBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

function MetricBar({ label, value, maxValue, color }: MetricBarProps) {
  const widthPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 truncate">{label}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-300"
          style={{ width: `${widthPercent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-14 text-right">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

const COLORS = {
  revenue: "#6EA3BE",
  invoicing: "#48bb78",
  closedWon: "#9f7aea",
  pipeline: "#F37167",
};

export default function PurchasingHistoryCard({ fullmindData, leaid }: PurchasingHistoryCardProps) {
  const fy25Revenue = Number(fullmindData?.fy25SessionsRevenue ?? 0);
  const fy26Revenue = Number(fullmindData?.fy26SessionsRevenue ?? 0);

  const yoyChange = useMemo(() => {
    if (fy25Revenue <= 0) return null;
    return ((fy26Revenue - fy25Revenue) / fy25Revenue) * 100;
  }, [fy25Revenue, fy26Revenue]);

  const fy26Metrics = useMemo(() => {
    if (!fullmindData) return [];
    return [
      { label: "Sessions Revenue", value: Number(fullmindData.fy26SessionsRevenue), color: COLORS.revenue },
      { label: "Net Invoicing", value: Number(fullmindData.fy26NetInvoicing), color: COLORS.invoicing },
      { label: "Closed Won", value: Number(fullmindData.fy26ClosedWonNetBooking), color: COLORS.closedWon },
      { label: "Open Pipeline", value: Number(fullmindData.fy26OpenPipeline), color: COLORS.pipeline },
    ].filter((m) => m.value > 0);
  }, [fullmindData]);

  const fy25Metrics = useMemo(() => {
    if (!fullmindData) return [];
    return [
      { label: "Sessions Revenue", value: Number(fullmindData.fy25SessionsRevenue), color: COLORS.revenue },
      { label: "Net Invoicing", value: Number(fullmindData.fy25NetInvoicing), color: COLORS.invoicing },
      { label: "Closed Won", value: Number(fullmindData.fy25ClosedWonNetBooking), color: COLORS.closedWon },
    ].filter((m) => m.value > 0);
  }, [fullmindData]);

  const fy27Metrics = useMemo(() => {
    if (!fullmindData) return [];
    return [
      { label: "Open Pipeline", value: Number(fullmindData.fy27OpenPipeline), color: COLORS.pipeline },
    ].filter((m) => m.value > 0);
  }, [fullmindData]);

  const maxValue = useMemo(() => {
    const all = [...fy25Metrics, ...fy26Metrics, ...fy27Metrics].map((m) => m.value);
    return Math.max(...all, 1);
  }, [fy25Metrics, fy26Metrics, fy27Metrics]);

  // Fetch competitor spend data
  const { data: competitorData } = useQuery<CompetitorSpendResponse>({
    queryKey: ["competitorSpend", leaid],
    queryFn: async () => {
      const res = await fetch(`/api/districts/${leaid}/competitor-spend`);
      if (!res.ok) throw new Error("Failed to fetch competitor spend");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Group competitor spend by competitor, sorted by total descending
  const sortedCompetitors = useMemo(() => {
    if (!competitorData?.competitorSpend?.length) return [];
    const map = new Map<string, { color: string; total: number; records: CompetitorSpendRecord[] }>();
    for (const r of competitorData.competitorSpend) {
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
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [competitorData]);

  const hasFullmindData = fy25Metrics.length > 0 || fy26Metrics.length > 0 || fy27Metrics.length > 0;
  const hasCompetitorData = sortedCompetitors.length > 0;

  if (!hasFullmindData && !hasCompetitorData) return null;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      }
      title="Fullmind Purchasing"
      badge={
        yoyChange != null ? (
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              yoyChange > 5
                ? "bg-[#EDFFE3] text-[#5f665b]"
                : yoyChange < -5
                  ? "bg-[#F37167]/15 text-[#9b4840]"
                  : "bg-[#6EA3BE]/15 text-[#4d7285]"
            }`}
          >
            {yoyChange > 0 ? "\u2191" : yoyChange < 0 ? "\u2193" : "\u2014"}{" "}
            {Math.abs(yoyChange).toFixed(0)}% YoY
          </span>
        ) : (
          <></>
        )
      }
      detail={
        <div className="space-y-4 pt-2">
          {fy25Metrics.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#403770] mb-2">FY25</div>
              <div className="space-y-1.5">
                {fy25Metrics.map((m) => (
                  <MetricBar key={m.label} {...m} maxValue={maxValue} />
                ))}
              </div>
            </div>
          )}
          {fy27Metrics.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#403770] mb-2">FY27</div>
              <div className="space-y-1.5">
                {fy27Metrics.map((m) => (
                  <MetricBar key={m.label} {...m} maxValue={maxValue} />
                ))}
              </div>
            </div>
          )}
          {fullmindData && fullmindData.fy26SessionsCount > 0 && (
            <div className="text-xs text-gray-500">
              {fullmindData.fy26SessionsCount.toLocaleString()} sessions delivered (FY26)
            </div>
          )}

          {/* Competitor Spend Section */}
          {hasCompetitorData && (
            <div className="border-t border-gray-100 pt-3 mt-3">
              <div className="text-xs font-semibold text-[#403770] mb-2">Competitor Spend</div>
              <div className="space-y-2.5">
                {sortedCompetitors.map(([competitor, { color, records }]) => (
                  <div key={competitor}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-medium text-gray-700">{competitor}</span>
                    </div>
                    <div className="ml-4 space-y-0.5">
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
            </div>
          )}
        </div>
      }
    >
      {/* Headline: FY26 summary */}
      <div className="space-y-1.5">
        {fy26Revenue > 0 ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#403770]">{formatCurrency(fy26Revenue)}</span>
              <span className="text-xs text-gray-500">FY26 Revenue</span>
            </div>
            {fy26Metrics.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {fy26Metrics.map((m) => (
                  <MetricBar key={m.label} {...m} maxValue={maxValue} />
                ))}
              </div>
            )}
          </>
        ) : fy25Revenue > 0 ? (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-[#403770]">{formatCurrency(fy25Revenue)}</span>
            <span className="text-xs text-gray-500">FY25 Revenue</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">No purchasing history</span>
        )}
      </div>
    </SignalCard>
  );
}
