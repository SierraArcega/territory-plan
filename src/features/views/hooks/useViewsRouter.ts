"use client";

/**
 * URL parsing + navigation helper for the My Views feature.
 *
 * Reads the App Router pathname + searchParams to derive the active group,
 * view, and detail-panel state, and exposes mutators that round-trip through
 * router.push() so the URL is always the source of truth.
 *
 * URL shapes (see spec §"URL Structure"):
 *
 *   /views                                         → portfolio
 *   /views?archived=1                              → portfolio, Archived tab
 *   /views/plans/[planId]                          → plan, default view (page redirects)
 *   /views/plans/[planId]/[viewId]                 → plan, specific view
 *   /views/plans/[planId]/[viewId]?detail=kind:id  → plan view + detail panel
 *   /views/lists/[listId]                          → list, default view (page redirects)
 *   /views/lists/[listId]/[viewId]                 → list, specific view
 *   /views/lists/[listId]/[viewId]?detail=kind:id  → list view + detail panel
 *
 * Notes:
 *   - Unknown viewIds are treated as null so the consumer can decide whether
 *     to redirect to the default view.
 *   - Detail panel reads ?detail=[kind]:[id]; malformed values yield null so
 *     the caller can render the view body without a panel.
 *   - All navigation methods use router.push() (not replace) so back/forward
 *     work for view-switching and detail-panel toggles.
 */
import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  isDetailKind,
  isViewId,
  type DetailKind,
  type ViewId,
} from "../lib/view-types";

export type GroupKind = "plan" | "list";

export interface DetailState {
  kind: DetailKind;
  id: string;
}

export interface ViewsRouter {
  /** True when the current URL is the /views portfolio (no group selected). */
  isPortfolio: boolean;
  /** Which kind of group is active (plan vs. list), or null on portfolio. */
  groupKind: GroupKind | null;
  /** Active group's database id (planId or listId), or null on portfolio. */
  groupId: string | null;
  /**
   * Active view id, or null when the URL only specifies a group (the page
   * for that case is expected to redirect to the default view).
   */
  viewId: ViewId | null;
  /** Detail-panel state parsed from ?detail=[kind]:[id], or null. */
  detail: DetailState | null;
  /** Whether the portfolio is in Archived tab mode (?archived=1). */
  showArchived: boolean;
  /** Navigate to a specific group + optional view; preserves no query params. */
  goToGroup: (kind: GroupKind, id: string, viewId?: ViewId) => void;
  /** Navigate to the portfolio; optionally selecting the Archived tab. */
  goToPortfolio: (showArchived?: boolean) => void;
  /** Open the detail panel on the current view, preserving everything else. */
  openDetail: (kind: DetailKind, id: string) => void;
  /** Close the detail panel by removing the ?detail param. */
  closeDetail: () => void;
}

/**
 * Parses a path of shape /views/<kind>/<id>[/<viewId>] into its segments.
 *
 * Returns null when the path is /views (portfolio) or anything outside the
 * /views/* tree.
 */
function parsePath(pathname: string): {
  groupKind: GroupKind | null;
  groupId: string | null;
  viewId: ViewId | null;
} {
  // Strip leading slash + split. Tolerate trailing slash for paranoia.
  const segs = pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/");
  // segs[0] should be "views" for any URL that mounts this hook; if it isn't,
  // return a null shape so consumers don't blow up during a transition.
  if (segs[0] !== "views") {
    return { groupKind: null, groupId: null, viewId: null };
  }
  if (segs.length === 1) {
    // /views — portfolio
    return { groupKind: null, groupId: null, viewId: null };
  }
  const kindSeg = segs[1];
  if (kindSeg !== "plans" && kindSeg !== "lists") {
    return { groupKind: null, groupId: null, viewId: null };
  }
  const groupKind: GroupKind = kindSeg === "plans" ? "plan" : "list";
  const groupId = segs[2] ?? null;
  const viewSeg = segs[3];
  const viewId = viewSeg && isViewId(viewSeg) ? viewSeg : null;
  return { groupKind, groupId, viewId };
}

/**
 * Parses a ?detail=kind:id query param. Returns null when missing or malformed
 * — callers can treat null as "panel closed".
 */
function parseDetailParam(raw: string | null): DetailState | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx <= 0 || idx === raw.length - 1) return null;
  const kind = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!isDetailKind(kind)) return null;
  // Tight id length cap to avoid pathological URL lengths from a malformed
  // server response or copy-paste accident.
  if (id.length === 0 || id.length > 200) return null;
  return { kind, id };
}

/** Build /views/<plural-kind>/<id>[/<viewId>] from primitives. */
export function buildGroupPath(
  kind: GroupKind,
  id: string,
  viewId?: ViewId,
): string {
  const kindSeg = kind === "plan" ? "plans" : "lists";
  // Always encode the id — list/plan ids are uuids today but the path must
  // remain robust if the format changes.
  const idSeg = encodeURIComponent(id);
  return viewId
    ? `/views/${kindSeg}/${idSeg}/${viewId}`
    : `/views/${kindSeg}/${idSeg}`;
}

export function useViewsRouter(): ViewsRouter {
  const router = useRouter();
  const pathname = usePathname() ?? "/views";
  const searchParams = useSearchParams();

  // Derive the URL-driven state. useMemo keeps the returned object stable for
  // consumers that pass it to dependency arrays, though we never spread the
  // whole object into selectors.
  const parsed = useMemo(() => parsePath(pathname), [pathname]);

  const detailRaw = searchParams?.get("detail") ?? null;
  const detail = useMemo(() => parseDetailParam(detailRaw), [detailRaw]);

  const showArchived = searchParams?.get("archived") === "1";

  const isPortfolio = parsed.groupKind === null && pathname.startsWith("/views");

  const goToGroup = useCallback(
    (kind: GroupKind, id: string, viewId?: ViewId) => {
      router.push(buildGroupPath(kind, id, viewId));
    },
    [router],
  );

  const goToPortfolio = useCallback(
    (archived?: boolean) => {
      router.push(archived ? "/views?archived=1" : "/views");
    },
    [router],
  );

  const openDetail = useCallback(
    (kind: DetailKind, id: string) => {
      // Build a fresh URLSearchParams from the current one so we don't drop
      // sibling params (e.g. archived).
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.set("detail", `${kind}:${id}`);
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("detail");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams]);

  return {
    isPortfolio,
    groupKind: parsed.groupKind,
    groupId: parsed.groupId,
    viewId: parsed.viewId,
    detail,
    showArchived,
    goToGroup,
    goToPortfolio,
    openDetail,
    closeDetail,
  };
}

/** Exported for unit tests — parses without React hooks. */
export const __test = { parsePath, parseDetailParam, buildGroupPath };
