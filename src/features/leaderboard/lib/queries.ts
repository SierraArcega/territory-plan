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

export interface LeaderboardDetailEntry {
  rank: number;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalPoints: number;
  tier: string;
  breakdown: {
    action: string;
    label: string;
    pointValue: number;
    count: number;
    total: number;
  }[];
  items: {
    action: string;
    id: string;
    title: string;
    date: string;
    type?: string;
  }[];
}

interface LeaderboardDetailsResponse {
  entries: LeaderboardDetailEntry[];
  metrics: { action: string; label: string; pointValue: number }[];
}

export function useLeaderboardDetails() {
  return useQuery({
    queryKey: ["leaderboard", "details"],
    queryFn: () => fetchJson<LeaderboardDetailsResponse>(`${API_BASE}/leaderboard/details`),
    staleTime: 2 * 60 * 1000,
  });
}
