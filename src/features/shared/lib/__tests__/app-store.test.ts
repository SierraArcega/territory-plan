import { describe, it, expect, beforeEach } from "vitest";
import {
  useMapStore,
  selectFilters,
  selectPanelState,
  type TooltipData,
} from "../app-store";

// ---------------------------------------------------------------------------
// Reset store to initial state before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  useMapStore.setState({
    activeTab: "home",
    sidebarCollapsed: false,
    selectedLeaid: null,
    hoveredLeaid: null,
    metricType: "net_invoicing",
    fiscalYear: "fy26",
    filters: {
      stateAbbrev: null,
      statusFilter: "all",
      salesExecutive: null,
      searchQuery: "",
    },
    sidePanelOpen: false,
    activePanelType: null,
    selectedStateCode: null,
    tooltip: { visible: false, exiting: false, x: 0, y: 0, data: null },
    clickRipples: [],
    touchPreviewLeaid: null,
    multiSelectMode: false,
    selectedLeaids: new Set<string>(),
    currentPlanId: null,
    similarDistrictLeaids: [],
    vendorLayerVisible: false,
    charterLayerVisible: false,
    selectedNcessch: null,
  });
});

// ===========================================================================
// Navigation
// ===========================================================================

describe("Navigation", () => {
  it("setActiveTab changes activeTab", () => {
    useMapStore.getState().setActiveTab("map");

    expect(useMapStore.getState().activeTab).toBe("map");
  });

  it("setSidebarCollapsed changes sidebarCollapsed", () => {
    expect(useMapStore.getState().sidebarCollapsed).toBe(false);

    useMapStore.getState().setSidebarCollapsed(true);

    expect(useMapStore.getState().sidebarCollapsed).toBe(true);
  });
});

// ===========================================================================
// District / Map actions
// ===========================================================================

describe("District / Map actions", () => {
  it("setSelectedLeaid opens side panel and sets district panel type", () => {
    useMapStore.getState().setSelectedLeaid("1234567");

    const state = useMapStore.getState();
    expect(state.selectedLeaid).toBe("1234567");
    expect(state.sidePanelOpen).toBe(true);
    expect(state.activePanelType).toBe("district");
  });

  it("setSelectedLeaid(null) closes panel", () => {
    // Open a panel first
    useMapStore.getState().setSelectedLeaid("1234567");
    expect(useMapStore.getState().sidePanelOpen).toBe(true);

    useMapStore.getState().setSelectedLeaid(null);

    const state = useMapStore.getState();
    expect(state.selectedLeaid).toBe(null);
    expect(state.sidePanelOpen).toBe(false);
    expect(state.activePanelType).toBe(null);
  });

  it("setHoveredLeaid sets hovered district", () => {
    useMapStore.getState().setHoveredLeaid("9999999");

    expect(useMapStore.getState().hoveredLeaid).toBe("9999999");
  });

  it("setMetricType changes metric", () => {
    useMapStore.getState().setMetricType("open_pipeline");

    expect(useMapStore.getState().metricType).toBe("open_pipeline");
  });

  it("setFiscalYear changes year", () => {
    useMapStore.getState().setFiscalYear("fy25");

    expect(useMapStore.getState().fiscalYear).toBe("fy25");
  });
});

// ===========================================================================
// Filters
// ===========================================================================

describe("Filters", () => {
  it("setStateFilter updates filters.stateAbbrev", () => {
    useMapStore.getState().setStateFilter("CA");

    expect(useMapStore.getState().filters.stateAbbrev).toBe("CA");
  });

  it("setStatusFilter updates filters.statusFilter", () => {
    useMapStore.getState().setStatusFilter("customer");

    expect(useMapStore.getState().filters.statusFilter).toBe("customer");
  });

  it("setSalesExecutive updates filters.salesExecutive", () => {
    useMapStore.getState().setSalesExecutive("Jane Doe");

    expect(useMapStore.getState().filters.salesExecutive).toBe("Jane Doe");
  });

  it("setSearchQuery updates filters.searchQuery", () => {
    useMapStore.getState().setSearchQuery("Springfield");

    expect(useMapStore.getState().filters.searchQuery).toBe("Springfield");
  });

  it("clearFilters resets all filters to initial values", () => {
    // Set various filters first
    useMapStore.getState().setStateFilter("TX");
    useMapStore.getState().setStatusFilter("pipeline");
    useMapStore.getState().setSalesExecutive("John Smith");
    useMapStore.getState().setSearchQuery("Dallas");

    useMapStore.getState().clearFilters();

    const { filters } = useMapStore.getState();
    expect(filters.stateAbbrev).toBe(null);
    expect(filters.statusFilter).toBe("all");
    expect(filters.salesExecutive).toBe(null);
    expect(filters.searchQuery).toBe("");
  });
});

