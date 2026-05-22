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
import type { ViewLayouts } from "@/lib/saved-views/grid-layout-schema";

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
  collaborators: { id: string; fullName: string | null; avatarUrl: string | null }[];
  hidden: boolean;
  // Plan-level target rollups (always returned by /api/territory-plans).
  // The portfolio aggregates these into the "Total target" stat.
  renewalRollup: number;
  expansionRollup: number;
  winbackRollup: number;
  newBusinessRollup: number;
  /** Sum of plan-district pipeline rollups — used for the per-card pipeline stat. */
  pipelineTotal: number;
  // ?stats=1 computed fields
  progress: number | null;
  pipelineValue: number;
  contactsCount: number;
  oppsCount: number;
  /** Sum of `minimum_purchase_amount` over the plan's Closed Won opps in the plan FY. */
  closedWonMinCommit: number;
  recentNewsCount: number;
  // Per-plan column/sort/filter layout, keyed by view-type slot.
  // Null when the plan has never had a view layout saved; undefined in legacy
  // responses that predate the field (treated the same as null at the call site).
  viewLayouts?: ViewLayouts;
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
  // Per-list column/sort/filter layout, keyed by view-type slot.
  // Null when the list has never had a view layout saved.
  viewLayouts?: ViewLayouts;
}

interface ListsResponse {
  lists: SavedListSummary[];
}

// ── Plans ───────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's plans — the ones they own or collaborate on — with
 * computed stats (progress, pipeline, contacts, opps). Used by the sidebar's
 * Plans subsection AND the portfolio. The `mine=1` flag scopes the shared
 * /api/territory-plans endpoint to the logged-in user (the endpoint defaults to
 * all plans for the leaderboard / map search / filter dropdowns).
 *
 * Uses the canonical `/api/territory-plans` path (per Phase A deviation —
 * /api/plans is the legacy alias, /api/territory-plans is the source of truth).
 */
export function usePlansWithStats(showHidden = false, mine = true) {
  const mineParam = mine ? "&mine=1" : "";
  const hiddenParam = showHidden ? "&showHidden=1" : "";
  const url = `${API_BASE}/territory-plans?stats=1${mineParam}${hiddenParam}`;
  return useQuery({
    queryKey: ["views", "plans", "stats", showHidden, mine] as const,
    queryFn: () => fetchJson<PlanWithStats[]>(url),
    staleTime: 60 * 1000,
  });
}

// ── Lists ───────────────────────────────────────────────────────────────────

