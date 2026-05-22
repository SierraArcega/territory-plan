"use client";

/**
 * SignalsView — the `case "signals"` body. Inline-accordion tree of districts,
 * each expanding into one mixed reverse-chronological signal feed.
 *
 * Responsibilities:
 *   - Owns toolbar state (types / since / search / expandAll) in ONE batched
 *     setState so a single toggle never cascades multiple re-renders.
 *   - Fetches the district summary (`useSignalsSummary`); filters by search
 *     client-side (no refetch); renders ≤50 rows with a "Show more districts"
 *     button; shows a filter-hint banner at 200+ matches.
 *   - Expand-all drives a controlled expand set; each row still lazy-loads its
 *     own feed on expand.
 *   - Freshness watermark: reads `signals:lastVisit:{kind}:{id}` from
 *     localStorage into a ref on mount, writes `now` on unmount (cleanup).
 *
 * States:
 *   - List scope (leaids null & not a plan) → "Signals for lists coming soon".
 *   - Summary loading → skeleton district rows.
 *   - Summary error → ErrorState with retry.
 *   - Whole-empty (filters exclude everything) → EmptyState + reset.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { RadioTower } from "lucide-react";
import type { ViewBodyProps } from "../_shared";
import {
  EmptyState,
  ErrorState,
  FilterHintBanner,
  ViewScroll,
} from "../_shared";
import GridPager from "../../grid/GridPager";
import { GRID_PAGE_SIZE, pageMeta } from "../../grid/grid-pagination";
import { useSignalsSummary } from "./queries";
import SignalsControls, { type SignalsToolbarState } from "./SignalsControls";
import SignalDistrictRow from "./SignalDistrictRow";

const INITIAL_TOOLBAR: SignalsToolbarState = {
  types: { vac: true, news: true, rfp: true },
  since: "30d",
  search: "",
  expandAll: false,
};

export default function SignalsView({
  leaids,
  parentKind,
  parentId,
}: ViewBodyProps) {
  const [toolbar, setToolbar] = useState<SignalsToolbarState>(INITIAL_TOOLBAR);
  const [page, setPage] = useState(1);
  // Controlled expand set — drives both per-row expansion and expand-all.
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => new Set());

  // Single batched patch — combines any number of toolbar changes into one
  // setState (CLAUDE.md: batch mutations to avoid cascading re-renders).
  function patchToolbar(patch: Partial<SignalsToolbarState>) {
    setToolbar((prev) => ({ ...prev, ...patch }));
  }

  const isListScope = parentKind === "list" && (leaids === null);

  // ── Freshness last-visit watermark ─────────────────────────────────────────
  const lastVisitKey = `signals:lastVisit:${parentKind}:${parentId}`;
  const lastVisitRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(lastVisitKey);
      lastVisitRef.current = raw ? new Date(raw).getTime() : null;
    } catch {
      lastVisitRef.current = null;
    }
    // Write the new watermark on unmount so the next visit's "new" dots are
    // measured against this visit (CLAUDE.md: clean up on unmount).
    return () => {
      try {
        window.localStorage.setItem(lastVisitKey, new Date().toISOString());
      } catch {
        // localStorage may throw in private mode / over quota — degrade silently.
      }
    };
  }, [lastVisitKey]);

  const summary = useSignalsSummary({
    parentKind,
    parentId,
    leaids,
    types: toolbar.types,
    since: toolbar.since,
  });

  const allDistricts = useMemo(
    () => summary.data?.districts ?? [],
    [summary.data],
  );

  // Client-side search filter over the already-loaded summary (no refetch).
  const filtered = useMemo(() => {
    const q = toolbar.search.trim().toLowerCase();
    if (!q) return allDistricts;
    return allDistricts.filter((d) => d.name.toLowerCase().includes(q));
  }, [allDistricts, toolbar.search]);

  // Expand-all derives the open set from the filtered list when toggled on.
  function handlePatch(patch: Partial<SignalsToolbarState>) {
    if (patch.expandAll === true) {
      setExpandedSet(new Set(filtered.map((d) => d.leaid)));
    } else if (patch.expandAll === false) {
      setExpandedSet(new Set());
    }
    // Any re-scoping change (search text, signal types, time window) snaps
    // paging back to the first page so we never land on a now-empty page.
    if (
      patch.search !== undefined ||
      patch.types !== undefined ||
      patch.since !== undefined
    ) {
      setPage(1);
    }
    patchToolbar(patch);
  }

  function toggleRow(leaid: string) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(leaid)) next.delete(leaid);
      else next.add(leaid);
      return next;
    });
  }

  function resetFilters() {
    setExpandedSet(new Set());
    setPage(1);
    setToolbar(INITIAL_TOOLBAR);
  }

  // ── List scope: not yet supported (Phase E resolves list leaid sets) ──
  if (isListScope) {
    return (
      <EmptyState
        title="Signals for lists are coming soon"
        hint="Open a plan to see its districts' vacancies, news, and RFPs in one feed."
      />
    );
  }

  if (summary.isLoading) {
    return <DistrictRowSkeleton />;
  }

  if (summary.isError) {
    return (
      <ErrorState
        message={String(summary.error?.message ?? "Could not load signals.")}
        onRetry={() => summary.refetch()}
      />
    );
  }

  const total = filtered.length;
  // One fixed-size window per page (matches the table grids' pager).
  const meta = pageMeta(total, page, GRID_PAGE_SIZE);
  const visible = filtered.slice(
    (meta.page - 1) * GRID_PAGE_SIZE,
    meta.page * GRID_PAGE_SIZE,
  );
  const searchActive = toolbar.search.trim().length > 0;

  return (
    <div className="flex h-full flex-col bg-[#FFFCFA]">
      <SignalsControls
        state={toolbar}
        onChange={handlePatch}
        searchDisabled={summary.isLoading}
      />
      <FilterHintBanner total={total} />
      <ViewScroll className="flex-1 min-h-0">
        {total === 0 ? (
          <WholeEmpty searchActive={searchActive} onReset={resetFilters} />
        ) : (
          <ul className="flex flex-col">
            {visible.map((district) => (
              <SignalDistrictRow
                key={district.leaid}
                district={district}
                types={toolbar.types}
                since={toolbar.since}
                expanded={expandedSet.has(district.leaid)}
                onToggle={toggleRow}
                lastVisitMs={lastVisitRef.current}
              />
            ))}
          </ul>
        )}
      </ViewScroll>
      {total > GRID_PAGE_SIZE && (
        <GridPager
          total={total}
          page={meta.page}
          pageSize={GRID_PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

// ── Sub-states ───────────────────────────────────────────────────────────────

function WholeEmpty({
  searchActive,
  onReset,
}: {
  searchActive: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-sm text-center">
        <RadioTower
          className="mx-auto h-7 w-7 text-[#A69DC0]"
          aria-hidden
          strokeWidth={1.5}
        />
        <h3 className="mt-3 text-[14px] font-semibold text-[#403770] whitespace-nowrap">
          No signals match these filters
        </h3>
        <p className="mt-1 text-[12px] text-[#8A80A8]">
          {searchActive
            ? "No districts match your search."
            : "Try a wider time window or turn a signal type back on."}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#D4CFE2] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#544A78] hover:border-[#403770] hover:text-[#403770] transition-colors duration-100"
        >
          <span className="whitespace-nowrap">Reset filters</span>
        </button>
      </div>
    </div>
  );
}

function DistrictRowSkeleton() {
  return (
    <ViewScroll>
      <ul className="flex flex-col" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-2 border-b border-[#EFEDF5] px-3 py-2.5"
            aria-hidden
          >
            <div className="h-4 w-4 rounded bg-[#F7F5FA] animate-pulse" />
            <div className="h-3.5 flex-1 rounded bg-[#F7F5FA] animate-pulse" />
            <div className="h-3.5 w-12 rounded bg-[#F7F5FA] animate-pulse" />
          </li>
        ))}
      </ul>
    </ViewScroll>
  );
}
