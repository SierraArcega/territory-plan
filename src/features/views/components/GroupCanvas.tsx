"use client";

/**
 * GroupCanvas — the shared wrapper for Plan/List views.
 *
 * Composition:
 *   - GroupHeader (eyebrow + title + stats/chips + action buttons)
 *   - ViewTabsStrip (8 view tabs + "+ View")
 *   - CanvasBody (scrollable body hosting the active view)
 *
 * Data fetching:
 *   - Plans: `usePlansWithStats()` (already cached by the sidebar mount;
 *     this hook re-uses that cache).
 *   - Lists: `useList(id)` (single record with `filterTree`).
 */
import { useMemo, type ReactNode } from "react";
import {
  usePlansWithStats,
  useList,
  type PlanWithStats,
  type SavedListSummary,
} from "../lib/queries";
import type { ViewId } from "../lib/view-types";
import type { GroupKind } from "../hooks/useViewsRouter";
import GroupHeader from "./GroupHeader";
import ViewTabsStrip from "./ViewTabsStrip";
import MapViewContainer from "./views/MapViewContainer";
import TableView from "./views/TableView";
import KanbanView from "./views/KanbanView";
import ContactsView from "./views/ContactsView";
import OppsView from "./views/OppsView";
import SignalsView from "./views/signals/SignalsView";

export interface GroupCanvasProps {
  kind: GroupKind;
  groupId: string;
  viewId: ViewId;
}

/**
 * Extract the leaid set in scope for the active Plan/List, used to filter
 * entity views and the map. For lists we use the preview-style derivation
 * (Phase E will wire the live preview); for v1 we leave the leaid set null
 * for lists and let each view fall back to the global scope it knows.
 */
function useScopeLeaids(
  kind: GroupKind,
  groupId: string,
  plan: PlanWithStats | null,
): string[] | null {
  return useMemo(() => {
    if (kind === "plan") {
      return plan?.districtLeaids ?? [];
    }
    // Lists: returning null means "no narrowing" — views default to a
    // sample/empty state until Phase E wires the list preview's sample leaids.
    return null;
  }, [kind, plan, groupId]);
}

export default function GroupCanvas({
  kind,
  groupId,
  viewId,
}: GroupCanvasProps) {
  // Plans / lists share the same TanStack cache as the sidebar, so this is
  // effectively a free lookup once the sidebar has fetched.
  const plansQ = usePlansWithStats(false, false);
  const plan = useMemo(() => {
    if (kind !== "plan") return null;
    return plansQ.data?.find((p) => p.id === groupId) ?? null;
  }, [kind, plansQ.data, groupId]);

  const listQ = useList(kind === "list" ? groupId : null);
  const list = kind === "list" ? listQ.data ?? null : null;

  const leaids = useScopeLeaids(kind, groupId, plan);

  // Group-level loading: skeleton header while the matching group is missing.
  const isInitialLoading =
    (kind === "plan" && plansQ.isLoading) ||
    (kind === "list" && listQ.isLoading);

  // Not found: API resolved but no row. The dynamic route still mounts; we
  // surface a friendly "couldn't load" panel rather than crash.
  const notFound =
    (kind === "plan" && !plansQ.isLoading && !plan && plansQ.isSuccess) ||
    (kind === "list" && !listQ.isLoading && !list && listQ.isSuccess);

  return (
    <section className="h-full min-w-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
      {isInitialLoading ? (
        <HeaderSkeleton />
      ) : notFound ? (
        <NotFound kind={kind} />
      ) : (
        <>
          <GroupHeader kind={kind} viewId={viewId} plan={plan} list={list} />
          <ViewTabsStrip
            kind={kind}
            groupId={groupId}
            activeViewId={viewId}
          />
          <CanvasBody
            kind={kind}
            viewId={viewId}
            leaids={leaids}
            plan={plan}
            list={list}
            parentId={groupId}
          />
        </>
      )}
    </section>
  );
}

// ── CanvasBody ─────────────────────────────────────────────────────────────

interface CanvasBodyProps {
  kind: GroupKind;
  viewId: ViewId;
  leaids: string[] | null;
  plan: PlanWithStats | null;
  list: SavedListSummary | null;
  /** Resolved parent id (plan.id or list.id) — forwarded to view bodies. */
  parentId: string;
}

function CanvasBody({
  kind,
  viewId,
  leaids,
  plan,
  list,
  parentId,
}: CanvasBodyProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden relative">
      <ViewBody
        kind={kind}
        viewId={viewId}
        leaids={leaids}
        plan={plan}
        list={list}
        parentId={parentId}
      />
    </div>
  );
}

function ViewBody({
  kind,
  viewId,
  leaids,
  plan,
  list,
  parentId,
}: CanvasBodyProps): ReactNode {
  // Resolve the saved layouts blob from whichever parent record is active.
  // This is passed to view bodies so useGridLayout can seed its state without
  // a second fetch (the hook is "caller-feeds-saved-layouts").
  const savedLayouts = kind === "plan" ? plan?.viewLayouts ?? null : list?.viewLayouts ?? null;

  switch (viewId) {
    case "map":
      return (
        <MapViewContainer
          leaids={leaids}
          planId={kind === "plan" ? plan?.id ?? null : null}
          contextLabel={plan?.name ?? list?.name ?? null}
        />
      );
    case "table":
      return (
        <TableView
          leaids={leaids}
          parentKind={kind}
          parentId={parentId}
          savedLayouts={savedLayouts}
        />
      );
    case "kanban":
      return (
        <KanbanView
          leaids={leaids}
          fiscalYear={plan?.fiscalYear ?? null}
          planId={plan?.id ?? null}
          savedLayouts={savedLayouts}
        />
      );
    case "contacts":
      return (
        <ContactsView
          leaids={leaids}
          parentKind={kind}
          parentId={parentId}
          savedLayouts={savedLayouts}
        />
      );
    case "opps":
      return (
        <OppsView
          leaids={leaids}
          parentKind={kind}
          parentId={parentId}
          savedLayouts={savedLayouts}
        />
      );
    case "signals":
      return (
        <SignalsView
          leaids={leaids}
          parentKind={kind}
          parentId={parentId}
          savedLayouts={savedLayouts}
        />
      );
    default: {
      const _: never = viewId;
      throw new Error(`Unhandled view id: ${String(_)}`);
    }
  }
}

// ── Loading / not-found chrome ─────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <header className="bg-white border-b border-[#D4CFE2] px-5 py-4 flex-shrink-0">
      <div className="h-3 w-16 rounded bg-[#EFEDF5] animate-pulse mb-3" />
      <div className="h-5 w-48 rounded bg-[#EFEDF5] animate-pulse" />
      <div
        className="mt-3 grid gap-x-4 gap-y-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="h-2.5 w-14 rounded bg-[#F7F5FA] animate-pulse mb-2" />
            <div className="h-3.5 w-20 rounded bg-[#EFEDF5] animate-pulse" />
          </div>
        ))}
      </div>
    </header>
  );
}

function NotFound({ kind }: { kind: GroupKind }) {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="max-w-sm text-center">
        <h2 className="text-base font-semibold text-[#403770] whitespace-nowrap">
          {kind === "plan" ? "Plan" : "List"} not found
        </h2>
        <p className="mt-2 text-[12px] text-[#8A80A8]">
          It may have been deleted, archived, or hidden by its owner.
        </p>
      </div>
    </div>
  );
}
