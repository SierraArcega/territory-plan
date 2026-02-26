"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import FloatingPanel from "./FloatingPanel";
import MultiSelectChip from "./MultiSelectChip";
import LayerBubble from "./LayerBubble";
import MapSummaryBar from "./MapSummaryBar";
import SelectModePill from "./SelectModePill";
import ExploreOverlay from "./explore/ExploreOverlay";
import ComparisonMapShell from "./ComparisonMapShell";
import { loadPalettePrefs, savePalettePrefs } from "@/features/map/lib/palette-storage";
import { useMapV2Store } from "@/features/map/lib/store";
import { VENDOR_IDS } from "@/features/map/lib/layers";

// Dynamic import for MapLibre (no SSR)
const MapV2Container = dynamic(() => import("./MapV2Container"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[#F8F7F4] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-plum/20 border-t-plum rounded-full tile-loading-spinner" />
        <span className="text-sm text-gray-400">Loading map...</span>
      </div>
    </div>
  ),
});

export default function MapV2Shell() {
  const compareMode = useMapV2Store((s) => s.compareMode);
  const compareView = useMapV2Store((s) => s.compareView);
  const focusPlanId = useMapV2Store((s) => s.focusPlanId);
  const unfocusPlan = useMapV2Store((s) => s.unfocusPlan);

  // Load saved palette preferences on mount
  useEffect(() => {
    const prefs = loadPalettePrefs();
    const store = useMapV2Store.getState();
    for (const vendorId of VENDOR_IDS) {
      store.setVendorPalette(vendorId, prefs.vendorPalettes[vendorId]);
      store.setVendorOpacity(vendorId, prefs.vendorOpacities[vendorId]);
    }
    store.setSignalPalette(prefs.signalPalette);
    store.initCategoryState(prefs.categoryColors, prefs.categoryOpacities);
    // Capture initial snapshot after state is loaded
    requestAnimationFrame(() => useMapV2Store.getState().captureSnapshot());
  }, []);

  // Auto-save palette prefs when they change
  useEffect(() => {
    const unsub = useMapV2Store.subscribe((state, prevState) => {
      if (
        state.vendorPalettes !== prevState.vendorPalettes ||
        state.signalPalette !== prevState.signalPalette ||
        state.vendorOpacities !== prevState.vendorOpacities ||
        state.categoryColors !== prevState.categoryColors ||
        state.categoryOpacities !== prevState.categoryOpacities
      ) {
        savePalettePrefs({
          vendorPalettes: state.vendorPalettes,
          signalPalette: state.signalPalette,
          vendorOpacities: state.vendorOpacities,
          categoryColors: state.categoryColors,
          categoryOpacities: state.categoryOpacities,
        });
      }
    });
    return unsub;
  }, []);

  // In changes view, the TransitionLegend replaces the MapSummaryBar
  const showSummaryBar = !compareMode || compareView !== "changes";

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#F8F7F4]">
      {/* Full-viewport map (renders behind everything) */}
      {compareMode ? <ComparisonMapShell /> : <MapV2Container />}

      {/* Floating panel overlay */}
      <FloatingPanel />

      {/* Explore data overlay (covers map when active) */}
      <ExploreOverlay />

      {/* Multi-select action chip */}
      <MultiSelectChip />

      {/* Multi-select mode toggle */}
      <SelectModePill />

      {/* Summary stats bar (hidden in changes view -- TransitionLegend replaces it) */}
      {showSummaryBar && <MapSummaryBar />}

      {/* Exit focus mode button */}
      {focusPlanId && (
        <button
          onClick={unfocusPlan}
          className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-200/60 text-gray-600 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-white hover:text-plum hover:border-plum/30 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Exit Focus
        </button>
      )}

      {/* Layer control bubble */}
      <LayerBubble />
    </div>
  );
}
