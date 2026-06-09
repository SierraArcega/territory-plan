import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseTopline = vi.fn();
vi.mock("@/features/home/lib/queries", () => ({
  useTopline: (fy: number, repScope: string) => mockUseTopline(fy, repScope),
  useSparklines: () => ({ data: undefined }),
  // The drill-in modal is always mounted (closed → metric null); stub its query.
  useDeals: () => ({ data: undefined, isLoading: false, isError: false }),
}));

// The Targets card owns its own query; stub it here so this test stays focused
// on the financial cards (covered separately in TargetsCard.test).
vi.mock("@/features/home/components/dashboard/TargetsCard", () => ({
  default: () => <div data-testid="targets-card" />,
}));

import ToplineStatStrip from "../ToplineStatStrip";

describe("ToplineStatStrip", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders a card per metric with the rank-vs-team line", () => {
    mockUseTopline.mockReturnValue({
      data: {
        fy: 2026,
        schoolYr: "2025-26",
        cards: [
          { metricKey: "openPipeline", label: "Open Pipeline", value: 480000, rank: 3, totalReps: 12, inRoster: true, segments: [{ key: "return", label: "Return", value: 280000 }] },
          { metricKey: "bookings", label: "Closed Won Bookings", value: 612000, rank: 1, totalReps: 12, inRoster: true, segments: [] },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<ToplineStatStrip fy={2026} repScope="me" />);

    expect(screen.getByText("Open Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Closed Won Bookings")).toBeInTheDocument();
    expect(screen.getByText("#3/12")).toBeInTheDocument();
  });

  it("renders the merged Sched + Delivered card from the revenue + take cards", () => {
    mockUseTopline.mockReturnValue({
      data: {
        fy: 2026, schoolYr: "2025-26",
        cards: [
          { metricKey: "openPipeline", label: "Open Pipeline", value: 480000, rank: 3, totalReps: 12, inRoster: true, segments: [] },
          { metricKey: "bookings", label: "Closed Won Bookings", value: 612000, rank: 1, totalReps: 12, inRoster: true, segments: [], bookingsDetail: { minCommit: 650000, maxBudget: 1100000, oppCount: 8, accountCount: 6 } },
          { metricKey: "revenue", label: "Sched + Delivered Rev.", value: 748000, rank: 2, totalReps: 12, inRoster: true, segments: [{ key: "return", label: "Return", value: 601000 }] },
          { metricKey: "take", label: "Sched + Delivered Take", value: 224000, rank: 4, totalReps: 12, inRoster: true, segments: [{ key: "return", label: "Return", value: 180000 }] },
        ],
      },
      isLoading: false, isError: false,
    });
    render(<ToplineStatStrip fy={2026} repScope="me" />);
    expect(screen.getByText("Sched + Delivered")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument(); // util = 748 / 1100 from bookingsDetail
    expect(screen.getByText("$748K")).toBeInTheDocument();
    expect(screen.getByText(/\$224K · 30%/)).toBeInTheDocument();
    // The two standalone labels are gone — merged into one card.
    expect(screen.queryByText("Sched + Delivered Rev.")).not.toBeInTheDocument();
    expect(screen.queryByText("Sched + Delivered Take")).not.toBeInTheDocument();
  });

  it("shows an error fallback when the query errors", () => {
    mockUseTopline.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<ToplineStatStrip fy={2026} repScope="me" />);
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });

  it("shows three skeleton cards while loading", () => {
    mockUseTopline.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<ToplineStatStrip fy={2026} repScope="me" />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });
});
