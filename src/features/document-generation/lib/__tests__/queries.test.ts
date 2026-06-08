import { describe, it, expect } from "vitest";
import { districtContactsUrl } from "../queries";

describe("districtContactsUrl", () => {
  it("builds a leaid-scoped contacts URL", () => {
    expect(districtContactsUrl("0612345")).toBe("/api/contacts?leaid=0612345");
  });
});
