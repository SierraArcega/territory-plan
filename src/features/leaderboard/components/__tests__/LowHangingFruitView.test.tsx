import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LowHangingFruitView from "../LowHangingFruitView";

vi.mock("../../lib/queries", async () => {
  const actual = await vi.importActual<object>("../../lib/queries");
  return {
    ...actual,
    useLowHangingFruitList: () => ({
      data: {
        totalRevenueAtRisk: 1_000_000,
        districts: [
          {
            leaid: "1",
            districtName: "Pasadena USD",
            state: "CA",
            enrollment: 19234,
            lmsId: null,
            category: "missing_renewal",
            fy26Revenue: 320000,
            fy26CompletedRevenue: 0,
            fy26ScheduledRevenue: 0,
            fy26SessionCount: 412,
            fy26SubscriptionCount: null,
            fy26OppBookings: 41000,
            fy26MinBookings: 0,
            priorYearRevenue: 0,
            priorYearVendor: null,
            priorYearFy: null,
            inFy27Plan: false,
            planIds: [],
            hasFy27Target: false,
            fy27TargetAmount: 0,
            hasFy27Pipeline: false,
            fy27OpenPipeline: 0,
            inPlan: false,
            lastClosedWon: {
              repName: "Jordan Lee",
              repEmail: null,
              closeDate: "2025-04-12T00:00:00.000Z",
              schoolYr: "2024-25",
              amount: 220000,
            },
            productTypes: ["Tier 1"],
            subProducts: [],
            revenueTrend: { fy24: 280000, fy25: 305000, fy26: 320000, fy27: null },
            suggestedTarget: 335000,
          },
        ],
      },
      isLoading: false,
      isError: false,
    }),
    useMyPlans: () => ({ data: [], isLoading: false }),
  };
});

function renderView() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <LowHangingFruitView />
    </QueryClientProvider>,
  );
}

describe("LowHangingFruitView", () => {
  it("renders header, footer, and a row with category + actions", () => {
    renderView();

    // Header — note the spec sentence-cases the title
    const heading = screen.getByRole("heading", { name: /Low hanging fruit/i });
    expect(heading).toBeInTheDocument();
    // "Showing 1 of 1 districts" — split across <strong>/<span>, so match
    // against the header's full textContent.
    const headerText = heading.parentElement?.textContent ?? "";
    expect(headerText).toMatch(/Showing\s+1\s+of\s+1\s+districts/i);

    // Row data
    expect(screen.getByText("Pasadena USD")).toBeInTheDocument();
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getAllByText(/Missing renewal/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Jordan Lee")).toBeInTheDocument();

    // Action bar
    const oppLink = screen.getByRole("link", { name: /\+ Opp/i });
    expect(oppLink).toHaveAttribute(
      "href",
      "https://lms.fullmindlearning.com/opportunities/kanban?_sort=close_date&_dir=asc&school_year=2026-27",
    );
    expect(oppLink).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: /Plan/i })).toBeInTheDocument();
  });

  it("offers an Export CSV action", () => {
    renderView();
    expect(screen.getByRole("button", { name: /Export CSV/i })).toBeInTheDocument();
  });
});
