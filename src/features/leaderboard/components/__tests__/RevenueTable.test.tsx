import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import RevenueTable from "../RevenueTable";
import type { LeaderboardEntry } from "../../lib/types";

const makeEntry = (overrides: Partial<LeaderboardEntry> & { fullName: string }): LeaderboardEntry => ({
  userId: crypto.randomUUID(),
  avatarUrl: null,
  totalPoints: 0,
  tier: "freshman",
  rank: 1,
  take: 0,
  pipeline: 0,
  pipelineCurrentFY: 0,
  pipelineNextFY: 0,
  revenue: 0,
  priorYearRevenue: 0,
  revenueTargeted: 0,
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
