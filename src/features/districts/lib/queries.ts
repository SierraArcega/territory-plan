import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { FiscalYear, MetricType } from "@/features/shared/lib/app-store";

type StatusFilter = "all" | "customer" | "pipeline" | "customer_pipeline" | "no_data";
import type {
  DistrictListItem,
  DistrictDetail,
  DistrictEdits,
  UnmatchedAccount,
  StateSummary,
  SimilarMetricKey,
  SimilarityTolerance,
  SimilarDistrictsResponse,
  SchoolListItem,
  SchoolDetail,
} from "@/features/shared/types/api-types";

// District queries

export function useDistricts(params: {
  state?: string | null;
  status?: StatusFilter;
  salesExecutive?: string | null;
  search?: string;
  metric?: MetricType;
  year?: FiscalYear;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.state) searchParams.set("state", params.state);
  if (params.status && params.status !== "all")
    searchParams.set("status", params.status);
  if (params.salesExecutive) searchParams.set("salesExec", params.salesExecutive);
  if (params.search) searchParams.set("search", params.search);
  if (params.metric) searchParams.set("metric", params.metric);
  if (params.year) searchParams.set("year", params.year);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  return useQuery({
    queryKey: ["districts", params],
    queryFn: () =>
      fetchJson<{ districts: DistrictListItem[]; total: number }>(
        `${API_BASE}/districts?${searchParams}`
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes - district lists don't change often
  });
}

export function useDistrictDetail(leaid: string | null) {
  return useQuery({
    queryKey: ["district", leaid],
    queryFn: () => fetchJson<DistrictDetail>(`${API_BASE}/districts/${leaid}`),
    enabled: !!leaid,
    staleTime: 10 * 60 * 1000, // 10 minutes - district details rarely change
  });
}

// District edits mutations
export function useUpdateDistrictEdits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leaid,
      notes,
      owner,
    }: {
      leaid: string;
      notes?: string;
      owner?: string;
    }) =>
      fetchJson<DistrictEdits>(`${API_BASE}/districts/${leaid}/edits`, {
        method: "PUT",
        body: JSON.stringify({ notes, owner }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
    },
  });
}

// Batch operations
interface BatchEditParams {
  leaids?: string[];
  filters?: { column: string; op: string; value?: unknown }[];
  owner?: string;
  notes?: string;
}

export function useBatchEditDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaids, filters, owner, notes }: BatchEditParams) =>
      fetchJson<{ updated: number }>(`${API_BASE}/districts/batch-edits`, {
        method: "POST",
        body: JSON.stringify({ leaids, filters, owner, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

interface BatchTagParams {
  leaids?: string[];
  filters?: { column: string; op: string; value?: unknown }[];
  action: "add" | "remove";
  tagId: number;
}

export function useBatchTagDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaids, filters, action, tagId }: BatchTagParams) =>
      fetchJson<{ updated: number }>(`${API_BASE}/districts/batch-tags`, {
        method: "POST",
        body: JSON.stringify({ leaids, filters, action, tagId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

// Unmatched accounts
export function useUnmatchedByState(stateAbbrev: string | null) {
  return useQuery({
    queryKey: ["unmatched", stateAbbrev],
    queryFn: () =>
      fetchJson<UnmatchedAccount[]>(
        `${API_BASE}/unmatched?state=${stateAbbrev}`
      ),
    enabled: !!stateAbbrev,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useStateSummaries() {
  return useQuery({
    queryKey: ["unmatched", "summaries"],
    queryFn: () => fetchJson<StateSummary[]>(`${API_BASE}/unmatched/by-state`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Similar districts hook
export function useSimilarDistricts(params: {
  leaid: string | null;
  metrics: SimilarMetricKey[];
  tolerance: SimilarityTolerance;
  enabled?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params.leaid) searchParams.set("leaid", params.leaid);
  if (params.metrics.length > 0) searchParams.set("metrics", params.metrics.join(","));
  searchParams.set("tolerance", params.tolerance);

  return useQuery({
    queryKey: ["similarDistricts", params],
    queryFn: () =>
      fetchJson<SimilarDistrictsResponse>(
        `${API_BASE}/districts/similar?${searchParams}`
      ),
    enabled: params.enabled !== false && !!params.leaid && params.metrics.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes - expensive calculation
  });
}

// Schools by district (for district detail panel)
export function useSchoolsByDistrict(leaid: string | null) {
  return useQuery({
    queryKey: ["schoolsByDistrict", leaid],
    queryFn: () =>
      fetchJson<{ schools: SchoolListItem[]; total: number }>(
        `${API_BASE}/schools/by-district/${leaid}`
      ),
    enabled: !!leaid,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// School detail
export function useSchoolDetail(ncessch: string | null) {
  return useQuery({
    queryKey: ["school", ncessch],
    queryFn: () =>
      fetchJson<SchoolDetail>(`${API_BASE}/schools/${ncessch}`),
    enabled: !!ncessch,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Update school CRM fields
export function useUpdateSchoolEdits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ncessch,
      notes,
      owner,
    }: {
      ncessch: string;
      notes?: string;
      owner?: string;
    }) =>
      fetchJson<{ ncessch: string; notes: string | null; owner: string | null; updatedAt: string }>(
        `${API_BASE}/schools/${ncessch}/edits`,
        {
          method: "PATCH",
          body: JSON.stringify({ notes, owner }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["school", variables.ncessch] });
      queryClient.invalidateQueries({ queryKey: ["schoolsByDistrict"] });
    },
  });
}

// Create a new non-district account
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      accountType: string;
      stateAbbrev?: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      salesExecutive?: string;
      phone?: string;
      websiteUrl?: string;
    }) => {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create account");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
    },
  });
}

// Check for duplicate accounts by name (non-blocking warning)
export function useDuplicateCheck(name: string, state?: string) {
  return useQuery({
    queryKey: ["account-duplicates", name, state],
    queryFn: async () => {
      const params = new URLSearchParams({ name });
      if (state) params.set("state", state);
      const res = await fetch(`/api/accounts?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: name.length >= 3,
    staleTime: 5000,
  });
}
