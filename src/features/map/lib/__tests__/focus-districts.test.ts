import { describe, it, expect } from "vitest";
import { useMapV2Store, COPILOT_FOCUS_ID } from "../store";

describe("focusDistricts", () => {
  it("isolates to the given districts, stashes filters, queues bounds, and restores on exit", () => {
    useMapV2Store.setState({ filterStates: ["CA"], filterOwner: "rep-1" });

    useMapV2Store.getState().focusDistricts(["1900001", "1900002"], ["IA"], [[-96, 40], [-90, 44]]);
    const s = useMapV2Store.getState();
    expect(s.focusLeaids).toEqual(["1900001", "1900002"]);
    expect(s.filterStates).toEqual(["IA"]);
    expect(s.focusPlanId).toBe(COPILOT_FOCUS_ID);
    expect(s.pendingFitBounds).toEqual([[-96, 40], [-90, 44]]);
    expect(s.preFocusFilters?.filterStates).toEqual(["CA"]);
    expect(s.preFocusFilters?.filterOwner).toBe("rep-1");

    useMapV2Store.getState().unfocusPlan();
    const after = useMapV2Store.getState();
    expect(after.focusLeaids).toEqual([]);
    expect(after.filterStates).toEqual(["CA"]);
    expect(after.filterOwner).toBe("rep-1");
  });
});
