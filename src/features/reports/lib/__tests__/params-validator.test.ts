import { describe, expect, it } from "vitest";
import { validateParams } from "../params-validator";
import { MAX_LIMIT } from "../types";

describe("validateParams", () => {
  it("accepts a minimal single-table query", () => {
    const result = validateParams({ table: "districts" });
    expect(result.valid).toBe(true);
  });

  it("rejects an unregistered table", () => {
    const result = validateParams({ table: "bogus_table" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain("bogus_table");
    }
  });

  it("rejects an excluded table", () => {
    const result = validateParams({ table: "query_log" });
    expect(result.valid).toBe(false);
  });

  it("resolves columns on the root table", () => {
    const result = validateParams({
      table: "districts",
      columns: ["leaid", "name", "enrollment"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects columns that don't exist on the table", () => {
    const result = validateParams({
      table: "districts",
      columns: ["leaid", "not_a_column"],
    });
    expect(result.valid).toBe(false);
  });

  it("validates filter ops and values", () => {
    const good = validateParams({
      table: "district_opportunity_actuals",
      filters: [
        { column: "school_yr", op: "eq", value: "2025-26" },
        { column: "bookings", op: "gt", value: 100000 },
        { column: "sales_rep_email", op: "isNotNull" },
      ],
    });
    expect(good.valid).toBe(true);
  });

  it("requires a value for eq/gt/etc", () => {
    const result = validateParams({
      table: "districts",
      filters: [{ column: "leaid", op: "eq" }],
    });
    expect(result.valid).toBe(false);
  });

  it("requires a non-empty array for `in`", () => {
    const result = validateParams({
      table: "districts",
      filters: [{ column: "leaid", op: "in", value: [] }],
    });
    expect(result.valid).toBe(false);
  });

  it("requires group-by for non-aggregated columns when aggregations are used", () => {
    const result = validateParams({
      table: "district_opportunity_actuals",
      columns: ["sales_rep_email"],
      aggregations: [{ column: "bookings", fn: "sum" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("groupBy"))).toBe(true);
    }
  });

  it("accepts aggregations when group-by covers non-aggregated columns", () => {
    const result = validateParams({
      table: "district_opportunity_actuals",
      columns: ["sales_rep_email"],
      aggregations: [{ column: "bookings", fn: "sum" }],
      groupBy: ["sales_rep_email"],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts COUNT(*)", () => {
    const result = validateParams({
      table: "districts",
      aggregations: [{ column: "*", fn: "count" }],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects fn(*) for anything other than count", () => {
    const result = validateParams({
      table: "districts",
      aggregations: [{ column: "*", fn: "sum" }],
    });
    expect(result.valid).toBe(false);
  });

  it("validates declared joins", () => {
    const result = validateParams({
      table: "districts",
      joins: [{ toTable: "opportunities" }],
      columns: ["districts.leaid", "opportunities.id"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects joins with no declared relationship", () => {
    const result = validateParams({
      table: "districts",
      joins: [{ toTable: "subscriptions" }], // no direct relationship
    });
    expect(result.valid).toBe(false);
  });

  it("clamps limit to MAX_LIMIT", () => {
    const result = validateParams({ table: "districts", limit: 10_000 });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.normalized.limit).toBe(MAX_LIMIT);
    }
  });

  it("clamps negative limits to 1", () => {
    const result = validateParams({ table: "districts", limit: -5 });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.normalized.limit).toBe(1);
    }
  });
});
