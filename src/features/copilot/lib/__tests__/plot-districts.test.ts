import { describe, it, expect } from "vitest";
import { extractDistrictLeaids, statesForLeaids, MAX_PLOTTED_DISTRICTS } from "../plot-districts";

describe("extractDistrictLeaids", () => {
  it("returns [] when no leaid column", () => {
    expect(extractDistrictLeaids(["name"], [{ name: "X" }])).toEqual({ leaids: [], truncated: false });
  });
  it("dedupes leaids from rows", () => {
    const r = extractDistrictLeaids(["leaid", "name"], [
      { leaid: "1900001", name: "A" },
      { leaid: "1900001", name: "A" },
      { leaid: "1900002", name: "B" },
    ]);
    expect(r.leaids).toEqual(["1900001", "1900002"]);
    expect(r.truncated).toBe(false);
  });
  it("caps at MAX_PLOTTED_DISTRICTS and marks truncated", () => {
    const rows = Array.from({ length: MAX_PLOTTED_DISTRICTS + 5 }, (_, i) => ({
      leaid: String(1900000 + i),
    }));
    const r = extractDistrictLeaids(["leaid"], rows);
    expect(r.leaids).toHaveLength(MAX_PLOTTED_DISTRICTS);
    expect(r.truncated).toBe(true);
  });
});

describe("statesForLeaids", () => {
  it("maps leading FIPS to distinct state abbrevs", () => {
    expect(statesForLeaids(["1900001", "1900002", "0600003"]).sort()).toEqual(["CA", "IA"]);
  });
});
