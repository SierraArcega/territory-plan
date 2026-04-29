import { describe, it, expect } from "vitest";
import { formatCell, humanizeColumnName, inferFormat } from "../format-cell";

describe("formatCell — currency", () => {
  it("formats numeric currency with $ and commas", () => {
    expect(formatCell("net_booking_amount", 40859.5)).toBe("$40,859.50");
    expect(formatCell("maximum_budget", 1234567)).toBe("$1,234,567.00");
  });

  it("formats string-numeric currency", () => {
    expect(formatCell("minimum_purchase_amount", "8399.60")).toBe("$8,399.60");
  });

  it("uses heuristic for SQL aliases like net_bookings / max_budget", () => {
    expect(formatCell("net_bookings", 12345)).toBe("$12,345.00");
    expect(formatCell("max_budget", 9999.99)).toBe("$9,999.99");
    expect(formatCell("min_purchase", "5000")).toBe("$5,000.00");
  });

  it("renders zero correctly", () => {
    expect(formatCell("invoiced", 0)).toBe("$0.00");
  });
});

describe("formatCell — dates", () => {
  it("formats ISO timestamps as MM/DD/YYYY", () => {
    expect(formatCell("created_at", "2026-04-28T17:08:53.000Z")).toBe("04/28/2026");
  });

  it("formats date-only strings", () => {
    expect(formatCell("close_date", "2024-10-16")).toBe("10/16/2024");
  });

  it("formats Date instances using the local calendar day", () => {
    // Use a midday UTC value so all reasonable test runners land on the same calendar day.
    expect(formatCell("created_at", new Date("2026-01-15T12:00:00Z"))).toBe("01/15/2026");
  });

  it("falls back to string for invalid dates", () => {
    expect(formatCell("created_at", "not-a-date")).toBe("not-a-date");
  });

  it("detects ISO date in unregistered/aliased columns by value shape", () => {
    expect(formatCell("some_alias", "2026-04-28T17:08:53.000Z")).toBe("04/28/2026");
  });
});

describe("formatCell — other types", () => {
  it("renders null/undefined/empty as em-dash", () => {
    expect(formatCell("name", null)).toBe("—");
    expect(formatCell("name", undefined)).toBe("—");
    expect(formatCell("name", "")).toBe("—");
  });

  it("formats booleans as Yes/No", () => {
    expect(formatCell("is_active", true)).toBe("Yes");
    expect(formatCell("is_active", false)).toBe("No");
  });

  it("formats integers with commas, no decimals", () => {
    expect(formatCell("row_count", 1234567)).toBe("1,234,567");
  });

  it("formats decimals with up to 2 fraction digits", () => {
    expect(formatCell("ratio_field", 1.23456)).toBe("1.23");
  });

  it("renders text columns as-is", () => {
    expect(formatCell("name", "Houston ISD")).toBe("Houston ISD");
  });
});

describe("inferFormat", () => {
  it("uses TABLE_REGISTRY for registered columns", () => {
    expect(inferFormat("net_booking_amount", 100)).toBe("currency");
    expect(inferFormat("created_at", "2026-04-28")).toBe("date");
  });

  it("falls back to value shape for ISO dates on unregistered columns", () => {
    expect(inferFormat("alias_col", "2026-04-28T00:00:00Z")).toBe("date");
  });

  it("detects currency from column name when value is numeric", () => {
    expect(inferFormat("total_amount", 100)).toBe("currency");
    expect(inferFormat("revenue", "5000")).toBe("currency");
  });
});

describe("humanizeColumnName", () => {
  it("converts snake_case to Title Case", () => {
    expect(humanizeColumnName("minimum_purchase_amount")).toBe("Minimum Purchase Amount");
    expect(humanizeColumnName("created_at")).toBe("Created At");
    expect(humanizeColumnName("net_booking_amount")).toBe("Net Booking Amount");
  });

  it("leaves already-mixed-case identifiers alone", () => {
    expect(humanizeColumnName("districtName")).toBe("districtName");
    expect(humanizeColumnName("FOO")).toBe("FOO");
  });

  it("handles single words", () => {
    expect(humanizeColumnName("name")).toBe("Name");
  });
});
