import { describe, it, expect } from "vitest";
import { pickDistrictFeature } from "../pickDistrictFeature";

describe("pickDistrictFeature", () => {
  it("returns the child when both rollup and child are at the point", () => {
    const features = [
      { properties: { leaid: "3620580", is_rollup: true } },
      { properties: { leaid: "3600076", is_rollup: false } },
    ];
    expect(pickDistrictFeature(features as any)?.properties.leaid).toBe("3600076");
  });

  it("returns the child when only the child is at the point", () => {
    const features = [{ properties: { leaid: "3600076", is_rollup: false } }];
    expect(pickDistrictFeature(features as any)?.properties.leaid).toBe("3600076");
  });

  it("returns the rollup as fallback when only the rollup is at the point", () => {
    const features = [{ properties: { leaid: "3620580", is_rollup: true } }];
    expect(pickDistrictFeature(features as any)?.properties.leaid).toBe("3620580");
  });

  it("returns undefined on empty feature list", () => {
    expect(pickDistrictFeature([])).toBeUndefined();
  });
});
