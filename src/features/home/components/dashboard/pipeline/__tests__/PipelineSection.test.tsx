import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/home/lib/queries", () => ({ usePipeline: vi.fn() }));
vi.mock("@/features/leaderboard/lib/queries", () => ({
  useLowHangingFruitList: () => ({ data: { districts: [], totalRevenueAtRisk: 0 }, isLoading: false, isError: false }),
}));

import PipelineSection from "../PipelineSection";
import { usePipeline } from "@/features/home/lib/queries";

const mockHook = vi.mocked(usePipeline);

const STAGES = ["Meeting Booked", "Discovery", "Presentation", "Proposal", "Negotiation", "Commitment"];
const byStage = STAGES.map((name, i) => ({ prefix: i, name, min: i === 4 ? 80 : 0, max: i === 4 ? 200 : 0 }));
const funnel = {
  stages: STAGES.map((name, i) => ({ prefix: i, name, count: i === 4 ? 2 : 0, min: i === 4 ? 80 : 0, max: i === 4 ? 200 : 0, teamMin: i === 4 ? 80 : 0, sharePct: i === 4 ? 100 : 0 })),
  sources: [
    { key: "return", label: "Return", color: "#403770", you: 80, team: 80, pct: 100 },
    { key: "new", label: "New biz", color: "#F37167", you: 0, team: 0, pct: 0 },
    { key: "winback", label: "Win-back", color: "#6EA3BE", you: 0, team: 0, pct: 0 },
    { key: "expansion", label: "Expansion", color: "#FFCF70", you: 0, team: 0, pct: 0 },
  ],
  openCount: 2, totalMin: 80, totalMax: 200, spread: 120, teamMinTotal: 80, overallSharePct: 100, rank: 2, totalReps: 2,
  targets: { count: 0, value: 0, teamValue: 0, sharePct: 0 },
  won: { prefix: 6, name: "Closed Won", count: 0, min: 0, max: 0, teamMin: 0, sharePct: 0 },
};
const twCol = (count: number) => ({
  count,
  total: count * 1000,
  totalMin: count * 500,
  totalMax: count * 2000,
  deals: Array.from({ length: count }, (_, i) => ({ account: `D${i}`, value: 1000, min: 500, max: 2000, motion: "Return", product: "Tutoring", stage: "Discovery" })),
  prevCount: 0,
  prevTotal: 0,
});
const oppView = (p: Record<string, unknown>) => ({
  account: "Acct", state: "NY", source: "return", stageName: "Negotiation", stagePrefix: 4,
  netBooking: 100, minPurchase: 80, maxBudget: 200, weighted: 75, closeDate: null, daysInStage: 40, tier: "on", overdue: false, ...p,
});
const data = {
  fy: 2026, schoolYr: "2025-26", inRoster: true,
  coverage: { minCommit: 90, maxBudget: 260, openCount: 2, weightedPipeline: 77, gap: 400, coverageMin: 0.225, coverageMax: 0.65, byStage, wonBookings: 600, fyTarget: 1000 },
  funnel,
  opps: [oppView({ account: "Brookfield CSD", tier: "on" }), oppView({ account: "Riverside USD", tier: "stale" })],
  atRisk: [oppView({ account: "Riverside USD", tier: "stale" })],
  thisWeek: { won: twCol(2), lost: twCol(1), created: twCol(3) },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = (over: Record<string, unknown>) => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over } as any);

describe("PipelineSection", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders the coverage and stage-funnel cards from the payload", () => {
    mockHook.mockReturnValue(result({ data }));
    render(<PipelineSection fy={2026} />);
    expect(screen.getByText("Stage funnel")).toBeTruthy();
    expect(screen.getByText("Top open opportunities")).toBeTruthy();
    expect(screen.getByText("Top targets not in pipeline")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("At risk")).toBeTruthy();
    expect(screen.getByText("Brookfield CSD")).toBeTruthy();
    expect(screen.getAllByText("Riverside USD").length).toBeGreaterThanOrEqual(1); // table + at-risk
  });

  it("shows a not-ranked state for a caller outside the rep roster", () => {
    mockHook.mockReturnValue(result({ data: { ...data, inRoster: false } }));
    render(<PipelineSection fy={2026} />);
    expect(screen.getByText(/not a ranked sales rep/i)).toBeTruthy();
    expect(screen.queryByText("Coverage")).toBeNull();
  });

  it("hides the This Week card for a non-current fiscal year (thisWeek null)", () => {
    mockHook.mockReturnValue(result({ data: { ...data, thisWeek: null } }));
    render(<PipelineSection fy={2024} />);
    expect(screen.queryByText("This week")).toBeNull();
    expect(screen.getByText("Stage funnel")).toBeTruthy(); // rest still renders
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
