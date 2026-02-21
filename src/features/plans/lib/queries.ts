import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  TerritoryPlan,
  TerritoryPlanDetail,
  Contact,
  Service,
  PlanDistrictDetail,
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
    }) =>
      fetchJson<{ added: number; planId: string }>(
        `${API_BASE}/territory-plans/${planId}/districts`,
        {
          method: "POST",
          body: JSON.stringify({ leaids, filters }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
      // Refresh district detail so territoryPlanIds updates in the side panel
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
    },
  });
}

export function usePlanContacts(planId: string | null) {
  return useQuery({
    queryKey: ["planContacts", planId],
    queryFn: () =>
      fetchJson<Contact[]>(`${API_BASE}/territory-plans/${planId}/contacts`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000, // 2 minutes
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
      // Debounce the dashboard refresh — it's not urgent
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
    },
  });
}
