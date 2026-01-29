import { create } from "zustand";

export type StatusFilter = "all" | "customer" | "pipeline" | "customer_pipeline" | "no_data";
export type MetricType =
  | "sessions_revenue"
  | "sessions_take"
  | "sessions_count"
  | "closed_won_net_booking"
  | "net_invoicing"
  | "open_pipeline"
  | "open_pipeline_weighted";

export type FiscalYear = "fy25" | "fy26" | "fy27";

interface Filters {
  stateAbbrev: string | null;
  statusFilter: StatusFilter;
  salesExecutive: string | null;
  searchQuery: string;
}

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

interface MapState {
  selectedLeaid: string | null;
  hoveredLeaid: string | null;
  metricType: MetricType;
  fiscalYear: FiscalYear;
  filters: Filters;
  sidePanelOpen: boolean;
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
}

interface MapActions {
  setSelectedLeaid: (leaid: string | null) => void;
  setHoveredLeaid: (leaid: string | null) => void;
  setMetricType: (metric: MetricType) => void;
  setFiscalYear: (year: FiscalYear) => void;
  setStateFilter: (state: string | null) => void;
  setStatusFilter: (status: StatusFilter) => void;
  setSalesExecutive: (exec: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSidePanelOpen: (open: boolean) => void;
  clearFilters: () => void;
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
}

const initialFilters: Filters = {
  stateAbbrev: null,
  statusFilter: "all",
  salesExecutive: null,
  searchQuery: "",
};

const initialTooltip: TooltipState = {
  visible: false,
  exiting: false,
  x: 0,
  y: 0,
  data: null,
};

// Counter for generating unique ripple IDs
let rippleIdCounter = 0;

export const useMapStore = create<MapState & MapActions>((set) => ({
  // State
  selectedLeaid: null,
  hoveredLeaid: null,
  metricType: "net_invoicing",
  fiscalYear: "fy26",
  filters: initialFilters,
  sidePanelOpen: false,
  tooltip: initialTooltip,
  clickRipples: [],
  touchPreviewLeaid: null,
  multiSelectMode: false,
  selectedLeaids: new Set<string>(),
  currentPlanId: null,

  // Actions
  setSelectedLeaid: (leaid) =>
    set({ selectedLeaid: leaid, sidePanelOpen: leaid !== null }),
  setHoveredLeaid: (leaid) => set({ hoveredLeaid: leaid }),
  setMetricType: (metric) => set({ metricType: metric }),
  setFiscalYear: (year) => set({ fiscalYear: year }),
  setStateFilter: (state) =>
    set((s) => ({ filters: { ...s.filters, stateAbbrev: state } })),
  setStatusFilter: (status) =>
    set((s) => ({ filters: { ...s.filters, statusFilter: status } })),
  setSalesExecutive: (exec) =>
    set((s) => ({ filters: { ...s.filters, salesExecutive: exec } })),
  setSearchQuery: (query) =>
    set((s) => ({ filters: { ...s.filters, searchQuery: query } })),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  clearFilters: () => set({ filters: initialFilters }),

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
}));

// Selector helpers
export const selectFilters = (state: MapState) => state.filters;
export const selectMetricConfig = (state: MapState) => ({
  metric: state.metricType,
  year: state.fiscalYear,
});
