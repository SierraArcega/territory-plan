import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  TerritoryPlan,
  TerritoryPlanDetail,
  TerritoryPlanDistrict,
  Contact,
  Service,
  PlanDistrictDetail,
  PlanOpportunityRow,
} from "@/features/shared/types/api-types";

// Territory Plans
export function useTerritoryPlans(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["territoryPlans"],
    queryFn: () => fetchJson<TerritoryPlan[]>(`${API_BASE}/territory-plans`),
    staleTime: 2 * 60 * 1000, // 2 minutes - plans may change during session
    enabled: options?.enabled,
  });
}

export function useTerritoryPlan(planId: string | null) {
  return useQuery({
    queryKey: ["territoryPlan", planId],
    queryFn: () =>
      fetchJson<TerritoryPlanDetail>(`${API_BASE}/territory-plans/${planId}`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCreateTerritoryPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: {
      name: string;
      description?: string;
      ownerId?: string;
      color?: string;
      status?: "planning" | "working" | "stale" | "archived";
      fiscalYear: number;
      startDate?: string;
      endDate?: string;
      stateFips?: string[];
      collaboratorIds?: string[];
    }) =>
      fetchJson<TerritoryPlan>(`${API_BASE}/territory-plans`, {
        method: "POST",
        body: JSON.stringify(plan),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUpdateTerritoryPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      ownerId?: string | null;
      color?: string;
      status?: "planning" | "working" | "stale" | "archived";
      fiscalYear?: number;
      startDate?: string;
      endDate?: string;
      stateFips?: string[];
      collaboratorIds?: string[];
    }) =>
      fetchJson<TerritoryPlan>(`${API_BASE}/territory-plans/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.id] });
    },
  });
}

export function useDeleteTerritoryPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/territory-plans/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
    },
  });
}

export function useAddDistrictsToPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      leaids,
      filters,
    }: {
      planId: string;
      leaids?: string | string[];
      filters?: { column: string; op: string; value?: unknown }[];
      /** Partial district data for optimistic UI — not sent to server */
      districtData?: Partial<TerritoryPlanDistrict>;
    }) =>
      fetchJson<{ added: number; planId: string }>(
        `${API_BASE}/territory-plans/${planId}/districts`,
        {
          method: "POST",
          body: JSON.stringify({ leaids, filters }),
        }
      ),
    onMutate: async (variables) => {
      // Only do optimistic update if districtData is provided (combobox flow)
      if (!variables.districtData || !variables.leaids) return undefined;

      await queryClient.cancelQueries({ queryKey: ["territoryPlan", variables.planId] });

      const planKey = ["territoryPlan", variables.planId] as const;
      const previousPlan = queryClient.getQueryData<TerritoryPlanDetail>(planKey);

      if (previousPlan) {
        const leaid = Array.isArray(variables.leaids) ? variables.leaids[0] : variables.leaids;
        const newDistrict: TerritoryPlanDistrict = {
          leaid,
          addedAt: new Date().toISOString(),
          name: "",
          stateAbbrev: null,
          enrollment: null,
          owner: null,
          renewalTarget: null,
          winbackTarget: null,
          expansionTarget: null,
          newBusinessTarget: null,
          notes: null,
          returnServices: [],
          newServices: [],
          tags: [],
          opportunities: [],
          ...variables.districtData,
        };

        queryClient.setQueryData<TerritoryPlanDetail>(planKey, {
          ...previousPlan,
          districts: [...previousPlan.districts, newDistrict],
        });
      }

      return { previousPlan };
    },
    onError: (_err, variables, context) => {
      // Roll back optimistic update
      if (context?.previousPlan) {
        queryClient.setQueryData(["territoryPlan", variables.planId], context.previousPlan);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
      queryClient.invalidateQueries({ queryKey: ["teamProgress"] });
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      const leaids = variables.leaids;
      if (leaids) {
        const ids = Array.isArray(leaids) ? leaids : [leaids];
        for (const id of ids) {
          queryClient.invalidateQueries({ queryKey: ["district", id] });
        }
      }
    },
  });
}

export function useRemoveDistrictFromPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, leaid }: { planId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
      queryClient.invalidateQueries({ queryKey: ["teamProgress"] });
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function usePlanOpportunities(planId: string | null) {
  return useQuery({
    queryKey: ["planOpportunities", planId],
    queryFn: () =>
      fetchJson<PlanOpportunityRow[]>(
        `${API_BASE}/territory-plans/${planId}/opportunities`
      ),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDistrictWebsites(leaids: string[]) {
  return useQuery({
    queryKey: ["districtWebsites", leaids],
    queryFn: async () => {
      const res = await fetchJson<{ leaid: string; websiteUrl: string | null }[]>(
        `${API_BASE}/districts/websites`,
        {
          method: "POST",
          body: JSON.stringify({ leaids }),
        }
      );
      const map = new Map<string, string>();
      for (const d of res) {
        if (d.websiteUrl) map.set(d.leaid, d.websiteUrl);
      }
      return map;
    },
    enabled: leaids.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes — websites don't change often
  });
}

export function usePlanContacts(planId: string | null, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["planContacts", planId],
    queryFn: () =>
      fetchJson<Contact[]>(`${API_BASE}/territory-plans/${planId}/contacts`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: options?.refetchInterval ?? false,
  });
}

/**
 * Error thrown by useBulkEnrich when the API returns a non-OK status. The
 * response body (e.g. `{ reason: "rollup-district", rollupLeaids, childLeaids }`)
 * is preserved on `.body` so callers can branch on structured error shapes.
 */
export interface BulkEnrichError extends Error {
  status: number;
  body: unknown;
}

export interface ContactSourcePlan {
  id: string;
  name: string;
  ownerName: string | null;
  sharedDistrictCount: number;
  contactCount: number;
  lastEnrichedAt: string | null;
}

export function useContactSources(planId: string | null) {
  return useQuery({
    queryKey: ["planContactSources", planId],
    queryFn: () =>
      fetchJson<{ plans: ContactSourcePlan[] }>(
        `${API_BASE}/territory-plans/${planId}/contact-sources`
      ),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useBulkEnrich() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      planId,
      targetRole,
      schoolLevels,
    }: {
      planId: string;
      targetRole: string;
      schoolLevels?: number[];
    }) => {
      // Custom fetch (not fetchJson) so we can attach the parsed response body
      // to thrown errors. The rollup-district 400 response carries structured
      // fields that ContactsActionBar uses to offer an "Expand" action.
      const res = await fetch(
        `${API_BASE}/territory-plans/${planId}/contacts/bulk-enrich`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetRole,
            ...(schoolLevels ? { schoolLevels } : {}),
          }),
        }
      );
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // non-JSON body — leave body as null
      }
      if (!res.ok) {
        const errRecord = (body ?? {}) as Record<string, unknown>;
        const detail =
          typeof errRecord.error === "string"
            ? errRecord.error
            : `API Error: ${res.status} ${res.statusText}`;
        const err = new Error(`${res.status}: ${detail}`) as BulkEnrichError;
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body as {
        total: number;
        skipped: number;
        queued: number;
        reason?: "no-districts" | "no-schools-in-district" | "no-schools-at-levels";
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planContacts", variables.planId] });
    },
  });
}

/**
 * PATCH /api/territory-plans/[id]/expand-rollup — converts any rollup leaids in
 * the plan to their child districts. Idempotent; safe to call anytime.
 * Invalidates the plan detail and contacts caches on success so the UI picks up
 * the newly expanded set of districts.
 */
export function useExpandRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const res = await fetch(
        `${API_BASE}/territory-plans/${planId}/expand-rollup`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!res.ok) {
        throw new Error(`Failed to expand rollup (${res.status})`);
      }
      return res.json() as Promise<{
        rollupsExpanded: string[];
        expandedCount: number;
      }>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["planContacts", variables.planId] });
    },
  });
}

export interface EnrichProgress {
  total: number;
  enriched: number;
  queued: number;
}

export function useEnrichProgress(planId: string | null, polling: boolean) {
  return useQuery({
    queryKey: ["enrichProgress", planId],
    queryFn: () =>
      fetchJson<EnrichProgress>(
        `${API_BASE}/territory-plans/${planId}/contacts/enrich-progress`
      ),
    enabled: !!planId,
    refetchInterval: polling ? 5000 : false,
    staleTime: polling ? 0 : 30 * 1000, // When not polling, cache for 30s
  });
}

export function usePlanDistrictDetail(planId: string | null, leaid: string | null) {
  return useQuery({
    queryKey: ["planDistrict", planId, leaid],
    queryFn: () =>
      fetchJson<PlanDistrictDetail>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`
      ),
    enabled: !!planId && !!leaid,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useUpdateDistrictTargets() {
  const queryClient = useQueryClient();

  type UpdateVars = {
    planId: string;
    leaid: string;
    renewalTarget?: number | null;
    winbackTarget?: number | null;
    expansionTarget?: number | null;
    newBusinessTarget?: number | null;
    notes?: string | null;
    returnServiceIds?: number[];
    newServiceIds?: number[];
  };

  return useMutation({
    mutationFn: ({ planId, leaid, ...data }: UpdateVars) =>
      fetchJson<PlanDistrictDetail>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      ),
    onMutate: async (variables) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["territoryPlan", variables.planId] });
      await queryClient.cancelQueries({ queryKey: ["planDistrict", variables.planId, variables.leaid] });

      const allServices = queryClient.getQueryData<Service[]>(["services"]) || [];

      // Helper: patch a district record with the mutation variables
      const patchDistrict = <T extends {
        renewalTarget: number | null;
        winbackTarget: number | null;
        expansionTarget: number | null;
        newBusinessTarget: number | null;
        notes: string | null;
        returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
        newServices: Array<{ id: number; name: string; slug: string; color: string }>;
      }>(d: T): T => {
        const updated = { ...d };
        if (variables.renewalTarget !== undefined) updated.renewalTarget = variables.renewalTarget;
        if (variables.winbackTarget !== undefined) updated.winbackTarget = variables.winbackTarget;
        if (variables.expansionTarget !== undefined) updated.expansionTarget = variables.expansionTarget;
        if (variables.newBusinessTarget !== undefined) updated.newBusinessTarget = variables.newBusinessTarget;
        if (variables.notes !== undefined) updated.notes = variables.notes;
        if (variables.returnServiceIds !== undefined) {
          updated.returnServices = variables.returnServiceIds
            .map((id) => allServices.find((s) => s.id === id))
            .filter((s): s is Service => !!s)
            .map((s) => ({ id: s.id, name: s.name, slug: s.slug, color: s.color }));
        }
        if (variables.newServiceIds !== undefined) {
          updated.newServices = variables.newServiceIds
            .map((id) => allServices.find((s) => s.id === id))
            .filter((s): s is Service => !!s)
            .map((s) => ({ id: s.id, name: s.name, slug: s.slug, color: s.color }));
        }
        return updated;
      };

      // Optimistically update the full plan cache
      const planKey = ["territoryPlan", variables.planId] as const;
      const previousPlan = queryClient.getQueryData<TerritoryPlanDetail>(planKey);
      if (previousPlan) {
        queryClient.setQueryData<TerritoryPlanDetail>(planKey, {
          ...previousPlan,
          districts: previousPlan.districts.map((d) =>
            d.leaid === variables.leaid ? patchDistrict(d) : d
          ),
        });
      }

      // Optimistically update the single-district cache (used by PlanAccordionContent)
      const districtKey = ["planDistrict", variables.planId, variables.leaid] as const;
      const previousDistrict = queryClient.getQueryData<PlanDistrictDetail>(districtKey);
      if (previousDistrict) {
        queryClient.setQueryData<PlanDistrictDetail>(districtKey, patchDistrict(previousDistrict));
      }

      return { previousPlan, previousDistrict };
    },
    onError: (_err, variables, context) => {
      // Roll back to previous state on error
      if (context?.previousPlan) {
        queryClient.setQueryData(["territoryPlan", variables.planId], context.previousPlan);
      }
      if (context?.previousDistrict) {
        queryClient.setQueryData(["planDistrict", variables.planId, variables.leaid], context.previousDistrict);
      }
    },
    onSettled: (_, _err, variables) => {
      // Background-refresh the single district detail (lightweight)
      queryClient.invalidateQueries({ queryKey: ["planDistrict", variables.planId, variables.leaid] });
      // Refresh dashboards that aggregate target data
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["teamProgress"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// District name search for the combobox
export interface DistrictSearchResult {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  accountType: string | null;
  owner: string | null;
}

export function useDistrictNameSearch(query: string) {
  return useQuery({
    queryKey: ["districtNameSearch", query],
    queryFn: async () => {
      const res = await fetchJson<{ data: DistrictSearchResult[] }>(
        `${API_BASE}/districts/search?name=${encodeURIComponent(query)}&limit=10`
      );
      return res.data;
    },
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds — search results are fairly stable
  });
}
