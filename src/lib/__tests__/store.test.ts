import { describe, it, expect, beforeEach } from "vitest";
import { useMapStore } from "@/features/shared/lib/app-store";

describe("useMapStore - Multi-Select Mode", () => {
  beforeEach(() => {
    // Reset the store before each test
    useMapStore.setState({
      multiSelectMode: false,
      selectedLeaids: new Set<string>(),
      currentPlanId: null,
      selectedLeaid: null,
      sidePanelOpen: false,
    });
  });

  describe("toggleMultiSelectMode", () => {
    it("enables multi-select mode", () => {
      expect(useMapStore.getState().multiSelectMode).toBe(false);

      useMapStore.getState().toggleMultiSelectMode();

      expect(useMapStore.getState().multiSelectMode).toBe(true);
    });

    it("disables multi-select mode and clears selections", () => {
      // Set up initial state
      useMapStore.setState({
        multiSelectMode: true,
        selectedLeaids: new Set(["1234567", "2345678"]),
      });

      useMapStore.getState().toggleMultiSelectMode();

      expect(useMapStore.getState().multiSelectMode).toBe(false);
      expect(useMapStore.getState().selectedLeaids.size).toBe(0);
    });

    it("closes side panel when entering multi-select mode", () => {
      useMapStore.setState({
        sidePanelOpen: true,
        selectedLeaid: "1234567",
      });

      useMapStore.getState().toggleMultiSelectMode();

      expect(useMapStore.getState().sidePanelOpen).toBe(false);
      expect(useMapStore.getState().selectedLeaid).toBe(null);
    });
  });

  describe("toggleDistrictSelection", () => {
    it("adds a district to selection", () => {
      useMapStore.setState({ multiSelectMode: true });

      useMapStore.getState().toggleDistrictSelection("1234567");

      expect(useMapStore.getState().selectedLeaids.has("1234567")).toBe(true);
      expect(useMapStore.getState().selectedLeaids.size).toBe(1);
    });

    it("removes a district from selection", () => {
      useMapStore.setState({
        multiSelectMode: true,
        selectedLeaids: new Set(["1234567", "2345678"]),
      });

      useMapStore.getState().toggleDistrictSelection("1234567");

      expect(useMapStore.getState().selectedLeaids.has("1234567")).toBe(false);
      expect(useMapStore.getState().selectedLeaids.has("2345678")).toBe(true);
      expect(useMapStore.getState().selectedLeaids.size).toBe(1);
    });

    it("handles multiple selections", () => {
      useMapStore.setState({ multiSelectMode: true });

      useMapStore.getState().toggleDistrictSelection("1234567");
      useMapStore.getState().toggleDistrictSelection("2345678");
      useMapStore.getState().toggleDistrictSelection("3456789");

      expect(useMapStore.getState().selectedLeaids.size).toBe(3);
      expect(useMapStore.getState().selectedLeaids.has("1234567")).toBe(true);
      expect(useMapStore.getState().selectedLeaids.has("2345678")).toBe(true);
      expect(useMapStore.getState().selectedLeaids.has("3456789")).toBe(true);
    });
  });

  describe("clearSelectedDistricts", () => {
    it("clears all selected districts", () => {
      useMapStore.setState({
        multiSelectMode: true,
        selectedLeaids: new Set(["1234567", "2345678", "3456789"]),
      });

      useMapStore.getState().clearSelectedDistricts();

      expect(useMapStore.getState().selectedLeaids.size).toBe(0);
    });
  });

  describe("setCurrentPlanId", () => {
    it("sets the current plan ID", () => {
      useMapStore.getState().setCurrentPlanId("plan-123");

      expect(useMapStore.getState().currentPlanId).toBe("plan-123");
    });

    it("clears the current plan ID", () => {
      useMapStore.setState({ currentPlanId: "plan-123" });

      useMapStore.getState().setCurrentPlanId(null);

      expect(useMapStore.getState().currentPlanId).toBe(null);
    });
  });
});