// ===========================================================================
// Panel management
// ===========================================================================

describe("Panel management", () => {
  it("openStatePanel sets state panel type and clears district selection", () => {
    // Start with a district selected
    useMapStore.getState().setSelectedLeaid("1234567");

    useMapStore.getState().openStatePanel("CA");

    const state = useMapStore.getState();
    expect(state.activePanelType).toBe("state");
    expect(state.selectedStateCode).toBe("CA");
    expect(state.sidePanelOpen).toBe(true);
    expect(state.selectedLeaid).toBe(null);
  });

  it("openDistrictPanel sets district panel type and clears state selection", () => {
    // Start with a state selected
    useMapStore.getState().openStatePanel("NY");

    useMapStore.getState().openDistrictPanel("7654321");

    const state = useMapStore.getState();
    expect(state.activePanelType).toBe("district");
    expect(state.selectedLeaid).toBe("7654321");
    expect(state.sidePanelOpen).toBe(true);
    expect(state.selectedStateCode).toBe(null);
  });

  it("closePanel clears all panel state", () => {
    // Open a district panel first
    useMapStore.getState().openDistrictPanel("1234567");

    useMapStore.getState().closePanel();

    const state = useMapStore.getState();
    expect(state.activePanelType).toBe(null);
    expect(state.sidePanelOpen).toBe(false);
    expect(state.selectedLeaid).toBe(null);
    expect(state.selectedStateCode).toBe(null);
  });
});

// ===========================================================================
// Tooltip
// ===========================================================================

describe("Tooltip", () => {
  const sampleData: TooltipData = {
    type: "district",
    leaid: "1234567",
    name: "Springfield SD",
    stateAbbrev: "IL",
    enrollment: 5000,
  };

  it("showTooltip sets visible, position, and data", () => {
    useMapStore.getState().showTooltip(100, 200, sampleData);

    const { tooltip } = useMapStore.getState();
    expect(tooltip.visible).toBe(true);
    expect(tooltip.exiting).toBe(false);
    expect(tooltip.x).toBe(100);
    expect(tooltip.y).toBe(200);
    expect(tooltip.data).toEqual(sampleData);
  });

  it("hideTooltip starts exit animation (sets exiting: true)", () => {
    // Show tooltip first
    useMapStore.getState().showTooltip(100, 200, sampleData);

    useMapStore.getState().hideTooltip();

    const { tooltip } = useMapStore.getState();
    expect(tooltip.exiting).toBe(true);
    // Data and position are preserved during exit animation
    expect(tooltip.data).toEqual(sampleData);
  });

  it("hideTooltip is no-op if already hidden", () => {
    // Tooltip starts hidden
    const before = useMapStore.getState().tooltip;

    useMapStore.getState().hideTooltip();

    const after = useMapStore.getState().tooltip;
    expect(after).toEqual(before);
  });

  it("updateTooltipPosition updates x and y", () => {
    useMapStore.getState().showTooltip(100, 200, sampleData);

    useMapStore.getState().updateTooltipPosition(300, 400);

    const { tooltip } = useMapStore.getState();
    expect(tooltip.x).toBe(300);
    expect(tooltip.y).toBe(400);
    // Data is preserved
    expect(tooltip.data).toEqual(sampleData);
  });
});

// ===========================================================================
// Multi-select
// ===========================================================================

