"use client";

import dynamic from "next/dynamic";
import FloatingPanel from "./FloatingPanel";
import MultiSelectChip from "./MultiSelectChip";
import LayerBubble from "./LayerBubble";
import SelectModePill from "./SelectModePill";
import ExploreOverlay from "./explore/ExploreOverlay";

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

      {/* Layer control bubble */}
      <LayerBubble />
    </div>
  );
}
