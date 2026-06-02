import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ToplineCard } from "./topline";
import type { RankTrajectoryPayload } from "./rank-trajectory";
import type { Sparkline, SparklineMetricKey } from "./sparkline";
import type { WowDeltas } from "./wow";
import type { Coverage, StageHealth, OppView } from "./pipeline";
import type { ThisWeek } from "./pipeline-source";

// Types for the alerts response

export interface DistrictAlert {
  leaid: string;
  districtName: string;
  stateAbbrev: string;
  planId: string;
  planName: string;
  planColor: string;
}

export interface StalePlanAlert {
  planId: string;
  planName: string;
  planColor: string;
  districtCount: number;
  lastActivityDate: string | null;
}

export interface FeedAlertsResponse {
  districtsWithoutContacts: DistrictAlert[];
  stalePlans: StalePlanAlert[];
}

export function useFeedAlerts() {
  return useQuery({
    queryKey: ["feed-alerts"],
    queryFn: () => fetchJson<FeedAlertsResponse>(`${API_BASE}/feed/alerts`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface ToplineResponse {
  fy: number;
  schoolYr: string;
  cards: ToplineCard[];
}

export function useTopline(fy: number) {
  return useQuery({
    queryKey: ["dashboard", "topline", fy],
    queryFn: () => fetchJson<ToplineResponse>(`${API_BASE}/home/dashboard/topline?fy=${fy}`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface TargetsCardData {
  metricKey: "targets";
  label: string;
  value: number;
  rank: number;
  totalReps: number;
  inRoster: boolean;
  segments: { new: number; winback: number; expansion: number };
  untargeted: number;
  convertedToPipeline: number;
  active90: number;
  stale: number;
}

export interface TargetsResponse {
  fy: number;
  schoolYr: string;
  card: TargetsCardData;
}

export function useTargets(fy: number) {
  return useQuery({
    queryKey: ["dashboard", "targets", fy],
    queryFn: () => fetchJson<TargetsResponse>(`${API_BASE}/home/dashboard/targets?fy=${fy}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRankTrajectory(fy: number) {
  return useQuery({
    queryKey: ["dashboard", "rankTrajectory", fy],
    queryFn: () =>
      fetchJson<RankTrajectoryPayload>(`${API_BASE}/home/dashboard/rank-trajectory?fy=${fy}`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface SparklinesResponse {
  fy: number;
  schoolYr: string;
  sparklines: Record<SparklineMetricKey, Sparkline>;
  wow: WowDeltas;
}

export function useSparklines(fy: number) {
  return useQuery({
    queryKey: ["dashboard", "sparklines", fy],
    queryFn: () => fetchJson<SparklinesResponse>(`${API_BASE}/home/dashboard/sparklines?fy=${fy}`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface PipelineResponse {
  fy: number;
  schoolYr: string;
  coverage: Coverage & { wonBookings: number; fyTarget: number };
  stageHealth: StageHealth[];
  opps: OppView[];
  atRisk: OppView[];
  thisWeek: ThisWeek;
}

export function usePipeline(fy: number) {
  return useQuery({
    queryKey: ["dashboard", "pipeline", fy],
    queryFn: () => fetchJson<PipelineResponse>(`${API_BASE}/home/dashboard/pipeline?fy=${fy}`),
    staleTime: 5 * 60 * 1000,
  });
}
