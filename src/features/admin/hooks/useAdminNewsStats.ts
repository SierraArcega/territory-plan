"use client";

import { useQuery } from "@tanstack/react-query";

export interface NewsIngestStats {
  articles: {
    last7d: number;
    prior7d: number;
  };
  coverage: {
    targetDistrictCount: number;
    green: number;
    amber: number;
    red: number;
    percentGreen: number;
  };
  lastRun: {
    finishedAt: string | null;
    status: string | null;
    layer: string | null;
  };
  failures24h: number;
  layerBreakdown: Array<{
    layer: string;
    runsLast24h: number;
    lastStatus: string;
  }>;
  health: "green" | "amber" | "red";
}

async function fetchNewsIngestStats(): Promise<NewsIngestStats> {
  const res = await fetch("/api/admin/news-ingest-stats");
  if (!res.ok) throw new Error("Failed to fetch news ingest stats");
  return res.json();
}

export function useAdminNewsStats() {
  return useQuery({
    queryKey: ["admin", "news-ingest-stats"],
    queryFn: fetchNewsIngestStats,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
