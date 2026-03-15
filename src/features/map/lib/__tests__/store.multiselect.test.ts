import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../store";

beforeEach(() => {
  useMapV2Store.setState({
    selectedLeaids: new Set<string>(),
    panelState: "BROWSE",
    panelHistory: [],
    selectedLeaid: null,
  });
});

describe("toggleLeaidSelection", () => {
  it("adds a leaid to selectedLeaids and switches panelState to MULTI_DISTRICT when BROWSE", () => {
    useMapV2Store.getState().toggleLeaidSelection("1234567");
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.has("1234567")).toBe(true);
    expect(s.panelState).toBe("MULTI_DISTRICT");
  });

  it("removes a leaid and returns to BROWSE when the set becomes empty", () => {
    useMapV2Store.getState().toggleLeaidSelection("1234567");
    useMapV2Store.getState().toggleLeaidSelection("1234567");
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.size).toBe(0);
    expect(s.panelState).toBe("BROWSE");
  });

  it("stays in MULTI_DISTRICT when removing one of multiple leaids", () => {
    useMapV2Store.getState().toggleLeaidSelection("aaa");
    useMapV2Store.getState().toggleLeaidSelection("bbb");
    useMapV2Store.getState().toggleLeaidSelection("aaa");
    const s = useMapV2Store.getState();
    expect(s.panelState).toBe("MULTI_DISTRICT");
    expect(s.selectedLeaids.has("bbb")).toBe(true);
  });

  it("enforces a 20-district cap — 21st add is a no-op", () => {
    for (let i = 0; i < 20; i++) {
      useMapV2Store.getState().toggleLeaidSelection(`district-${i}`);
    }
    useMapV2Store.getState().toggleLeaidSelection("district-overflow");
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.size).toBe(20);
    expect(s.selectedLeaids.has("district-overflow")).toBe(false);
  });

  it("does not push MULTI_DISTRICT panelState if already in MULTI_DISTRICT", () => {
    useMapV2Store.getState().toggleLeaidSelection("aaa");
    useMapV2Store.getState().toggleLeaidSelection("bbb");
    const s = useMapV2Store.getState();
    expect(s.panelState).toBe("MULTI_DISTRICT");
  });
});

describe("clearSelectedDistricts", () => {
  it("clears selectedLeaids and resets panelState to BROWSE", () => {
    useMapV2Store.getState().toggleLeaidSelection("abc");
    expect(useMapV2Store.getState().panelState).toBe("MULTI_DISTRICT");
    useMapV2Store.getState().clearSelectedDistricts();
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.size).toBe(0);
    expect(s.panelState).toBe("BROWSE");
    expect(s.panelHistory).toEqual([]);
  });
});

describe("goBack from DISTRICT to MULTI_DISTRICT", () => {
  it("clears selectedLeaid when returning to MULTI_DISTRICT", () => {
    useMapV2Store.getState().toggleLeaidSelection("abc");
    useMapV2Store.getState().selectDistrict("abc");
    expect(useMapV2Store.getState().selectedLeaid).toBe("abc");
    expect(useMapV2Store.getState().panelState).toBe("DISTRICT");

    useMapV2Store.getState().goBack();
    const s = useMapV2Store.getState();
    expect(s.panelState).toBe("MULTI_DISTRICT");
    expect(s.selectedLeaid).toBeNull();
    expect(s.selectedLeaids.has("abc")).toBe(true);
  });

  it("clears selectedLeaid when returning to BROWSE", () => {
    useMapV2Store.getState().selectDistrict("xyz");
    expect(useMapV2Store.getState().panelState).toBe("DISTRICT");
    useMapV2Store.getState().goBack();
    const s = useMapV2Store.getState();
    expect(s.panelState).toBe("BROWSE");
    expect(s.selectedLeaid).toBeNull();
  });
});

describe("selectDistrict nav stack deduplication", () => {
  it("does not push duplicate MULTI_DISTRICT entries when Explore is called repeatedly", () => {
    useMapV2Store.getState().toggleLeaidSelection("abc"); // panelState → MULTI_DISTRICT
    useMapV2Store.getState().selectDistrict("abc");       // push MULTI_DISTRICT, go to DISTRICT
    useMapV2Store.getState().goBack();                    // back to MULTI_DISTRICT
    const historyAfterFirstCycle = useMapV2Store.getState().panelHistory.length;

    useMapV2Store.getState().selectDistrict("abc");       // second Explore — should NOT push again
    const historyAfterSecondExplore = useMapV2Store.getState().panelHistory.length;

    // Second Explore should not have grown the history vs after first goBack
    expect(historyAfterSecondExplore).toBe(historyAfterFirstCycle + 1);
    // And only one MULTI_DISTRICT entry should be at the top
    const history = useMapV2Store.getState().panelHistory;
    expect(history[history.length - 1]).toBe("MULTI_DISTRICT");
    expect(history.filter(s => s === "MULTI_DISTRICT").length).toBe(1);
  });
});
