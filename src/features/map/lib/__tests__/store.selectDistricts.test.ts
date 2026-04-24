import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../store";

describe("selectDistricts batched action", () => {
  beforeEach(() => {
    useMapV2Store.setState({
      selectedLeaids: new Set(),
      panelState: "BROWSE",
      panelHistory: [],
      activeIconTab: "home",
    });
  });

  it("sets exactly the given leaids in one store update", () => {
    const store = useMapV2Store.getState();
    store.selectDistricts(["a", "b", "c"]);
    const after = useMapV2Store.getState();
    expect(Array.from(after.selectedLeaids).sort()).toEqual(["a", "b", "c"]);
    expect(after.panelState).toBe("MULTI_DISTRICT");
    expect(after.activeIconTab).toBe("selection");
  });

  it("bypasses the 20-item cap (used for rollup expansion > 20 children)", () => {
    const leaids = Array.from({ length: 35 }, (_, i) => `leaid-${i}`);
    useMapV2Store.getState().selectDistricts(leaids);
    expect(useMapV2Store.getState().selectedLeaids.size).toBe(35);
  });

  it("sets BROWSE / home on empty input", () => {
    useMapV2Store.getState().selectDistricts([]);
    const after = useMapV2Store.getState();
    expect(after.selectedLeaids.size).toBe(0);
    expect(after.panelState).toBe("BROWSE");
    expect(after.activeIconTab).toBe("home");
  });
});
