"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import LayerBubble from "./LayerBubble";
import LayerDrawer from "./LayerDrawer";
import ExploreOverlay from "./explore/ExploreOverlay";
import ComparisonMapShell from "./ComparisonMapShell";
import SearchBar from "./SearchBar";
import SearchResults from "./SearchResults";
import RightPanel from "./RightPanel";
import { loadPalettePrefs, savePalettePrefs } from "@/features/map/lib/palette-storage";
import { useMapV2Store } from "@/features/map/lib/store";
import type { OverlayLayerType } from "@/features/map/lib/store";
import { VENDOR_IDS } from "@/features/map/lib/layers";
import { useMapContacts, useMapVacancies, useMapActivities, useMapPlans } from "@/features/map/lib/queries";

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

  // Overlay layer state for feature counts
  const activeLayers = useMapV2Store((s) => s.activeLayers);
  const layerFilters = useMapV2Store((s) => s.layerFilters);
  const dateRange = useMapV2Store((s) => s.dateRange);
  const mapBounds = useMapV2Store((s) => s.mapBounds);
  const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);

  // Query data to get feature counts for the drawer
  const contactsQuery = useMapContacts(mapBounds, layerFilters.contacts, activeLayers.has("contacts"));
  const vacanciesQuery = useMapVacancies(mapBounds, layerFilters.vacancies, dateRange, activeLayers.has("vacancies"));
  const activitiesQuery = useMapActivities(mapBounds, layerFilters.activities, dateRange, activeLayers.has("activities"));
  const plansQuery = useMapPlans(layerFilters.plans, activeLayers.has("plans"));

  const featureCounts = useMemo<Partial<Record<OverlayLayerType, number>>>(() => ({
    contacts: contactsQuery.data?.features.length,
    vacancies: vacanciesQuery.data?.features.length,
    activities: activitiesQuery.data?.features.length,
    plans: plansQuery.data?.features.length,
  }), [contactsQuery.data, vacanciesQuery.data, activitiesQuery.data, plansQuery.data]);

  const layerLoading = useMemo<Partial<Record<OverlayLayerType, boolean>>>(() => ({
    contacts: contactsQuery.isLoading,
    vacancies: vacanciesQuery.isLoading,
    activities: activitiesQuery.isLoading,
    plans: plansQuery.isLoading,
  }), [contactsQuery.isLoading, vacanciesQuery.isLoading, activitiesQuery.isLoading, plansQuery.isLoading]);

  // Determine if any overlay is active (for right panel rendering outside plan workspace)
  const anyOverlayActive = activeLayers.has("contacts") ||
    activeLayers.has("vacancies") ||
    activeLayers.has("plans") ||
    activeLayers.has("activities");

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

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#F8F7F4] flex flex-col">
      {/* Search toolbar — docked to top, in document flow */}
      <SearchBar />

      {/* Map area — fills remaining space */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Full-viewport map (renders behind everything) */}
        {compareMode ? <ComparisonMapShell /> : <MapV2Container />}

        {/* Explore data overlay (covers map when active) */}
        <ExploreOverlay />

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

        {/* Layer drawer (left side overlay controls) */}
        <LayerDrawer featureCounts={featureCounts} layerLoading={layerLoading} />

        {/* Search results panel (right side) */}
        <SearchResults />

        {/* Layer controls (opened by gear icon in SearchBar) */}
        <LayerBubble />

        {/* Right panel for overlay entity detail/edit (when clicked from map pins) */}
        {anyOverlayActive && rightPanelContent && (
          <div className="absolute top-0 right-0 bottom-0 z-20">
            <RightPanel />
          </div>
        )}
      </div>
    </div>
  );
}
