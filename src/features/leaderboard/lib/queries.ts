import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { LeaderboardEntry, LeaderboardMyRank, InitiativeInfo } from "./types";

export interface LeaderboardFiscalYears {
  priorFY: string;
  currentFY: string;
  nextFY: string;
}

export interface LeaderboardResponse {
  initiative: InitiativeInfo;
  fiscalYears: LeaderboardFiscalYears;
  entries: LeaderboardEntry[];
  metrics: { action: string; label: string; pointValue: number }[];
  thresholds: { tier: string; minPoints: number }[];
  /**
   * Team-wide totals across all users including admins (which are filtered
   * from `entries`). Single-FY columns are scalars; pipeline and targeted
   * are shipped per-FY so the client can match its FY selectors.
   * Optional so older clients during deploy don't crash.
   */
  teamTotals?: {
    revenue: number;
    priorYearRevenue: number;
    unassignedRevenue: number;
    unassignedPriorYearRevenue: number;

    pipelinePriorFY: number;
    pipelineCurrentFY: number;
    pipelineNextFY: number;
    unassignedPipelinePriorFY: number;
    unassignedPipelineCurrentFY: number;
    unassignedPipelineNextFY: number;

    targetedPriorFY: number;
    targetedCurrentFY: number;
    targetedNextFY: number;
    unassignedTargetedPriorFY: number;
    unassignedTargetedCurrentFY: number;
    unassignedTargetedNextFY: number;
  };
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
