import { describe, it, expect } from "vitest";
import {
  buildWhereClause,
  DISTRICT_FIELD_MAP,
  PLANS_FIELD_MAP,
} from "../filters";
import type { FilterDef } from "../filters";

/* ------------------------------------------------------------------ */
/*  buildWhereClause - individual operators                           */
/* ------------------------------------------------------------------ */

describe("buildWhereClause", () => {
  describe("operator: eq", () => {
    it("produces { [field]: value } for a string value", () => {
      const filters: FilterDef[] = [{ column: "status", op: "eq", value: "active" }];
      expect(buildWhereClause(filters)).toEqual({ status: "active" });
    });

    it("works with a numeric value", () => {
      const filters: FilterDef[] = [{ column: "count", op: "eq", value: 42 }];
      expect(buildWhereClause(filters)).toEqual({ count: 42 });
    });
  });

  describe("operator: neq", () => {
    it("produces { [field]: { not: value } }", () => {
      const filters: FilterDef[] = [{ column: "status", op: "neq", value: "archived" }];
      expect(buildWhereClause(filters)).toEqual({ status: { not: "archived" } });
    });
  });

  describe("operator: in", () => {
    it("produces { [field]: { in: value } } for an array of strings", () => {
      const filters: FilterDef[] = [
        { column: "state", op: "in", value: ["CA", "TX", "NY"] },
      ];
      expect(buildWhereClause(filters)).toEqual({
        state: { in: ["CA", "TX", "NY"] },
      });
    });

    it("works with numeric arrays", () => {
      const filters: FilterDef[] = [
        { column: "grade", op: "in", value: [1, 2, 3] },
      ];
      expect(buildWhereClause(filters)).toEqual({
        grade: { in: [1, 2, 3] },
      });
    });
  });

  describe("operator: contains", () => {
    it("produces { [field]: { contains: value, mode: 'insensitive' } }", () => {
      const filters: FilterDef[] = [
        { column: "name", op: "contains", value: "Springfield" },
      ];
      expect(buildWhereClause(filters)).toEqual({
        name: { contains: "Springfield", mode: "insensitive" },
      });
    });

    it("includes mode: 'insensitive' for case-insensitive matching", () => {
      const result = buildWhereClause([
        { column: "name", op: "contains", value: "test" },
      ]);
      expect(result.name).toHaveProperty("mode", "insensitive");
    });
  });

  describe("operator: gt", () => {
    it("produces { [field]: { gt: value } }", () => {
      const filters: FilterDef[] = [{ column: "enrollment", op: "gt", value: 1000 }];
      expect(buildWhereClause(filters)).toEqual({
        enrollment: { gt: 1000 },
      });
    });
  });

  describe("operator: gte", () => {
    it("produces { [field]: { gte: value } }", () => {
      const filters: FilterDef[] = [{ column: "enrollment", op: "gte", value: 500 }];
      expect(buildWhereClause(filters)).toEqual({
        enrollment: { gte: 500 },
      });
    });
  });

  describe("operator: lt", () => {
    it("produces { [field]: { lt: value } }", () => {
      const filters: FilterDef[] = [{ column: "score", op: "lt", value: 50 }];
      expect(buildWhereClause(filters)).toEqual({
        score: { lt: 50 },
      });
    });
  });

  describe("operator: lte", () => {
    it("produces { [field]: { lte: value } }", () => {
      const filters: FilterDef[] = [{ column: "score", op: "lte", value: 100 }];
      expect(buildWhereClause(filters)).toEqual({
        score: { lte: 100 },
      });
    });
  });

  describe("operator: between", () => {
    it("produces { [field]: { gte: min, lte: max } } from [min, max] tuple", () => {
      const filters: FilterDef[] = [
        { column: "enrollment", op: "between", value: [500, 5000] },
      ];
      expect(buildWhereClause(filters)).toEqual({
        enrollment: { gte: 500, lte: 5000 },
      });
    });

    it("works with decimal values", () => {
      const filters: FilterDef[] = [
        { column: "rate", op: "between", value: [0.1, 0.9] },
      ];
      expect(buildWhereClause(filters)).toEqual({
        rate: { gte: 0.1, lte: 0.9 },
      });
    });

    it("handles the same min and max", () => {
      const filters: FilterDef[] = [
        { column: "year", op: "between", value: [2025, 2025] },
      ];
      expect(buildWhereClause(filters)).toEqual({
        year: { gte: 2025, lte: 2025 },
      });
    });
  });

  describe("operator: is_true", () => {
    it("produces { [field]: true }", () => {
      const filters: FilterDef[] = [{ column: "isCustomer", op: "is_true" }];
      expect(buildWhereClause(filters)).toEqual({ isCustomer: true });
    });

    it("ignores any provided value", () => {
      const filters: FilterDef[] = [
        { column: "isCustomer", op: "is_true", value: "whatever" },
      ];
      expect(buildWhereClause(filters)).toEqual({ isCustomer: true });
    });
  });

  describe("operator: is_false", () => {
    it("produces { [field]: false }", () => {
      const filters: FilterDef[] = [{ column: "isActive", op: "is_false" }];
      expect(buildWhereClause(filters)).toEqual({ isActive: false });
    });
  });

  describe("operator: is_empty", () => {
    it("produces { [field]: null }", () => {
      const filters: FilterDef[] = [{ column: "notes", op: "is_empty" }];
      expect(buildWhereClause(filters)).toEqual({ notes: null });
    });
  });

  describe("operator: is_not_empty", () => {
    it("produces { [field]: { not: null } }", () => {
      const filters: FilterDef[] = [{ column: "notes", op: "is_not_empty" }];
      expect(buildWhereClause(filters)).toEqual({ notes: { not: null } });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Multiple filters combined                                         */
  /* ------------------------------------------------------------------ */

  describe("multiple filters", () => {
    it("combines multiple filters into a single where clause", () => {
      const filters: FilterDef[] = [
        { column: "state", op: "eq", value: "CA" },
        { column: "enrollment", op: "gte", value: 1000 },
        { column: "isCustomer", op: "is_true" },
      ];
      expect(buildWhereClause(filters)).toEqual({
        state: "CA",
        enrollment: { gte: 1000 },
        isCustomer: true,
      });
    });

    it("combines filters of different types on different fields", () => {
      const filters: FilterDef[] = [
        { column: "name", op: "contains", value: "Academy" },
        { column: "status", op: "neq", value: "inactive" },
        { column: "enrollment", op: "between", value: [100, 2000] },
        { column: "notes", op: "is_not_empty" },
      ];
      expect(buildWhereClause(filters)).toEqual({
        name: { contains: "Academy", mode: "insensitive" },
        status: { not: "inactive" },
        enrollment: { gte: 100, lte: 2000 },
        notes: { not: null },
      });
    });

    it("last filter wins when multiple filters target the same column", () => {
      const filters: FilterDef[] = [
        { column: "score", op: "gt", value: 50 },
        { column: "score", op: "lt", value: 90 },
      ];
      // The loop overwrites the same key, so the last one wins
      expect(buildWhereClause(filters)).toEqual({
        score: { lt: 90 },
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Empty filters array                                               */
  /* ------------------------------------------------------------------ */

  describe("empty filters", () => {
    it("returns an empty object for an empty filters array", () => {
      expect(buildWhereClause([])).toEqual({});
    });

    it("returns an empty object when fieldMap is provided but filters are empty", () => {
      expect(buildWhereClause([], DISTRICT_FIELD_MAP)).toEqual({});
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Field mapping behavior                                            */
  /* ------------------------------------------------------------------ */

  describe("fieldMap behavior", () => {
    it("maps column names via DISTRICT_FIELD_MAP", () => {
      const filters: FilterDef[] = [
        { column: "state", op: "eq", value: "TX" },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      // "state" maps to "stateAbbrev"
      expect(result).toEqual({ stateAbbrev: "TX" });
    });

    it("maps 'enrollment' to 'enrollment' (identity mapping)", () => {
      const filters: FilterDef[] = [
        { column: "enrollment", op: "gte", value: 5000 },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      expect(result).toEqual({ enrollment: { gte: 5000 } });
    });

    it("maps 'sped_percent' to 'swdPct'", () => {
      const filters: FilterDef[] = [
        { column: "sped_percent", op: "between", value: [0.05, 0.2] },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      expect(result).toEqual({ swdPct: { gte: 0.05, lte: 0.2 } });
    });

    it("maps 'urbanicity' to 'urbanCentricLocale'", () => {
      const filters: FilterDef[] = [
        { column: "urbanicity", op: "in", value: ["City", "Suburb"] },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      expect(result).toEqual({
        urbanCentricLocale: { in: ["City", "Suburb"] },
      });
    });

    it("maps 'fy25_closed_won_net_booking' to 'fy25ClosedWonNetBooking'", () => {
      const filters: FilterDef[] = [
        { column: "fy25_closed_won_net_booking", op: "gt", value: 10000 },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      expect(result).toEqual({ fy25ClosedWonNetBooking: { gt: 10000 } });
    });

    it("maps 'graduationRate' to 'graduationRateTotal'", () => {
      const filters: FilterDef[] = [
        { column: "graduationRate", op: "gte", value: 0.85 },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      expect(result).toEqual({ graduationRateTotal: { gte: 0.85 } });
    });

    it("silently skips unknown columns when fieldMap is provided", () => {
      const filters: FilterDef[] = [
        { column: "nonexistent_column", op: "eq", value: "hello" },
        { column: "state", op: "eq", value: "CA" },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      // "nonexistent_column" is not in the map, should be skipped
      expect(result).toEqual({ stateAbbrev: "CA" });
      expect(result).not.toHaveProperty("nonexistent_column");
    });

    it("skips all filters when all columns are unknown", () => {
      const filters: FilterDef[] = [
        { column: "bogus", op: "eq", value: 1 },
        { column: "fake_field", op: "gt", value: 100 },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      expect(result).toEqual({});
    });

    it("uses column directly as Prisma field when no fieldMap is provided", () => {
      const filters: FilterDef[] = [
        { column: "myCustomField", op: "eq", value: "hello" },
      ];
      const result = buildWhereClause(filters);
      expect(result).toEqual({ myCustomField: "hello" });
    });

    it("correctly maps multiple fields via DISTRICT_FIELD_MAP in one call", () => {
      const filters: FilterDef[] = [
        { column: "state", op: "in", value: ["CA", "NY"] },
        { column: "enrollment", op: "gte", value: 1000 },
        { column: "sped_percent", op: "lte", value: 0.15 },
        { column: "isCustomer", op: "is_true" },
        { column: "name", op: "contains", value: "Unified" },
      ];
      const result = buildWhereClause(filters, DISTRICT_FIELD_MAP);
      expect(result).toEqual({
        stateAbbrev: { in: ["CA", "NY"] },
        enrollment: { gte: 1000 },
        swdPct: { lte: 0.15 },
        isCustomer: true,
        name: { contains: "Unified", mode: "insensitive" },
      });
    });

    it("uses a custom fieldMap when provided", () => {
      const customMap: Record<string, string> = {
        externalName: "internalName",
      };
      const filters: FilterDef[] = [
        { column: "externalName", op: "eq", value: "test" },
      ];
      const result = buildWhereClause(filters, customMap);
      expect(result).toEqual({ internalName: "test" });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  PLANS_FIELD_MAP via buildWhereClause                              */
  /* ------------------------------------------------------------------ */

  describe("with PLANS_FIELD_MAP", () => {
    it("maps 'name' to 'name'", () => {
      const filters: FilterDef[] = [
        { column: "name", op: "contains", value: "Q1" },
      ];
      const result = buildWhereClause(filters, PLANS_FIELD_MAP);
      expect(result).toEqual({
        name: { contains: "Q1", mode: "insensitive" },
      });
    });

    it("maps 'status' to 'status'", () => {
      const filters: FilterDef[] = [
        { column: "status", op: "eq", value: "draft" },
      ];
      const result = buildWhereClause(filters, PLANS_FIELD_MAP);
      expect(result).toEqual({ status: "draft" });
    });

    it("maps 'districtCount' to 'districtCount'", () => {
      const filters: FilterDef[] = [
        { column: "districtCount", op: "gte", value: 10 },
      ];
      const result = buildWhereClause(filters, PLANS_FIELD_MAP);
      expect(result).toEqual({ districtCount: { gte: 10 } });
    });

    it("skips unknown columns via PLANS_FIELD_MAP", () => {
      const filters: FilterDef[] = [
        { column: "enrollment", op: "gt", value: 500 },
      ];
      // "enrollment" is in DISTRICT_FIELD_MAP, but NOT in PLANS_FIELD_MAP
      const result = buildWhereClause(filters, PLANS_FIELD_MAP);
      expect(result).toEqual({});
    });
  });
});

/* ------------------------------------------------------------------ */
/*  DISTRICT_FIELD_MAP shape                                          */
/* ------------------------------------------------------------------ */

describe("DISTRICT_FIELD_MAP", () => {
  it("is an object with string keys and string values", () => {
    for (const [key, value] of Object.entries(DISTRICT_FIELD_MAP)) {
      expect(typeof key).toBe("string");
      expect(typeof value).toBe("string");
    }
  });

  it("contains expected core mappings", () => {
    expect(DISTRICT_FIELD_MAP.state).toBe("stateAbbrev");
    expect(DISTRICT_FIELD_MAP.enrollment).toBe("enrollment");
    expect(DISTRICT_FIELD_MAP.sped_percent).toBe("swdPct");
    expect(DISTRICT_FIELD_MAP.name).toBe("name");
    expect(DISTRICT_FIELD_MAP.leaid).toBe("leaid");
  });

  it("contains revenue mappings", () => {
    expect(DISTRICT_FIELD_MAP.fy25_closed_won_net_booking).toBe("fy25ClosedWonNetBooking");
    expect(DISTRICT_FIELD_MAP.fy26_open_pipeline_value).toBe("fy26OpenPipeline");
    expect(DISTRICT_FIELD_MAP.fy27_open_pipeline_value).toBe("fy27OpenPipeline");
  });

  it("contains demographic mappings", () => {
    expect(DISTRICT_FIELD_MAP.ell_percent).toBe("ellPct");
    expect(DISTRICT_FIELD_MAP.free_lunch_percent).toBe("childrenPovertyPercent");
    expect(DISTRICT_FIELD_MAP.medianHouseholdIncome).toBe("medianHouseholdIncome");
  });

  it("contains trend mappings", () => {
    expect(DISTRICT_FIELD_MAP.enrollmentTrend3yr).toBe("enrollmentTrend3yr");
    expect(DISTRICT_FIELD_MAP.swdTrend3yr).toBe("swdTrend3yr");
    expect(DISTRICT_FIELD_MAP.vacancyPressureSignal).toBe("vacancyPressureSignal");
  });

  it("contains education outcome mappings", () => {
    expect(DISTRICT_FIELD_MAP.graduationRate).toBe("graduationRateTotal");
    expect(DISTRICT_FIELD_MAP.mathProficiency).toBe("mathProficiencyPct");
    expect(DISTRICT_FIELD_MAP.readProficiency).toBe("readProficiencyPct");
    expect(DISTRICT_FIELD_MAP.chronicAbsenteeismRate).toBe("chronicAbsenteeismRate");
  });

  it("contains finance mappings", () => {
    expect(DISTRICT_FIELD_MAP.totalRevenue).toBe("totalRevenue");
    expect(DISTRICT_FIELD_MAP.expenditurePerPupil).toBe("expenditurePerPupil");
    expect(DISTRICT_FIELD_MAP.techSpending).toBe("techSpending");
  });

  it("has more than 100 entries", () => {
    expect(Object.keys(DISTRICT_FIELD_MAP).length).toBeGreaterThan(100);
  });
});

/* ------------------------------------------------------------------ */
/*  PLANS_FIELD_MAP shape                                             */
/* ------------------------------------------------------------------ */

describe("PLANS_FIELD_MAP", () => {
  it("contains expected keys", () => {
    const expectedKeys = [
      "name",
      "status",
      "fiscalYear",
      "description",
      "color",
      "createdAt",
      "updatedAt",
      "districtCount",
      "stateCount",
      "renewalRollup",
      "expansionRollup",
      "winbackRollup",
      "newBusinessRollup",
    ];
    for (const key of expectedKeys) {
      expect(PLANS_FIELD_MAP).toHaveProperty(key);
    }
  });

  it("has 13 entries", () => {
    expect(Object.keys(PLANS_FIELD_MAP).length).toBe(13);
  });

  it("maps rollup columns correctly", () => {
    expect(PLANS_FIELD_MAP.renewalRollup).toBe("renewalRollup");
    expect(PLANS_FIELD_MAP.expansionRollup).toBe("expansionRollup");
    expect(PLANS_FIELD_MAP.winbackRollup).toBe("winbackRollup");
    expect(PLANS_FIELD_MAP.newBusinessRollup).toBe("newBusinessRollup");
  });
});
