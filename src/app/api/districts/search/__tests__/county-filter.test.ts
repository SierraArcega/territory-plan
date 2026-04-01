import { describe, it, expect } from "vitest";
import type { FilterDef } from "@/features/explore/lib/filters";

/**
 * Extracts county filter objects from the filters array and returns:
 * - countyWhere: a Prisma OR clause for compound county+state matching
 * - remainingFilters: the filters array with countyName filters removed
 *
 * This mirrors the logic added to the search route.
 */
function extractCountyFilter(filters: FilterDef[]): {
  countyWhere: Record<string, unknown> | null;
  remainingFilters: FilterDef[];
} {
  const countyFilter = filters.find(
    (f) => f.column === "countyName" && f.op === "in"
  );
  if (!countyFilter || !Array.isArray(countyFilter.value)) {
    return { countyWhere: null, remainingFilters: filters };
  }

  const pairs = countyFilter.value as Array<{
    countyName: string;
    stateAbbrev: string;
  }>;
  const countyWhere = {
    OR: pairs.map((p) => ({
      countyName: p.countyName,
      stateAbbrev: p.stateAbbrev,
    })),
  };
  const remainingFilters = filters.filter((f) => f !== countyFilter);
  return { countyWhere, remainingFilters };
}

describe("extractCountyFilter", () => {
  it("builds compound OR clause from county+state pairs", () => {
    const filters: FilterDef[] = [
      {
        column: "countyName",
        op: "in",
        value: [
          { countyName: "Harris County", stateAbbrev: "TX" },
          { countyName: "Washington County", stateAbbrev: "AL" },
        ],
      },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toEqual({
      OR: [
        { countyName: "Harris County", stateAbbrev: "TX" },
        { countyName: "Washington County", stateAbbrev: "AL" },
      ],
    });
    expect(remainingFilters).toEqual([]);
  });

  it("preserves other filters and removes only countyName", () => {
    const filters: FilterDef[] = [
      { column: "state", op: "in", value: ["CA", "TX"] },
      {
        column: "countyName",
        op: "in",
        value: [{ countyName: "Harris County", stateAbbrev: "TX" }],
      },
      { column: "enrollment", op: "gt", value: 1000 },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toEqual({
      OR: [{ countyName: "Harris County", stateAbbrev: "TX" }],
    });
    expect(remainingFilters).toEqual([
      { column: "state", op: "in", value: ["CA", "TX"] },
      { column: "enrollment", op: "gt", value: 1000 },
    ]);
  });

  it("returns null countyWhere when no county filter is present", () => {
    const filters: FilterDef[] = [
      { column: "state", op: "in", value: ["CA"] },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toBeNull();
    expect(remainingFilters).toEqual(filters);
  });

  it("returns null countyWhere when county filter value is not an array", () => {
    const filters: FilterDef[] = [
      { column: "countyName", op: "in", value: "Harris County" },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toBeNull();
    expect(remainingFilters).toEqual(filters);
  });
});
