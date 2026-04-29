import { describe, it, expect } from "vitest";
import { handleDescribeTable } from "../describe-table";

describe("handleDescribeTable", () => {
  it("returns an error for an unknown table", async () => {
    const result = await handleDescribeTable("nonexistent");
    expect(result).toMatch(/not (registered|found)/i);
  });

  it("returns column descriptions for a known table", async () => {
    const result = await handleDescribeTable("districts");
    expect(result).toContain("leaid");
    expect(result).toContain("state");
  });

  it("includes relationships section", async () => {
    const result = await handleDescribeTable("districts");
    expect(result.toLowerCase()).toMatch(/relationship|joins|related/);
  });
});
