import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock the API hooks
vi.mock("@/lib/api", () => ({
  useCreateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTerritoryPlans: vi.fn(() => ({
    data: [
      { id: "plan-1", name: "Colorado Plan", color: "#403770" },
      { id: "plan-2", name: "Denver Metro Plan", color: "#F37167" },
    ],
  })),
  useStates: vi.fn(() => ({
    data: [
      { fips: "06", name: "California", abbrev: "CA" },
      { fips: "08", name: "Colorado", abbrev: "CO" },
    ],
  })),
  useUsers: vi.fn(() => ({ data: [] })),
  useProfile: vi.fn(() => ({ data: { id: "user-1" } })),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivity: vi.fn(() => ({ data: null, isLoading: false })),
}));

import { useActivity } from "@/features/activities/lib/queries";
import { useUpdateActivity } from "@/lib/api";
const mockUseActivity = vi.mocked(useActivity);
const mockUseUpdateActivity = vi.mocked(useUpdateActivity);

import ActivityFormModal from "../ActivityFormModal";
import type { ActivityListItem } from "@/features/shared/types/api-types";

const editingActivity: ActivityListItem = {
  id: "act-1",
  type: "call",
  category: "outreach",
  title: "Test Call",
  startDate: "2026-03-14T10:00:00Z",
  endDate: null,
  status: "planned",
  source: "manual",
  outcomeType: null,
  assignedToUserId: "user-1",
  needsPlanAssociation: false,
  hasUnlinkedDistricts: false,
  planCount: 1,
  districtCount: 0,
  stateAbbrevs: ["CO"],
};

const fullActivity = {
  id: "act-1",
  type: "call",
  category: "outreach",
  title: "Test Call",
  notes: "Existing notes",
  startDate: "2026-03-14T10:00:00Z",
  endDate: null,
  status: "planned",
  source: "manual",
  outcome: null,
  outcomeType: null,
  createdByUserId: "user-1",
  assignedToUserId: "user-1",
  createdAt: "2026-03-14T00:00:00Z",
  updatedAt: "2026-03-14T00:00:00Z",
  googleEventId: null,
  needsPlanAssociation: false,
  hasUnlinkedDistricts: false,
  plans: [{ planId: "plan-1", planName: "Colorado Plan", planColor: "#403770" }],
  districts: [],
  contacts: [],
  states: [
    { fips: "08", abbrev: "CO", name: "Colorado", isExplicit: true },
    { fips: "06", abbrev: "CA", name: "California", isExplicit: false },
  ],
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("ActivityFormModal — edit mode", () => {
  beforeEach(() => {
    mockUseActivity.mockReturnValue({ data: null, isLoading: true } as ReturnType<typeof useActivity>);
  });

  it("renders the Plans picker in edit mode", () => {
    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("Link to Plans")).toBeInTheDocument();
  });

  it("renders the States picker in edit mode", () => {
    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("States")).toBeInTheDocument();
  });

  it("disables Save Changes button while full activity is loading", () => {
    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("pre-populates plans and explicit states from full activity fetch", async () => {
    mockUseActivity.mockReturnValue({ data: fullActivity, isLoading: false } as ReturnType<typeof useActivity>);

    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      const coloradoPlanCheckbox = screen.getByRole("checkbox", { name: /colorado plan/i });
      expect(coloradoPlanCheckbox).toBeChecked();
    });

    const coloradoStateCheckbox = screen.getByRole("checkbox", { name: /colorado \(co\)/i });
    expect(coloradoStateCheckbox).toBeChecked();

    // CA was isExplicit: false — should NOT be checked
    const californiaStateCheckbox = screen.getByRole("checkbox", { name: /california \(ca\)/i });
    expect(californiaStateCheckbox).not.toBeChecked();
  });

  it("sends planIds and stateFips in the update call", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    mockUseUpdateActivity.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false } as ReturnType<typeof useUpdateActivity>);
    mockUseActivity.mockReturnValue({ data: fullActivity, isLoading: false } as ReturnType<typeof useActivity>);

    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: "act-1",
          planIds: ["plan-1"],
          stateFips: ["08"],
        })
      );
    });
  });
});
