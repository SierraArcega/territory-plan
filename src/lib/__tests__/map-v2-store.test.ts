import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "@/features/map/lib/store";
import { DEFAULT_VENDOR_PALETTE, DEFAULT_SIGNAL_PALETTE } from "@/features/map/lib/palettes";

describe("useMapV2Store - Plan Workspace", () => {
  beforeEach(() => {
    useMapV2Store.setState({
      panelState: "BROWSE",
      panelHistory: [],
      activePlanId: null,
      planSection: "districts",
      rightPanelContent: null,
    });
  });

  describe("viewPlan", () => {
    it("transitions to PLAN_OVERVIEW and sets activePlanId", () => {
      useMapV2Store.getState().viewPlan("plan-123");

      const state = useMapV2Store.getState();
      expect(state.panelState).toBe("PLAN_OVERVIEW");
      expect(state.activePlanId).toBe("plan-123");
      expect(state.planSection).toBe("districts");
    });
  });

  describe("setPlanSection", () => {
    it("updates planSection and panelState", () => {
      useMapV2Store.setState({ activePlanId: "plan-123", panelState: "PLAN_OVERVIEW" });

      useMapV2Store.getState().setPlanSection("tasks");

      const state = useMapV2Store.getState();
      expect(state.planSection).toBe("tasks");
      expect(state.panelState).toBe("PLAN_TASKS");
    });

    it("closes right panel when switching sections", () => {
      useMapV2Store.setState({
        activePlanId: "plan-123",
        panelState: "PLAN_OVERVIEW",
        rightPanelContent: { type: "task_form", id: "1234567" },
      });

      useMapV2Store.getState().setPlanSection("contacts");

      expect(useMapV2Store.getState().rightPanelContent).toBeNull();
    });
  });

  describe("openRightPanel / closeRightPanel", () => {
    it("sets rightPanelContent", () => {
      useMapV2Store.getState().openRightPanel({ type: "task_form", id: "1234567" });

      expect(useMapV2Store.getState().rightPanelContent).toEqual({
        type: "task_form",
        id: "1234567",
      });
    });

    it("clears rightPanelContent on close", () => {
      useMapV2Store.setState({
        rightPanelContent: { type: "task_form" },
      });

      useMapV2Store.getState().closeRightPanel();

      expect(useMapV2Store.getState().rightPanelContent).toBeNull();
    });
  });
});

describe("useMapV2Store - Palette Preferences", () => {
  beforeEach(() => {
    useMapV2Store.setState({
      vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
      signalPalette: DEFAULT_SIGNAL_PALETTE,
    });
  });

  it("initializes with default vendor palettes", () => {
    const state = useMapV2Store.getState();
    expect(state.vendorPalettes.fullmind).toBe("plum");
    expect(state.vendorPalettes.proximity).toBe("coral");
    expect(state.vendorPalettes.elevate).toBe("steel-blue");
    expect(state.vendorPalettes.tbt).toBe("golden");
  });

  it("initializes with default signal palette", () => {
    expect(useMapV2Store.getState().signalPalette).toBe("mint-coral");
  });

  it("setVendorPalette updates a single vendor", () => {
    useMapV2Store.getState().setVendorPalette("fullmind", "ocean");
    expect(useMapV2Store.getState().vendorPalettes.fullmind).toBe("ocean");
    expect(useMapV2Store.getState().vendorPalettes.proximity).toBe("coral");
  });

  it("setSignalPalette updates the signal palette", () => {
    useMapV2Store.getState().setSignalPalette("blue-orange");
    expect(useMapV2Store.getState().signalPalette).toBe("blue-orange");
  });
});
