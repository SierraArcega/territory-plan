"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import SideBySideMap from "./SideBySideMap";
import ChangesMap from "./ChangesMap";

/**
 * Wrapper that renders either SideBySideMap or ChangesMap based on the
 * `compareView` store value. Replaces MapV2Container in the shell when
 * compare mode is active.
 */
export default function ComparisonMapShell() {
  const compareView = useMapV2Store((s) => s.compareView);
  const exitCompareMode = useMapV2Store((s) => s.exitCompareMode);

  return (
    <>
      {compareView === "side_by_side" ? <SideBySideMap /> : <ChangesMap />}

      {/* Exit compare mode button */}
      <button
        onClick={exitCompareMode}
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-200/60 text-gray-600 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-white hover:text-plum hover:border-plum/30 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Exit Compare
      </button>
    </>
  );
}
