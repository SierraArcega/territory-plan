import { describe, it, expect } from "vitest";
import { increaseTargetsColumns } from "../columns/increaseTargetsColumns";

describe("increaseTargetsColumns", () => {
  it("every column has the required ColumnDef fields", () => {
    expect(increaseTargetsColumns.length).toBeGreaterThan(0);
    for (const col of increaseTargetsColumns) {
      expect(typeof col.key).toBe("string");
      expect(col.key.length).toBeGreaterThan(0);
      expect(typeof col.label).toBe("string");
      expect(col.label.length).toBeGreaterThan(0);
      expect(typeof col.group).toBe("string");
      expect(col.group.length).toBeGreaterThan(0);
      expect(typeof col.filterType).toBe("string");
    }
  });

  it("includes the four key at-risk columns", () => {
    const keys = increaseTargetsColumns.map((c) => c.key);
    expect(keys).toContain("districtName");
    expect(keys).toContain("state");
    expect(keys).toContain("fy26Revenue");
    expect(keys).toContain("lastRepName");
  });

  it("labels the revenue column with the '($)' currency hint", () => {
    const rev = increaseTargetsColumns.find((c) => c.key === "fy26Revenue");
    expect(rev?.label).toContain("($)");
  });
});
