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
});
