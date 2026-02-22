"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import FloatingPanel from "./FloatingPanel";
import MultiSelectChip from "./MultiSelectChip";
import LayerBubble from "./LayerBubble";
import MapSummaryBar from "./MapSummaryBar";
import SelectModePill from "./SelectModePill";
import ExploreOverlay from "./explore/ExploreOverlay";
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
  // Load saved palette preferences on mount
  useEffect(() => {
    const prefs = loadPalettePrefs();
    const store = useMapV2Store.getState();
    for (const vendorId of VENDOR_IDS) {
      store.setVendorPalette(vendorId, prefs.vendorPalettes[vendorId]);
      store.setVendorOpacity(vendorId, prefs.vendorOpacities[vendorId]);
    }
    store.setSignalPalette(prefs.signalPalette);
  }, []);

  // Auto-save palette prefs when they change
  useEffect(() => {
    const unsub = useMapV2Store.subscribe((state, prevState) => {
      if (
        state.vendorPalettes !== prevState.vendorPalettes ||
        state.signalPalette !== prevState.signalPalette ||
        state.vendorOpacities !== prevState.vendorOpacities
      ) {
        savePalettePrefs({
          vendorPalettes: state.vendorPalettes,
          signalPalette: state.signalPalette,
          vendorOpacities: state.vendorOpacities,
        });
      }
    });
    return unsub;
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#F8F7F4]">
      {/* Full-viewport map (renders behind everything) */}
      <MapV2Container />

      {/* Floating panel overlay */}
      <FloatingPanel />

      {/* Explore data overlay (covers map when active) */}
      <ExploreOverlay />

      {/* Multi-select action chip */}
      <MultiSelectChip />

      {/* Multi-select mode toggle */}
      <SelectModePill />

      {/* Summary stats bar */}
      <MapSummaryBar />

      {/* Layer control bubble */}
      <LayerBubble />
    </div>
  );
}
