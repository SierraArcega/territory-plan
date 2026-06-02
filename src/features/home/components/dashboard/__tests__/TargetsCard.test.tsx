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
          targetTotal: 5000000,
          pipelineOnAccounts: 1400000,
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

  it("renders the targeted-vs-pipeline bar with target $, pipeline $, and coverage %", () => {
    mockUseTargets.mockReturnValue({
      data: {
        fy: 2026,
        schoolYr: "2025-26",
        card: {
          metricKey: "targets", label: "Targets", value: 60, rank: 1, totalReps: 12, inRoster: true,
          segments: { new: 30, winback: 10, expansion: 5 }, untargeted: 15,
          convertedToPipeline: 7, active90: 40, stale: 20,
          targetTotal: 5000000, pipelineOnAccounts: 1400000,
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<TargetsCard fy={2026} />);
    expect(screen.getByText("Targeted vs pipeline")).toBeInTheDocument();
    expect(screen.getByText("$5M")).toBeInTheDocument(); // targetTotal
    expect(screen.getByText("$1.4M")).toBeInTheDocument(); // pipelineOnAccounts
    expect(screen.getByText(/28% covered/)).toBeInTheDocument(); // 1.4M / 5M
  });

  it("hides the targeted-vs-pipeline bar when no target $ is set", () => {
    mockUseTargets.mockReturnValue({
      data: {
        fy: 2026,
        schoolYr: "2025-26",
        card: {
          metricKey: "targets", label: "Targets", value: 5, rank: 8, totalReps: 12, inRoster: true,
          segments: { new: 0, winback: 0, expansion: 0 }, untargeted: 5,
          convertedToPipeline: 0, active90: 0, stale: 5,
          targetTotal: 0, pipelineOnAccounts: 0,
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<TargetsCard fy={2026} />);
    expect(screen.queryByText("Targeted vs pipeline")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    mockUseTargets.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<TargetsCard fy={2026} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});
