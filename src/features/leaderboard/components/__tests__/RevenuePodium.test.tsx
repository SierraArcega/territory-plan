import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RevenuePodium from "../RevenuePodium";
import type { LeaderboardEntry } from "../../lib/types";

const makeEntry = (overrides: Partial<LeaderboardEntry> & { fullName: string; revenue: number }): LeaderboardEntry => ({
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

describe("RevenuePodium", () => {
  it("renders top 3 entries in 2-1-3 visual order", () => {
    const entries = [
      makeEntry({ fullName: "Alice", revenue: 900000, rank: 1 }),
      makeEntry({ fullName: "Bob", revenue: 700000, rank: 2 }),
      makeEntry({ fullName: "Carol", revenue: 500000, rank: 3 }),
    ];

    render(<RevenuePodium entries={entries} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();

    // Rank labels
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders currency values", () => {
    const entries = [
      makeEntry({ fullName: "Alice", revenue: 961964, rank: 1 }),
      makeEntry({ fullName: "Bob", revenue: 795726, rank: 2 }),
      makeEntry({ fullName: "Carol", revenue: 578543, rank: 3 }),
    ];

    render(<RevenuePodium entries={entries} />);

    expect(screen.getByText("$961,964")).toBeInTheDocument();
    expect(screen.getByText("$795,726")).toBeInTheDocument();
    expect(screen.getByText("$578,543")).toBeInTheDocument();
  });

  it("renders nothing when fewer than 3 entries", () => {
    const entries = [
      makeEntry({ fullName: "Alice", revenue: 900000, rank: 1 }),
    ];

    const { container } = render(<RevenuePodium entries={entries} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows initials when no avatar", () => {
    const entries = [
      makeEntry({ fullName: "Monica Sherwood", revenue: 900000, rank: 1 }),
      makeEntry({ fullName: "Mike O'Donnell", revenue: 700000, rank: 2 }),
      makeEntry({ fullName: "Kris Tedesco", revenue: 500000, rank: 3 }),
    ];

    render(<RevenuePodium entries={entries} />);

    expect(screen.getByText("MS")).toBeInTheDocument();
    expect(screen.getByText("MO")).toBeInTheDocument();
    expect(screen.getByText("KT")).toBeInTheDocument();
  });
});
