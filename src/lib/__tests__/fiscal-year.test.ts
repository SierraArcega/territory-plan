import { describe, it, expect } from "vitest";
import { getCurrentFY, schoolYearForFY, fyPills } from "../fiscal-year";

describe("getCurrentFY", () => {
  it("returns the calendar year for dates before July 1 (Jan–Jun)", () => {
    expect(getCurrentFY(new Date("2026-05-28T12:00:00"))).toBe(2026);
  });

  it("rolls to the next year on July 1 (FY start)", () => {
    expect(getCurrentFY(new Date("2026-07-01T00:00:00"))).toBe(2027);
  });

  it("treats June 30 as still the prior FY", () => {
    expect(getCurrentFY(new Date("2026-06-30T23:59:59"))).toBe(2026);
  });
});

describe("schoolYearForFY", () => {
  it("maps FY26 to the '2025-26' school-year string DOA/opportunities use", () => {
    expect(schoolYearForFY(2026)).toBe("2025-26");
  });

  it("maps FY24 to '2023-24'", () => {
    expect(schoolYearForFY(2024)).toBe("2023-24");
  });
});

describe("fyPills", () => {
  it("returns FY+1 down to FY-2 with labels and school-year strings", () => {
    expect(fyPills(2026)).toEqual([
      { fy: 2027, schoolYr: "2026-27", label: "FY27" },
      { fy: 2026, schoolYr: "2025-26", label: "FY26" },
      { fy: 2025, schoolYr: "2024-25", label: "FY25" },
      { fy: 2024, schoolYr: "2023-24", label: "FY24" },
    ]);
  });
});
