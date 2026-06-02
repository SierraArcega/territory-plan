import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/home/lib/queries", () => ({ usePipeline: vi.fn() }));

import PipelineSection from "../PipelineSection";
import { usePipeline } from "@/features/home/lib/queries";

const mockHook = vi.mocked(usePipeline);

const STAGES = ["Meeting Booked", "Discovery", "Presentation", "Proposal", "Negotiation", "Commitment"];
const byStage = STAGES.map((name, i) => ({ prefix: i, name, min: i === 4 ? 80 : 0, max: i === 4 ? 200 : 0 }));
const stageHealth = STAGES.map((name, i) => ({
  prefix: i, name, weight: 0.5, count: i === 4 ? 2 : 0, atStake: i === 4 ? 150 : 0,
  weighted: i === 4 ? 112.5 : 0, avgAge: i === 4 ? 25 : 0, stalled: i === 4 ? 1 : 0, rank: 2, totalReps: 2,
}));
const data = {
  fy: 2026, schoolYr: "2025-26",
  coverage: { minCommit: 90, maxBudget: 260, openCount: 2, weightedPipeline: 77, gap: 400, coverageMin: 0.225, coverageMax: 0.65, byStage, wonBookings: 600, fyTarget: 1000 },
  stageHealth, opps: [], atRisk: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = (over: Record<string, unknown>) => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over } as any);

describe("PipelineSection", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders the coverage and stage-health cards from the payload", () => {
    mockHook.mockReturnValue(result({ data }));
    render(<PipelineSection fy={2026} />);
    expect(screen.getByText("Coverage")).toBeTruthy();
    expect(screen.getByText("Stage health")).toBeTruthy();
    expect(screen.getAllByText("Negotiation").length).toBeGreaterThanOrEqual(1);
  });

  it("shows skeletons while loading", () => {
    mockHook.mockReturnValue(result({ isLoading: true }));
    const { container } = render(<PipelineSection fy={2026} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error state with retry", () => {
    const refetch = vi.fn();
    mockHook.mockReturnValue(result({ isError: true, refetch }));
    render(<PipelineSection fy={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
