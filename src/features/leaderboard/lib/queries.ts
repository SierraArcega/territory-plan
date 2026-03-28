import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { LeaderboardEntry, LeaderboardMyRank, SeasonInfo } from "./types";

interface LeaderboardResponse {
  season: SeasonInfo;
  entries: LeaderboardEntry[];
  metrics: { action: string; label: string; pointValue: number }[];
  thresholds: { tier: string; minPoints: number }[];
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchJson<LeaderboardResponse>(`${API_BASE}/leaderboard`),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMyLeaderboardRank() {
  return useQuery({
    queryKey: ["leaderboard", "me"],
    queryFn: () => fetchJson<LeaderboardMyRank>(`${API_BASE}/leaderboard/me`),
    staleTime: 2 * 60 * 1000,
  });
}
