import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DistrictDetailContent from "../DistrictDetailContent";

// District detail data — the panel's only network dependency.
vi.mock("@/features/views/lib/queries", () => ({
  useEntity: () => ({
    data: {
      district: {
        leaid: "0601234",
        name: "Tedesco USD",
        stateAbbrev: "CA",
        enrollment: 1000,
        numberOfSchools: 3,
      },
      fullmindData: null,
      contacts: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

// Current plan context lives in the map store; the panel reads viewsPlanId.
vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (sel: (s: { viewsPlanId: string | null }) => unknown) =>
    sel({ viewsPlanId: "plan-7" }),
}));

// Stub the heavy home modal — assert only the wiring contract.
vi.mock("@/features/activities/components/ActivityFormModal", () => ({
  default: ({
    isOpen,
    defaultPlanId,
    defaultDistricts,
  }: {
    isOpen: boolean;
    defaultPlanId?: string;
    defaultDistricts?: { leaid: string; name: string }[];
  }) =>
    isOpen ? (
      <div data-testid="activity-modal" data-plan-id={defaultPlanId ?? ""}>
        {(defaultDistricts ?? []).map((d) => (
          <span key={d.leaid}>{d.name}</span>
        ))}
      </div>
    ) : null,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("DistrictDetailContent", () => {
  it("opens the home activity modal preselected with the district and current plan", async () => {
    render(<DistrictDetailContent id="0601234" onClose={() => {}} />, { wrapper });
    expect(screen.queryByTestId("activity-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /log activity/i }));

    const modal = await screen.findByTestId("activity-modal");
    expect(modal).toHaveAttribute("data-plan-id", "plan-7");
    expect(within(modal).getByText(/tedesco usd/i)).toBeInTheDocument();
  });
});
