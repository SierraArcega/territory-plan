import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: { district: { findMany: (...a: unknown[]) => findMany(...a) } },
  prisma: { district: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import { resolveDistrict } from "../district-resolver";

beforeEach(() => {
  findMany.mockReset();
});

const txDistricts = [
  { leaid: "4849530", name: "United Independent School District" },
  { leaid: "4823610", name: "Houston Independent School District" },
  { leaid: "4844290", name: "Round Rock Independent School District" },
];

describe("resolveDistrict", () => {
  it("returns null when stateAbbrev is unknown", async () => {
    expect(await resolveDistrict("Anywhere", "ZZ")).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("Tier 1: case-insensitive exact match", async () => {
    findMany.mockResolvedValue(txDistricts);
    expect(await resolveDistrict("united independent school district", "TX")).toBe("4849530");
  });

  it("Tier 2: normalized match (strips ISD/Public Schools/etc.)", async () => {
    findMany.mockResolvedValue(txDistricts);
    expect(await resolveDistrict("United ISD", "TX")).toBe("4849530");
    expect(await resolveDistrict("Houston Public Schools", "TX")).toBe("4823610");
  });

  it("Tier 3: Dice >= 0.85 single match", async () => {
    findMany.mockResolvedValue([{ leaid: "4900000", name: "Dallas Independent School District" }]);
    const result = await resolveDistrict("Dalls Independent School District", "TX");
    expect(result).toBe("4900000");
  });

  it("returns null when 0 candidates match", async () => {
    findMany.mockResolvedValue(txDistricts);
    expect(await resolveDistrict("Wholly Unrelated Charter", "TX")).toBeNull();
  });

  it("returns null when Tier 2 is ambiguous (multiple matches)", async () => {
    findMany.mockResolvedValue([
      { leaid: "1", name: "Springfield Public Schools" },
      { leaid: "2", name: "Springfield Independent School District" },
    ]);
    expect(await resolveDistrict("Springfield", "TX")).toBeNull();
  });

  it("scopes by stateFips (passes correct where clause)", async () => {
    findMany.mockResolvedValue([]);
    await resolveDistrict("Anything", "CA");
    expect(findMany).toHaveBeenCalledWith({
      where: { stateFips: "06" },
      select: { leaid: true, name: true },
    });
  });

  // Stop-word tuning for non-LEA name shapes (SEAs, GA "Board of Education",
  // numbered districts, etc). These reflect real patterns observed in the
  // 2026-05-04 nationwide cold-start sync.

  it("matches 'Board of Education' naming (Georgia convention)", async () => {
    findMany.mockResolvedValue([
      { leaid: "1300390", name: "Clarke County Schools" },
    ]);
    expect(await resolveDistrict("Clarke County Board of Education", "GA")).toBe("1300390");
  });

  it("matches 'School System' naming (Georgia convention)", async () => {
    findMany.mockResolvedValue([
      { leaid: "1300510", name: "Fulton County Schools" },
    ]);
    expect(await resolveDistrict("Fulton County School System", "GA")).toBe("1300510");
  });

  it("matches numbered districts ('District One', 'District Five')", async () => {
    findMany.mockResolvedValue([
      { leaid: "4500900", name: "Florence School District" },
      { leaid: "4501800", name: "Lexington Richland" },
    ]);
    expect(await resolveDistrict("Florence School District One", "SC")).toBe("4500900");
    expect(await resolveDistrict("Lexington / Richland County School District Five", "SC"))
      .toBe("4501800");
  });

  it("matches state DOEs to their canonical entry", async () => {
    findMany.mockResolvedValue([
      { leaid: "M000029", name: "Massachusetts Department of Education" },
    ]);
    expect(await resolveDistrict(
      "Massachusetts Department of Elementary and Secondary Education", "MA",
    )).toBe("M000029");
  });

  it("matches state board of education", async () => {
    findMany.mockResolvedValue([
      { leaid: "M000080", name: "Texas State Board of Education" },
    ]);
    expect(await resolveDistrict("Texas Education Agency", "TX")).toBe("M000080");
  });

  it("matches county-government wrappers to underlying district", async () => {
    findMany.mockResolvedValue([
      { leaid: "5101920", name: "Henrico County Public Schools" },
    ]);
    expect(await resolveDistrict("Henrico County Government", "VA")).toBe("5101920");
  });
});
