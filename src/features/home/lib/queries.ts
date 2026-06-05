import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ToplineCard } from "./topline";
import type { RankTrajectoryPayload } from "./rank-trajectory";
import type { Sparkline, SparklineMetricKey } from "./sparkline";
import type { WowDeltas } from "./wow";
import type { OppView, FunnelData } from "./pipeline";
import type { ThisWeek } from "./pipeline";
import type { VelocityCell } from "./velocity";
import type {
  DealMetric,
  DealTotals,
  PipelineDealRow,
  BookingDealRow,
  UtilizationRow,
} from "./deals";

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

// ── Rep roster ──────────────────────────────────────────────────────────────

export interface RepOption {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export function useActiveReps() {
  return useQuery({
    queryKey: ["reps"],
    queryFn: () => fetchJson<RepOption[]>(`${API_BASE}/reps`),
    staleTime: 60 * 60 * 1000, // roster rarely changes
  });
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface ToplineResponse {
  fy: number;
  schoolYr: string;
  cards: ToplineCard[];
  mode?: "rep" | "team";
}

export function useTopline(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "topline", fy, repScope],
    queryFn: () => fetchJson<ToplineResponse>(`${API_BASE}/home/dashboard/topline?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: repScope !== "",
  });
}

export interface TargetsCardData {
  metricKey: "targets";
  label: string;
  value: number;
  rank: number | null;
  totalReps: number;
  inRoster: boolean;
  segments: { new: number; winback: number; expansion: number };
  untargeted: number;
  convertedToPipeline: number;
  active90: number;
  stale: number;
  targetTotal: number;
  pipelineOnAccounts: number;
}

export interface TargetsResponse {
  fy: number;
  schoolYr: string;
  card: TargetsCardData;
  mode?: "rep" | "team";
}

export function useTargets(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "targets", fy, repScope],
    queryFn: () => fetchJson<TargetsResponse>(`${API_BASE}/home/dashboard/targets?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: repScope !== "",
  });
}

export function useRankTrajectory(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "rankTrajectory", fy, repScope],
    queryFn: () =>
      fetchJson<RankTrajectoryPayload>(`${API_BASE}/home/dashboard/rank-trajectory?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: repScope !== "team" && repScope !== "",
  });
}

export interface SparklinesResponse {
  fy: number;
  schoolYr: string;
  sparklines: Record<SparklineMetricKey, Sparkline>;
  wow: WowDeltas;
  mode?: "rep" | "team";
}

export function useSparklines(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "sparklines", fy, repScope],
    queryFn: () => fetchJson<SparklinesResponse>(`${API_BASE}/home/dashboard/sparklines?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: repScope !== "",
  });
}

export interface PipelineResponse {
  fy: number;
  schoolYr: string;
  inRoster: boolean; // false for an admin/manager viewing (not in the rep roster)
  funnel: FunnelData;
  opps: OppView[];
  atRisk: OppView[];
  thisWeek: ThisWeek | null; // null for a non-current FY
  mode?: "rep" | "team";
}

export function usePipeline(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "pipeline", fy, repScope],
    queryFn: () => fetchJson<PipelineResponse>(`${API_BASE}/home/dashboard/pipeline?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: repScope !== "",
  });
}

export interface VelocityResponse {
  fy: number;
  schoolYr: string;
  cells: VelocityCell[];
  mode?: "rep" | "team";
}

export function useVelocity(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "velocity", fy, repScope],
    queryFn: () => fetchJson<VelocityResponse>(`${API_BASE}/home/dashboard/velocity?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: repScope !== "",
  });
}

export interface DealsResponse {
  fy: number;
  schoolYr: string;
  mode?: "rep" | "team";
  metric: DealMetric;
  rows: PipelineDealRow[] | BookingDealRow[] | UtilizationRow[];
  totals: DealTotals;
}

// Backs the topline cards' drill-in modals. `metric` is null while the modal is
// closed, which (with the unresolved-scope guard) keeps the query from firing
// until a card is actually expanded. Key uses serialized primitives only.
export function useDeals(fy: number, repScope: string, metric: DealMetric | null) {
  return useQuery({
    queryKey: ["dashboard", "deals", fy, repScope, metric ?? ""],
    queryFn: () =>
      fetchJson<DealsResponse>(`${API_BASE}/home/dashboard/deals?fy=${fy}&metric=${metric}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: metric != null && repScope !== "",
  });
}
