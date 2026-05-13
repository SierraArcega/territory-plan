"use client";

/**
 * "My Views" section — sidebar's centerpiece.
 *
 * Phase B6 ships:
 *   - Section header (bookmark icon + "MY VIEWS" eyebrow)
 *   - "All plans" row (routes to /views portfolio)
 *   - Plans subsection placeholder with loading skeleton rows
 *   - Lists subsection placeholder with loading skeleton rows + "+ New list"
 *   - Hidden footer ("Show hidden (N)") wired to the store
 *
 * The actual plan/list rows (with caret expand, accent bars, progress rings,
 * context menu) are Phase C1. B6's job is to mount the queries, show the
 * loading state correctly (per CLAUDE.md "show loading state, don't hide UI"),
 * and surface the section chrome so the layout is observable end-to-end.
 */
import { useMemo } from "react";
import Link from "next/link";
import { Bookmark, Grid3x3, Plus, Target, ListChecks } from "lucide-react";
import { useViewsStore, selectDensity, selectShowHidden } from "../lib/store";
import { useLists, usePlansWithStats } from "../lib/queries";

const ALL_PLANS_HREF = "/views";

/** Section eyebrow color per the prototype — Fullmind plum. */
const EYEBROW_PLUM = "#403770";

export default function MyViewsSection() {
  const density = useViewsStore(selectDensity);
  const showHidden = useViewsStore(selectShowHidden);
  const toggleShowHidden = useViewsStore((s) => s.toggleShowHidden);
  const openBuilder = useViewsStore((s) => s.openBuilder);

  const plansQ = usePlansWithStats(showHidden);
  const listsQ = useLists(showHidden);

  // Hidden count for the footer affordance. We always-on fetch the visible
  // set; the hidden count is the delta from the showHidden=1 fetch. Phase F
  // will swap to a cheaper /api/territory-plans?stats=0&onlyHidden=1 endpoint
  // — for now we fold both lists' hidden flags.
  const hiddenCount = useMemo(() => {
    const plans = plansQ.data ?? [];
    const lists = listsQ.data ?? [];
    return (
      plans.filter((p) => p.hidden).length +
      lists.filter((l) => l.hidden).length
    );
  }, [plansQ.data, listsQ.data]);

  const rowPadY = density === "comfortable" ? "py-2.5" : "py-2";
  const subRowPadY = density === "comfortable" ? "py-2" : "py-1.5";

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-2 pt-2 pb-1">
      {/* Section header — bookmark + "MY VIEWS" eyebrow */}
      <header className="flex items-center gap-2 px-2 pt-2 pb-1">
        <Bookmark
          className="w-3.5 h-3.5"
          aria-hidden
          strokeWidth={2}
          style={{ color: EYEBROW_PLUM }}
        />
        <span
          className="text-[10px] font-semibold uppercase whitespace-nowrap"
          style={{
            color: EYEBROW_PLUM,
            letterSpacing: "0.06em",
          }}
        >
          My Views
        </span>
      </header>

      {/* "All plans" row — routes to portfolio */}
      <Link
        href={ALL_PLANS_HREF}
        className={`mt-1 group flex items-center gap-2.5 rounded-md px-2 ${rowPadY} text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100`}
      >
        <Grid3x3 className="w-4 h-4 flex-shrink-0 text-[#544A78]" aria-hidden />
        <span className="flex-1 min-w-0 truncate whitespace-nowrap">
          All plans
        </span>
        {/* Compact count badge — number of plans (loads asynchronously). */}
        <span className="text-[10px] font-medium text-[#8A80A8] tabular-nums whitespace-nowrap">
          {plansQ.isLoading ? "…" : plansQ.data?.length ?? 0}
        </span>
      </Link>

      {/* Plans subsection header */}
      <div className="mt-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5">
          <Target
            className="w-3.5 h-3.5 text-[#544A78]"
            aria-hidden
            strokeWidth={2}
          />
          <span className="text-xs font-semibold text-[#544A78] whitespace-nowrap">
            Plans
          </span>
        </div>
        <span className="text-[10px] font-medium text-[#8A80A8] whitespace-nowrap">
          FY26
        </span>
      </div>

      <SubsectionBody
        isLoading={plansQ.isLoading}
        isError={plansQ.isError}
        isEmpty={plansQ.data?.length === 0}
        emptyText="No plans yet"
        rowCount={plansQ.data?.length ?? 0}
        rowPadY={subRowPadY}
        kind="plan"
      />

      {/* Lists subsection header */}
      <div className="mt-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5">
          <ListChecks
            className="w-3.5 h-3.5 text-[#544A78]"
            aria-hidden
            strokeWidth={2}
          />
          <span className="text-xs font-semibold text-[#544A78] whitespace-nowrap">
            Lists
          </span>
        </div>
        <button
          type="button"
          onClick={() => openBuilder()}
          className="text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 p-0.5 rounded-sm"
          aria-label="New list"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>

      <SubsectionBody
        isLoading={listsQ.isLoading}
        isError={listsQ.isError}
        isEmpty={listsQ.data?.length === 0}
        emptyText="No lists yet"
        rowCount={listsQ.data?.length ?? 0}
        rowPadY={subRowPadY}
        kind="list"
      />

      {/* Hidden footer affordance — only when there's something to show */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => toggleShowHidden()}
          className="mt-3 mx-2 px-1 py-1 text-left text-[11px] text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 whitespace-nowrap"
        >
          {showHidden
            ? `Hide hidden (${hiddenCount})`
            : `Show hidden (${hiddenCount})`}
        </button>
      )}
    </div>
  );
}

interface SubsectionBodyProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyText: string;
  rowCount: number;
  rowPadY: string;
  kind: "plan" | "list";
}

/**
 * Subsection body — shows a skeleton while loading, an error retry hint on
 * failure, the empty state when the user has no plans/lists, or a count
 * stub for now (real rows come in Phase C1).
 *
 * Per CLAUDE.md "show loading state, don't hide UI": we render the
 * skeleton in the same row footprint so the layout doesn't shift.
 */
function SubsectionBody({
  isLoading,
  isError,
  isEmpty,
  emptyText,
  rowCount,
  rowPadY,
  kind,
}: SubsectionBodyProps) {
  if (isLoading) {
    return (
      <ul className="mt-1.5" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 px-2 ${rowPadY}`}
            aria-hidden
          >
            <span className="w-1 h-3.5 rounded-full bg-[#EFEDF5] flex-shrink-0" />
            <span className="flex-1 min-w-0 h-3 rounded-md bg-[#F7F5FA] animate-pulse" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="mt-1.5 px-2 py-2 text-[11px] text-[#8A80A8] whitespace-nowrap">
        Couldn&apos;t load — retry coming
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="mt-1.5 px-2 py-2 text-[11px] text-[#8A80A8] whitespace-nowrap">
        {emptyText}
      </div>
    );
  }

  // Phase B6 placeholder — Phase C1 replaces this with real GroupRow rendering.
  return (
    <div className="mt-1.5 px-2 py-2 text-[11px] text-[#8A80A8] whitespace-nowrap">
      {rowCount} {kind === "plan" ? "plan" : "list"}
      {rowCount === 1 ? "" : "s"} — rows ship in Phase C1
    </div>
  );
}
