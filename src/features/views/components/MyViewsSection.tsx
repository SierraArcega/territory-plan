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
import Link from "next/link";
import { Bookmark, Grid3x3, Plus } from "lucide-react";
import { useViewsStore, selectShowHidden } from "../lib/store";
import { useLists, usePlansWithStats } from "../lib/queries";
import { LISTS_ENABLED } from "../lib/feature-flags";
import PlansSubsection from "./PlansSubsection";
import ListsSubsection from "./ListsSubsection";
import HiddenFooter from "./HiddenFooter";

/** Section eyebrow color per the prototype — Fullmind plum. */
const EYEBROW_PLUM = "#403770";

export default function MyViewsSection() {
  const showHidden = useViewsStore(selectShowHidden);
  const openBuilder = useViewsStore((s) => s.openBuilder);

  const plansQ = usePlansWithStats(showHidden);
  // Lists is feature-gated; skip the fetch entirely when the Lists UI is hidden.
  const listsQ = useLists(showHidden, LISTS_ENABLED);

  const plans = plansQ.data ?? [];
  const lists = LISTS_ENABLED ? listsQ.data ?? [] : [];

  // True empty state — every enabled source resolved with zero rows. We
  // deliberately do NOT show this until those queries have data; until then
  // the subsections render their own skeletons. When Lists is gated off, the
  // empty state depends on plans alone.
  const listsEmpty =
    !LISTS_ENABLED || (!listsQ.isLoading && lists.length === 0);
  const showEmptyState =
    !plansQ.isLoading && plans.length === 0 && listsEmpty;

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

      {/* "All plans" row — always visible so users with zero plans can reach the portfolio */}
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
      </Link>

      {/* Empty state — shown inline when the user has no plans and no lists. */}
      {showEmptyState ? (
        <div className="mt-2 mx-2 p-3 rounded-md border border-dashed border-[#D4CFE2] bg-[#FFFCFA]">
          <p className="text-[12px] text-[#544A78] font-medium whitespace-nowrap">
            No views yet
          </p>
          {LISTS_ENABLED ? (
            <>
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
            </>
          ) : (
            <p className="text-[11px] text-[#8A80A8] mt-1">
              Plans you build from the map will show up here.
            </p>
          )}
        </div>
      ) : (
        <>
          <PlansSubsection />
          {LISTS_ENABLED && <ListsSubsection />}
        </>
      )}

      {/* Show hidden + Archived plans deep-links — render only when their
          populations are non-empty. */}
      <HiddenFooter />
    </div>
  );
}
