import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseTopline = vi.fn();
vi.mock("@/features/home/lib/queries", () => ({
  useTopline: (fy: number) => mockUseTopline(fy),
}));

// The Targets card owns its own query; stub it here so this test stays focused
// on the four financial cards (covered separately in TargetsCard.test).
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
          { metricKey: "openPipeline", label: "Open Pipeline", value: 480000, rank: 3, totalReps: 12, inRoster: true },
          { metricKey: "bookings", label: "Closed Won Bookings", value: 612000, rank: 1, totalReps: 12, inRoster: true },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<ToplineStatStrip fy={2026} />);

    expect(screen.getByText("Open Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Closed Won Bookings")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("shows an error fallback when the query errors", () => {
    mockUseTopline.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<ToplineStatStrip fy={2026} />);
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });

  it("shows four skeleton cards while loading", () => {
    mockUseTopline.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<ToplineStatStrip fy={2026} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });
});
