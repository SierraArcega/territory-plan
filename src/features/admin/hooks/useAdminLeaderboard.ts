import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  AdminSeasonConfig,
  RegistryEntry,
  PreviewResult,
  SeasonIdentityPayload,
  MetricsPayload,
  TiersPayload,
  WeightsPayload,
  TransitionPayload,
  PreviewPayload,
} from "@/features/admin/lib/leaderboard-types";

// ── Queries ──

export function useAdminLeaderboardConfig() {
  return useQuery({
    queryKey: ["admin", "leaderboard"],
    queryFn: () => fetchJson<AdminSeasonConfig>(`${API_BASE}/admin/leaderboard`),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMetricRegistry() {
  return useQuery({
    queryKey: ["admin", "leaderboard", "registry"],
    queryFn: () =>
      fetchJson<{ entries: RegistryEntry[] }>(`${API_BASE}/admin/leaderboard/registry`).then(
        (res) => res.entries
      ),
    staleTime: 10 * 60 * 1000,
  });
}

// ── Mutations ──

export function useUpdateSeasonIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SeasonIdentityPayload) =>
      fetchJson(`${API_BASE}/admin/leaderboard/season`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUpdateMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MetricsPayload) =>
      fetchJson(`${API_BASE}/admin/leaderboard/metrics`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUpdateTiers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TiersPayload) =>
      fetchJson(`${API_BASE}/admin/leaderboard/tiers`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUpdateWeights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WeightsPayload) =>
      fetchJson(`${API_BASE}/admin/leaderboard/weights`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUpdateTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TransitionPayload) =>
      fetchJson(`${API_BASE}/admin/leaderboard/transition`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
    },
  });
}

export function usePreviewChanges() {
  return useMutation({
    mutationFn: (data: PreviewPayload) =>
      fetchJson<PreviewResult>(`${API_BASE}/admin/leaderboard/preview`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateNewSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`${API_BASE}/admin/leaderboard/season/new`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useEndSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`${API_BASE}/admin/leaderboard/season/end`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useExportHistory() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/admin/leaderboard/export`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leaderboard-history-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
