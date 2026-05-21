import { describe, it, expect } from "vitest";
import { boundsForLeaids } from "../views-plan-bounds";

// Minimal STATE_BBOX stand-in: CA (FIPS 06) and NY (FIPS 36).
const BBOX = {
  CA: [[-124.4, 32.5], [-114.1, 42.0]] as [[number, number], [number, number]],
  NY: [[-79.8, 40.5], [-71.9, 45.0]] as [[number, number], [number, number]],
};

describe("boundsForLeaids", () => {
  it("returns null for an empty leaid list", () => {
    expect(boundsForLeaids([], BBOX)).toBeNull();
  });

  it("returns the single state's bbox for one state", () => {
    // 0601234 → FIPS 06 → CA
    expect(boundsForLeaids(["0601234", "0699999"], BBOX)).toEqual([
      [-124.4, 32.5],
      [-114.1, 42.0],
    ]);
  });

  it("unions bboxes across multiple states", () => {
    // CA (06) + NY (36)
    expect(boundsForLeaids(["0601234", "3600001"], BBOX)).toEqual([
      [-124.4, 32.5],
      [-71.9, 45.0],
    ]);
  });

  it("ignores leaids whose FIPS has no bbox entry", () => {
    // 7800000 → FIPS 78 (VI) not in BBOX → ignored, falls back to CA only
    expect(boundsForLeaids(["0601234", "7800000"], BBOX)).toEqual([
      [-124.4, 32.5],
      [-114.1, 42.0],
    ]);
  });

  it("returns null when no leaid maps to a known bbox", () => {
    expect(boundsForLeaids(["7800000"], BBOX)).toBeNull();
  });
});
