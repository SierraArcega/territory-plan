import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { LeaderboardEntry, LeaderboardMyRank, InitiativeInfo } from "./types";

export interface ResolvedFiscalYears {
  pipeline: string;
  targeted: string | null;
  revenue: string;
  priorYear: string;
  defaultSchoolYr: string;
}

export interface LeaderboardResponse {
  initiative: InitiativeInfo;
  resolvedFiscalYears: ResolvedFiscalYears;
  entries: LeaderboardEntry[];
  metrics: { action: string; label: string; pointValue: number }[];
  thresholds: { tier: string; minPoints: number }[];
}

export interface LeaderboardFYOverrides {
  pipelineFY?: string;
  targetedFY?: string;
}

export function useLeaderboard(overrides?: LeaderboardFYOverrides) {
  const params = new URLSearchParams();
  if (overrides?.pipelineFY) params.set("pipelineFY", overrides.pipelineFY);
  if (overrides?.targetedFY) params.set("targetedFY", overrides.targetedFY);
  const qs = params.toString();
  const url = `${API_BASE}/leaderboard${qs ? `?${qs}` : ""}`;

  return useQuery({
    queryKey: ["leaderboard", overrides?.pipelineFY ?? null, overrides?.targetedFY ?? null],
    queryFn: () => fetchJson<LeaderboardResponse>(url),
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
