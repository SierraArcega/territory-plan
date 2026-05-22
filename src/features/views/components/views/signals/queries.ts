/**
 * TanStack Query hooks for the Signals view.
 *
 * Two read-only endpoints back the inline-accordion tree:
 *   - GET /api/signals          → summary (one row per in-scope district,
 *                                  per-type counts + newestSignalAt). Returns
 *                                  the FULL set; the client renders ≤50 and
 *                                  filters search over the loaded set.
 *   - GET /api/signals/[leaid]  → that district's merged reverse-chron items,
 *                                  server-paginated; fetched only on expand.
 *
 * Key discipline (CLAUDE.md): every query key is built from serialized
 * primitives — never raw arrays/objects — so deep-equal inputs share a cache
 * entry and reference-fresh inputs don't trigger phantom refetches.
 */
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import { leaidsKey } from "../_shared";
import type { SignalType, SignalWindow } from "@/lib/signals/sql";

// ── Wire shapes ──────────────────────────────────────────────────────────────

/** One district row in the summary payload. */
export interface SignalsSummaryDistrict {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  counts: { vac: number; news: number; rfp: number };
  /** ISO timestamp of the newest in-scope signal, or null for 0-signal rows. */
  newestSignalAt: string | null;
}

export interface SignalsSummaryResponse {
  districts: SignalsSummaryDistrict[];
  total: number;
}

/** One leaf signal in a district's expanded feed. */
export interface DistrictSignalItem {
  type: SignalType;
  /** Always a string on the wire — rfp ids are numeric server-side. */
  id: string;
  title: string;
  date: string;
  secondaryDate?: string | null;
  meta?: string | null;
}

export interface DistrictSignalsResponse {
  items: DistrictSignalItem[];
  hasMore: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Stable CSV of the active type codes, in canonical order, for both the
 * query-string param and the serialized query key. A `TypeMask`-shaped object
 * (or a partial) collapses to e.g. "news,rfp" so deep-equal masks share a key.
 */
export function typesCsv(types: {
  vac: boolean;
  news: boolean;
  rfp: boolean;
}): string {
  const active: SignalType[] = [];
  if (types.vac) active.push("vac");
  if (types.news) active.push("news");
  if (types.rfp) active.push("rfp");
  return active.join(",");
}

// ── Summary hook ───────────────────────────────────────────────────────────────

export interface UseSignalsSummaryArgs {
  parentKind: "plan" | "list";
  parentId: string;
  /** Resolved leaid set (lists, Phase E). Null for plans (server derives them). */
  leaids: string[] | null;
  types: { vac: boolean; news: boolean; rfp: boolean };
  since: SignalWindow;
}

/**
 * Fetch the full district summary for the active scope.
 *
 * - Plans pass `planId` so the server resolves the full leaid set (enabling
 *   0-signal rows). Lists today resolve to a null leaid set → the hook stays
 *   disabled and the view shows a "coming soon" note.
 * - `enabled` for plans, or for lists once a non-null `leaids` set arrives.
 */
export function useSignalsSummary({
  parentKind,
  parentId,
  leaids,
  types,
  since,
}: UseSignalsSummaryArgs) {
  const csv = typesCsv(types);
  const enabled = parentKind === "plan" || (leaids !== null && leaids.length > 0);
  // Plans derive leaids server-side from parentId (planId), so leaidsKey is
  // "none" and parentId disambiguates. Lists pass an explicit set — include it
  // so two resolved scopes for the same list id can't collide (Phase E).
  const scopeKey = parentKind === "plan" ? "plan" : leaidsKey(leaids);

  return useQuery<SignalsSummaryResponse, Error>({
    queryKey: ["signals-summary", parentKind, parentId, csv, since, scopeKey] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      if (parentKind === "plan") {
        params.set("planId", parentId);
      } else if (leaids && leaids.length > 0) {
        params.set("leaids", leaids.join(","));
      }
      if (csv) params.set("types", csv);
      params.set("since", since);
      return fetchJson<SignalsSummaryResponse>(
        `${API_BASE}/signals?${params.toString()}`,
      );
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

// ── Per-district items hook ──────────────────────────────────────────────────

export interface UseDistrictSignalsArgs {
  leaid: string;
  types: { vac: boolean; news: boolean; rfp: boolean };
  since: SignalWindow;
  /** 1-based page; limit grows to page*50 (offset stays 0), like GridView. */
  page: number;
  /** Only fetch when the district is expanded. */
  enabled: boolean;
}

/**
 * Fetch one district's merged reverse-chronological signal feed.
 *
 * Mirrors GridView's show-more pattern: `limit = page * 50`, `offset = 0`
 * (re-fetches the whole window each page). Mounted only when its
 * `SignalDistrictRow` is expanded, so it owns its own query per the
 * conditional-rendering rule.
 */
export function useDistrictSignals({
  leaid,
  types,
  since,
  page,
  enabled,
}: UseDistrictSignalsArgs) {
  const csv = typesCsv(types);
  const limit = page * 50;

  return useQuery<DistrictSignalsResponse, Error>({
    queryKey: ["district-signals", leaid, csv, since, page] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      if (csv) params.set("types", csv);
      params.set("since", since);
      params.set("limit", String(limit));
      params.set("offset", "0");
      return fetchJson<DistrictSignalsResponse>(
        `${API_BASE}/signals/${encodeURIComponent(leaid)}?${params.toString()}`,
      );
    },
    enabled,
    staleTime: 60 * 1000,
  });
}
