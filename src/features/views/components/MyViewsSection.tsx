"use client";

/**
 * "My Views" section — sidebar's centerpiece.
 *
 * Phase C1 wires real plan/list rows. The section shows:
 *   - Section header (bookmark icon + "MY VIEWS" eyebrow)
 *   - "All plans" row (routes to /views portfolio)
 *   - PlansSubsection — real plans via usePlansWithStats
 *   - ListsSubsection — real lists via useLists
 *   - Inline empty state when both are empty + a primary "Create your first list"
 *     button (CTA flows into openBuilder())
 *   - Hidden footer ("Show hidden (N)") wired to the store
 */
import { useMemo } from "react";
import Link from "next/link";
import { Bookmark, Grid3x3, Plus } from "lucide-react";
import { useViewsStore, selectShowHidden } from "../lib/store";
import { useLists, usePlansWithStats } from "../lib/queries";
import PlansSubsection from "./PlansSubsection";
import ListsSubsection from "./ListsSubsection";

/** Section eyebrow color per the prototype — Fullmind plum. */
const EYEBROW_PLUM = "#403770";

export default function MyViewsSection() {
  const showHidden = useViewsStore(selectShowHidden);
  const toggleShowHidden = useViewsStore((s) => s.toggleShowHidden);
  const openBuilder = useViewsStore((s) => s.openBuilder);

  const plansQ = usePlansWithStats(showHidden);
  const listsQ = useLists(showHidden);

  const plans = plansQ.data ?? [];
  const lists = listsQ.data ?? [];

  // Hidden count for the footer affordance.
  const hiddenCount = useMemo(
    () =>
      plans.filter((p) => p.hidden).length +
      lists.filter((l) => l.hidden).length,
    [plans, lists],
  );

  // True empty state — both queries resolved with zero rows. We deliberately
  // do NOT show this until both queries have data; until then the subsections
  // render their own skeletons.
  const showEmptyState =
    !plansQ.isLoading &&
    !listsQ.isLoading &&
    plans.length === 0 &&
    lists.length === 0;

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
          style={{ color: EYEBROW_PLUM, letterSpacing: "0.06em" }}
        >
          My Views
        </span>
      </header>

      {/* Empty state — shown inline when the user has no plans and no lists. */}
      {showEmptyState ? (
        <div className="mt-2 mx-2 p-3 rounded-md border border-dashed border-[#D4CFE2] bg-[#FFFCFA]">
          <p className="text-[12px] text-[#544A78] font-medium whitespace-nowrap">
            No views yet
          </p>
          <p className="text-[11px] text-[#8A80A8] mt-1 mb-2">
            Start with a saved list to scope your work.
          </p>
          <button
            type="button"
            onClick={() => openBuilder()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#403770] text-white text-[12px] font-semibold hover:bg-[#322a5a] transition-colors duration-100"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            <span className="whitespace-nowrap">Create your first list</span>
          </button>
        </div>
      ) : (
        <>
          {/* "All plans" row — routes to portfolio */}
          <Link
            href="/views"
            className="mt-1 group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100"
          >
            <Grid3x3
              className="w-4 h-4 flex-shrink-0 text-[#544A78]"
              aria-hidden
            />
            <span className="flex-1 min-w-0 truncate whitespace-nowrap">
              All plans
            </span>
            <span className="text-[10px] font-medium text-[#8A80A8] tabular-nums whitespace-nowrap">
              {plansQ.isLoading ? "…" : plans.length}
            </span>
          </Link>

          <PlansSubsection />
          <ListsSubsection />
        </>
      )}

      {/* Hidden footer affordance */}
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
