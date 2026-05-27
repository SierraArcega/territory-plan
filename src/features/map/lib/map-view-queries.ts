import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { MapViewState } from "@/features/map/lib/store";

export interface MapViewSummary {
  id: string;
  name: string;
  description: string | null;
  isShared: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; fullName: string | null; avatarUrl: string | null };
}

export interface MapViewDetail extends MapViewSummary {
  state: Record<string, unknown>;
}

export function useMapViews() {
  return useQuery({
    queryKey: ["mapViews"],
    queryFn: () => fetchJson<MapViewSummary[]>(`${API_BASE}/map-views`),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMapView(id: string | null) {
  return useQuery({
    queryKey: ["mapView", id],
    queryFn: () => fetchJson<MapViewDetail>(`${API_BASE}/map-views/${id}`),
    enabled: !!id,
  });
}

export function useCreateMapView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (view: {
      name: string;
      description?: string;
      isShared?: boolean;
      state: Record<string, unknown>;
    }) =>
      fetchJson<MapViewDetail>(`${API_BASE}/map-views`, {
        method: "POST",
        body: JSON.stringify(view),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapViews"] });
    },
  });
}

export function useUpdateMapView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      isShared?: boolean;
    }) =>
      fetchJson<MapViewDetail>(`${API_BASE}/map-views/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mapViews"] });
      queryClient.invalidateQueries({ queryKey: ["mapView", variables.id] });
    },
  });
}

export function useDeleteMapView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/map-views/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapViews"] });
    },
  });
}

/**
 * Resolves a saved view by name (case-insensitive; the list is newest-first, so
 * the first match wins) and applies its state to the live map. Used by the
 * copilot's `map_view.apply` action, which is applied in the browser rather than
 * via the execute endpoint. Throws if no accessible view matches the name.
 */
export async function resolveAndApplyMapView(
  name: string,
  applyViewSnapshot: (state: MapViewState) => void,
): Promise<string> {
  const wanted = name.trim().toLowerCase();
  const views = await fetchJson<MapViewSummary[]>(`${API_BASE}/map-views`);
  const match = views.find((v) => v.name.trim().toLowerCase() === wanted);
  if (!match) {
    throw new Error(`No map view named "${name}".`);
  }
  const detail = await fetchJson<MapViewDetail>(`${API_BASE}/map-views/${match.id}`);
  applyViewSnapshot(detail.state as unknown as MapViewState);
  return match.name;
}
