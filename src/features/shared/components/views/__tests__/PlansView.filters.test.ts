// src/features/shared/components/views/__tests__/PlansView.filters.test.ts
// Tests for the filteredPlans memo logic extracted as a pure function.
import { describe, it, expect } from "vitest";

// Note: schoolNcesIds is NOT used in filtering — school filtering works by
// mapping each selected school to its parent leaid and filtering via districtLeaids.
type PlanStub = {
  status: string;
  fiscalYear: number;
  owner: { id: string; fullName: string } | null;
  states: { fips: string }[];
  districtLeaids: string[] | undefined;
};

function filterPlans(
  plans: PlanStub[],
  {
    statuses,
    fiscalYears,
    ownerIds,
    stateFips,
    districtLeaids,
    schoolLeaids,
  }: {
    statuses: string[];
    fiscalYears: string[];
    ownerIds: string[];
    stateFips: string[];
    districtLeaids: string[];
    schoolLeaids: string[];
  }
): PlanStub[] {
  let result = plans;
  if (statuses.length)
    result = result.filter((p) => statuses.includes(p.status));
  if (fiscalYears.length)
    result = result.filter((p) => fiscalYears.includes(String(p.fiscalYear)));
  if (ownerIds.length)
    result = result.filter((p) => p.owner && ownerIds.includes(p.owner.id));
  if (stateFips.length)
    result = result.filter((p) => p.states.some((s) => stateFips.includes(s.fips)));
  const allLeaidFilters = [...districtLeaids, ...schoolLeaids];
  if (allLeaidFilters.length)
    result = result.filter((p) =>
      (p.districtLeaids ?? []).some((id) => allLeaidFilters.includes(id))
    );
  return result;
}

const PLANS: PlanStub[] = [
  {
    status: "planning",
    fiscalYear: 2026,
    owner: { id: "u1", fullName: "Alice" },
    states: [{ fips: "06" }],
    districtLeaids: ["lea001", "lea002"],
  },
  {
    status: "working",
    fiscalYear: 2027,
    owner: { id: "u2", fullName: "Bob" },
    states: [{ fips: "48" }],
    districtLeaids: ["lea003"],
  },
  {
    status: "archived",
    fiscalYear: 2026,
    owner: null,
    states: [],
    districtLeaids: undefined,   // intentionally undefined — tests the ?? [] null guard
  },
];

const noFilters = { statuses: [], fiscalYears: [], ownerIds: [], stateFips: [], districtLeaids: [], schoolLeaids: [] };

describe("filterPlans — individual dimensions", () => {
  it("returns all plans when no filters are active", () => {
    expect(filterPlans(PLANS, noFilters)).toHaveLength(3);
  });

  it("filters by status", () => {
    const result = filterPlans(PLANS, { ...noFilters, statuses: ["planning"] });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("planning");
  });

  it("filters by fiscal year (string comparison)", () => {
    const result = filterPlans(PLANS, { ...noFilters, fiscalYears: ["2026"] });
    expect(result).toHaveLength(2);
  });

  it("filters by owner id", () => {
    const result = filterPlans(PLANS, { ...noFilters, ownerIds: ["u1"] });
    expect(result).toHaveLength(1);
    expect(result[0].owner?.id).toBe("u1");
  });

  it("excludes plans with null owner when owner filter is active", () => {
    const result = filterPlans(PLANS, { ...noFilters, ownerIds: ["u1", "u2"] });
    expect(result).toHaveLength(2);
  });

  it("filters by state fips", () => {
    const result = filterPlans(PLANS, { ...noFilters, stateFips: ["06"] });
    expect(result).toHaveLength(1);
  });

  it("filters by district leaid", () => {
    const result = filterPlans(PLANS, { ...noFilters, districtLeaids: ["lea003"] });
    expect(result).toHaveLength(1);
  });

  it("filters by school leaid (OR with district leaids)", () => {
    const result = filterPlans(PLANS, { ...noFilters, schoolLeaids: ["lea001"] });
    expect(result).toHaveLength(1);
  });

  it("does not throw when districtLeaids is undefined on a plan", () => {
    expect(() =>
      filterPlans(PLANS, { ...noFilters, districtLeaids: ["lea999"] })
    ).not.toThrow();
  });
});

describe("filterPlans — combined filters", () => {
  it("ANDs two active filters", () => {
    const result = filterPlans(PLANS, { ...noFilters, statuses: ["planning"], fiscalYears: ["2026"] });
    expect(result).toHaveLength(1);
  });

  it("returns empty array when filters produce no matches", () => {
    const result = filterPlans(PLANS, { ...noFilters, statuses: ["stale"] });
    expect(result).toHaveLength(0);
  });
});
