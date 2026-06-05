import { describe, it, expect } from "vitest";

import {
  DEFAULT_FISCAL_YEAR,
  getProducts,
  getVolumeProducts,
  getBocesProducts,
  getCategories,
  findBySku,
} from "../pricebook";

// Snapshot counts for the "PandaDoc Export May 2026" import. When the pricebook
// is regenerated for a new year, update these alongside pricebook.json.
const FY27_COUNT = 92;
const FY26_COUNT = 81;
const FLAT_TOTAL = FY27_COUNT + FY26_COUNT; // 173 (Allocation excluded)

describe("pricebook dataset", () => {
  it("imported the expected flat + volume counts", () => {
    expect(getProducts({ fiscalYear: "all" })).toHaveLength(FLAT_TOTAL);
    expect(getProducts({ fiscalYear: "FY27" })).toHaveLength(FY27_COUNT);
    expect(getProducts({ fiscalYear: "FY26" })).toHaveLength(FY26_COUNT);
    expect(getVolumeProducts({ fiscalYear: "all" })).toHaveLength(1);
  });

  it("tagged every flat product with a fiscal year", () => {
    expect(getProducts({ fiscalYear: "all" }).every((p) => p.fiscalYear)).toBe(true);
  });

  it("excluded the Allocation custom line item", () => {
    expect(
      getProducts({ fiscalYear: "all" }).some((p) => /allocation/i.test(p.name)),
    ).toBe(false);
  });

  it("dropped the internal Cost column from every row", () => {
    expect(
      getProducts({ fiscalYear: "all" }).every((p) => !("cost" in p)),
    ).toBe(true);
  });

  it("kept $0 placeholder rows (rep enters the price)", () => {
    const pgc = findBySku("PGC-2027");
    expect(pgc?.listRate).toBe(0);
    expect(pgc?.fiscalYear).toBe("FY27");
  });

  it("keeps the volume product's full quantity-tier ladder, ascending", () => {
    const [vol] = getVolumeProducts({ fiscalYear: "FY27" });
    expect(vol.sku).toBe("EK12-T1-SUPP-30-44");
    expect(vol.tiers).toHaveLength(5);
    const mins = vol.tiers.map((t) => t.minQty);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
});

describe("selectors", () => {
  it("defaults to the current fiscal year", () => {
    expect(DEFAULT_FISCAL_YEAR).toBe("FY27");
    expect(getProducts()).toEqual(getProducts({ fiscalYear: "FY27" }));
  });

  it("getBocesProducts returns only FY27 BOCES line items", () => {
    const boces = getBocesProducts();
    expect(boces.length).toBeGreaterThan(0);
    expect(
      boces.every((p) => p.fiscalYear === "FY27" && /boces|^BOC/i.test(`${p.category} ${p.sku}`)),
    ).toBe(true);
  });

  it("exposes distinct categories for grouping", () => {
    const cats = getCategories("FY27");
    expect(cats).toContain("FY27 BOCES Pricing");
    expect(new Set(cats).size).toBe(cats.length);
  });
});
