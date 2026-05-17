import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

interface UseViewsDataArgs {
  source: SavedListSource;
  leaids: string[] | null;
  listId: string | null;
  /**
   * Plan id — required for virtual fields like `has_target` that compile to
   * a plan-scoped EXISTS subquery. Pass when the grid lives inside a plan.
   */
  planId?: string | null;
  layout: GridViewLayout;
  limit: number;
  offset: number;
}

export interface ViewsDataResponse {
  rows: Record<string, unknown>[];
  total: number;
  truncated?: boolean;
}

export function useViewsData(args: UseViewsDataArgs) {
  const { source, leaids, listId, planId, layout, limit, offset } = args;
  const filtersJson = JSON.stringify(layout.filters);
  const sortJson = JSON.stringify(layout.sort);
  const leaidsKey = leaids ? leaids.slice().sort().join(",") : "";
  const enabled = leaids !== null || listId !== null;

  const url = (() => {
    const params = new URLSearchParams({
      source,
      limit: String(limit),
      offset: String(offset),
    });
    if (leaids) params.set("leaids", leaids.join(","));
    if (listId) params.set("listId", listId);
    if (planId) params.set("planId", planId);
    if (layout.filters.children.length > 0) params.set("filters", filtersJson);
    for (const s of layout.sort) params.append("sort", `${s.id}:${s.dir}`);
    return `${API_BASE}/views/data?${params.toString()}`;
  })();

  return useQuery({
    queryKey: [
      "views",
      "data",
      source,
      leaidsKey,
      listId ?? "",
      planId ?? "",
      filtersJson,
      sortJson,
      limit,
      offset,
    ] as const,
    queryFn: () => fetchJson<ViewsDataResponse>(url),
    enabled,
    staleTime: 30 * 1000,
  });
}
