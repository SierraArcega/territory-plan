import { describe, it, expect } from "vitest";
import { handleListTables } from "../list-tables";

describe("handleListTables", () => {
  it("returns a string containing at least 'districts'", async () => {
    const result = await handleListTables();
    expect(result).toContain("districts");
  });

  it("returns a description for each table", async () => {
    const result = await handleListTables();
    const lines = result.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/:/);
    }
  });
});
