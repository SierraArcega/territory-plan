import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const agencyMapFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    district: { findMany: (...a: unknown[]) => findMany(...a) },
    agencyDistrictMap: { findUnique: (...a: unknown[]) => agencyMapFindUnique(...a) },
  },
  prisma: {
    district: { findMany: (...a: unknown[]) => findMany(...a) },
    agencyDistrictMap: { findUnique: (...a: unknown[]) => agencyMapFindUnique(...a) },
  },
}));

import { resolveAgency } from "../district-resolver";

beforeEach(() => {
  findMany.mockReset();
  agencyMapFindUnique.mockReset();
  agencyMapFindUnique.mockResolvedValue(null); // default: no override
});

const txDistricts = [
  { leaid: "4849530", name: "United Independent School District" },
  { leaid: "4823610", name: "Houston Independent School District" },
  { leaid: "4844290", name: "Round Rock Independent School District" },
];

describe("resolveAgency", () => {
  it("returns null leaid with kind=unresolved when stateAbbrev is unknown", async () => {
    const result = await resolveAgency({ agencyKey: 12345, agencyName: "Anywhere", stateAbbrev: "ZZ" });
    expect(result).toEqual({ leaid: null, kind: "unresolved" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("Tier 1: case-insensitive exact match", async () => {
    findMany.mockResolvedValue(txDistricts);
    expect(await resolveAgency({ agencyKey: 12346, agencyName: "united independent school district", stateAbbrev: "TX" }))
      .toEqual({ leaid: "4849530", kind: "name_match" });
  });

  it("Tier 2: normalized match (strips ISD/Public Schools/etc.)", async () => {
    findMany.mockResolvedValue(txDistricts);
    expect(await resolveAgency({ agencyKey: 12347, agencyName: "United ISD", stateAbbrev: "TX" }))
      .toEqual({ leaid: "4849530", kind: "name_match" });
    expect(await resolveAgency({ agencyKey: 12348, agencyName: "Houston Public Schools", stateAbbrev: "TX" }))
      .toEqual({ leaid: "4823610", kind: "name_match" });
  });

  it("Tier 3: Dice >= 0.85 single match", async () => {
    findMany.mockResolvedValue([{ leaid: "4900000", name: "Dallas Independent School District" }]);
    const result = await resolveAgency({ agencyKey: 12349, agencyName: "Dalls Independent School District", stateAbbrev: "TX" });
    expect(result).toEqual({ leaid: "4900000", kind: "name_match" });
  });

  it("returns null leaid with kind=unresolved when 0 candidates match", async () => {
    findMany.mockResolvedValue(txDistricts);
    expect(await resolveAgency({ agencyKey: 12350, agencyName: "Wholly Unrelated Charter", stateAbbrev: "TX" }))
      .toEqual({ leaid: null, kind: "unresolved" });
  });

  it("returns null leaid with kind=unresolved when Tier 2 is ambiguous (multiple matches)", async () => {
    findMany.mockResolvedValue([
      { leaid: "1", name: "Springfield Public Schools" },
      { leaid: "2", name: "Springfield Independent School District" },
    ]);
    expect(await resolveAgency({ agencyKey: 12351, agencyName: "Springfield", stateAbbrev: "TX" }))
      .toEqual({ leaid: null, kind: "unresolved" });
  });

  it("scopes by stateFips (passes correct where clause)", async () => {
    findMany.mockResolvedValue([]);
    await resolveAgency({ agencyKey: 12352, agencyName: "Anything", stateAbbrev: "CA" });
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
    expect(await resolveAgency({ agencyKey: 12353, agencyName: "Clarke County Board of Education", stateAbbrev: "GA" }))
      .toEqual({ leaid: "1300390", kind: "name_match" });
  });

  it("matches 'School System' naming (Georgia convention)", async () => {
    findMany.mockResolvedValue([
      { leaid: "1300510", name: "Fulton County Schools" },
    ]);
    expect(await resolveAgency({ agencyKey: 12354, agencyName: "Fulton County School System", stateAbbrev: "GA" }))
      .toEqual({ leaid: "1300510", kind: "name_match" });
  });

  it("matches numbered districts ('District One', 'District Five')", async () => {
    findMany.mockResolvedValue([
      { leaid: "4500900", name: "Florence School District" },
      { leaid: "4501800", name: "Lexington Richland" },
    ]);
    expect(await resolveAgency({ agencyKey: 12355, agencyName: "Florence School District One", stateAbbrev: "SC" }))
      .toEqual({ leaid: "4500900", kind: "name_match" });
    expect(await resolveAgency({ agencyKey: 12356, agencyName: "Lexington / Richland County School District Five", stateAbbrev: "SC" }))
      .toEqual({ leaid: "4501800", kind: "name_match" });
  });

  it("matches state DOEs to their canonical entry", async () => {
    findMany.mockResolvedValue([
      { leaid: "M000029", name: "Massachusetts Department of Education" },
    ]);
    expect(await resolveAgency({
      agencyKey: 12357,
      agencyName: "Massachusetts Department of Elementary and Secondary Education",
      stateAbbrev: "MA",
    })).toEqual({ leaid: "M000029", kind: "name_match" });
  });

  it("matches state board of education", async () => {
    findMany.mockResolvedValue([
      { leaid: "M000080", name: "Texas State Board of Education" },
    ]);
    expect(await resolveAgency({ agencyKey: 12358, agencyName: "Texas Education Agency", stateAbbrev: "TX" }))
      .toEqual({ leaid: "M000080", kind: "name_match" });
  });

  it("matches county-government wrappers to underlying district", async () => {
    findMany.mockResolvedValue([
      { leaid: "5101920", name: "Henrico County Public Schools" },
    ]);
    expect(await resolveAgency({ agencyKey: 12359, agencyName: "Henrico County Government", stateAbbrev: "VA" }))
      .toEqual({ leaid: "5101920", kind: "name_match" });
  });
});

describe("resolveAgency — override branches", () => {
  it("kind=district: returns map.leaid with kind=override_district", async () => {
    agencyMapFindUnique.mockResolvedValue({ kind: "district", leaid: "4900000", stateFips: null });
    const result = await resolveAgency({ agencyKey: 999, agencyName: "Anything", stateAbbrev: "TX" });
    expect(result).toEqual({ leaid: "4900000", kind: "override_district" });
    expect(findMany).not.toHaveBeenCalled(); // override short-circuits name match
  });

  it("kind=state: returns null leaid with kind=override_state", async () => {
    agencyMapFindUnique.mockResolvedValue({ kind: "state", leaid: null, stateFips: "36" });
    const result = await resolveAgency({ agencyKey: 999, agencyName: "Anything", stateAbbrev: "NY" });
    expect(result).toEqual({ leaid: null, kind: "override_state" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("kind=non_lea: returns null leaid with kind=override_non_lea", async () => {
    agencyMapFindUnique.mockResolvedValue({ kind: "non_lea", leaid: null, stateFips: null });
    const result = await resolveAgency({ agencyKey: 999, agencyName: "Anything", stateAbbrev: "VA" });
    expect(result).toEqual({ leaid: null, kind: "override_non_lea" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("no override row: falls through to name match (regression)", async () => {
    agencyMapFindUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([{ leaid: "4849530", name: "United Independent School District" }]);
    const result = await resolveAgency({ agencyKey: 12345, agencyName: "United ISD", stateAbbrev: "TX" });
    expect(result).toEqual({ leaid: "4849530", kind: "name_match" });
  });

  it("no override + no match: returns null with kind=unresolved", async () => {
    agencyMapFindUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    const result = await resolveAgency({ agencyKey: 12345, agencyName: "Mystery", stateAbbrev: "WY" });
    expect(result).toEqual({ leaid: null, kind: "unresolved" });
  });

  it("queries override by agencyKey", async () => {
    agencyMapFindUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    await resolveAgency({ agencyKey: 29140, agencyName: "X", stateAbbrev: "TX" });
    expect(agencyMapFindUnique).toHaveBeenCalledWith({ where: { agencyKey: 29140 } });
  });
});
