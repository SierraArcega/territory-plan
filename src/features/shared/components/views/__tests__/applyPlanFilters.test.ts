import { describe, it, expect } from "vitest";
import { applyPlanFilters } from "../PlansView";
import type { TerritoryPlan } from "@/lib/api";

const mockPlans: TerritoryPlan[] = [
  {
    id: "plan-1",
    name: "West Region Q1",
    description: "Primary focus on Western expansion",
    owner: { id: "user-1", fullName: "John Smith", avatarUrl: null },
    color: "#FF5733",
    status: "working",
    fiscalYear: 2026,
    startDate: null,
    endDate: null,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-15T00:00:00Z",
    districtCount: 15,
    districtLeaids: [],
    schoolNcesIds: [],
    totalEnrollment: 50000,
    stateCount: 1,
    states: [{ fips: "06", abbrev: "CA", name: "California" }],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
    renewalRollup: 0,
    expansionRollup: 0,
    winbackRollup: 0,
    newBusinessRollup: 0,
    pipelineTotal: 0,
  },
  {
    id: "plan-2",
    name: "East Coast Expansion",
    description: "New territory development",
    owner: { id: "user-2", fullName: "Jane Doe", avatarUrl: null },
    color: "#3498DB",
    status: "planning",
    fiscalYear: 2026,
    startDate: null,
    endDate: null,
    createdAt: "2025-12-10T00:00:00Z",
    updatedAt: "2025-12-20T00:00:00Z",
    districtCount: 8,
    districtLeaids: [],
    schoolNcesIds: [],
    totalEnrollment: 30000,
    stateCount: 2,
    states: [
      { fips: "36", abbrev: "NY", name: "New York" },
      { fips: "34", abbrev: "NJ", name: "New Jersey" },
    ],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
    renewalRollup: 0,
    expansionRollup: 0,
    winbackRollup: 0,
    newBusinessRollup: 0,
    pipelineTotal: 0,
  },
];

describe("applyPlanFilters", () => {
  const emptyFilters = {
    nameSearch: "",
    descriptionSearch: "",
    statuses: [],
    fiscalYears: [],
    ownerIds: [],
    stateFips: [],
    districtLeaids: [],
  };

  it("filters by name (case-insensitive substring)", () => {
    const result = applyPlanFilters(mockPlans, { ...emptyFilters, nameSearch: "west" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("plan-1");
  });

  it("filters by description (case-insensitive substring)", () => {
    const result = applyPlanFilters(mockPlans, { ...emptyFilters, descriptionSearch: "territory" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("plan-2");
  });

  it("combines name search with other filters", () => {
    const result = applyPlanFilters(mockPlans, { ...emptyFilters, nameSearch: "east", statuses: ["planning"] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("plan-2");
  });

  it("returns empty when name search matches no plans", () => {
    const result = applyPlanFilters(mockPlans, { ...emptyFilters, nameSearch: "nonexistent" });
    expect(result).toHaveLength(0);
  });

  it("handles null description gracefully", () => {
    const plansWithNull = [...mockPlans, { ...mockPlans[0], id: "plan-null", description: null }];
    const result = applyPlanFilters(plansWithNull, { ...emptyFilters, descriptionSearch: "focus" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("plan-1");
  });
});
