import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("@/features/home/lib/queries", () => ({ useDeals: vi.fn() }));

import DealDetailModal from "../DealDetailModal";
import { useDeals } from "@/features/home/lib/queries";

const mockUseDeals = vi.mocked(useDeals);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = (over: Record<string, unknown>) => ({ data: undefined, isLoading: false, isError: false, ...over } as any);

const pipelineRows = [
  { account: "Houston ISD", state: "TX", stageName: "Discovery", source: "new", committed: 100, maxBudget: 300, closeDate: null },
  { account: "Austin ISD", state: "TX", stageName: "Proposal", source: "return", committed: 50, maxBudget: 80, closeDate: null },
];

const utilRows = [
  { account: "Big ISD", source: "new", minCommit: 100, maxBudget: 200, revenue: 120, take: 36, deferred: 0, utilPct: 0.6, underMin: false },
  { account: "Small ISD", source: "return", minCommit: 80, maxBudget: 300, revenue: 40, take: 12, deferred: 40, utilPct: 40 / 300, underMin: true },
];

const targetRows = [
  { account: "Dallas ISD", state: "TX", segment: "new", targetDollars: 100, openPipe: 60, won: 40, pipeline: 100, converted: true, owners: ["Sierra Arcega"], lastActivity: "2026-06-01T00:00:00.000Z", nextActivity: "2026-06-12T00:00:00.000Z", active: true },
  { account: "Plano ISD", state: "TX", segment: null, targetDollars: 0, openPipe: 0, won: 0, pipeline: 0, converted: false, owners: [], lastActivity: null, nextActivity: null, active: false },
];

describe("DealDetailModal", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders nothing when no metric is set (closed)", () => {
    mockUseDeals.mockReturnValue(result({}));
    render(<DealDetailModal metric={null} fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a loading skeleton (not a hidden UI) while fetching", () => {
    mockUseDeals.mockReturnValue(result({ isLoading: true }));
    render(<DealDetailModal metric="pipeline" fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders a friendly per-metric empty state", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "rev", rows: [], totals: { count: 0 } } }));
    render(<DealDetailModal metric="rev" fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.getByText(/No contracted accounts to measure/i)).toBeInTheDocument();
  });

  it("renders the pipeline table, totals footer, and export action", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "pipeline", mode: "rep", rows: pipelineRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="pipeline" fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.getByText("Houston ISD")).toBeInTheDocument();
    expect(screen.getByText("Austin ISD")).toBeInTheDocument();
    // footer totals: committed 150, max budget 380
    expect(screen.getByText("$150")).toBeInTheDocument();
    expect(screen.getByText("$380")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeTruthy();
  });

  it("filters rows by source pill", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "pipeline", mode: "rep", rows: pipelineRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="pipeline" fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.getByText("Austin ISD")).toBeInTheDocument();
    // Filter to "New biz" → only Houston (source new) remains
    fireEvent.click(screen.getByRole("tab", { name: "New biz" }));
    expect(screen.getByText("Houston ISD")).toBeInTheDocument();
    expect(screen.queryByText("Austin ISD")).toBeNull();
  });

  it("filters utilization rows by the Under-min pill", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "rev", mode: "rep", rows: utilRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="rev" fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.getByText("Big ISD")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Under min" }));
    expect(screen.getByText("Small ISD")).toBeInTheDocument(); // underMin: true
    expect(screen.queryByText("Big ISD")).toBeNull(); // underMin: false
  });

  it("shows a blended utilization total in the footer (Σrev / Σmaxbudget)", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "rev", mode: "team", rows: utilRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="rev" fy={2026} repScope="team" onClose={vi.fn()} />);
    // blended util = (120+40) / (200+300) = 160/500 = 32%
    const footer = screen.getByRole("dialog");
    expect(within(footer).getByText("32%")).toBeInTheDocument();
  });

  it("renders the targets table with a worked-but-untargeted district", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "targets", mode: "rep", rows: targetRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="targets" fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Targets" })).toBeInTheDocument();
    expect(screen.getByText("Dallas ISD")).toBeInTheDocument();
    expect(screen.getByText("Plano ISD")).toBeInTheDocument();
    expect(screen.getByText("No target")).toBeInTheDocument(); // segment null label
  });

  it("shows the Targeted-by owner column only in team mode", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "targets", mode: "team", rows: targetRows, totals: { count: 2 } } }));
    const { unmount } = render(<DealDetailModal metric="targets" fy={2026} repScope="team" onClose={vi.fn()} />);
    expect(screen.getByText("Targeted by")).toBeInTheDocument();
    expect(screen.getByText("Sierra Arcega")).toBeInTheDocument();
    unmount();
    // rep mode → no owner column (redundant: every row is the same rep)
    mockUseDeals.mockReturnValue(result({ data: { metric: "targets", mode: "rep", rows: targetRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="targets" fy={2026} repScope="me" onClose={vi.fn()} />);
    expect(screen.queryByText("Targeted by")).toBeNull();
  });

  it("filters targets to converted districts via the Converted pill", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "targets", mode: "rep", rows: targetRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="targets" fy={2026} repScope="me" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Converted" }));
    expect(screen.getByText("Dallas ISD")).toBeInTheDocument(); // converted: true
    expect(screen.queryByText("Plano ISD")).toBeNull(); // converted: false
  });

  it("filters targets to untargeted districts via the No-targets pill", () => {
    mockUseDeals.mockReturnValue(result({ data: { metric: "targets", mode: "rep", rows: targetRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="targets" fy={2026} repScope="me" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "No targets" }));
    expect(screen.getByText("Plano ISD")).toBeInTheDocument(); // segment null
    expect(screen.queryByText("Dallas ISD")).toBeNull();
  });

  it("calls onClose from the Modal close button", () => {
    const onClose = vi.fn();
    mockUseDeals.mockReturnValue(result({ data: { metric: "pipeline", mode: "rep", rows: pipelineRows, totals: { count: 2 } } }));
    render(<DealDetailModal metric="pipeline" fy={2026} repScope="me" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
