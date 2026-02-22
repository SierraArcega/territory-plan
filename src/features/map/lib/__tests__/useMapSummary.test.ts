import { describe, it, expect } from "vitest";
import type { SummaryTotals } from "../useMapSummary";

// Test the pure aggregation logic without React hooks
// Extract the engagement mapping and sum logic for unit testing

const ENGAGEMENT_TO_CATEGORIES: Record<string, string[]> = {
  target: ["target"],
  pipeline: ["new_pipeline", "renewal_pipeline", "expansion_pipeline"],
  first_year: ["new"],
  multi_year: ["multi_year"],
  lapsed: ["lapsed"],
};

const EMPTY_TOTALS: SummaryTotals = {
  count: 0,
  totalEnrollment: 0,
  sessionsRevenue: 0,
  netInvoicing: 0,
  closedWonBookings: 0,
  openPipeline: 0,
  weightedPipeline: 0,
};

function sumCategories(
  byCategory: Record<string, SummaryTotals>,
  allowedCategories: Set<string>
): SummaryTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const [cat, data] of Object.entries(byCategory)) {
    if (allowedCategories.has(cat)) {
      totals.count += data.count;
      totals.totalEnrollment += data.totalEnrollment;
      totals.sessionsRevenue += data.sessionsRevenue;
      totals.netInvoicing += data.netInvoicing;
      totals.closedWonBookings += data.closedWonBookings;
      totals.openPipeline += data.openPipeline;
      totals.weightedPipeline += data.weightedPipeline;
    }
  }
  return totals;
}

const mockByCategory: Record<string, SummaryTotals> = {
  target: { count: 100, totalEnrollment: 400000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 0, weightedPipeline: 0 },
  new_pipeline: { count: 50, totalEnrollment: 200000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 3000000, weightedPipeline: 1500000 },
  renewal_pipeline: { count: 30, totalEnrollment: 120000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 1500000, weightedPipeline: 750000 },
  expansion_pipeline: { count: 20, totalEnrollment: 80000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 700000, weightedPipeline: 350000 },
  new: { count: 40, totalEnrollment: 160000, sessionsRevenue: 2000000, netInvoicing: 1500000, closedWonBookings: 1000000, openPipeline: 0, weightedPipeline: 0 },
  multi_year: { count: 60, totalEnrollment: 240000, sessionsRevenue: 5000000, netInvoicing: 3500000, closedWonBookings: 2500000, openPipeline: 0, weightedPipeline: 0 },
  lapsed: { count: 25, totalEnrollment: 100000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 0, weightedPipeline: 0 },
};

describe("useMapSummary aggregation logic", () => {
  it("engagement 'pipeline' maps to new_pipeline + renewal_pipeline + expansion_pipeline", () => {
    const allowed = new Set<string>();
    for (const c of ENGAGEMENT_TO_CATEGORIES["pipeline"]) allowed.add(c);

    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(50 + 30 + 20); // 100
    expect(result.openPipeline).toBe(3000000 + 1500000 + 700000); // 5200000
  });

  it("engagement 'multi_year' maps to multi_year category", () => {
    const allowed = new Set(ENGAGEMENT_TO_CATEGORIES["multi_year"]);
    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(60);
    expect(result.sessionsRevenue).toBe(5000000);
  });

  it("multiple engagement filters combine additively", () => {
    const allowed = new Set<string>();
    for (const c of ENGAGEMENT_TO_CATEGORIES["target"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["pipeline"]) allowed.add(c);

    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(100 + 50 + 30 + 20); // 200
  });

  it("empty allowed set returns zero totals", () => {
    const result = sumCategories(mockByCategory, new Set());
    expect(result.count).toBe(0);
    expect(result.sessionsRevenue).toBe(0);
  });

  it("engagement 'first_year' maps to 'new' category", () => {
    const allowed = new Set(ENGAGEMENT_TO_CATEGORIES["first_year"]);
    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(40);
    expect(result.netInvoicing).toBe(1500000);
  });
});
