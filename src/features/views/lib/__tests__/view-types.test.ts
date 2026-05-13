import { describe, it, expect } from "vitest";
import {
  VIEW_SPECS,
  VIEW_IDS,
  VIEW_ICON,
  DETAIL_KINDS,
  isViewId,
  isDetailKind,
  lookupViewSpec,
} from "../view-types";

describe("view-types registry", () => {
  it("has all 8 view IDs", () => {
    expect(VIEW_IDS).toEqual([
      "map",
      "table",
      "kanban",
      "contacts",
      "opps",
      "vacancies",
      "news",
      "rfps",
    ]);
  });

  it("VIEW_SPECS length matches VIEW_IDS", () => {
    expect(VIEW_SPECS).toHaveLength(VIEW_IDS.length);
  });

  it("each spec has a unique id", () => {
    const ids = new Set(VIEW_SPECS.map((s) => s.id));
    expect(ids.size).toBe(VIEW_SPECS.length);
  });

  it("each spec maps to a Lucide icon (function/component)", () => {
    for (const spec of VIEW_SPECS) {
      expect(spec.icon).toBeTruthy();
      expect(typeof spec.icon === "function" || typeof spec.icon === "object").toBe(true);
    }
  });

  it("VIEW_ICON contains a key for every view id", () => {
    for (const id of VIEW_IDS) {
      expect(VIEW_ICON[id]).toBe(lookupViewSpec(id).icon);
    }
  });

  it("DETAIL_KINDS covers map/table/kanban via 'district'", () => {
    expect(VIEW_SPECS.find((v) => v.id === "map")?.detailKind).toBe("district");
    expect(VIEW_SPECS.find((v) => v.id === "table")?.detailKind).toBe("district");
    expect(VIEW_SPECS.find((v) => v.id === "kanban")?.detailKind).toBe("district");
  });

  it("each entity view maps to its own detail kind", () => {
    expect(VIEW_SPECS.find((v) => v.id === "contacts")?.detailKind).toBe("contact");
    expect(VIEW_SPECS.find((v) => v.id === "opps")?.detailKind).toBe("opp");
    expect(VIEW_SPECS.find((v) => v.id === "vacancies")?.detailKind).toBe("vacancy");
    expect(VIEW_SPECS.find((v) => v.id === "news")?.detailKind).toBe("news");
    expect(VIEW_SPECS.find((v) => v.id === "rfps")?.detailKind).toBe("rfp");
  });

  it("isViewId narrows correctly", () => {
    expect(isViewId("map")).toBe(true);
    expect(isViewId("table")).toBe(true);
    expect(isViewId("garbage")).toBe(false);
    expect(isViewId("")).toBe(false);
  });

  it("isDetailKind narrows correctly", () => {
    expect(isDetailKind("district")).toBe(true);
    expect(isDetailKind("opp")).toBe(true);
    expect(isDetailKind("garbage")).toBe(false);
  });

  it("DETAIL_KINDS has all 6 entity types", () => {
    expect(DETAIL_KINDS).toEqual([
      "district",
      "contact",
      "opp",
      "vacancy",
      "news",
      "rfp",
    ]);
  });

  it("lookupViewSpec throws on unknown id", () => {
    // @ts-expect-error — intentionally pass an invalid id to verify runtime guard
    expect(() => lookupViewSpec("nope")).toThrow();
  });
});
