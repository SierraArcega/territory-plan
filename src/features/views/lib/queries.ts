/**
 * TanStack Query hooks for the Saved Views feature.
 *
 * Wire-shape consumers — plan/list/preview/entity fetches and the small set
 * of mutations the My Views sidebar needs. The hooks intentionally do not
 * own UI state (filtering, ordering, etc.); that lives in the URL or the
 * sidebar's Zustand store.
 *
 * Key conventions (per CLAUDE.md):
 *   - All query keys use serialized primitives. Filter trees are
 *     JSON.stringify()'d before going into a key so reference-equality
 *     refetches stop happening.
 *   - useListPreview debounces the spec by 300ms before issuing the request.
 *   - Mutations invalidate the smallest possible cache slice to avoid
 *     cascading refetches.
 */
import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import type {
  FilterNode,
  SavedListSource,
  ScopeMode,
  ScopeRefKind,
} from "@/lib/saved-views/filter-tree";
import type { DetailKind } from "./view-types";

// ── Plan + List response shapes ────────────────────────────────────────────

/**
 * Subset of the territory-plan response we need in the sidebar. Mirrors the
 * shape returned by GET /api/territory-plans?stats=1; the actual response
 * has many more fields we don't need here.
 */
export interface PlanWithStats {
  id: string;
  name: string;
  color: string | null;
  status: string;
  fiscalYear: number;
  districtCount: number;
  districtLeaids: string[];
  owner: { id: string; fullName: string | null; avatarUrl: string | null } | null;
  hidden: boolean;
  // ?stats=1 computed fields
  progress: number | null;
  pipelineValue: number;
  contactsCount: number;
  oppsCount: number;
}

export interface SavedListSummary {
  id: string;
  name: string;
  source: SavedListSource;
  filterTree: FilterNode;
  scopeMode: ScopeMode;
  scopeFilterTree: FilterNode | null;
  scopeRefKind: ScopeRefKind | null;
  scopeRefId: string | null;
  shared: boolean;
  ownerId: string;
  owner: { id: string; fullName: string | null; avatarUrl: string | null } | null;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
}

interface ListsResponse {
  lists: SavedListSummary[];
}

// ── Plans ───────────────────────────────────────────────────────────────────

/**
 * Fetch all plans the user can see, with computed stats (progress, pipeline,
 * contacts, opps). Used by the sidebar's Plans subsection AND the portfolio.
 *
 * Uses the canonical `/api/territory-plans` path (per Phase A deviation —
 * /api/plans is the legacy alias, /api/territory-plans is the source of truth).
 */
export function usePlansWithStats(showHidden = false) {
  const url = `${API_BASE}/territory-plans?stats=1${showHidden ? "&showHidden=1" : ""}`;
  return useQuery({
    queryKey: ["views", "plans", "stats", showHidden] as const,
    queryFn: () => fetchJson<PlanWithStats[]>(url),
    staleTime: 60 * 1000, // 1 minute — sidebar tolerates slightly stale data
  });
}

// ── Lists ───────────────────────────────────────────────────────────────────

export function useLists(showHidden = false) {
  const url = `${API_BASE}/lists${showHidden ? "?showHidden=1" : ""}`;
  return useQuery({
    queryKey: ["views", "lists", showHidden] as const,
    queryFn: () => fetchJson<ListsResponse>(url).then((r) => r.lists),
    staleTime: 60 * 1000,
  });
}

export function useList(id: string | null) {
  return useQuery({
    queryKey: ["views", "list", id] as const,
    queryFn: () => fetchJson<SavedListSummary>(`${API_BASE}/lists/${id}`),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

// ── List mutations ──────────────────────────────────────────────────────────

interface CreateListBody {
  name: string;
  source: SavedListSource;
  filterTree: FilterNode;
  scopeMode?: ScopeMode;
  scopeFilterTree?: FilterNode | null;
  scopeRefKind?: ScopeRefKind | null;
  scopeRefId?: string | null;
  shared?: boolean;
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateListBody) =>
      fetchJson<SavedListSummary>(`${API_BASE}/lists`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "lists"] });
    },
  });
}

interface UpdateListBody {
  id: string;
  data: Partial<Omit<CreateListBody, "source">>;
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: UpdateListBody) =>
      fetchJson<SavedListSummary>(`${API_BASE}/lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["views", "lists"] });
      qc.invalidateQueries({ queryKey: ["views", "list", id] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`${API_BASE}/lists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "lists"] });
    },
  });
}

// ── Hide / unhide ───────────────────────────────────────────────────────────

interface HideArgs {
  id: string;
}

/**
 * Per-user hide for a SavedList. Optimistic — the sidebar removes the row
 * before the API responds; on failure we refetch to restore.
 */
export function useHideList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: HideArgs) =>
      fetchJson<{ ok: true }>(`${API_BASE}/lists/${id}/hide`, {
        method: "POST",
        body: JSON.stringify({ hidden: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "lists"] });
    },
  });
}

