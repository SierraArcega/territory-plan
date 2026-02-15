import { create } from "zustand";
import type { VendorId } from "@/lib/map-v2-layers";

// Panel state machine
export type PanelState =
  | "BROWSE"
  | "DISTRICT"
  | "STATE"
  | "PLAN_NEW"
  | "PLAN_VIEW"
  | "PLAN_ADD";

// Icon bar navigation
export type IconBarTab = "home" | "search" | "plans" | "settings";

// Tooltip data for v2
export interface V2TooltipData {
  type: "state" | "district" | "school";
  stateName?: string;
  stateCode?: string;
  districtCount?: number;
  leaid?: string;
  name?: string;
  stateAbbrev?: string;
  enrollment?: number;
  customerCategory?: string;
  dominantVendor?: string;
  salesExecutive?: string | null;
  // School-specific
  schoolLevel?: number;
  lograde?: string;
  higrade?: string;
}

export interface V2TooltipState {
  visible: boolean;
  exiting: boolean;
  x: number;
  y: number;
  data: V2TooltipData | null;
}

interface MapV2State {
  // Panel state machine
  panelState: PanelState;
  panelHistory: PanelState[];

  // Multi-vendor layers
  activeVendors: Set<VendorId>;
  filterOwner: string | null;
  filterPlanId: string | null;
  filterStates: string[];

  // Icon bar
  activeIconTab: IconBarTab;

  // Selection state
  selectedLeaid: string | null;
  selectedStateCode: string | null;
  hoveredLeaid: string | null;

  // Plan state
  activePlanId: string | null;
  planDistrictLeaids: Set<string>;

  // Multi-select (for Flow A: select -> plan)
  selectedLeaids: Set<string>;

  // Search
  searchQuery: string;

  // Tooltip
  tooltip: V2TooltipState;

  // Click ripples
  clickRipples: Array<{ id: number; x: number; y: number; color: "coral" | "plum" }>;

  // Responsive
  panelCollapsed: boolean;

  // Layer bubble
  layerBubbleOpen: boolean;
}

interface MapV2Actions {
  // Panel navigation
  setPanelState: (state: PanelState) => void;
  goBack: () => void;

  // Vendor layers & filters
  toggleVendor: (vendor: VendorId) => void;
  setFilterOwner: (owner: string | null) => void;
  setFilterPlanId: (planId: string | null) => void;
  setFilterStates: (states: string[]) => void;
  toggleFilterState: (abbrev: string) => void;

  // Icon bar
  setActiveIconTab: (tab: IconBarTab) => void;

  // Selection
  selectDistrict: (leaid: string) => void;
  selectState: (stateCode: string) => void;
  clearSelection: () => void;
  setHoveredLeaid: (leaid: string | null) => void;

  // Plan actions
  startNewPlan: () => void;
  createPlan: (planId: string) => void;
  viewPlan: (planId: string) => void;
  addDistrictToPlan: (leaid: string) => void;
  removeDistrictFromPlan: (leaid: string) => void;
  finishAddingDistricts: () => void;

  // Multi-select
  toggleDistrictSelection: (leaid: string) => void;
  clearSelectedDistricts: () => void;
  createPlanFromSelection: () => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Tooltip
  showTooltip: (x: number, y: number, data: V2TooltipData) => void;
  hideTooltip: () => void;
  updateTooltipPosition: (x: number, y: number) => void;

  // Click ripples
  addClickRipple: (x: number, y: number, color: "coral" | "plum") => void;
  removeClickRipple: (id: number) => void;

  // Responsive
  setPanelCollapsed: (collapsed: boolean) => void;
  togglePanel: () => void;

  // Layer bubble
  setLayerBubbleOpen: (open: boolean) => void;
  toggleLayerBubble: () => void;
}

let rippleId = 0;

const initialTooltip: V2TooltipState = {
  visible: false,
  exiting: false,
  x: 0,
  y: 0,
  data: null,
};

