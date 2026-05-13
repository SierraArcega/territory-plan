"use client";

/**
 * MapViewContainer — mounts the existing MapV2Container inside the saved-views
 * canvas.
 *
 * Phase C v0 (this file): mounts MapV2Container as-is with a banner clarifying
 * that the displayed map is not yet scoped to the active plan/list's district
 * set. Threading a `districtLeaidsFilter` prop into MapV2Container is a
 * multi-day refactor (MapV2 has ~700 LOC of layer config + filter expressions
 * keyed on the global Zustand store, not props). Phase F revisits this once
 * the rest of the views are validated.
 *
 * Per the implementer prompt's "Stop early if" guidance and CLAUDE.md's MapV2
 * reuse mandate, this v0 ships now so the URL routes work end-to-end. The
 * `leaids` and `contextLabel` props are kept on the contract so Phase F's
 * follow-up doesn't need to change every call site.
 */
import dynamic from "next/dynamic";
import { Info } from "lucide-react";

// MapV2Container is heavy (MapLibre + tile workers); load only when the Map
// view is selected so other views don't pay the cost.
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
  /**
   * District leaid set the map should scope to. v0 ignores this — the map
   * renders the global view and the banner explains the limitation. Phase F
   * threads this into MapV2Container's layer filter expressions.
   */
  leaids: string[] | null;
  /** Human label for the active plan/list shown in the banner ("Northeast Pod"). */
  contextLabel: string | null;
}

export default function MapViewContainer({
  leaids,
  contextLabel,
}: MapViewContainerProps) {
  // Show the banner whenever we have a scope but are not yet honoring it. An
  // empty/null leaids array means the parent didn't compute a scope (lists in
  // v0) — in that case there's nothing to warn about.
  const showBanner = Array.isArray(leaids) && leaids.length > 0;

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
    </div>
  );
}
