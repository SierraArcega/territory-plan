import { describe, it, expect } from "vitest";
import { validateSummary } from "../summary-validator";
import type { QuerySummary } from "../types";

const baseSummary: QuerySummary = {
  source: "Districts",
  filters: [{ id: "f1", label: "State", value: "Texas" }],
  columns: [
    { id: "c1", label: "District name" },
    { id: "c2", label: "Bookings" },
  ],
  sort: null,
  limit: 100,
};

describe("validateSummary", () => {
  it("passes when filter values appear in SQL", () => {
    const sql = "SELECT name, bookings FROM districts WHERE state = 'Texas' LIMIT 100";
    const result = validateSummary(sql, baseSummary);
    expect(result.valid).toBe(true);
  });

  it("fails when filter value isn't in SQL", () => {
    const sql = "SELECT name, bookings FROM districts WHERE state = 'Ohio' LIMIT 100";
    const result = validateSummary(sql, baseSummary);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Texas"))).toBe(true);
  });

  it("allows substring matching for wrapped labels (FY26 inside 2025-26)", () => {
    const sql = "SELECT name, bookings FROM districts WHERE school_yr = '2025-26' LIMIT 100";
    const summary: QuerySummary = {
      ...baseSummary,
      filters: [{ id: "f1", label: "Year", value: "FY26 (2025-26)" }],
    };
    const result = validateSummary(sql, summary);
    expect(result.valid).toBe(true);
  });

  it("fails when column count doesn't match SELECT", () => {
    const sql = "SELECT name FROM districts WHERE state = 'Texas' LIMIT 100";
    const result = validateSummary(sql, baseSummary);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("column"))).toBe(true);
  });

  it("enforces LIMIT ≤ 500", () => {
    const sql = "SELECT name, bookings FROM districts WHERE state = 'Texas' LIMIT 9999";
    const result = validateSummary(sql, { ...baseSummary, limit: 9999 });
    expect(result.valid).toBe(false);
  });

  it("requires a LIMIT clause", () => {
    const sql = "SELECT name, bookings FROM districts WHERE state = 'Texas'";
    const result = validateSummary(sql, baseSummary);
    expect(result.valid).toBe(false);
  });

  it("validates CTE queries correctly (counts outer SELECT columns)", () => {
    const sql =
      "WITH recent AS (SELECT a, b FROM districts WHERE state = 'Texas') SELECT name, bookings FROM recent LIMIT 100";
    const result = validateSummary(sql, baseSummary);
    expect(result.valid).toBe(true);
  });

  it("validates queries with subqueries in SELECT list", () => {
    const sql =
      "SELECT name, (SELECT COUNT(*) FROM opportunities WHERE district_lea_id = districts.leaid) AS deal_count FROM districts WHERE state = 'Texas' LIMIT 100";
    const summary: QuerySummary = {
      ...baseSummary,
      columns: [
        { id: "c1", label: "District name" },
        { id: "c2", label: "Deal count" },
      ],
    };
    const result = validateSummary(sql, summary);
    expect(result.valid).toBe(true);
  });

  it("rejects SQL whose only LIMIT is inside a block comment", () => {
    const sql = "SELECT name, bookings FROM districts WHERE state = 'Texas' /* LIMIT 50 */";
    const result = validateSummary(sql, baseSummary);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("limit"))).toBe(true);
  });

  it("ignores LIMIT inside line comments", () => {
    const sql = "-- LIMIT 9999\nSELECT name, bookings FROM districts WHERE state = 'Texas' LIMIT 100";
    const result = validateSummary(sql, baseSummary);
    expect(result.valid).toBe(true);
  });
});
