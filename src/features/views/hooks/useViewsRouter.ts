"use client";

/**
 * URL parsing + navigation helper for the My Views feature.
 *
 * Reads the App Router pathname + searchParams to derive the active group and
 * view, and exposes mutators that round-trip through router.push() so the URL
 * is always the source of truth.
 *
 * URL shapes (see spec §"URL Structure"):
 *
 *   /views                            → portfolio, My plans tab (default)
 *   /views?bucket=team                → portfolio, Team plans tab
 *   /views?bucket=archived            → portfolio, Archived plans tab
 *   /views/plans/[planId]             → plan, default view (page redirects)
 *   /views/plans/[planId]/[viewId]    → plan, specific view
 *   /views/lists/[listId]             → list, default view (page redirects)
 *   /views/lists/[listId]/[viewId]    → list, specific view
 *
 * Notes:
 *   - Unknown viewIds are treated as null so the consumer can decide whether
 *     to redirect to the default view.
 *   - All navigation methods use router.push() (not replace) so back/forward
 *     work for view-switching.
 */
import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { isViewId, type ViewId } from "../lib/view-types";

export type GroupKind = "plan" | "list";

/** Portfolio tab buckets. "mine" is the default landing tab. */
export type PortfolioBucket = "mine" | "team" | "archived";

const PORTFOLIO_BUCKETS: PortfolioBucket[] = ["mine", "team", "archived"];

function isPortfolioBucket(v: string | null): v is PortfolioBucket {
  return v !== null && (PORTFOLIO_BUCKETS as string[]).includes(v);
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
  /**
   * Active portfolio tab. Reads `?bucket=mine|team|archived`; defaults to
   * "mine" when absent or invalid so a bare `/views` URL lands on the user's
   * own plans.
   */
  bucket: PortfolioBucket;
  /** Navigate to a specific group + optional view; preserves no query params. */
  goToGroup: (kind: GroupKind, id: string, viewId?: ViewId) => void;
  /** Navigate to the portfolio; optionally selecting a specific tab. */
  goToPortfolio: (bucket?: PortfolioBucket) => void;
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

  const bucketRaw = searchParams?.get("bucket") ?? null;
  const bucket: PortfolioBucket = isPortfolioBucket(bucketRaw) ? bucketRaw : "mine";

  const isPortfolio = parsed.groupKind === null && pathname.startsWith("/views");

  const goToGroup = useCallback(
    (kind: GroupKind, id: string, viewId?: ViewId) => {
      router.push(buildGroupPath(kind, id, viewId));
    },
    [router],
  );

  const goToPortfolio = useCallback(
    (next?: PortfolioBucket) => {
      // "mine" is the default landing tab, so a bare /views is canonical for it.
      router.push(next && next !== "mine" ? `/views?bucket=${next}` : "/views");
    },
    [router],
  );

  return {
    isPortfolio,
    groupKind: parsed.groupKind,
    groupId: parsed.groupId,
    viewId: parsed.viewId,
    bucket,
    goToGroup,
    goToPortfolio,
  };
}

/** Exported for unit tests — parses without React hooks. */
export const __test = { parsePath, buildGroupPath };
