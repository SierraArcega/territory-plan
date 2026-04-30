import { describe, it, expect } from "vitest";
import {
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  applyFilters,
  type LHFFilters,
} from "../filters";
import type { IncreaseTarget } from "../types";

const row = (overrides: Partial<IncreaseTarget> = {}): IncreaseTarget =>
  ({
    leaid: "000001",
    districtName: "Test",
    state: "CA",
    enrollment: null,
    lmsId: null,
    category: "missing_renewal",
    fy26Revenue: 200_000,
    fy26CompletedRevenue: 0,
    fy26ScheduledRevenue: 0,
    fy26SessionCount: null,
    fy26SubscriptionCount: null,
    fy26OppBookings: 0,
    fy26MinBookings: 0,
    priorYearRevenue: 0,
    priorYearVendor: null,
    priorYearFy: null,
    inFy27Plan: false,
    planIds: [],
    hasFy27Target: false,
    hasFy27Pipeline: false,
    fy27OpenPipeline: 0,
    inPlan: false,
    lastClosedWon: null,
    productTypes: ["Live Instruction"],
    subProducts: [],
    revenueTrend: { fy24: null, fy25: null, fy26: 200000, fy27: null },
    suggestedTarget: 210_000,
    ...overrides,
  }) as IncreaseTarget;

describe("filters", () => {
  it("DEFAULT_FILTERS is all-empty except hideWithFy27Target", () => {
    expect(DEFAULT_FILTERS.categories).toEqual([]);
    expect(DEFAULT_FILTERS.states).toEqual([]);
    expect(DEFAULT_FILTERS.products).toEqual([]);
    expect(DEFAULT_FILTERS.revenueBand).toBeNull();
    expect(DEFAULT_FILTERS.lastRep).toBe("anyone");
    // The compact ledger surfaces actionable rows by default — districts
    // already targeted in FY27 are hidden until the user opts back in.
    expect(DEFAULT_FILTERS.hideWithFy27Target).toBe(true);
  });

  it("round-trips via URLSearchParams", () => {
    const filters: LHFFilters = {
      categories: ["missing_renewal"],
      states: ["CA", "TX"],
      products: ["Live Instruction"],
      revenueBand: "250k-1m",
      lastRep: "open",
      hideWithFy27Target: true,
    };
    const params = filtersToSearchParams(filters);
    const restored = filtersFromSearchParams(params);
    expect(restored).toEqual(filters);
  });

  it("applyFilters keeps row when categories match", () => {
    const kept = applyFilters([row({ category: "missing_renewal" })], {
      ...DEFAULT_FILTERS,
      categories: ["missing_renewal"],
    });
    expect(kept).toHaveLength(1);
  });

  it("applyFilters drops row whose state is not selected", () => {
    const kept = applyFilters([row({ state: "CA" })], {
      ...DEFAULT_FILTERS,
      states: ["TX"],
    });
    expect(kept).toHaveLength(0);
  });

  it("applyFilters hides districts with hasFy27Target when the toggle is on", () => {
    const kept = applyFilters(
      [row({ hasFy27Target: true }), row({ leaid: "2", hasFy27Target: false })],
      { ...DEFAULT_FILTERS, hideWithFy27Target: true },
    );
    expect(kept.map((r) => r.leaid)).toEqual(["2"]);
  });

  it("applyFilters matches revenue band using category-appropriate signal", () => {
    const kept = applyFilters(
      [
        row({ category: "missing_renewal", fy26Revenue: 100_000 }),
        row({ leaid: "2", category: "fullmind_winback", fy26Revenue: 0, priorYearRevenue: 500_000 }),
      ],
      { ...DEFAULT_FILTERS, revenueBand: "250k-1m" },
    );
    expect(kept.map((r) => r.leaid)).toEqual(["2"]);
  });
});
