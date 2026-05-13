"use client";

/**
 * HiddenFooter — sidebar footer affordances for hidden + archived discovery.
 *
 * Two rows surface only when the relevant population is non-empty:
 *   1. "Show hidden (N)" — toggles `showHidden` in the views store. With it
 *      on, the sidebar refetches plans/lists with `?showHidden=1` and renders
 *      hidden rows in their muted treatment (opacity 0.55 + dashed accent).
 *   2. "Archived plans · N" — deep-links to `/views?archived=1` so the user
 *      can find an archived plan to unarchive without leaving the sidebar.
 *
 * We always fetch with `showHidden=1` here (one extra query) so the count is
 * authoritative. The main sidebar list still respects the local `showHidden`
 * flag, so the user only sees hidden rows when they opt in.
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useViewsStore, selectShowHidden } from "../lib/store";
import { useLists, usePlansWithStats } from "../lib/queries";

export default function HiddenFooter() {
  const router = useRouter();
  const showHidden = useViewsStore(selectShowHidden);
  const toggleShowHidden = useViewsStore((s) => s.toggleShowHidden);

  // Always query with showHidden=1 to know the true hidden + archived
  // counts. This is cheap (TanStack dedupes the request when the same key
  // is in flight elsewhere) and survives unmount via gcTime.
  const plansQ = usePlansWithStats(true);
  const listsQ = useLists(true);

  const counts = useMemo(() => {
    const plans = plansQ.data ?? [];
    const lists = listsQ.data ?? [];
    return {
      hiddenPlans: plans.filter((p) => p.hidden).length,
      hiddenLists: lists.filter((l) => l.hidden).length,
      archivedPlans: plans.filter((p) => p.status === "archived").length,
    };
  }, [plansQ.data, listsQ.data]);

  const totalHidden = counts.hiddenPlans + counts.hiddenLists;
  const hasArchived = counts.archivedPlans > 0;

  if (totalHidden === 0 && !hasArchived) return null;

  return (
    <div className="mt-3 mx-2 flex flex-col gap-0.5">
      {totalHidden > 0 && (
        <button
          type="button"
          onClick={() => toggleShowHidden()}
          className="px-1 py-1 text-left text-[11px] font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 whitespace-nowrap"
          aria-pressed={showHidden}
        >
          {showHidden
            ? `Hide hidden (${totalHidden})`
            : `Show hidden (${totalHidden})`}
        </button>
      )}
      {hasArchived && (
        <button
          type="button"
          onClick={() => router.push("/views?archived=1")}
          className="px-1 py-1 text-left text-[11px] font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 whitespace-nowrap"
        >
          Archived plans · {counts.archivedPlans}
        </button>
      )}
    </div>
  );
}
