import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ActivityType, ActivityStatus } from "@/features/activities/types";
import type {
  ActivitiesParams,
  ActivitiesResponse,
  Activity,
} from "@/features/shared/types/api-types";

// List activities with filtering
export function useActivities(params: ActivitiesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.planId) searchParams.set("planId", params.planId);
  if (params.districtLeaid) searchParams.set("districtLeaid", params.districtLeaid);
  if (params.stateCode) searchParams.set("stateCode", params.stateCode);
  if (params.type) searchParams.set("type", params.type);
  if (params.category) searchParams.set("category", params.category);
  if (params.status) searchParams.set("status", params.status);
  if (params.startDateFrom) searchParams.set("startDateFrom", params.startDateFrom);
  if (params.startDateTo) searchParams.set("startDateTo", params.startDateTo);
  if (params.unscheduled) searchParams.set("unscheduled", "true");
  if (params.needsPlanAssociation !== undefined)
    searchParams.set("needsPlanAssociation", params.needsPlanAssociation.toString());
  if (params.hasUnlinkedDistricts !== undefined)
    searchParams.set("hasUnlinkedDistricts", params.hasUnlinkedDistricts.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE}/activities${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["activities", params],
    queryFn: () => fetchJson<ActivitiesResponse>(url),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch single activity
export function useActivity(activityId: string | null) {
  return useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => fetchJson<Activity>(`${API_BASE}/activities/${activityId}`),
    enabled: !!activityId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Create activity mutation
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      type: ActivityType;
      title: string;
      startDate?: string | null;
      endDate?: string | null;
      status?: ActivityStatus;
      notes?: string | null;
      planIds?: string[];
      districtLeaids?: string[];
      contactIds?: number[];
      stateFips?: string[];
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// Update activity mutation
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      ...data
    }: {
      activityId: string;
      type?: ActivityType;
      title?: string;
      startDate?: string | null;
      endDate?: string | null;
      status?: ActivityStatus;
      notes?: string | null;
      outcome?: string | null;
      outcomeType?: string | null;
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Delete activity mutation
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityId: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/activities/${activityId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// Link plans to activity mutation
export function useLinkActivityPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, planIds }: { activityId: string; planIds: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/activities/${activityId}/plans`, {
        method: "POST",
        body: JSON.stringify({ planIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Unlink plan from activity mutation
export function useUnlinkActivityPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, planId }: { activityId: string; planId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/plans/${planId}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Link districts to activity mutation
export function useLinkActivityDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, leaids }: { activityId: string; leaids: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/activities/${activityId}/districts`, {
        method: "POST",
        body: JSON.stringify({ leaids }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Unlink district from activity mutation
export function useUnlinkActivityDistrict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, leaid }: { activityId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/districts/${leaid}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}
