import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
            fy27TargetReps: [],
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

describe("LowHangingFruitView — summary banner collapse", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows the banner and a hide button by default", () => {
    renderView();
    expect(screen.getByLabelText("Hide instructions")).toBeInTheDocument();
    expect(screen.getByText(/How to action them/i)).toBeInTheDocument();
  });

  it("collapses the banner when hide button is clicked", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide instructions"));
    expect(screen.queryByText(/How to action them/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show instructions")).toBeInTheDocument();
  });

  it("re-expands the banner when the collapsed row is clicked", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide instructions"));
    fireEvent.click(screen.getByLabelText("Show instructions"));
    expect(screen.getByText(/How to action them/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Hide instructions")).toBeInTheDocument();
  });

  it("starts collapsed when sessionStorage flag is pre-set", () => {
    sessionStorage.setItem("lhf-banner-collapsed", "true");
    renderView();
    expect(screen.queryByText(/How to action them/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show instructions")).toBeInTheDocument();
  });

  it("persists collapsed state to sessionStorage", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide instructions"));
    expect(sessionStorage.getItem("lhf-banner-collapsed")).toBe("true");
  });

  it("persists expanded state to sessionStorage when re-expanded", () => {
    sessionStorage.setItem("lhf-banner-collapsed", "true");
    renderView();
    fireEvent.click(screen.getByLabelText("Show instructions"));
    expect(sessionStorage.getItem("lhf-banner-collapsed")).toBe("false");
  });
});

describe("LowHangingFruitView — filter bar collapse", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows the filter bar and a hide button by default", () => {
    renderView();
    expect(screen.getByLabelText("Hide filters")).toBeInTheDocument();
    // State dropdown only renders when the filter bar is expanded
    expect(screen.getByRole("button", { name: /^State/i })).toBeInTheDocument();
  });

  it("collapses the filter bar when hide button is clicked", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide filters"));
    expect(screen.queryByRole("button", { name: /^State/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show filters")).toBeInTheDocument();
  });

  it("re-expands the filter bar when the collapsed row is clicked", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide filters"));
    fireEvent.click(screen.getByLabelText("Show filters"));
    expect(screen.getByRole("button", { name: /^State/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Hide filters")).toBeInTheDocument();
  });

  it("starts collapsed when sessionStorage flag is pre-set", () => {
    sessionStorage.setItem("lhf-filters-collapsed", "true");
    renderView();
    expect(screen.queryByRole("button", { name: /^State/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show filters")).toBeInTheDocument();
  });

  it("persists collapsed state to sessionStorage", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide filters"));
    expect(sessionStorage.getItem("lhf-filters-collapsed")).toBe("true");
  });

  it("persists expanded state to sessionStorage when re-expanded", () => {
    sessionStorage.setItem("lhf-filters-collapsed", "true");
    renderView();
    fireEvent.click(screen.getByLabelText("Show filters"));
    expect(sessionStorage.getItem("lhf-filters-collapsed")).toBe("false");
  });

  it("shows no badge when no filters are active and collapsed", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide filters"));
    const collapsed = screen.getByLabelText("Show filters");
    expect(collapsed.querySelector(".rounded-full")).toBeNull();
  });
});
