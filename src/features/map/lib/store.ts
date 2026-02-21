import { create } from "zustand";
import type { VendorId, SignalId, LocaleId } from "@/features/map/lib/layers";
import type { AccountTypeValue } from "@/lib/account-types";

// School type toggles: level 1-3 + charter
export type SchoolType = "elementary" | "middle" | "high" | "charter";
export const ALL_SCHOOL_TYPES: SchoolType[] = ["elementary", "middle", "high", "charter"];

// Panel state machine
export type PanelState =
  | "BROWSE"
  | "DISTRICT"
  | "STATE"
  | "PLAN_NEW"
  | "PLAN_VIEW"
  | "PLAN_ADD"
  | "PLAN_OVERVIEW"
  | "PLAN_ACTIVITIES"
  | "PLAN_TASKS"
  | "PLAN_CONTACTS"
  | "PLAN_PERF";

// Icon bar navigation
export type IconBarTab = "home" | "search" | "plans" | "explore" | "settings";

// Plan workspace sections
export type PlanSection = "districts" | "activities" | "tasks" | "contacts" | "performance";

// Explore Data entity tabs
export type ExploreEntity = "districts" | "activities" | "tasks" | "contacts" | "plans";

// Filter operator types — single source of truth in explore-filters.ts
import type { FilterOp } from "@/features/explore/lib/filters";
export type { FilterOp } from "@/features/explore/lib/filters";

export interface ExploreFilter {
  id: string;
  column: string;
  op: FilterOp;
  value: string | number | boolean | string[] | [number, number];
}

export interface ExploreSortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface ExploreSavedView {
  id: string;
  name: string;
  entity: ExploreEntity;
  filters: ExploreFilter[];
  sorts: ExploreSortConfig[];
  columns: string[];
}

