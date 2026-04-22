import { describe, it, expect } from "vitest";
import { extractStates } from "../extract-states";

describe("extractStates", () => {
  it("detects postal abbreviations with comma", () => {
    expect(extractStates("Austin, TX saw a surge in enrollment.")).toContain("TX");
  });

  it("detects multiple states in the same text", () => {
    const s = extractStates("Schools in California and New York are seeing change.");
    expect(s).toContain("CA");
    expect(s).toContain("NY");
  });

  it("drops ambiguous full names without edu context (Georgia the country)", () => {
    expect(extractStates("The country of Georgia signed a trade deal.")).toEqual([]);
  });

  it("accepts ambiguous full names when edu context is in-sentence", () => {
    expect(
      extractStates("Georgia school districts announced a new curriculum.")
    ).toContain("GA");
  });

  it("drops 'Washington' when used as a name without edu context", () => {
    expect(extractStates("George Washington crossed the Delaware.")).toEqual(["DE"]);
  });

  it("accepts 'Washington' state with edu context", () => {
    expect(
      extractStates("Washington public schools reopened Monday.")
    ).toContain("WA");
  });

  it("returns sorted unique abbrevs", () => {
    const s = extractStates("Texas, California, and Texas again. In school news, CA, TX.");
    expect(s).toEqual(["CA", "TX"]);
  });
});
