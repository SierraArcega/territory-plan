import { describe, it, expect } from "vitest";
import { isOpenDeal, isOverdue } from "../open-deals";

describe("isOpenDeal", () => {
  it("is false for null/empty stage", () => {
    expect(isOpenDeal(null)).toBe(false);
    expect(isOpenDeal("")).toBe(false);
  });
  it("is false for closed won/lost (any spacing/case)", () => {
    expect(isOpenDeal("Closed Won")).toBe(false);
    expect(isOpenDeal("closed_lost")).toBe(false);
    expect(isOpenDeal("CLOSED WON")).toBe(false);
  });
  it("is true for an open stage", () => {
    expect(isOpenDeal("Negotiation")).toBe(true);
    expect(isOpenDeal("Proposal Sent")).toBe(true);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-05-27T00:00:00Z");
  it("is true when closeDate is in the past", () => {
    expect(isOverdue(new Date("2026-05-01T00:00:00Z"), now)).toBe(true);
  });
  it("is false when closeDate is future or null", () => {
    expect(isOverdue(new Date("2026-06-01T00:00:00Z"), now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
});
