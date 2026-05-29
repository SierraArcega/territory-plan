import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseTargets = vi.fn();
vi.mock("@/features/home/lib/queries", () => ({
  useTargets: (fy: number) => mockUseTargets(fy),
}));

import TargetsCard from "../TargetsCard";

describe("TargetsCard", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders the worked-district count, segment legend, and sub-counts", () => {
    mockUseTargets.mockReturnValue({
      data: {
        fy: 2026,
        schoolYr: "2025-26",
        card: {
          metricKey: "targets",
          label: "Targets",
          value: 287,
          rank: 3,
          totalReps: 12,
          inRoster: true,
          segments: { new: 142, winback: 89, expansion: 56 },
          untargeted: 12,
          convertedToPipeline: 84,
          active90: 187,
          stale: 100,
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<TargetsCard fy={2026} />);

    expect(screen.getByText("districts being worked")).toBeInTheDocument();
    // segment counts (each unique)
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(screen.getByText("89")).toBeInTheDocument();
    expect(screen.getByText("56")).toBeInTheDocument();
    // sub-rows
    expect(screen.getByText("Converted to pipeline")).toBeInTheDocument();
    expect(screen.getByText("Active · 90d")).toBeInTheDocument();
    expect(screen.getByText("No targets set")).toBeInTheDocument();
    expect(screen.getByText(/100 stale/)).toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    mockUseTargets.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<TargetsCard fy={2026} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});
