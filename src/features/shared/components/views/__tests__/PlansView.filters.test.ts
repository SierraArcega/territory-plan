// src/features/shared/components/views/__tests__/PlansView.filters.test.ts
// Tests for applyPlanFilters — the pure filter function used by the filteredPlans memo.
import { describe, it, expect } from "vitest";
import { applyPlanFilters } from "../PlansView";
import type { TerritoryPlan } from "@/features/shared/types/api-types";

// Minimal plan stubs — only fields used by applyPlanFilters need to be populated.
// School filtering works by matching school-parent leaid against districtLeaids;
// selectedSchoolLeaids is a set of leaids (not ncessch ids).
const PLANS = [
  {
    status: "planning",
    fiscalYear: 2026,
    owner: { id: "u1", fullName: "Alice" },
    states: [{ fips: "06", abbrev: "CA" }],
    districtLeaids: ["lea001", "lea002"],
  },
  {
    status: "working",
    fiscalYear: 2027,
    owner: { id: "u2", fullName: "Bob" },
    states: [{ fips: "48", abbrev: "TX" }],
    districtLeaids: ["lea003"],
  },
  {
    status: "archived",
    fiscalYear: 2026,
    owner: null,
    states: [],
    districtLeaids: undefined,   // intentionally undefined — tests the ?? [] null guard
  },
] as unknown as TerritoryPlan[];

const noFilters = { statuses: [], fiscalYears: [], ownerIds: [], stateFips: [], districtLeaids: [], schoolLeaids: [] };

describe("applyPlanFilters — individual dimensions", () => {
  it("returns all plans when no filters are active", () => {
    expect(applyPlanFilters(PLANS, noFilters)).toHaveLength(3);
  });

  it("filters by status", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, statuses: ["planning"] });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("planning");
  });

  it("filters by fiscal year (string comparison)", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, fiscalYears: ["2026"] });
    expect(result).toHaveLength(2);
  });

  it("filters by owner id", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, ownerIds: ["u1"] });
    expect(result).toHaveLength(1);
    expect(result[0].owner?.id).toBe("u1");
  });

  it("excludes plans with null owner when owner filter is active", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, ownerIds: ["u1", "u2"] });
    expect(result).toHaveLength(2);
  });

  it("filters by state fips", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, stateFips: ["06"] });
    expect(result).toHaveLength(1);
  });

  it("filters by district leaid", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, districtLeaids: ["lea003"] });
    expect(result).toHaveLength(1);
  });

  it("filters by school leaid (OR-combined with district leaids against districtLeaids field)", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, schoolLeaids: ["lea001"] });
    expect(result).toHaveLength(1);
  });

  it("does not throw when districtLeaids is undefined on a plan", () => {
    expect(() =>
      applyPlanFilters(PLANS, { ...noFilters, districtLeaids: ["lea999"] })
    ).not.toThrow();
  });
});

describe("applyPlanFilters — combined filters", () => {
  it("ANDs two active filters", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, statuses: ["planning"], fiscalYears: ["2026"] });
    expect(result).toHaveLength(1);
  });

  it("returns empty array when filters produce no matches", () => {
    const result = applyPlanFilters(PLANS, { ...noFilters, statuses: ["stale"] });
    expect(result).toHaveLength(0);
  });
});
