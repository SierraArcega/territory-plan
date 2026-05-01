import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DistrictExploreModal from "../DistrictExploreModal";
import * as libApi from "@/lib/api";

const mockViewPlan = vi.fn();
const mockOnClose = vi.fn();

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: Object.assign(
    vi.fn((selector: (s: any) => any) =>
      selector({ exploreModalVacancyId: null, viewPlan: mockViewPlan })
    ),
    { getState: () => ({ exploreModalVacancyId: null }) }
  ),
}));

// All tests in this file render against a fully-loaded district + plan (not a loading skeleton)
vi.mock("@/features/districts/lib/queries", () => ({
  useDistrictDetail: () => ({
    data: {
      leaid: "1234567",
      name: "Test District",
      territoryPlanIds: ["plan-1"],
      state: "LA",
      pipeline: {},
      activities: [],
    },
    isLoading: false,
  }),
}));

vi.mock("@/lib/api", () => ({
  useTerritoryPlans: vi.fn(),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivities: () => ({ data: null }),
}));

beforeEach(() => {
  vi.mocked(libApi.useTerritoryPlans).mockReturnValue({
    data: [
      {
        id: "plan-1",
        name: "Kleist Renewal",
        color: "#7C3AED",
        status: "working",
        owner: { id: "user-1", fullName: "Sierra Arcega", avatarUrl: null },
        description: null,
        fiscalYear: 2026,
      },
    ],
  } as any);
  mockViewPlan.mockReset();
  mockOnClose.mockReset();
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DistrictExploreModal — responsive sizing", () => {
  it("modal panel uses responsive width (70vw + max-w) instead of fixed w-[1076px]", () => {
    const { container } = renderWithClient(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    // Old fixed class must be gone
    expect(container.querySelector(".w-\\[1076px\\]")).toBeNull();
    // New responsive classes must be present
    expect(container.querySelector(".max-w-\\[1076px\\]")).not.toBeNull();
    // Verify the 70vw width class is present
    const modalPanel = container.querySelector(".max-w-\\[1076px\\]");
    expect(modalPanel?.className).toContain("w-[70vw]");
  });

  it("modal panel uses responsive height (70vh + max-h) instead of fixed h-[745px]", () => {
    const { container } = renderWithClient(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    // Old fixed class must be gone
    expect(container.querySelector(".h-\\[745px\\]")).toBeNull();
    // New responsive classes must be present
    expect(container.querySelector(".max-h-\\[745px\\]")).not.toBeNull();
    // Verify the 70vh height class is present
    const modalPanel = container.querySelector(".max-h-\\[745px\\]");
    expect(modalPanel?.className).toContain("h-[70vh]");
  });
});

describe("DistrictExploreModal — plan membership owner", () => {
  it("shows plan owner name after a dot separator when owner exists", () => {
    const { container } = renderWithClient(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    expect(container.textContent).toContain("· Sierra Arcega");
  });

  it("does not render a dot separator when owner is null", () => {
    vi.mocked(libApi.useTerritoryPlans).mockReturnValueOnce({
      data: [
        {
          id: "plan-1",
          name: "Kleist Renewal",
          color: "#7C3AED",
          status: "working",
          owner: null,
          description: null,
          fiscalYear: 2026,
        },
      ],
    } as any);
    const { container } = renderWithClient(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    expect(container.textContent).not.toContain("·");
  });
});

describe("DistrictExploreModal — plan membership navigation", () => {
  it("calls onClose and viewPlan with the plan id when a plan row is clicked", () => {
    const { container } = renderWithClient(
      <DistrictExploreModal leaid="1234567" onClose={mockOnClose} />
    );
    const planButton = container.querySelector("button[data-plan-id='plan-1']");
    expect(planButton).not.toBeNull();
    fireEvent.click(planButton!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockViewPlan).toHaveBeenCalledWith("plan-1");
  });
});
