import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { useProfile } from "@/features/shared/lib/queries";
import type { TerritoryPlan } from "@/features/shared/types/api-types";
import type {
  LeaderboardEntry,
  InitiativeInfo,
  IncreaseTargetsResponse,
  IncreaseTargetBucket,
  RevenueRankResponse,
} from "./types";
import { INCREASE_TARGET_BUCKET_FIELD } from "./types";

export interface LeaderboardFiscalYears {
  currentFY: string;
  nextFY: string;
  priorFY: string;
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
    // Revenue: legacy scalar + per-FY pair
    revenue: number;
    revenueCurrentFY: number;
    revenuePriorFY: number;
    unassignedRevenue: number;
    unassignedRevenueCurrentFY: number;
    unassignedRevenuePriorFY: number;

    // Min Purchases: legacy alias (priorYearRevenue) + per-FY pair
    priorYearRevenue: number;
    minPurchasesCurrentFY: number;
    minPurchasesPriorFY: number;
    unassignedPriorYearRevenue: number;
    unassignedMinPurchasesCurrentFY: number;
    unassignedMinPurchasesPriorFY: number;

    pipelineCurrentFY: number;
    pipelineNextFY: number;
    unassignedPipelineCurrentFY: number;
    unassignedPipelineNextFY: number;

    targetedCurrentFY: number;
    targetedNextFY: number;
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

export function useRevenueRank(fy: "current" | "next") {
  return useQuery({
    queryKey: ["revenue-rank", fy],
    queryFn: () => fetchJson<RevenueRankResponse>(`${API_BASE}/leaderboard/revenue-rank?fy=${fy}`),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Increase Your Targets tab
// ---------------------------------------------------------------------------

const INCREASE_TARGETS_QUERY_KEY = ["leaderboard", "increase-targets"] as const;

/**
 * List of FY26 Fullmind customers with no FY27 activity and not yet in any
 * territory plan. Team-wide visibility (same for every rep).
 */
export function useIncreaseTargetsList() {
  return useQuery({
    queryKey: INCREASE_TARGETS_QUERY_KEY,
    queryFn: () =>
      fetchJson<IncreaseTargetsResponse>(
        `${API_BASE}/leaderboard/increase-targets`,
      ),
    // List mutates on every add, so keep it shorter than the 2min leaderboard stale.
    staleTime: 60 * 1000,
  });
}

/** Preferred alias — the list is the data source for the Low Hanging Fruit surface. */
export const useLowHangingFruitList = useIncreaseTargetsList;

/**
 * Territory plans owned by the current user. Reuses the team-wide
 * /api/territory-plans endpoint and filters client-side by `owner.id`.
 */
export function useMyPlans() {
  const profile = useProfile();
  const currentUserId = profile.data?.id ?? null;

  return useQuery({
    queryKey: ["territory-plans", "mine", currentUserId] as const,
    queryFn: async () => {
      const all = await fetchJson<TerritoryPlan[]>(`${API_BASE}/territory-plans`);
      if (!currentUserId) return [];
      return all.filter((plan) => plan.owner?.id === currentUserId);
    },
    enabled: !!currentUserId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Add a district to a plan with a target amount in the chosen bucket.
 * Reuses POST /api/territory-plans/[id]/districts — the existing route upserts
 * on the composite PK, syncs plan rollups, and awards district_added points.
 *
 * On success: optimistically removes the row from the increase-targets list
 * cache so the UI stays in sync before refetch. Also invalidates the plans
 * query so rollups update on the home screen.
 */
export function useAddDistrictToPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      planId: string;
      leaid: string;
      bucket: IncreaseTargetBucket;
      targetAmount: number;
    }) => {
      const bucketField = INCREASE_TARGET_BUCKET_FIELD[vars.bucket];
      return fetchJson<{ added: number; planId: string }>(
        `${API_BASE}/territory-plans/${vars.planId}/districts`,
        {
          method: "POST",
          body: JSON.stringify({
            leaids: vars.leaid,
            [bucketField]: vars.targetAmount,
          }),
        },
      );
    },
    onSuccess: (_data, variables) => {
      // Optimistic cache update: flip the added row's FY27 readiness flags so
      // its action / status cell updates without a refetch flicker. The row
      // itself stays in the list — it still has FY26 revenue and the plan may
      // be any fiscal year; server refetch will reconcile if they picked a
      // non-FY27 plan.
      queryClient.setQueryData<IncreaseTargetsResponse>(
        INCREASE_TARGETS_QUERY_KEY,
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            districts: prev.districts.map((d) =>
              d.leaid === variables.leaid
                ? {
                    ...d,
                    inFy27Plan: true,
                    inPlan: true,
                    hasFy27Target: (variables.targetAmount ?? 0) > 0,
                    planIds: d.planIds.includes(variables.planId)
                      ? d.planIds
                      : [...d.planIds, variables.planId],
                  }
                : d,
            ),
          };
        },
      );

      // Plan rollups changed — refresh anything that reads them.
      queryClient.invalidateQueries({ queryKey: ["territory-plans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({
        queryKey: ["territoryPlan", variables.planId],
      });
    },
  });
}
