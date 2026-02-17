import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../map-v2-store";

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
