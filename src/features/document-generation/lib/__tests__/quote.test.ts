// src/features/document-generation/lib/__tests__/quote.test.ts
import { describe, it, expect } from "vitest";
import { computeTotals } from "../quote";
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
    expect(t.lines[0].total).toBe(100); // 33.333*3 = 99.999 -> 100.00
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
