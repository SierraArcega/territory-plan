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

interface MapState {
  selectedLeaid: string | null;
  hoveredLeaid: string | null;
  metricType: MetricType;
  fiscalYear: FiscalYear;
  filters: Filters;
  sidePanelOpen: boolean;
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
}

const initialFilters: Filters = {
  stateAbbrev: null,
  statusFilter: "all",
  salesExecutive: null,
  searchQuery: "",
};

export const useMapStore = create<MapState & MapActions>((set) => ({
  // State
  selectedLeaid: null,
  hoveredLeaid: null,
  metricType: "net_invoicing",
  fiscalYear: "fy26",
  filters: initialFilters,
  sidePanelOpen: false,

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
}));

// Selector helpers
export const selectFilters = (state: MapState) => state.filters;
export const selectMetricConfig = (state: MapState) => ({
  metric: state.metricType,
  year: state.fiscalYear,
});