export function useLists(showHidden = false, enabled = true) {
  const url = `${API_BASE}/lists${showHidden ? "?showHidden=1" : ""}`;
  return useQuery({
    queryKey: ["views", "lists", showHidden] as const,
    queryFn: () => fetchJson<ListsResponse>(url).then((r) => r.lists),
    staleTime: 60 * 1000,
    // Lists is feature-gated; callers pass `false` to skip the fetch entirely
    // when the Lists UI is hidden (conditional fetching over a wasted request).
    enabled,
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

// ── Layout mutations ────────────────────────────────────────────────────────

/**
 * Persist a full viewLayouts blob onto a territory plan.
 * Called by useGridLayout after its 500ms debounce fires.
 *
 * Invalidation matches the canonical key shapes used by usePlansWithStats
 * (["views", "plans", ...]) and any single-plan fetch (["views", "plan", id]).
 * There is no single-plan fetch hook today, but the key is reserved here so
 * it invalidates correctly when one is added.
 */
export function useUpdatePlanLayout(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (viewLayouts: ViewLayouts) =>
      fetchJson(`${API_BASE}/territory-plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({ viewLayouts }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "plans"] });
      qc.invalidateQueries({ queryKey: ["views", "plan", planId] });
    },
  });
}

/**
 * Persist a full viewLayouts blob onto a saved list.
 * Called by useGridLayout after its 500ms debounce fires.
 *
 * Invalidation matches ["views", "lists"] (useLists) and
 * ["views", "list", id] (useList).
 */
export function useUpdateListLayout(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (viewLayouts: ViewLayouts) =>
      fetchJson(`${API_BASE}/lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ viewLayouts }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "lists"] });
      qc.invalidateQueries({ queryKey: ["views", "list", listId] });
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

// ── Plan-district inline edits ──────────────────────────────────────────────

interface UpdatePlanDistrictArgs {
  churnRisk?: string | null;
  notes?: string | null;
}

/**
 * Optimistic per-plan-per-district mutation. Used by ChurnRiskCell.
 * Invalidates the active views/data cache key so the next
 * fetch is fresh; the optimistic update keeps the cell snappy in the
 * meantime.
 */
export function useUpdatePlanDistrict(planId: string, leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePlanDistrictArgs) =>
      fetchJson<{ churnRisk: string | null; notes: string | null }>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        { method: "PUT", body: JSON.stringify(data) },
      ),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["views", "data"] });
      // Patch every "views","data" page in the cache for this row.
      const updaters: Array<{ key: readonly unknown[]; previous: unknown }> = [];
      const queries = qc.getQueriesData<{ rows: Record<string, unknown>[] }>({
        queryKey: ["views", "data"],
      });
      for (const [key, data] of queries) {
        if (!data?.rows) continue;
        updaters.push({ key, previous: data });
        qc.setQueryData(key, {
          ...data,
          rows: data.rows.map((r) =>
            r.leaid === leaid
              ? {
                  ...r,
                  ...(vars.churnRisk !== undefined ? { churnRisk: vars.churnRisk } : {}),
                  ...(vars.notes !== undefined ? { planNotes: vars.notes } : {}),
                }
              : r,
          ),
        });
      }
      return { updaters };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back every page we patched.
      for (const u of ctx?.updaters ?? []) {
        qc.setQueryData(u.key, u.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["views", "data"] });
    },
  });
}

// ── District notes log ──────────────────────────────────────────────────────

export interface DistrictNoteEntry {
  id: string;
  bodyJson: unknown;
  bodyText: string;
  noteType: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; fullName: string | null; email: string; avatarUrl: string | null };
}

export function useDistrictNotes(leaid: string | null) {
  return useQuery({
    queryKey: ["district-notes", leaid],
    queryFn: () =>
      fetchJson<{ notes: DistrictNoteEntry[] }>(`${API_BASE}/districts/${leaid}/notes`).then((r) => r.notes),
    enabled: !!leaid,
    staleTime: 30 * 1000,
  });
}

interface CreateArgs { leaid: string; bodyJson: unknown; bodyText: string; noteType?: string }
interface UpdateArgs { leaid: string; noteId: string; bodyJson: unknown; bodyText: string; noteType?: string }
interface DeleteArgs { leaid: string; noteId: string }

/** Invalidate the leaid's note list AND the grid data (cell snippet/count). */
function invalidateNotes(qc: ReturnType<typeof useQueryClient>, leaid: string) {
  qc.invalidateQueries({ queryKey: ["district-notes", leaid] });
  qc.invalidateQueries({ queryKey: ["views", "data"] });
}

export function useCreateDistrictNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaid, bodyJson, bodyText, noteType }: CreateArgs) =>
      fetchJson<DistrictNoteEntry>(`${API_BASE}/districts/${leaid}/notes`, {
        method: "POST",
        body: JSON.stringify({ bodyJson, bodyText, noteType }),
      }),
    onSuccess: (_d, v) => invalidateNotes(qc, v.leaid),
  });
}

export function useUpdateDistrictNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaid, noteId, bodyJson, bodyText, noteType }: UpdateArgs) =>
      fetchJson<DistrictNoteEntry>(`${API_BASE}/districts/${leaid}/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ bodyJson, bodyText, noteType }),
      }),
    onSuccess: (_d, v) => invalidateNotes(qc, v.leaid),
  });
}

export function useDeleteDistrictNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaid, noteId }: DeleteArgs) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/districts/${leaid}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => invalidateNotes(qc, v.leaid),
  });
}
