import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  AdminInitiativeConfig,
  RegistryEntry,
  PreviewResult,
  InitiativeIdentityPayload,
  MetricsPayload,
  TiersPayload,
  WeightsPayload,
  PreviewPayload,
} from "@/features/admin/lib/leaderboard-types";

// ── Queries ──

export function useAdminLeaderboardConfig() {
  return useQuery({
    queryKey: ["admin", "leaderboard"],
    queryFn: () => fetchJson<AdminInitiativeConfig>(`${API_BASE}/admin/leaderboard`),
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

export function useUpdateInitiativeIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InitiativeIdentityPayload) =>
      fetchJson(`${API_BASE}/admin/leaderboard/initiative`, {
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

export function usePreviewChanges() {
  return useMutation({
    mutationFn: (data: PreviewPayload) =>
      fetchJson<PreviewResult>(`${API_BASE}/admin/leaderboard/preview`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateNewInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts: { backfill: boolean; startDate?: string }) =>
      fetchJson(`${API_BASE}/admin/leaderboard/initiative/new`, {
        method: "POST",
        body: JSON.stringify(opts),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useEndInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`${API_BASE}/admin/leaderboard/initiative/end`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useRecalculateScores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`${API_BASE}/admin/leaderboard/recalculate`, { method: "POST" }),
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
