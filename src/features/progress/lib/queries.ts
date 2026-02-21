import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  ProgressPeriod,
  ActivityMetrics,
  OutcomeMetrics,
  PlanEngagement,
} from "@/features/shared/types/api-types";

// Activity metrics — counts by category, source, status, plan, with trends
export function useActivityMetrics(period: ProgressPeriod = "month") {
  return useQuery({
    queryKey: ["progress", "activities", period],
    queryFn: () =>
      fetchJson<ActivityMetrics>(`${API_BASE}/progress/activities?period=${period}`),
    staleTime: 5 * 60 * 1000, // 5 minutes — dashboard data doesn't need to be real-time
  });
}

// Outcome metrics — distribution, funnel, district engagement
export function useOutcomeMetrics(period: ProgressPeriod = "month") {
  return useQuery({
    queryKey: ["progress", "outcomes", period],
    queryFn: () =>
      fetchJson<OutcomeMetrics>(`${API_BASE}/progress/outcomes?period=${period}`),
    staleTime: 5 * 60 * 1000,
  });
}

// Plan engagement — per-plan district coverage and activity recency
export function usePlanEngagement() {
  return useQuery({
    queryKey: ["progress", "plans"],
    queryFn: () => fetchJson<PlanEngagement[]>(`${API_BASE}/progress/plans`),
    staleTime: 5 * 60 * 1000,
  });
}
