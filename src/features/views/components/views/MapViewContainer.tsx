"use client";

/**
 * MapViewContainer — mounts the embedded MapV2 map inside the saved-views
 * canvas. When the active context is a plan, it binds the map to that plan
 * (highlight + territory framing) and renders the add-from-map selection bar.
 * When there is no active plan (lists / portfolio) it falls back to the global
 * map plus the legacy "showing all districts" banner.
 */
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Info } from "lucide-react";
import { useMapV2Store } from "@/features/map/lib/store";
import { PlanMapSelectionBar } from "./PlanMapSelectionBar";

const MapV2Container = dynamic(
  () => import("@/features/map/components/MapV2Container"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[#FFFCFA] text-[12px] text-[#8A80A8]">
        Loading map…
      </div>
    ),
  },
);

export interface MapViewContainerProps {
  /** District leaid set for the active context (plan.districtLeaids). */
  leaids: string[] | null;
  /** Active plan id, or null when the context is a list / portfolio. */
  planId: string | null;
  /** Human label for the active plan/list (used by the null-plan banner). */
  contextLabel: string | null;
}

export default function MapViewContainer({
  leaids,
  planId,
  contextLabel,
}: MapViewContainerProps) {
  const setViewsPlanContext = useMapV2Store((s) => s.setViewsPlanContext);
  const clearViewsPlanContext = useMapV2Store((s) => s.clearViewsPlanContext);

  // `leaids` is a fresh array reference on every plans refetch (TanStack Query
  // staleTime + window-focus), but its CONTENTS rarely change. Depend on a
  // serialized key so a background refetch doesn't re-run setViewsPlanContext
  // and wipe the rep's in-progress selection (it resets viewsPlanSelectedLeaids).
  const leaidsKey = leaids?.join(",") ?? "";
  useEffect(() => {
    if (!planId) return;
    setViewsPlanContext(planId, new Set(leaids ?? []));
    return () => clearViewsPlanContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, leaidsKey, setViewsPlanContext, clearViewsPlanContext]);

  // Null-plan path (list / portfolio): keep the legacy "all districts" banner.
  const showBanner = !planId && Array.isArray(leaids) && leaids.length > 0;

  return (
    <div className="relative h-full w-full">
      {showBanner && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white shadow-sm border border-[#D4CFE2] max-w-[90%]"
          role="status"
        >
          <Info className="w-3.5 h-3.5 text-[#6EA3BE] flex-shrink-0" aria-hidden />
          <span className="text-[11px] font-medium text-[#544A78] whitespace-nowrap">
            Showing all districts
            {contextLabel ? ` — ${contextLabel} scoping coming soon` : ""}
          </span>
        </div>
      )}
      <MapV2Container />
      {planId && <PlanMapSelectionBar planId={planId} />}
    </div>
  );
}
