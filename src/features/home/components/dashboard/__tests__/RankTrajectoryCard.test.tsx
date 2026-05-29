import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/home/lib/queries", () => ({ useRankTrajectory: vi.fn() }));

import RankTrajectoryCard from "../RankTrajectoryCard";
import { useRankTrajectory } from "@/features/home/lib/queries";

const mockHook = vi.mocked(useRankTrajectory);

const COLUMNS = ["Pre-FY", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const line = (ranks: number[]) => ({ ranks, values: ranks.map(() => 1000), inRoster: true });
const payload = {
  fy: 2026,
  schoolYr: "2025-26",
  columns: COLUMNS,
  todayIndex: 11,
  metrics: [
    { metricKey: "bookings", name: "Bookings", color: "#F37167", caller: line([8, 7, 6, 6, 5, 5, 4, 3, 3, 2, 2, 1, 1]), reps: [], segments: {} },
    { metricKey: "openPipeline", name: "Open pipeline", color: "#403770", caller: line([7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 3]), reps: [], segments: {} },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = (over: Record<string, unknown>) => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over } as any);

describe("RankTrajectoryCard", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders the chart and a legend row per metric, sorted best-rank first", () => {
    mockHook.mockReturnValue(result({ data: payload }));
    const { container } = render(<RankTrajectoryCard fy={2026} />);

    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("Rank trajectory")).toBeTruthy();
    // both metric names appear in the legend
    expect(screen.getAllByText("Bookings").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Open pipeline").length).toBeGreaterThanOrEqual(1);
  });

  it("renders an Expand control that opens the full-screen modal", () => {
    mockHook.mockReturnValue(result({ data: payload }));
    render(<RankTrajectoryCard fy={2026} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows a loading state while fetching", () => {
    mockHook.mockReturnValue(result({ isLoading: true }));
    const { container } = render(<RankTrajectoryCard fy={2026} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows an error state with retry", () => {
    const refetch = vi.fn();
    mockHook.mockReturnValue(result({ isError: true, refetch }));
    render(<RankTrajectoryCard fy={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
