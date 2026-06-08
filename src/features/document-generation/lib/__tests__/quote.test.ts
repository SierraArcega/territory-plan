// src/features/document-generation/lib/__tests__/quote.test.ts
import { describe, it, expect } from "vitest";
import { computeTotals, round2 } from "../quote";
import type { LineItemRow } from "../payload-types";

const row = (over: Partial<LineItemRow>): LineItemRow => ({
  id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs",
  listRate: 0, discountPct: 0, ...over,
});

describe("computeTotals (contract)", () => {
  it("applies discount to net rate and multiplies by qty", () => {
    const t = computeTotals("contract", [row({ listRate: 100, discountPct: 10, qty: 2 })], 0);
    expect(t.lines[0].netRate).toBe(90);
    expect(t.lines[0].total).toBe(180);
    expect(t.subtotal).toBe(180);
    expect(t.fee).toBe(0);
    expect(t.orderTotal).toBe(180);
  });
  it("rounds to 2 decimals", () => {
    const t = computeTotals("contract", [row({ listRate: 33.333, discountPct: 0, qty: 3 })], 0);
    // netRate is rounded first: round2(33.333) = 33.33; then round2(1*3*33.33) = 99.99
    expect(t.lines[0].total).toBe(99.99);
  });
  it("multiplies count × qty × netRate when count is provided", () => {
    const t = computeTotals("contract", [row({ count: 5, qty: 180, listRate: 500.23, unit: "Day", discountPct: 0 })], 0);
    expect(t.lines[0].total).toBe(round2(5 * 180 * 500.23));
    expect(t.billableDays).toBe(900);
  });
  it("accumulates billableHours from Hour-unit rows", () => {
    const t = computeTotals("contract", [row({ unit: "Hour", count: 2, qty: 100, listRate: 50, discountPct: 0 })], 0);
    expect(t.billableHours).toBe(200);
  });
  it("applies discount before multiplying by count", () => {
    const t = computeTotals("contract", [row({ count: 2, qty: 1, listRate: 100, discountPct: 10, unit: "Day" })], 0);
    expect(t.lines[0].total).toBe(180);
  });
});

describe("computeTotals (boces)", () => {
  it("ignores discount, adds fee_pct of subtotal", () => {
    const t = computeTotals("boces_quote", [row({ listRate: 100, qty: 10, discountPct: 50 })], 10.6);
    expect(t.lines[0].total).toBe(1000); // discount ignored
    expect(t.subtotal).toBe(1000);
    expect(t.fee).toBe(106);
    expect(t.orderTotal).toBe(1106);
  });
});
