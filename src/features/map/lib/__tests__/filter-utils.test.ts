import { describe, it, expect } from "vitest";
import {
  isPlansFiltered,
  isContactsFiltered,
  isVacanciesFiltered,
  isActivitiesFiltered,
  extractLeaids,
  leaidSetKey,
} from "../filter-utils";

describe("isPlansFiltered", () => {
  it("returns false for empty/default filters", () => {
    expect(isPlansFiltered({})).toBe(false);
    expect(isPlansFiltered({ ownerScope: "mine" })).toBe(false);
  });
  it("returns true when ownerIds set", () => {
    expect(isPlansFiltered({ ownerIds: ["abc"] })).toBe(true);
  });
  it("returns true when ownerScope is all", () => {
    expect(isPlansFiltered({ ownerScope: "all" })).toBe(true);
  });
  it("returns true when planIds set", () => {
    expect(isPlansFiltered({ planIds: ["p1"] })).toBe(true);
  });
  it("returns true when status set", () => {
    expect(isPlansFiltered({ status: ["working"] })).toBe(true);
  });
  it("returns true when fiscalYear set", () => {
    expect(isPlansFiltered({ fiscalYear: 2026 })).toBe(true);
  });
});

describe("isContactsFiltered", () => {
  it("returns false for empty filters", () => {
    expect(isContactsFiltered({})).toBe(false);
  });
  it("returns true when seniorityLevel set", () => {
    expect(isContactsFiltered({ seniorityLevel: ["C-Suite"] })).toBe(true);
  });
  it("returns true when primaryOnly set", () => {
    expect(isContactsFiltered({ primaryOnly: true })).toBe(true);
  });
});

describe("isVacanciesFiltered", () => {
  it("returns false for empty filters", () => {
    expect(isVacanciesFiltered({})).toBe(false);
  });
  it("returns true when category set", () => {
    expect(isVacanciesFiltered({ category: ["SPED"] })).toBe(true);
  });
  it("returns true when fullmindRelevant set", () => {
    expect(isVacanciesFiltered({ fullmindRelevant: true })).toBe(true);
  });
});

describe("isActivitiesFiltered", () => {
  it("returns false for empty filters", () => {
    expect(isActivitiesFiltered({})).toBe(false);
  });
  it("returns true when type set", () => {
    expect(isActivitiesFiltered({ type: ["call"] })).toBe(true);
  });
});

describe("extractLeaids", () => {
  it("extracts leaids from GeoJSON features", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        { properties: { leaid: "A" } },
        { properties: { leaid: "B" } },
        { properties: { leaid: "A" } },
        { properties: {} },
      ],
    };
    const result = extractLeaids(geojson);
    expect(result).toEqual(new Set(["A", "B"]));
  });
  it("returns empty set for null input", () => {
    expect(extractLeaids(null)).toEqual(new Set());
  });
});

describe("leaidSetKey", () => {
  it("returns stable key for same contents in different order", () => {
    const a = new Set(["B", "A", "C"]);
    const b = new Set(["C", "A", "B"]);
    expect(leaidSetKey(a)).toBe(leaidSetKey(b));
  });
  it("returns empty string for null", () => {
    expect(leaidSetKey(null)).toBe("");
  });
});
