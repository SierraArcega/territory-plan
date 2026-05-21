import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../store";

function reset() {
  useMapV2Store.setState({
    viewsPlanId: null,
    viewsPlanHighlightLeaids: new Set<string>(),
    viewsPlanSelectedLeaids: new Set<string>(),
  });
}

describe("useMapV2Store — views plan map context", () => {
  beforeEach(reset);

  it("setViewsPlanContext sets id + highlight and clears selection", () => {
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0699999"]));
    const s = useMapV2Store.getState();
    expect(s.viewsPlanId).toBe("plan-1");
    expect([...s.viewsPlanHighlightLeaids]).toEqual(["0699999"]);
    expect(s.viewsPlanSelectedLeaids.size).toBe(0);
  });

  it("toggleViewsPlanSelection adds then removes a leaid", () => {
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.has("0601234")).toBe(true);
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.has("0601234")).toBe(false);
  });

  it("toggleViewsPlanSelection is a no-op for in-plan leaids", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.size).toBe(0);
  });

  it("addToViewsPlanHighlight merges leaids into the highlight set", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().addToViewsPlanHighlight(["0699999", "0601234"]);
    expect([...useMapV2Store.getState().viewsPlanHighlightLeaids].sort()).toEqual([
      "0601234",
      "0699999",
    ]);
  });

  it("clearViewsPlanSelection empties only the selection set", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().toggleViewsPlanSelection("0699999");
    useMapV2Store.getState().clearViewsPlanSelection();
    const s = useMapV2Store.getState();
    expect(s.viewsPlanSelectedLeaids.size).toBe(0);
    expect(s.viewsPlanHighlightLeaids.size).toBe(1);
  });

  it("clearViewsPlanContext resets all three fields", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().toggleViewsPlanSelection("0699999");
    useMapV2Store.getState().clearViewsPlanContext();
    const s = useMapV2Store.getState();
    expect(s.viewsPlanId).toBeNull();
    expect(s.viewsPlanHighlightLeaids.size).toBe(0);
    expect(s.viewsPlanSelectedLeaids.size).toBe(0);
  });
});
