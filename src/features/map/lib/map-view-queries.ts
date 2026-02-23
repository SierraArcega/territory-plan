import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

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
