"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAddDistrictsToPlan } from "@/features/plans/lib/queries";
import { useMapV2Store } from "@/features/map/lib/store";

interface Props {
  planId: string;
}

/**
 * Floating action bar for the Views plan-scoped map. Appears when the rep has
 * clicked one or more not-yet-in-plan districts (the coral selection set) and
 * commits them to the plan in a single bulk add. Add-only — removal lives in
 * the Table/list views.
 */
export function PlanMapSelectionBar({ planId }: Props) {
  const qc = useQueryClient();
  const selected = useMapV2Store((s) => s.viewsPlanSelectedLeaids);
  const clearSelection = useMapV2Store((s) => s.clearViewsPlanSelection);
  const addHighlight = useMapV2Store((s) => s.addToViewsPlanHighlight);
  const addDistricts = useAddDistrictsToPlan();

  const count = selected.size;
  if (count === 0) return null;

  const handleAdd = async () => {
    const leaids = [...selected];
    try {
      await addDistricts.mutateAsync({ planId, leaids });
      qc.invalidateQueries({ queryKey: ["views", "data"] });
      qc.invalidateQueries({ queryKey: ["views", "plans"] });
      qc.invalidateQueries({ queryKey: ["views", "plan", planId] });
      addHighlight(leaids); // optimistic plum highlight
      clearSelection();
    } catch {
      // Selection is preserved for retry; error surfaced below.
    }
  };

  return (
    <div role="status" className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full border border-[#D4CFE2] bg-white px-4 py-2 shadow-md">
      <span className="whitespace-nowrap text-sm font-medium text-[#403770]">
        {count} district{count === 1 ? "" : "s"} selected
      </span>
      <button
        type="button"
        onClick={handleAdd}
        disabled={addDistricts.isPending}
        className="whitespace-nowrap rounded-full bg-[#403770] px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-[#322a5a] disabled:opacity-60"
      >
        {addDistricts.isPending ? "Adding…" : "Add to plan"}
      </button>
      <button
        type="button"
        onClick={clearSelection}
        disabled={addDistricts.isPending}
        className="whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] disabled:opacity-60"
      >
        Clear
      </button>
      {addDistricts.isError && (
        <span className="whitespace-nowrap text-xs text-[#A8281C]">Add failed — try again</span>
      )}
    </div>
  );
}
