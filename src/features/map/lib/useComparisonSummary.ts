import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { useMapV2Store } from "@/features/map/lib/store";
import type { TransitionBucket } from "@/features/map/lib/comparison";

export interface ComparisonBucketData {
  count: number;
  totalEnrollment: number;
}

export interface ComparisonSummaryResponse {
  fyA: string;
  fyB: string;
  vendor: string;
  buckets: Record<TransitionBucket, ComparisonBucketData>;
  total: ComparisonBucketData;
}

/**
 * React Query hook that fetches transition bucket counts for two fiscal years.
 * Only enabled when compare mode is active with the "changes" view.
 */
export function useComparisonSummary() {
  const compareMode = useMapV2Store((s) => s.compareMode);
  const compareView = useMapV2Store((s) => s.compareView);
  const compareFyA = useMapV2Store((s) => s.compareFyA);
  const compareFyB = useMapV2Store((s) => s.compareFyB);
  const filterStates = useMapV2Store((s) => s.filterStates);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  const statesCsv = [...filterStates].sort().join(",");
  const accountTypesCsv = [...filterAccountTypes].sort().join(",");
  // Default to first active vendor (usually fullmind)
  const vendor = [...activeVendors][0] ?? "fullmind";

  const enabled = compareMode && compareView === "changes";

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "comparisonSummary",
      compareFyA,
      compareFyB,
      vendor,
      statesCsv,
      filterOwner,
      filterPlanId,
      accountTypesCsv,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("fyA", compareFyA);
      params.set("fyB", compareFyB);
      params.set("vendors", vendor);
      if (statesCsv) params.set("states", statesCsv);
      if (filterOwner) params.set("owner", filterOwner);
      if (filterPlanId) params.set("planId", filterPlanId);
      if (accountTypesCsv) params.set("accountTypes", accountTypesCsv);
      return fetchJson<ComparisonSummaryResponse>(
        `${API_BASE}/districts/summary/compare?${params.toString()}`
      );
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? null,
    isLoading: isLoading && enabled,
    error,
    enabled,
  };
}
