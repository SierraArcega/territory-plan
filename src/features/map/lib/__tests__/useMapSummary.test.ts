import { describe, it, expect } from "vitest";
import type { SummaryTotals } from "../useMapSummary";

// Test the pure aggregation logic without React hooks
// Extract the engagement mapping and sum logic for unit testing

const ENGAGEMENT_TO_CATEGORIES: Record<string, string[]> = {
  target: ["target"],
  renewal_pipeline: ["renewal_pipeline"],
  expansion_pipeline: ["expansion_pipeline"],
  new_business_pipeline: ["new_business_pipeline"],
  winback_pipeline: ["winback_pipeline"],
  first_year: ["new"],
  multi_year_growing: ["multi_year_growing"],
  multi_year_flat: ["multi_year_flat"],
  multi_year_shrinking: ["multi_year_shrinking"],
  lapsed: ["lapsed"],
};

const EMPTY_TOTALS: SummaryTotals = {
  count: 0,
  totalEnrollment: 0,
  openPipeline: 0,
  closedWonBookings: 0,
  invoicing: 0,
  scheduledRevenue: 0,
  deliveredRevenue: 0,
  deferredRevenue: 0,
  totalRevenue: 0,
  deliveredTake: 0,
  scheduledTake: 0,
  allTake: 0,
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
      totals.openPipeline += data.openPipeline;
      totals.closedWonBookings += data.closedWonBookings;
      totals.invoicing += data.invoicing;
      totals.scheduledRevenue += data.scheduledRevenue;
      totals.deliveredRevenue += data.deliveredRevenue;
      totals.deferredRevenue += data.deferredRevenue;
      totals.totalRevenue += data.totalRevenue;
      totals.deliveredTake += data.deliveredTake;
      totals.scheduledTake += data.scheduledTake;
      totals.allTake += data.allTake;
    }
  }
  return totals;
}

const t = (overrides: Partial<SummaryTotals> = {}): SummaryTotals => ({
  ...EMPTY_TOTALS,
  ...overrides,
});

const mockByCategory: Record<string, SummaryTotals> = {
  target: t({ count: 100, totalEnrollment: 400000 }),
  new_business_pipeline: t({ count: 30, totalEnrollment: 120000, openPipeline: 1800000 }),
  winback_pipeline: t({ count: 20, totalEnrollment: 80000, openPipeline: 1200000 }),
  renewal_pipeline: t({ count: 30, totalEnrollment: 120000, openPipeline: 1500000 }),
  expansion_pipeline: t({ count: 20, totalEnrollment: 80000, openPipeline: 700000 }),
  new: t({ count: 40, totalEnrollment: 160000, totalRevenue: 2000000, invoicing: 1500000, closedWonBookings: 1000000 }),
  multi_year_growing: t({ count: 30, totalEnrollment: 120000, totalRevenue: 3000000, invoicing: 2000000, closedWonBookings: 1500000 }),
  multi_year_flat: t({ count: 20, totalEnrollment: 80000, totalRevenue: 1500000, invoicing: 1000000, closedWonBookings: 700000 }),
  multi_year_shrinking: t({ count: 10, totalEnrollment: 40000, totalRevenue: 500000, invoicing: 500000, closedWonBookings: 300000 }),
  lapsed: t({ count: 25, totalEnrollment: 100000 }),
};

describe("useMapSummary aggregation logic", () => {
  it("all pipeline sub-categories combined equal total pipeline", () => {
    const allowed = new Set<string>();
    for (const c of ENGAGEMENT_TO_CATEGORIES["renewal_pipeline"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["expansion_pipeline"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["new_business_pipeline"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["winback_pipeline"]) allowed.add(c);

    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(30 + 20 + 30 + 20); // 100
    expect(result.openPipeline).toBe(1800000 + 1200000 + 1500000 + 700000); // 5200000
  });

  it("multi_year sub-categories each map independently", () => {
    const growing = new Set(ENGAGEMENT_TO_CATEGORIES["multi_year_growing"]);
    const growingResult = sumCategories(mockByCategory, growing);
    expect(growingResult.count).toBe(30);
    expect(growingResult.totalRevenue).toBe(3000000);

    const shrinking = new Set(ENGAGEMENT_TO_CATEGORIES["multi_year_shrinking"]);
    const shrinkingResult = sumCategories(mockByCategory, shrinking);
    expect(shrinkingResult.count).toBe(10);
    expect(shrinkingResult.totalRevenue).toBe(500000);
  });

  it("all multi_year sub-categories combined equal former multi_year total", () => {
    const allowed = new Set<string>();
    for (const c of ENGAGEMENT_TO_CATEGORIES["multi_year_growing"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["multi_year_flat"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["multi_year_shrinking"]) allowed.add(c);

    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(30 + 20 + 10); // 60
    expect(result.totalRevenue).toBe(3000000 + 1500000 + 500000); // 5000000
  });

  it("multiple engagement filters combine additively", () => {
    const allowed = new Set<string>();
    for (const c of ENGAGEMENT_TO_CATEGORIES["target"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["renewal_pipeline"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["new_business_pipeline"]) allowed.add(c);

    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(100 + 30 + 30); // 160
  });

  it("empty allowed set returns zero totals", () => {
    const result = sumCategories(mockByCategory, new Set());
    expect(result.count).toBe(0);
    expect(result.totalRevenue).toBe(0);
  });

  it("engagement 'first_year' maps to 'new' category", () => {
    const allowed = new Set(ENGAGEMENT_TO_CATEGORIES["first_year"]);
    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(40);
    expect(result.invoicing).toBe(1500000);
  });
});