export function useUnhideList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: HideArgs) =>
      fetchJson<{ ok: true }>(`${API_BASE}/lists/${id}/hide`, {
        method: "POST",
        body: JSON.stringify({ hidden: false }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "lists"] });
    },
  });
}

/**
 * Per-user hide for a TerritoryPlan. Uses the canonical
 * /api/territory-plans/[id]/hide route (per Phase A deviation note).
 */
export function useHidePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: HideArgs) =>
      fetchJson<{ ok: true }>(`${API_BASE}/territory-plans/${id}/hide`, {
        method: "POST",
        body: JSON.stringify({ hidden: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "plans"] });
    },
  });
}

export function useUnhidePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: HideArgs) =>
      fetchJson<{ ok: true }>(`${API_BASE}/territory-plans/${id}/hide`, {
        method: "POST",
        body: JSON.stringify({ hidden: false }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "plans"] });
    },
  });
}

// ── Live preview (debounced) ────────────────────────────────────────────────

export interface PreviewSpec {
  source: SavedListSource;
  filterTree: FilterNode;
  scopeMode?: ScopeMode;
  scopeFilterTree?: FilterNode | null;
  scopeRefKind?: ScopeRefKind | null;
  scopeRefId?: string | null;
}

export interface PreviewSample {
  id: string | number;
  primaryLabel: string | null;
  secondaryLabel: string | null;
  meta: string | number | boolean | null;
}

export interface PreviewResponse {
  count: number | null;
  sample: PreviewSample[];
  truncated?: boolean;
}

/**
 * Internal tiny debounce — local-only because we don't have a shared
 * useDebounce primitive yet and pulling one in would widen the diff.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Debounced live-preview hook for the list builder.
 *
 * The spec is JSON-serialized into a string before it enters the query key,
 * so referentially-fresh-but-deep-equal specs do NOT trigger a refetch (per
 * CLAUDE.md "stable query keys" rule).
 *
 * Debounce: 300ms by default — overridable for tests via `options.debounceMs`.
 */
export function useListPreview(
  spec: PreviewSpec | null,
  options?: {
    debounceMs?: number;
    enabled?: boolean;
    queryOptions?: Omit<
      UseQueryOptions<PreviewResponse, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  const debounceMs = options?.debounceMs ?? 300;

  // Serialize the spec to a stable string up-front so both the debounce
  // dependency AND the query key are primitives. Deep-equal specs share a key.
  const serialized = useMemo(
    () => (spec ? JSON.stringify(spec) : null),
    [spec],
  );
  const debouncedSerialized = useDebouncedValue(serialized, debounceMs);

  return useQuery<PreviewResponse, Error>({
    queryKey: ["views", "list-preview", debouncedSerialized] as const,
    queryFn: () => {
      if (!debouncedSerialized) {
        throw new Error("Missing preview spec");
      }
      return fetchJson<PreviewResponse>(`${API_BASE}/lists/preview`, {
        method: "POST",
        body: debouncedSerialized,
      });
    },
    enabled: !!debouncedSerialized && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    ...options?.queryOptions,
  });
}

// ── Entity detail fetcher ───────────────────────────────────────────────────

/**
 * Routing helper — picks the right detail endpoint for the given kind. The
 * endpoints all live under /api but have different path shapes (districts
 * key on leaid, others on id, vacancies/news/rfps under their own paths).
 *
 * Phase A landed the new opportunities/news/rfps endpoints; districts and
 * contacts predate this feature.
 */
function entityUrl(kind: DetailKind, id: string): string {
  switch (kind) {
    case "district":
      return `${API_BASE}/districts/${encodeURIComponent(id)}`;
    case "contact":
      return `${API_BASE}/contacts/${encodeURIComponent(id)}`;
    case "opp":
      return `${API_BASE}/opportunities/${encodeURIComponent(id)}`;
    case "vacancy":
      return `${API_BASE}/vacancies/${encodeURIComponent(id)}`;
    case "news":
      return `${API_BASE}/news/${encodeURIComponent(id)}`;
    case "rfp":
      return `${API_BASE}/rfps/${encodeURIComponent(id)}`;
    default: {
      // Exhaustiveness guard.
      const _exhaustive: never = kind;
      throw new Error(`Unknown detail kind: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Generic detail fetcher used by the detail-panel kind dispatchers (Phase D).
 *
 * Typed as `unknown` because each entity kind returns a different shape; the
 * detail-content components own the runtime shape narrowing.
 */
export function useEntity(kind: DetailKind | null, id: string | null) {
  const enabled = kind != null && id != null;
  return useQuery<unknown, Error>({
    queryKey: ["views", "entity", kind, id] as const,
    queryFn: () => {
      if (!kind || !id) throw new Error("Missing kind/id");
      return fetchJson(entityUrl(kind, id));
    },
    enabled,
    staleTime: 60 * 1000,
  });
}
