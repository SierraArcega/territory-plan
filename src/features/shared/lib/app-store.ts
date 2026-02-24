import { create } from "zustand";
import { persist } from "zustand/middleware";

// Navigation tab types - these match the sidebar tabs
export type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "profile";

export type MetricType =
  | "sessions_revenue"
  | "sessions_take"
  | "sessions_count"
  | "closed_won_net_booking"
  | "net_invoicing"
  | "open_pipeline"
  | "open_pipeline_weighted";

export type FiscalYear = "fy25" | "fy26" | "fy27";

// Tooltip types
export interface TooltipData {
  type: "state" | "district";
  // State tooltip data
  stateName?: string;
  stateCode?: string;
  districtCount?: number;
  // District tooltip data
  leaid?: string;
  name?: string;
  stateAbbrev?: string;
  enrollment?: number;
  salesExecutive?: string | null;
  tags?: Array<{ name: string; color: string }>;
  charterSchoolCount?: number;
}

export interface TooltipState {
  visible: boolean;
  exiting: boolean;
  x: number;
  y: number;
  data: TooltipData | null;
}

// Click ripple types
export interface ClickRipple {
  id: number;
  x: number;
  y: number;
  color: "coral" | "plum";
}

// Panel types for unified panel management
export type PanelType = 'district' | 'state' | 'school' | null;

interface MapState {
  // Navigation state - which tab is active and sidebar collapse state
  activeTab: TabId;
  sidebarCollapsed: boolean;
  // Map-specific state
  selectedLeaid: string | null;
  hoveredLeaid: string | null;
  metricType: MetricType;
  fiscalYear: FiscalYear;
  sidePanelOpen: boolean;
  // Unified panel management - one panel at a time
  activePanelType: PanelType;
  selectedStateCode: string | null;
  // Tooltip state
  tooltip: TooltipState;
  // Click ripples for visual feedback
  clickRipples: ClickRipple[];
  // Touch preview mode (first tap shows tooltip, second tap selects)
  touchPreviewLeaid: string | null;
  // Multi-select mode for batch adding districts to plans
  multiSelectMode: boolean;
  selectedLeaids: Set<string>;
  currentPlanId: string | null; // Active plan for quick-add
  // Similar districts for "Find Similar" feature
  similarDistrictLeaids: string[];
  // Vendor comparison layer toggle
  vendorLayerVisible: boolean;
  // Charter district layer toggle
  charterLayerVisible: boolean;
  selectedNcessch: string | null;
}

interface MapActions {
  // Navigation actions
  setActiveTab: (tab: TabId) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  // Map/district actions
  setSelectedLeaid: (leaid: string | null) => void;
  setHoveredLeaid: (leaid: string | null) => void;
  setMetricType: (metric: MetricType) => void;
  setFiscalYear: (year: FiscalYear) => void;
  setSidePanelOpen: (open: boolean) => void;
  // Unified panel actions
  openStatePanel: (stateCode: string) => void;
  openDistrictPanel: (leaid: string) => void;
  closePanel: () => void;
  // Tooltip actions
  showTooltip: (x: number, y: number, data: TooltipData) => void;
  hideTooltip: () => void;
  updateTooltipPosition: (x: number, y: number) => void;
  // Click ripple actions
  addClickRipple: (x: number, y: number, color: "coral" | "plum") => void;
  removeClickRipple: (id: number) => void;
  // Touch preview actions
  setTouchPreviewLeaid: (leaid: string | null) => void;
  // Multi-select actions
  toggleMultiSelectMode: () => void;
  toggleDistrictSelection: (leaid: string) => void;
  clearSelectedDistricts: () => void;
  setCurrentPlanId: (planId: string | null) => void;
  // Similar districts actions
  setSimilarDistrictLeaids: (leaids: string[]) => void;
  clearSimilarDistricts: () => void;
  // Back navigation
  goBackToDistrictsList: () => void;
  // Vendor layer actions
  toggleVendorLayer: () => void;
  // Charter layer actions
  toggleCharterLayer: () => void;
  setSelectedNcessch: (ncessch: string | null) => void;
  clearSelectedNcessch: () => void;
  openSchoolPanel: (ncessch: string) => void;
}

const initialTooltip: TooltipState = {
  visible: false,
  exiting: false,
  x: 0,
  y: 0,
  data: null,
};

// Counter for generating unique ripple IDs
let rippleIdCounter = 0;

