"use client";

import dynamic from "next/dynamic";
import FilterBar from "@/components/filters/FilterBar";
import PanelContainer from "@/components/panel/PanelContainer";
import MultiSelectActionBar from "@/components/MultiSelectActionBar";

// Dynamic import for MapContainer to avoid SSR issues with MapLibre
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

export default function Home() {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
      {/* Unified Navigation + Filter Bar */}
      <FilterBar />

      {/* Map Area - takes all remaining space */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Map */}
        <MapContainer className="absolute inset-0" />

        {/* Unified Panel Container (State or District panel) */}
        <PanelContainer />

        {/* Multi-Select Action Bar */}
        <MultiSelectActionBar />
      </div>
    </div>
  );
}
