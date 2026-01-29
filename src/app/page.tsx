"use client";

import dynamic from "next/dynamic";
import FilterBar from "@/components/filters/FilterBar";
import SidePanel from "@/components/panel/SidePanel";

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
    <div className="h-screen flex flex-col bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#403770]">
            Territory Plan Builder
          </h1>
          <span className="text-[#F37167]">|</span>
          <span className="text-sm text-gray-500">Fullmind</span>
        </div>
        <div className="text-sm text-gray-500">
          ~13,000 US School Districts
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar />

      {/* Map Area */}
      <div className="flex-1 relative">
        {/* Map */}
        <MapContainer className="absolute inset-0" />

        {/* Side Panel */}
        <SidePanel />
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2 text-xs text-gray-500 flex justify-between items-center">
        <div>
          Data sources: NCES EDGE Boundaries, Urban Institute Education Data
        </div>
        <div>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#F37167]" /> Customer
          </span>
          <span className="mx-2">|</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#6EA3BE]" /> Pipeline
          </span>
          <span className="mx-2">|</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#403770]" /> Both
          </span>
        </div>
      </footer>
    </div>
  );
}
