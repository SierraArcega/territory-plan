import { describe, it, expect } from "vitest";
import { isRollup, getChildren, getRollupLeaids } from "../rollup";

describe("rollup helpers", () => {
  it("isRollup returns true for NYC DOE (3620580)", async () => {
    expect(await isRollup("3620580")).toBe(true);
  });

  it("isRollup returns false for a leaf district", async () => {
    expect(await isRollup("3600076")).toBe(false);
  });

  it("isRollup returns false for a nonexistent leaid", async () => {
    expect(await isRollup("9999999")).toBe(false);
  });

  it("getChildren returns 32+ leaids for NYC DOE", async () => {
    const children = await getChildren("3620580");
    expect(children.length).toBeGreaterThanOrEqual(32);
    expect(children).toContain("3600076");
  });

  it("getChildren returns [] for a leaf district", async () => {
    expect(await getChildren("3600076")).toEqual([]);
  });

  it("getRollupLeaids filters a mixed list to just the rollups", async () => {
    const result = await getRollupLeaids(["3620580", "3600076", "0400001"]);
    expect(result).toEqual(["3620580"]);
  });
});
