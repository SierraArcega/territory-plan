import { describe, it, expect } from "vitest";
import { lmsOpportunityUrl, schoolYearFor } from "../lms";

describe("lms opportunity url", () => {
  it("derives the school year from a date (>= July rolls forward)", () => {
    expect(schoolYearFor(new Date("2026-05-22"))).toBe("2025-26");
    expect(schoolYearFor(new Date("2026-08-01"))).toBe("2026-27");
  });
  it("builds the generic board url with the school year", () => {
    const url = lmsOpportunityUrl({ now: new Date("2026-05-22") });
    expect(url).toBe("https://lms.fullmindlearning.com/opportunities/kanban?school_year=2025-26");
  });
});