export interface RightPanelContent {
  type: "district_card" | "task_form" | "task_edit" | "activity_form" | "activity_edit" | "plan_edit" | "contact_detail" | "contact_form" | "plan_card";
  id?: string;
}

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
  planSection: PlanSection;
  rightPanelContent: RightPanelContent | null;
  detailPopout: { leaid: string } | null;
  planDistrictLeaids: Set<string>;

  // Multi-select (for Flow A: select -> plan)
  selectedLeaids: Set<string>;

  // Multi-select mode (click-to-select without Shift)
  multiSelectMode: boolean;

  // Search
  searchQuery: string;

  // Tooltip
  tooltip: V2TooltipState;

  // Click ripples
  clickRipples: Array<{ id: number; x: number; y: number; color: "coral" | "plum" }>;

  // Panel visibility
  panelMode: "full" | "collapsed" | "hidden";

  // Layer bubble
  layerBubbleOpen: boolean;

  // Schools layer — which school types are visible
  visibleSchoolTypes: Set<SchoolType>;

  // Signal layer
  activeSignal: SignalId | null;

  // Locale layer
  visibleLocales: Set<LocaleId>;

  // Account type filter
  filterAccountTypes: AccountTypeValue[];

  // Fullmind engagement filter
  fullmindEngagement: string[];

  // Competitor engagement filter (per-vendor)
  competitorEngagement: Record<string, string[]>;

  // Fiscal year selector (affects Fullmind + Competitors tile data)
  selectedFiscalYear: "fy25" | "fy26";

  // Account creation form state
  showAccountForm: boolean;
  accountFormDefaults: { name?: string } | null;

  // Explore Data
  isExploreActive: boolean;
  exploreEntity: ExploreEntity;
  exploreColumns: Record<ExploreEntity, string[]>;
  exploreFilters: Record<ExploreEntity, ExploreFilter[]>;
  exploreSort: Record<ExploreEntity, ExploreSortConfig[]>;
  explorePage: number;
  filteredDistrictLeaids: string[];

  // Saved views
  exploreSavedViews: Record<ExploreEntity, ExploreSavedView[]>;
  activeViewId: Record<ExploreEntity, string | null>;

  // Bulk selection
  selectedDistrictLeaids: Set<string>;
  selectAllMatchingFilters: boolean;

  // Focus Map — zooms + filters to a specific plan's footprint
  focusPlanId: string | null;
  focusLeaids: string[];
  preFocusFilters: { filterStates: string[]; filterPlanId: string | null } | null;
  pendingFitBounds: [[number, number], [number, number]] | null;
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

  // Plan workspace
  setPlanSection: (section: PlanSection) => void;
  openRightPanel: (content: RightPanelContent) => void;
  closeRightPanel: () => void;
  openDetailPopout: (leaid: string) => void;
  closeDetailPopout: () => void;

  // Multi-select (map shift-click — uses selectedLeaids)
  toggleLeaidSelection: (leaid: string) => void;
  clearSelectedDistricts: () => void;
  createPlanFromSelection: () => void;

  toggleMultiSelectMode: () => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Tooltip
  showTooltip: (x: number, y: number, data: V2TooltipData) => void;
  hideTooltip: () => void;
  updateTooltipPosition: (x: number, y: number) => void;

  // Click ripples
  addClickRipple: (x: number, y: number, color: "coral" | "plum") => void;
  removeClickRipple: (id: number) => void;

  // Panel visibility
  setPanelMode: (mode: "full" | "collapsed" | "hidden") => void;
  collapsePanel: () => void; // full→collapsed→hidden

  // Layer bubble
  setLayerBubbleOpen: (open: boolean) => void;
  toggleLayerBubble: () => void;

  // Schools layer
  toggleSchoolType: (type: SchoolType) => void;
  setVisibleSchoolTypes: (types: Set<SchoolType>) => void;

  // Signal layer
  setActiveSignal: (signal: SignalId | null) => void;

  // Locale layer
  toggleLocale: (locale: LocaleId) => void;
  setVisibleLocales: (locales: Set<LocaleId>) => void;

  // Account type filter
  toggleAccountType: (type: AccountTypeValue) => void;
  setFilterAccountTypes: (types: AccountTypeValue[]) => void;

  // Fullmind engagement filter
  toggleFullmindEngagement: (level: string) => void;
  setFullmindEngagement: (levels: string[]) => void;

  // Competitor engagement filter
  toggleCompetitorEngagement: (vendorId: string, level: string) => void;
  setCompetitorEngagement: (vendorId: string, levels: string[]) => void;

  // Fiscal year
  setSelectedFiscalYear: (fy: "fy25" | "fy26") => void;

  // Account creation form
  openAccountForm: (defaults?: { name?: string }) => void;
  closeAccountForm: () => void;

  // Explore Data
  setExploreEntity: (entity: ExploreEntity) => void;
  setExploreColumns: (entity: ExploreEntity, columns: string[]) => void;
  addExploreFilter: (entity: ExploreEntity, filter: ExploreFilter) => void;
  removeExploreFilter: (entity: ExploreEntity, filterId: string) => void;
  updateExploreFilter: (entity: ExploreEntity, filterId: string, updates: Partial<ExploreFilter>) => void;
  clearExploreFilters: (entity: ExploreEntity) => void;
  setExploreSort: (entity: ExploreEntity, sort: ExploreSortConfig[]) => void;
  addSortRule: (entity: ExploreEntity, rule: ExploreSortConfig) => void;
  removeSortRule: (entity: ExploreEntity, column: string) => void;
  reorderSortRules: (entity: ExploreEntity, rules: ExploreSortConfig[]) => void;
  setExplorePage: (page: number) => void;
  setFilteredDistrictLeaids: (leaids: string[]) => void;

  // Saved views
  saveView: (entity: ExploreEntity, view: ExploreSavedView) => void;
  loadView: (entity: ExploreEntity, viewId: string) => void;
  deleteView: (entity: ExploreEntity, viewId: string) => void;
  setActiveViewId: (entity: ExploreEntity, viewId: string | null) => void;

  // Bulk selection
  toggleDistrictSelection: (leaid: string) => void;
  setDistrictSelection: (leaids: string[]) => void;
  clearDistrictSelection: () => void;
  setSelectAllMatchingFilters: (value: boolean) => void;

  // Focus Map
  focusPlan: (planId: string, stateAbbrevs: string[], leaids: string[], bounds: [[number, number], [number, number]]) => void;
  unfocusPlan: () => void;
  clearPendingFitBounds: () => void;
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
  planSection: "districts" as PlanSection,
  rightPanelContent: null as RightPanelContent | null,
  detailPopout: null as { leaid: string } | null,
  planDistrictLeaids: new Set<string>(),
  selectedLeaids: new Set<string>(),
  multiSelectMode: false,
  searchQuery: "",
  tooltip: initialTooltip,
  clickRipples: [],
  panelMode: "full",
  layerBubbleOpen: false,
  visibleSchoolTypes: new Set<SchoolType>(),
  activeSignal: null,
  visibleLocales: new Set<LocaleId>(),
  filterAccountTypes: [],
  fullmindEngagement: [],
  competitorEngagement: {},
  selectedFiscalYear: "fy26",
  showAccountForm: false,
  accountFormDefaults: null,
  isExploreActive: false,
  exploreEntity: "districts" as ExploreEntity,
  exploreColumns: {
    districts: ["name", "state", "enrollment", "isCustomer", "fy26_open_pipeline_value", "fy26_closed_won_net_booking", "owner", "notes", "planNames", "lastActivity", "tags"],
    activities: ["title", "type", "status", "startDate", "outcomeType", "districtNames", "planNames"],
    tasks: ["title", "status", "priority", "dueDate", "districtNames", "planNames"],
    contacts: ["name", "title", "email", "phone", "districtName", "isPrimary", "lastActivity"],
    plans: ["name", "status", "fiscalYear", "ownerName", "districtCount", "totalTargets", "renewalRollup", "expansionRollup", "winbackRollup", "newBusinessRollup", "createdAt", "updatedAt"],
  } as Record<ExploreEntity, string[]>,
  exploreFilters: {
    districts: [],
    activities: [],
    tasks: [],
    contacts: [],
    plans: [],
  } as Record<ExploreEntity, ExploreFilter[]>,
  exploreSort: {
    districts: [],
    activities: [],
    tasks: [],
    contacts: [],
    plans: [],
  } as Record<ExploreEntity, ExploreSortConfig[]>,
  explorePage: 1,
  filteredDistrictLeaids: [],

  // Saved views
  exploreSavedViews: {
    districts: [],
    activities: [],
    tasks: [],
    contacts: [],
    plans: [],
  } as Record<ExploreEntity, ExploreSavedView[]>,
  activeViewId: {
    districts: null,
    activities: null,
    tasks: null,
    contacts: null,
    plans: null,
  } as Record<ExploreEntity, string | null>,

  // Bulk selection
  selectedDistrictLeaids: new Set<string>(),
  selectAllMatchingFilters: false,

  // Focus Map
  focusPlanId: null,
  focusLeaids: [],
  preFocusFilters: null,
  pendingFitBounds: null,

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
      isExploreActive: tab === "explore",
      // Clear filtered districts when leaving explore
      ...(tab !== "explore" ? { filteredDistrictLeaids: [] } : {}),
      // Clear any lingering map tooltip when switching tabs
      tooltip: { visible: false, exiting: false, x: 0, y: 0, data: null },
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
      panelState: "PLAN_OVERVIEW",
      panelHistory: [...s.panelHistory, s.panelState],
      planSection: "districts" as PlanSection,
      rightPanelContent: null,
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

  // Plan workspace
  setPlanSection: (section) => {
    const sectionToState: Record<PlanSection, PanelState> = {
      districts: "PLAN_OVERVIEW",
      activities: "PLAN_ACTIVITIES",
      tasks: "PLAN_TASKS",
      contacts: "PLAN_CONTACTS",
      performance: "PLAN_PERF",
    };
    set({ planSection: section, panelState: sectionToState[section], rightPanelContent: null });
  },

  openRightPanel: (content) => set({ rightPanelContent: content }),

  closeRightPanel: () => set({ rightPanelContent: null }),

  openDetailPopout: (leaid) =>
    set((s) => ({
      detailPopout: s.detailPopout?.leaid === leaid ? null : { leaid },
    })),

  closeDetailPopout: () => set({ detailPopout: null }),

  // Multi-select (map shift-click — uses selectedLeaids)
  toggleLeaidSelection: (leaid) =>
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

  toggleMultiSelectMode: () =>
    set((s) => ({
      multiSelectMode: !s.multiSelectMode,
      // Clear selection when turning off
      ...(!s.multiSelectMode ? {} : { selectedLeaids: new Set<string>() }),
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

  // Panel visibility
  setPanelMode: (mode) => set({ panelMode: mode }),
  collapsePanel: () =>
    set((s) => ({
      panelMode: s.panelMode === "full" ? "collapsed" : "hidden",
    })),

  // Layer bubble
  setLayerBubbleOpen: (open) => set({ layerBubbleOpen: open }),
  toggleLayerBubble: () => set((s) => ({ layerBubbleOpen: !s.layerBubbleOpen })),

  // Schools layer
  toggleSchoolType: (type) =>
    set((s) => {
      const next = new Set(s.visibleSchoolTypes);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { visibleSchoolTypes: next };
    }),
  setVisibleSchoolTypes: (types) => set({ visibleSchoolTypes: types }),

  // Signal layer — toggle off if same signal clicked again
  setActiveSignal: (signal) =>
    set((s) => ({
      activeSignal: s.activeSignal === signal ? null : signal,
    })),

  // Locale layer
  toggleLocale: (locale) =>
    set((s) => {
      const next = new Set(s.visibleLocales);
      if (next.has(locale)) {
        next.delete(locale);
      } else {
        next.add(locale);
      }
      return { visibleLocales: next };
    }),
  setVisibleLocales: (locales) => set({ visibleLocales: locales }),

  // Account type filter
  toggleAccountType: (type) =>
    set((s) => {
      const next = s.filterAccountTypes.includes(type)
        ? s.filterAccountTypes.filter((t) => t !== type)
        : [...s.filterAccountTypes, type];
      return { filterAccountTypes: next };
    }),
  setFilterAccountTypes: (types) => set({ filterAccountTypes: types }),

  // Fullmind engagement filter
  toggleFullmindEngagement: (level) =>
    set((s) => {
      const next = s.fullmindEngagement.includes(level)
        ? s.fullmindEngagement.filter((l) => l !== level)
        : [...s.fullmindEngagement, level];
      return { fullmindEngagement: next };
    }),
  setFullmindEngagement: (levels) => set({ fullmindEngagement: levels }),

  // Competitor engagement filter
  toggleCompetitorEngagement: (vendorId, level) =>
    set((s) => {
      const current = s.competitorEngagement[vendorId] || [];
      const next = current.includes(level)
        ? current.filter((l) => l !== level)
        : [...current, level];
      return { competitorEngagement: { ...s.competitorEngagement, [vendorId]: next } };
    }),
  setCompetitorEngagement: (vendorId, levels) =>
    set((s) => ({
      competitorEngagement: { ...s.competitorEngagement, [vendorId]: levels },
    })),

  // Fiscal year
  setSelectedFiscalYear: (fy) => set({ selectedFiscalYear: fy }),

  // Account creation form
  openAccountForm: (defaults) => set({ showAccountForm: true, accountFormDefaults: defaults || null }),
  closeAccountForm: () => set({ showAccountForm: false, accountFormDefaults: null }),

  // Explore Data
  setExploreEntity: (entity) =>
    set({ exploreEntity: entity, explorePage: 1, selectedDistrictLeaids: new Set<string>(), selectAllMatchingFilters: false }),

  setExploreColumns: (entity, columns) =>
    set((s) => ({
      exploreColumns: { ...s.exploreColumns, [entity]: columns },
    })),

  addExploreFilter: (entity, filter) =>
    set((s) => ({
      exploreFilters: {
        ...s.exploreFilters,
        [entity]: [...s.exploreFilters[entity], filter],
      },
      explorePage: 1,
      selectedDistrictLeaids: new Set<string>(),
      selectAllMatchingFilters: false,
    })),

  removeExploreFilter: (entity, filterId) =>
    set((s) => ({
      exploreFilters: {
        ...s.exploreFilters,
        [entity]: s.exploreFilters[entity].filter((f) => f.id !== filterId),
      },
      explorePage: 1,
      selectedDistrictLeaids: new Set<string>(),
      selectAllMatchingFilters: false,
    })),

  updateExploreFilter: (entity, filterId, updates) =>
    set((s) => ({
      exploreFilters: {
        ...s.exploreFilters,
        [entity]: s.exploreFilters[entity].map((f) =>
          f.id === filterId ? { ...f, ...updates } : f
        ),
      },
      explorePage: 1,
    })),

  clearExploreFilters: (entity) =>
    set((s) => ({
      exploreFilters: { ...s.exploreFilters, [entity]: [] },
      explorePage: 1,
      selectedDistrictLeaids: new Set<string>(),
      selectAllMatchingFilters: false,
    })),

  setExploreSort: (entity, sort) =>
    set((s) => ({
      exploreSort: { ...s.exploreSort, [entity]: sort },
      explorePage: 1,
    })),

  addSortRule: (entity, rule) =>
    set((s) => {
      const existing = s.exploreSort[entity];
      const idx = existing.findIndex((r) => r.column === rule.column);
      let next: ExploreSortConfig[];
      if (idx >= 0) {
        next = existing.map((r, i) => (i === idx ? rule : r));
      } else {
        next = [...existing, rule];
      }
      return {
        exploreSort: { ...s.exploreSort, [entity]: next },
        explorePage: 1,
      };
    }),

  removeSortRule: (entity, column) =>
    set((s) => ({
      exploreSort: {
        ...s.exploreSort,
        [entity]: s.exploreSort[entity].filter((r) => r.column !== column),
      },
      explorePage: 1,
    })),

  reorderSortRules: (entity, rules) =>
    set((s) => ({
      exploreSort: { ...s.exploreSort, [entity]: rules },
      explorePage: 1,
    })),

  setExplorePage: (page) => set({ explorePage: page }),

  setFilteredDistrictLeaids: (leaids) => set({ filteredDistrictLeaids: leaids }),

  // Saved views
  saveView: (entity, view) =>
    set((s) => {
      const existing = s.exploreSavedViews[entity];
      const idx = existing.findIndex((v) => v.id === view.id);
      const updated = idx >= 0
        ? existing.map((v) => (v.id === view.id ? view : v))
        : [...existing, view];
      return {
        exploreSavedViews: { ...s.exploreSavedViews, [entity]: updated },
        activeViewId: { ...s.activeViewId, [entity]: view.id },
      };
    }),

  loadView: (entity, viewId) =>
    set((s) => {
      const view = s.exploreSavedViews[entity].find((v) => v.id === viewId);
      if (!view) return s;
      return {
        exploreFilters: { ...s.exploreFilters, [entity]: view.filters },
        exploreSort: { ...s.exploreSort, [entity]: view.sorts },
        exploreColumns: { ...s.exploreColumns, [entity]: view.columns },
        activeViewId: { ...s.activeViewId, [entity]: viewId },
        explorePage: 1,
      };
    }),

  deleteView: (entity, viewId) =>
    set((s) => ({
      exploreSavedViews: {
        ...s.exploreSavedViews,
        [entity]: s.exploreSavedViews[entity].filter((v) => v.id !== viewId),
      },
      activeViewId: {
        ...s.activeViewId,
        [entity]: s.activeViewId[entity] === viewId ? null : s.activeViewId[entity],
      },
    })),

  setActiveViewId: (entity, viewId) =>
    set((s) => ({
      activeViewId: { ...s.activeViewId, [entity]: viewId },
    })),

  // Bulk selection
  toggleDistrictSelection: (leaid) =>
    set((s) => {
      const next = new Set(s.selectedDistrictLeaids);
      if (next.has(leaid)) next.delete(leaid);
      else next.add(leaid);
      return { selectedDistrictLeaids: next, selectAllMatchingFilters: false };
    }),
  setDistrictSelection: (leaids) =>
    set({ selectedDistrictLeaids: new Set(leaids), selectAllMatchingFilters: false }),
  clearDistrictSelection: () =>
    set({ selectedDistrictLeaids: new Set<string>(), selectAllMatchingFilters: false }),
  setSelectAllMatchingFilters: (value) =>
    set({ selectAllMatchingFilters: value }),

  // Focus Map — saves current filters, applies state filter + highlight layers, queues fitBounds
  focusPlan: (planId, stateAbbrevs, leaids, bounds) =>
    set((s) => ({
      focusPlanId: planId,
      focusLeaids: leaids,
      preFocusFilters: {
        filterStates: s.filterStates,
        filterPlanId: s.filterPlanId,
      },
      filterStates: stateAbbrevs,
      // Don't set filterPlanId — we want non-plan districts visible (dimmed),
      // not hidden. The highlight layers make plan districts stand out.
      pendingFitBounds: bounds,
    })),

  unfocusPlan: () =>
    set((s) => ({
      focusPlanId: null,
      focusLeaids: [],
      filterStates: s.preFocusFilters?.filterStates ?? [],
      filterPlanId: s.preFocusFilters?.filterPlanId ?? null,
      preFocusFilters: null,
    })),

  clearPendingFitBounds: () => set({ pendingFitBounds: null }),
}));
