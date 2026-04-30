import { describe, it, expect } from "vitest";
import { handleSearchMetadata } from "../search-metadata";

describe("handleSearchMetadata", () => {
  it("finds 'bookings' across multiple columns", async () => {
    const result = await handleSearchMetadata("bookings");
    expect(result.toLowerCase()).toContain("bookings");
    const matchCount = (result.match(/^\s*- /gm) ?? []).length;
    expect(matchCount).toBeGreaterThanOrEqual(2);
  });

  it("returns 'no matches' for junk queries", async () => {
    const result = await handleSearchMetadata("zzzzzqqqqqqxxxxx");
    expect(result.toLowerCase()).toMatch(/no match|nothing/);
  });

  it("includes the column's full description in results", async () => {
    const result = await handleSearchMetadata("closed-won");
    expect(result.length).toBeGreaterThan(200);
  });
});
