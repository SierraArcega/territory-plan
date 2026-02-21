"use client";

import dynamic from "next/dynamic";
import PanelContainer from "@/components/panel/PanelContainer";
import MultiSelectActionBar from "@/components/MultiSelectActionBar";
import GoalSetupModal from "@/features/goals/components/GoalSetupModal";

// Dynamic import for MapContainer to avoid SSR issues with MapLibre
// MapLibre uses browser-only APIs (WebGL, window), so we disable SSR
const MapContainer = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#FFFCFA]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
        <p className="text-[#403770] font-medium">Loading map...</p>
      </div>
    </div>
  ),
});

/**
 * MapView contains all the map-related UI:
 * - The interactive map (MapContainer)
 * - Side panel for district/state details (PanelContainer)
 * - Multi-select action bar for batch operations
 * - Goal setup modal for first-time users
 *
 * This component fills its parent container and manages the map layout.
 */
export default function MapView() {
  return (
    <div className="absolute inset-0">
      {/* Map - fills the entire view */}
      <MapContainer className="absolute inset-0" />

      {/* Side panel for district or state details */}
      <PanelContainer />

      {/* Action bar for multi-select mode (batch add to plans) */}
      <MultiSelectActionBar />

      {/* First-login setup wizard - shows when user hasn't completed setup */}
      <GoalSetupModal />
    </div>
  );
}
