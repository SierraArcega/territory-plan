import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { MetricType, FiscalYear } from "@/features/shared/lib/app-store";
import type { FeatureCollection, Point } from "geojson";
import type {
  Quantiles,
  CustomerDotsGeoJSON,
  StateDetail,
  StateDistrictsResponse,
  FocusModeData,
} from "@/features/shared/types/api-types";

// Quantiles for legend
export function useQuantiles(metric: MetricType, year: FiscalYear) {
  return useQuery({
    queryKey: ["quantiles", metric, year],
    queryFn: () =>
      fetchJson<Quantiles>(
        `${API_BASE}/metrics/quantiles?metric=${metric}&year=${year}`
      ),
    staleTime: 10 * 60 * 1000, // 10 minutes - quantiles rarely change
  });
}

// Customer dots for national view
export function useCustomerDots() {
  return useQuery({
    queryKey: ["customerDots"],
    queryFn: () => fetchJson<CustomerDotsGeoJSON>(`${API_BASE}/customer-dots`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// States list
export function useStates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["states"],
    queryFn: () =>
      fetchJson<{ fips: string; abbrev: string; name: string }[]>(`${API_BASE}/states`),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - states are static
    enabled: options?.enabled,
  });
}

// State detail hook
export function useStateDetail(stateCode: string | null) {
  return useQuery({
    queryKey: ["stateDetail", stateCode],
    queryFn: () => fetchJson<StateDetail>(`${API_BASE}/states/${stateCode}`),
    enabled: !!stateCode,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// State districts hook with search and filter support
export function useStateDistricts(params: {
  stateCode: string | null;
  search?: string;
  status?: "all" | "customer" | "pipeline" | "customer_pipeline";
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.status && params.status !== "all") searchParams.set("status", params.status);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE}/states/${params.stateCode}/districts${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["stateDistricts", params],
    queryFn: () => fetchJson<StateDistrictsResponse>(url),
    enabled: !!params.stateCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Update state notes/owner mutation
export function useUpdateState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stateCode,
      notes,
      territoryOwner,
    }: {
      stateCode: string;
      notes?: string;
      territoryOwner?: string;
    }) =>
      fetchJson<{ code: string; notes: string | null; territoryOwner: string | null }>(
        `${API_BASE}/states/${stateCode}`,
        {
          method: "PUT",
          body: JSON.stringify({ notes, territoryOwner }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stateDetail", variables.stateCode] });
    },
  });
}

// Focus Mode
export function useFocusModeData(planId: string | null) {
  return useQuery({
    queryKey: ["focusMode", planId],
    queryFn: () => fetchJson<FocusModeData>(`${API_BASE}/focus-mode/${planId}`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// School GeoJSON for viewport
// ============================================

const EMPTY_FC: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

/** Quantize a coordinate to a grid so nearby viewports share cache keys. */
function quantize(val: number, step: number): number {
  return Math.round(val / step) * step;
}

/**
 * Quantize bounds to a 0.5-degree grid. This means small pans reuse the
 * cached response instead of triggering a new fetch. The over-fetch is
 * minimal — at most 0.25 degrees of extra schools on each edge.
 */
function quantizeBounds(bounds: [number, number, number, number]): [number, number, number, number] {
  const STEP = 0.5;
  return [
    quantize(bounds[0], STEP) - STEP, // west  — round down
    quantize(bounds[1], STEP) - STEP, // south — round down
    quantize(bounds[2], STEP) + STEP, // east  — round up
    quantize(bounds[3], STEP) + STEP, // north — round up
  ];
}

/**
 * Fetches school GeoJSON for the current viewport bounds via TanStack Query.
 * Bounds are quantized to a 0.5° grid so nearby viewports share cache hits.
 * Uses keepPreviousData so school dots stay visible while the next fetch loads.
 */
export function useSchoolGeoJSON(
  bounds: [number, number, number, number] | null,
  enabled: boolean,
) {
  const qBounds = bounds ? quantizeBounds(bounds) : null;

  return useQuery({
    queryKey: ["schoolGeoJSON", qBounds],
    queryFn: async () => {
      if (!qBounds) return EMPTY_FC;
      const boundsParam = qBounds.join(",");
      const res = await fetch(`/api/schools/geojson?bounds=${boundsParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<FeatureCollection<Point>>;
    },
    enabled: enabled && qBounds !== null,
    staleTime: 60 * 1000, // 1 minute — school data is static
    gcTime: 5 * 60 * 1000, // keep in cache 5 minutes for back-panning
    placeholderData: keepPreviousData,
  });
}
