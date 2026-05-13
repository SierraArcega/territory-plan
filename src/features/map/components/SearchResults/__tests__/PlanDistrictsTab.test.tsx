import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import PlanDistrictsTab from "../PlanDistrictsTab";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";

// Mock all hooks that hit the network
vi.mock("@/lib/api", () => ({
  useUpdateDistrictTargets: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveDistrictFromPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useServices: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: () => ({ setFocusedLeaid: vi.fn() }),
}));

const district = {
  leaid: "3620580",
  addedAt: "2026-01-01T00:00:00Z",
  name: "Yonkers City School District",
  stateAbbrev: "NY",
  enrollment: 25000,
  owner: null,
  renewalTarget: 42000,
  winbackTarget: null,
  expansionTarget: null,
  newBusinessTarget: null,
  notes: null,
  returnServices: [],
  newServices: [],
  tags: [],
  actuals: undefined,
  opportunities: [],
  pacing: undefined,
};

const mockPlan: TerritoryPlanDetail = {
  id: "plan-1",
  name: "Westchester County",
  description: null,
  owner: null,
  color: "#403770",
  status: "working",
  fiscalYear: 2026,
  startDate: null,
  endDate: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  districtLeaids: ["3620580"],
  schoolNcesIds: [],
  totalEnrollment: 25000,
  stateCount: 1,
  states: [],
  collaborators: [],
  taskCount: 0,
  completedTaskCount: 0,
  renewalRollup: 0,
  expansionRollup: 0,
  winbackRollup: 0,
  newBusinessRollup: 42000,
  pipelineTotal: 0,
  districts: [district],
};

describe("PlanDistrictsTab", () => {
  it("renders short mobile header label 'Target' (the sm:hidden span)", () => {
    render(<PlanDistrictsTab plan={mockPlan} onClose={vi.fn()} />);
    // Both spans are in the DOM; JSDOM doesn't apply CSS, so both are present.
    // We just check the short version exists.
    expect(screen.getAllByText("Target").length).toBeGreaterThan(0);
  });
});
