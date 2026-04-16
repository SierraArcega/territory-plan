import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import RevenueTable from "../RevenueTable";
import type { RevenueTableTotals } from "../RevenueTable";
import type { LeaderboardEntry } from "../../lib/types";

const makeEntry = (overrides: Partial<LeaderboardEntry> & { fullName: string }): LeaderboardEntry => ({
  userId: crypto.randomUUID(),
  avatarUrl: null,
  totalPoints: 0,
  tier: "freshman",
  rank: 1,
  take: 0,
  pipeline: 0,
  pipelinePriorFY: 0,
  pipelineCurrentFY: 0,
  pipelineNextFY: 0,
  revenue: 0,
  priorYearRevenue: 0,
  revenueTargeted: 0,
  targetedPriorFY: 0,
  targetedCurrentFY: 0,
  targetedNextFY: 0,
  combinedScore: 0,
  initiativeScore: 0,
  pointBreakdown: [],
  ...overrides,
});

const entries = [
  makeEntry({ fullName: "Alice", revenue: 900000, priorYearRevenue: 1200000, pipeline: 500000, revenueTargeted: 300000, rank: 1 }),
  makeEntry({ fullName: "Bob", revenue: 700000, priorYearRevenue: 800000, pipeline: 300000, revenueTargeted: 200000, rank: 2 }),
  makeEntry({ fullName: "Carol", revenue: 500000, priorYearRevenue: 600000, pipeline: 100000, revenueTargeted: 100000, rank: 3 }),
];

describe("RevenueTable", () => {
  it("renders all entries with rank, name, and 4 money columns", () => {
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={vi.fn()} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();

    // Check column headers
    expect(screen.getByText("Current Revenue")).toBeInTheDocument();
    expect(screen.getByText("Prior Year Closed")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Targeted")).toBeInTheDocument();
  });

  it("calls onSort when clicking a column header", async () => {
    const onSort = vi.fn();
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={onSort} />);

    await userEvent.click(screen.getByText("Pipeline"));
    expect(onSort).toHaveBeenCalledWith("pipeline");
  });

  it("highlights the active sort column", () => {
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={vi.fn()} />);

    const header = screen.getByText("Current Revenue");
    expect(header.closest("th")).toHaveClass("text-[#5B2E91]");
  });

  it("formats currency values with commas", () => {
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={vi.fn()} />);

    expect(screen.getByText("$900,000")).toBeInTheDocument();
    expect(screen.getByText("$1,200,000")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Team totals footer (Tasks 5 + 6)
// ---------------------------------------------------------------------------

describe("RevenueTable team totals footer", () => {
  const baseEntry = makeEntry({
    fullName: "Alex Rep",
    totalPoints: 100,
    tier: "honor_roll",
    rank: 1,
    pipeline: 1_000_000,
    pipelineCurrentFY: 600_000,
    pipelineNextFY: 400_000,
    revenue: 5_000_000,
    priorYearRevenue: 3_000_000,
    revenueTargeted: 2_000_000,
    targetedCurrentFY: 1_200_000,
    targetedNextFY: 800_000,
    combinedScore: 80,
    initiativeScore: 80,
  });

  const baseTotals: RevenueTableTotals = {
    revenue: 50_000_000,
    priorYearRevenue: 40_000_000,
    pipeline: 10_000_000,
    revenueTargeted: 20_000_000,
    unassignedRevenue: 0,
    unassignedPriorYearRevenue: 0,
    unassignedPipeline: 0,
    unassignedRevenueTargeted: 0,
  };

  const noopSort = () => {};

  it("hides the footer when teamTotals prop is undefined", () => {
    const { container } = render(
      <RevenueTable
        entries={[baseEntry]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
      />
    );
    expect(container.querySelector("tfoot")).toBeNull();
  });

  it("hides the footer when entries is empty even if teamTotals is provided", () => {
    const { container } = render(
      <RevenueTable
        entries={[]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
        teamTotals={baseTotals}
      />
    );
    expect(container.querySelector("tfoot")).toBeNull();
  });

  it("renders a Team Total row with the provided per-column totals", () => {
    render(
      <RevenueTable
        entries={[baseEntry]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
        teamTotals={baseTotals}
      />
    );
    expect(screen.getByText(/Team Total/i)).toBeInTheDocument();
    // formatRevenue uses toLocaleString with no fraction digits
    expect(screen.getByText("$50,000,000")).toBeInTheDocument();
    expect(screen.getByText("$40,000,000")).toBeInTheDocument();
    expect(screen.getByText("$10,000,000")).toBeInTheDocument();
    expect(screen.getByText("$20,000,000")).toBeInTheDocument();
    expect(screen.queryByText(/unassigned/i)).toBeNull();
  });

  it("shows 'incl. $X unassigned' annotation only on columns where unassigned > 0", () => {
    render(
      <RevenueTable
        entries={[baseEntry]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
        teamTotals={{
          ...baseTotals,
          unassignedRevenue: 13_800_000,
          unassignedPipeline: 2_500_000,
          // priorYearRevenue + revenueTargeted intentionally unassigned=0
        }}
      />
    );
    const annotations = screen.getAllByText(/incl\. .* unassigned/i);
    expect(annotations).toHaveLength(2); // revenue + pipeline only
    expect(screen.getByText(/incl\. \$13,800,000 unassigned/i)).toBeInTheDocument();
    expect(screen.getByText(/incl\. \$2,500,000 unassigned/i)).toBeInTheDocument();
  });
});