export const useMapStore = create<MapState & MapActions>()(
  persist(
    (set) => ({
      // Navigation state
      activeTab: "home" as TabId,
      sidebarCollapsed: false,
      // Map state
      selectedLeaid: null,
      hoveredLeaid: null,
      metricType: "net_invoicing",
      fiscalYear: "fy26",
      sidePanelOpen: false,
      activePanelType: null,
      selectedStateCode: null,
      tooltip: initialTooltip,
      clickRipples: [],
      touchPreviewLeaid: null,
      multiSelectMode: false,
      selectedLeaids: new Set<string>(),
      currentPlanId: null,
      similarDistrictLeaids: [],
      vendorLayerVisible: false,
      charterLayerVisible: false,
      selectedNcessch: null,

      // Navigation actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Map/district actions
      setSelectedLeaid: (leaid) =>
    set({
      selectedLeaid: leaid,
      sidePanelOpen: leaid !== null,
      // When selecting a district, switch to district panel and clear state selection
      activePanelType: leaid !== null ? 'district' : null,
      selectedStateCode: leaid !== null ? null : undefined, // Clear state when selecting district
    }),
  setHoveredLeaid: (leaid) => set({ hoveredLeaid: leaid }),
  setMetricType: (metric) => set({ metricType: metric }),
  setFiscalYear: (year) => set({ fiscalYear: year }),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),

  // Unified panel actions
  openStatePanel: (stateCode) =>
    set({
      activePanelType: 'state',
      selectedStateCode: stateCode,
      sidePanelOpen: true,
      // Clear district selection when opening state panel
      selectedLeaid: null,
    }),
  openDistrictPanel: (leaid) =>
    set({
      activePanelType: 'district',
      selectedLeaid: leaid,
      sidePanelOpen: true,
      // Clear state selection when opening district panel
      selectedStateCode: null,
    }),
  closePanel: () =>
    set({
      activePanelType: null,
      sidePanelOpen: false,
      selectedLeaid: null,
      selectedStateCode: null,
    }),

  // Tooltip actions
  showTooltip: (x, y, data) =>
    set({ tooltip: { visible: true, exiting: false, x, y, data } }),
  hideTooltip: () =>
    set((s) => {
      // If already hidden or exiting, no change
      if (!s.tooltip.visible && !s.tooltip.exiting) return s;
      // Start exit animation
      return { tooltip: { ...s.tooltip, exiting: true } };
    }),
  updateTooltipPosition: (x, y) =>
    set((s) => ({ tooltip: { ...s.tooltip, x, y } })),

  // Click ripple actions
  addClickRipple: (x, y, color) =>
    set((s) => ({
      clickRipples: [...s.clickRipples, { id: ++rippleIdCounter, x, y, color }],
    })),
  removeClickRipple: (id) =>
    set((s) => ({
      clickRipples: s.clickRipples.filter((r) => r.id !== id),
    })),

  // Touch preview actions
  setTouchPreviewLeaid: (leaid) => set({ touchPreviewLeaid: leaid }),

  // Multi-select actions
  toggleMultiSelectMode: () =>
    set((s) => ({
      multiSelectMode: !s.multiSelectMode,
      // Clear selections when exiting multi-select mode
      selectedLeaids: s.multiSelectMode ? new Set<string>() : s.selectedLeaids,
      // Close side panel when entering multi-select mode
      sidePanelOpen: s.multiSelectMode ? s.sidePanelOpen : false,
      selectedLeaid: s.multiSelectMode ? s.selectedLeaid : null,
    })),
  toggleDistrictSelection: (leaid) =>
    set((s) => {
      const newSet = new Set(s.selectedLeaids);
      if (newSet.has(leaid)) {
        newSet.delete(leaid);
      } else {
        newSet.add(leaid);
      }
      return { selectedLeaids: newSet };
    }),
  clearSelectedDistricts: () => set({ selectedLeaids: new Set<string>() }),
  setCurrentPlanId: (planId) => set({ currentPlanId: planId }),

  // Similar districts actions
  setSimilarDistrictLeaids: (leaids) => set({ similarDistrictLeaids: leaids }),
  clearSimilarDistricts: () => set({ similarDistrictLeaids: [] }),

  // Go back to districts list (clears district selection but keeps state context)
  goBackToDistrictsList: () =>
    set({
      selectedLeaid: null,
      // Don't change activePanelType or selectedStateCode
      // The DistrictTabContent will show the districts list because stateCode is still set
    }),

  // Vendor layer toggle
  toggleVendorLayer: () =>
    set((s) => ({ vendorLayerVisible: !s.vendorLayerVisible })),

  // Charter layer actions
  toggleCharterLayer: () =>
    set((s) => ({ charterLayerVisible: !s.charterLayerVisible })),
  setSelectedNcessch: (ncessch) => set({ selectedNcessch: ncessch }),
  clearSelectedNcessch: () => set({ selectedNcessch: null }),
  openSchoolPanel: (ncessch) =>
    set({
      activePanelType: 'school',
      selectedNcessch: ncessch,
      sidePanelOpen: true,
      selectedLeaid: null,
      selectedStateCode: null,
    }),
    }),
    {
      name: "territory-plan-storage",
      // Only persist navigation preferences, not transient UI state
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        // Don't persist activeTab - we'll sync with URL instead
      }),
    }
  )
);

// Selector helpers
export const selectMetricConfig = (state: MapState) => ({
  metric: state.metricType,
  year: state.fiscalYear,
});
export const selectPanelState = (state: MapState) => ({
  activePanelType: state.activePanelType,
  selectedStateCode: state.selectedStateCode,
  selectedLeaid: state.selectedLeaid,
  sidePanelOpen: state.sidePanelOpen,
});

// Navigation state selector
export const selectNavigation = (state: MapState) => ({
  activeTab: state.activeTab,
  sidebarCollapsed: state.sidebarCollapsed,
});