describe("Multi-select", () => {
  it("toggleMultiSelectMode enables multi-select and closes side panel", () => {
    useMapStore.setState({
      sidePanelOpen: true,
      selectedLeaid: "1234567",
    });

    useMapStore.getState().toggleMultiSelectMode();

    const state = useMapStore.getState();
    expect(state.multiSelectMode).toBe(true);
    expect(state.sidePanelOpen).toBe(false);
    expect(state.selectedLeaid).toBe(null);
  });

  it("toggleMultiSelectMode disabling clears selected districts", () => {
    useMapStore.setState({
      multiSelectMode: true,
      selectedLeaids: new Set(["1234567", "2345678", "3456789"]),
    });

    useMapStore.getState().toggleMultiSelectMode();

    const state = useMapStore.getState();
    expect(state.multiSelectMode).toBe(false);
    expect(state.selectedLeaids.size).toBe(0);
  });

  it("toggleDistrictSelection adds/removes from set", () => {
    // Add a district
    useMapStore.getState().toggleDistrictSelection("1234567");
    expect(useMapStore.getState().selectedLeaids.has("1234567")).toBe(true);

    // Add another
    useMapStore.getState().toggleDistrictSelection("2345678");
    expect(useMapStore.getState().selectedLeaids.size).toBe(2);

    // Remove the first
    useMapStore.getState().toggleDistrictSelection("1234567");
    expect(useMapStore.getState().selectedLeaids.has("1234567")).toBe(false);
    expect(useMapStore.getState().selectedLeaids.has("2345678")).toBe(true);
    expect(useMapStore.getState().selectedLeaids.size).toBe(1);
  });

  it("clearSelectedDistricts empties the set", () => {
    useMapStore.setState({
      selectedLeaids: new Set(["1234567", "2345678"]),
    });

    useMapStore.getState().clearSelectedDistricts();

    expect(useMapStore.getState().selectedLeaids.size).toBe(0);
  });
});

// ===========================================================================
// Similar districts
// ===========================================================================

describe("Similar districts", () => {
  it("setSimilarDistrictLeaids sets the array", () => {
    const leaids = ["1111111", "2222222", "3333333"];

    useMapStore.getState().setSimilarDistrictLeaids(leaids);

    expect(useMapStore.getState().similarDistrictLeaids).toEqual(leaids);
  });

  it("clearSimilarDistricts empties the array", () => {
    useMapStore.setState({
      similarDistrictLeaids: ["1111111", "2222222"],
    });

    useMapStore.getState().clearSimilarDistricts();

    expect(useMapStore.getState().similarDistrictLeaids).toEqual([]);
  });
});

// ===========================================================================
// Layer toggles
// ===========================================================================

describe("Layer toggles", () => {
  it("toggleVendorLayer flips vendorLayerVisible", () => {
    expect(useMapStore.getState().vendorLayerVisible).toBe(false);

    useMapStore.getState().toggleVendorLayer();
    expect(useMapStore.getState().vendorLayerVisible).toBe(true);

    useMapStore.getState().toggleVendorLayer();
    expect(useMapStore.getState().vendorLayerVisible).toBe(false);
  });

  it("toggleCharterLayer flips charterLayerVisible", () => {
    expect(useMapStore.getState().charterLayerVisible).toBe(false);

    useMapStore.getState().toggleCharterLayer();
    expect(useMapStore.getState().charterLayerVisible).toBe(true);

    useMapStore.getState().toggleCharterLayer();
    expect(useMapStore.getState().charterLayerVisible).toBe(false);
  });
});

// ===========================================================================
// Selectors
// ===========================================================================

describe("Selectors", () => {
  it("selectFilters returns filters object", () => {
    useMapStore.getState().setStateFilter("NY");
    useMapStore.getState().setStatusFilter("pipeline");

    const filters = selectFilters(useMapStore.getState());

    expect(filters).toEqual({
      stateAbbrev: "NY",
      statusFilter: "pipeline",
      salesExecutive: null,
      searchQuery: "",
    });
  });

  it("selectPanelState returns panel-related state", () => {
    useMapStore.getState().openDistrictPanel("1234567");

    const panelState = selectPanelState(useMapStore.getState());

    expect(panelState).toEqual({
      activePanelType: "district",
      selectedStateCode: null,
      selectedLeaid: "1234567",
      sidePanelOpen: true,
    });
  });
});
