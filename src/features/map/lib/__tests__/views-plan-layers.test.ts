import { describe, it, expect } from "vitest";
import {
  viewsPlanLeaidFilter,
  VIEWS_PLAN_HIGHLIGHT_FILL_LAYER,
  VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER,
  VIEWS_PLAN_SELECTION_FILL_LAYER,
  VIEWS_PLAN_SELECTION_OUTLINE_LAYER,
} from "../layers";

describe("viewsPlanLeaidFilter", () => {
  it("wraps a leaid 'in' test that excludes rollups", () => {
    const f = viewsPlanLeaidFilter(["0601234", "3600001"]);
    expect(f[0]).toBe("all");
    // last clause is the leaid membership test
    expect(f[f.length - 1]).toEqual([
      "in",
      ["get", "leaid"],
      ["literal", ["0601234", "3600001"]],
    ]);
  });

  it("matches nothing for an empty list", () => {
    const f = viewsPlanLeaidFilter([]);
    expect(f[f.length - 1]).toEqual(["in", ["get", "leaid"], ["literal", []]]);
  });
});

describe("views plan layer configs", () => {
  it("all four target the districts source layer", () => {
    for (const layer of [
      VIEWS_PLAN_HIGHLIGHT_FILL_LAYER,
      VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER,
      VIEWS_PLAN_SELECTION_FILL_LAYER,
      VIEWS_PLAN_SELECTION_OUTLINE_LAYER,
    ]) {
      expect(layer.source).toBe("districts");
      expect(layer["source-layer"]).toBe("districts");
    }
  });

  it("uses plum for in-plan and coral for selection", () => {
    expect(VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER.paint["line-color"]).toBe("#403770");
    expect(VIEWS_PLAN_SELECTION_OUTLINE_LAYER.paint["line-color"]).toBe("#F37167");
  });

  it("has distinct layer ids", () => {
    const ids = [
      VIEWS_PLAN_HIGHLIGHT_FILL_LAYER.id,
      VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER.id,
      VIEWS_PLAN_SELECTION_FILL_LAYER.id,
      VIEWS_PLAN_SELECTION_OUTLINE_LAYER.id,
    ];
    expect(new Set(ids).size).toBe(4);
  });
});
