import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ExploreResponse } from "@/features/shared/types/api-types";

export function useExploreData<T = Record<string, unknown>>(
  entity: string,
  params: {
    filters?: { id: string; column: string; op: string; value: unknown }[];
    sorts?: { column: string; direction: "asc" | "desc" }[];
    page?: number;
    pageSize?: number;
    columns?: string[];
  }
) {
  const searchParams = new URLSearchParams();
  if (params.filters && params.filters.length > 0) {
    searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.sorts && params.sorts.length > 0) {
    searchParams.set("sorts", JSON.stringify(params.sorts));
  }
  if (params.columns && params.columns.length > 0) {
    searchParams.set("columns", params.columns.join(","));
  }
  searchParams.set("page", String(params.page || 1));
  searchParams.set("pageSize", String(params.pageSize || 50));

  return useQuery({
    queryKey: ["explore", entity, params],
    queryFn: () =>
      fetchJson<ExploreResponse<T>>(
        `${API_BASE}/explore/${entity}?${searchParams}`
      ),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