export const useMapV2Store = create<MapV2State & MapV2Actions>()((set) => ({
  // Initial state
  panelState: "BROWSE",
  panelHistory: [],
  activeVendors: new Set<VendorId>(["fullmind"]),
  filterOwner: null,
  filterPlanId: null,
  filterStates: [],
  activeIconTab: "home",
  selectedLeaid: null,
  selectedStateCode: null,
  hoveredLeaid: null,
  activePlanId: null,
  planDistrictLeaids: new Set<string>(),
  selectedLeaids: new Set<string>(),
  searchQuery: "",
  tooltip: initialTooltip,
  clickRipples: [],
  panelCollapsed: false,
  layerBubbleOpen: false,

  // Panel navigation
  setPanelState: (state) =>
    set((s) => ({
      panelState: state,
      panelHistory: [...s.panelHistory, s.panelState],
    })),

  goBack: () =>
    set((s) => {
      const history = [...s.panelHistory];
      const prev = history.pop() || "BROWSE";
      return {
        panelState: prev,
        panelHistory: history,
        // Clear selection when going back to browse
        ...(prev === "BROWSE"
          ? { selectedLeaid: null, selectedStateCode: null }
          : {}),
      };
    }),

  // Vendor layers & filters
  toggleVendor: (vendor) =>
    set((s) => {
      const next = new Set(s.activeVendors);
      if (next.has(vendor)) {
        if (next.size > 1) next.delete(vendor);
      } else {
        next.add(vendor);
      }
      return { activeVendors: next };
    }),

  setFilterOwner: (owner) => set({ filterOwner: owner }),
  setFilterPlanId: (planId) => set({ filterPlanId: planId }),
  setFilterStates: (states) => set({ filterStates: states }),
  toggleFilterState: (abbrev) =>
    set((s) => {
      const next = s.filterStates.includes(abbrev)
        ? s.filterStates.filter((a) => a !== abbrev)
        : [...s.filterStates, abbrev];
      return { filterStates: next };
    }),

  // Icon bar
  setActiveIconTab: (tab) =>
    set((s) => ({
      activeIconTab: tab,
      // Reset to browse when switching tabs
      panelState: tab === "home" || tab === "search" ? "BROWSE" : s.panelState,
      panelHistory: [],
    })),

  // Selection
  selectDistrict: (leaid) =>
    set((s) => ({
      selectedLeaid: leaid,
      panelState: "DISTRICT",
      panelHistory: [...s.panelHistory, s.panelState],
    })),

  selectState: (stateCode) =>
    set((s) => ({
      selectedStateCode: stateCode,
      panelState: "STATE",
      panelHistory: [...s.panelHistory, s.panelState],
    })),

  clearSelection: () =>
    set({
      selectedLeaid: null,
      selectedStateCode: null,
      panelState: "BROWSE",
      panelHistory: [],
    }),

  setHoveredLeaid: (leaid) => set({ hoveredLeaid: leaid }),

  // Plan actions
  startNewPlan: () =>
    set((s) => ({
      panelState: "PLAN_NEW",
      panelHistory: [...s.panelHistory, s.panelState],
    })),

  createPlan: (planId) =>
    set((s) => ({
      activePlanId: planId,
      panelState: "PLAN_ADD",
      panelHistory: [...s.panelHistory, s.panelState],
      planDistrictLeaids: new Set(s.selectedLeaids), // carry over any pre-selected
    })),

  viewPlan: (planId) =>
    set((s) => ({
      activePlanId: planId,
      panelState: "PLAN_VIEW",
      panelHistory: [...s.panelHistory, s.panelState],
    })),

  addDistrictToPlan: (leaid) =>
    set((s) => {
      const next = new Set(s.planDistrictLeaids);
      next.add(leaid);
      return { planDistrictLeaids: next };
    }),

  removeDistrictFromPlan: (leaid) =>
    set((s) => {
      const next = new Set(s.planDistrictLeaids);
      next.delete(leaid);
      return { planDistrictLeaids: next };
    }),

  finishAddingDistricts: () =>
    set((s) => ({
      panelState: "PLAN_VIEW",
      panelHistory: [...s.panelHistory, s.panelState],
    })),

  // Multi-select
  toggleDistrictSelection: (leaid) =>
    set((s) => {
      const next = new Set(s.selectedLeaids);
      if (next.has(leaid)) {
        next.delete(leaid);
      } else {
        next.add(leaid);
      }
      return { selectedLeaids: next };
    }),

  clearSelectedDistricts: () => set({ selectedLeaids: new Set<string>() }),

  createPlanFromSelection: () =>
    set((s) => ({
      panelState: "PLAN_NEW",
      panelHistory: [...s.panelHistory, s.panelState],
    })),

  // Search
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Tooltip
  showTooltip: (x, y, data) =>
    set({ tooltip: { visible: true, exiting: false, x, y, data } }),

  hideTooltip: () =>
    set((s) => {
      if (!s.tooltip.visible && !s.tooltip.exiting) return s;
      return { tooltip: { ...s.tooltip, exiting: true } };
    }),

  updateTooltipPosition: (x, y) =>
    set((s) => ({ tooltip: { ...s.tooltip, x, y } })),

  // Click ripples
  addClickRipple: (x, y, color) =>
    set((s) => ({
      clickRipples: [...s.clickRipples, { id: ++rippleId, x, y, color }],
    })),

  removeClickRipple: (id) =>
    set((s) => ({
      clickRipples: s.clickRipples.filter((r) => r.id !== id),
    })),

  // Responsive
  setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
  togglePanel: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),

  // Layer bubble
  setLayerBubbleOpen: (open) => set({ layerBubbleOpen: open }),
  toggleLayerBubble: () => set((s) => ({ layerBubbleOpen: !s.layerBubbleOpen })),
}));
