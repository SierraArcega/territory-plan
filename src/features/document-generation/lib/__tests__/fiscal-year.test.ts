import { describe, it, expect } from "vitest";
import { fiscalYearFromDate, resolveFiscalYear } from "../fiscal-year";

describe("fiscalYearFromDate", () => {
  it("maps a July-or-later date to the next year's FY (FY starts July 1, named by end year)", () => {
    expect(fiscalYearFromDate("2026-07-01")).toBe("FY27"); // SY 2026-27
    expect(fiscalYearFromDate("07/01/2026")).toBe("FY27"); // US format
  });
  it("maps a Jan–June date to that calendar year's FY", () => {
    expect(fiscalYearFromDate("2027-06-30")).toBe("FY27");
    expect(fiscalYearFromDate("2025-08-01")).toBe("FY26");
    expect(fiscalYearFromDate("03/15/2026")).toBe("FY26");
  });
  it("returns null for dates outside the available pricebook years (FY26/FY27)", () => {
    expect(fiscalYearFromDate("2030-01-01")).toBeNull();
    expect(fiscalYearFromDate("2020-01-01")).toBeNull();
  });
  it("returns null for unparseable / empty input", () => {
    expect(fiscalYearFromDate("")).toBeNull();
    expect(fiscalYearFromDate("not a date")).toBeNull();
  });
  it("handles ISO timestamps (opportunity dates) without falling back", () => {
    expect(fiscalYearFromDate("2026-07-01T00:00:00.000Z")).toBe("FY27");
    expect(fiscalYearFromDate("2025-08-01T12:34:56Z")).toBe("FY26");
  });
  it("rejects an out-of-range month instead of rolling it over", () => {
    expect(fiscalYearFromDate("2026-13-01")).toBeNull();
  });
});

describe("resolveFiscalYear", () => {
  it("returns the explicit selection when not 'auto'", () => {
    expect(resolveFiscalYear("FY26", "2026-07-01", "")).toBe("FY26");
    expect(resolveFiscalYear("FY27", "", "")).toBe("FY27");
  });
  it("auto-derives from start date, then end date", () => {
    expect(resolveFiscalYear("auto", "2026-07-01", "2027-06-30")).toBe("FY27");
    expect(resolveFiscalYear("auto", "", "2025-09-01")).toBe("FY26"); // falls back to end date
  });
  it("falls back to FY27 when 'auto' and dates are unusable", () => {
    expect(resolveFiscalYear("auto", "", "")).toBe("FY27");
    expect(resolveFiscalYear("auto", "garbage", "2099-01-01")).toBe("FY27");
  });
});
