import { describe, it, expect } from "vitest";
import { getFinancialValue, getFinancial, serializeFinancials } from "../financial-helpers";
import type { DistrictFinancial } from "@/features/shared/types/api-types";

const mockFinancials = [
  {
    fiscalYear: "FY25",
    vendor: "fullmind",
    totalRevenue: 50000,
    totalTake: 25000,
    sessionCount: 100,
    subscriptionCount: 0,
    closedWonOppCount: 3,
    closedWonBookings: 45000,
    invoicing: 48000,
    openPipeline: 0,
    openPipelineOppCount: 0,
    weightedPipeline: 0,
  },
  {
    fiscalYear: "FY26",
    vendor: "fullmind",
    totalRevenue: 60000,
    totalTake: 30000,
    sessionCount: 120,
    subscriptionCount: 0,
    closedWonOppCount: 4,
    closedWonBookings: 55000,
    invoicing: 58000,
    openPipeline: 20000,
    openPipelineOppCount: 2,
    weightedPipeline: 15000,
  },
  {
    fiscalYear: "FY27",
    vendor: "fullmind",
    totalRevenue: 0,
    totalTake: 0,
    sessionCount: 0,
    subscriptionCount: 0,
    closedWonOppCount: 0,
    closedWonBookings: 0,
    invoicing: 0,
    openPipeline: 35000,
    openPipelineOppCount: 3,
    weightedPipeline: 28000,
  },
];

describe("getFinancialValue", () => {
  it("returns value for matching vendor and FY", () => {
    expect(getFinancialValue(mockFinancials, "fullmind", "FY26", "openPipeline")).toBe(20000);
  });

  it("returns 0 for non-existent vendor", () => {
    expect(getFinancialValue(mockFinancials, "elevate", "FY26", "openPipeline")).toBe(0);
  });

  it("returns 0 for non-existent FY", () => {
    expect(getFinancialValue(mockFinancials, "fullmind", "FY28", "openPipeline")).toBe(0);
  });
});

const mockDistrictFinancials: DistrictFinancial[] = [
  {
    vendor: "fullmind",
    fiscalYear: "FY25",
    totalRevenue: 50000,
    allTake: 25000,
    sessionCount: 100,
    subscriptionCount: 0,
    closedWonOppCount: 3,
    closedWonBookings: 45000,
    invoicing: 48000,
    openPipelineOppCount: 0,
    openPipeline: 0,
    weightedPipeline: 0,
    poCount: null,
  },
  {
    vendor: "fullmind",
    fiscalYear: "FY26",
    totalRevenue: 60000,
    allTake: 30000,
    sessionCount: 120,
    subscriptionCount: 0,
    closedWonOppCount: 4,
    closedWonBookings: 55000,
    invoicing: 58000,
    openPipelineOppCount: 2,
    openPipeline: 20000,
    weightedPipeline: 15000,
    poCount: null,
  },
  {
    vendor: "fullmind",
    fiscalYear: "FY27",
    totalRevenue: null,
    allTake: null,
    sessionCount: null,
    subscriptionCount: null,
    closedWonOppCount: null,
    closedWonBookings: null,
    invoicing: null,
    openPipelineOppCount: 3,
    openPipeline: 35000,
    weightedPipeline: 28000,
    poCount: null,
  },
];

describe("getFinancial", () => {
  it("returns value for matching vendor and fiscal year", () => {
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY25", "totalRevenue")).toBe(50000);
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY25", "allTake")).toBe(25000);
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY25", "sessionCount")).toBe(100);
  });

  it("returns value for FY26 pipeline fields", () => {
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY26", "openPipeline")).toBe(20000);
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY26", "openPipelineOppCount")).toBe(2);
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY26", "weightedPipeline")).toBe(15000);
  });

  it("returns null when field is null", () => {
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY27", "totalRevenue")).toBeNull();
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY27", "allTake")).toBeNull();
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY27", "closedWonBookings")).toBeNull();
  });

  it("returns null for missing vendor/FY combination", () => {
    expect(getFinancial(mockDistrictFinancials, "elevate", "FY26", "openPipeline")).toBeNull();
    expect(getFinancial(mockDistrictFinancials, "fullmind", "FY28", "openPipeline")).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(getFinancial([], "fullmind", "FY26", "openPipeline")).toBeNull();
  });
});

describe("serializeFinancials", () => {
  it("converts Prisma Decimal-like objects to plain numbers", () => {
    const prismaRecords = [
      {
        vendor: "fullmind",
        fiscalYear: "FY26",
        totalRevenue: { toNumber: () => 142500 },
        totalTake: { toNumber: () => 71250 },
        sessionCount: 285,
        closedWonOppCount: 5,
        closedWonBookings: { toNumber: () => 130000 },
        invoicing: { toNumber: () => 125000 },
        openPipelineOppCount: 3,
        openPipeline: { toNumber: () => 80000 },
        weightedPipeline: { toNumber: () => 60000 },
        poCount: 2,
      },
    ];

    const result = serializeFinancials(prismaRecords);
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.vendor).toBe("fullmind");
    expect(r.fiscalYear).toBe("FY26");
    expect(r.totalRevenue).toBe(142500);
    expect(r.allTake).toBe(71250);
    expect(r.sessionCount).toBe(285);
    expect(r.closedWonOppCount).toBe(5);
    expect(r.closedWonBookings).toBe(130000);
    expect(r.invoicing).toBe(125000);
    expect(r.openPipelineOppCount).toBe(3);
    expect(r.openPipeline).toBe(80000);
    expect(r.weightedPipeline).toBe(60000);
    expect(r.poCount).toBe(2);
  });

  it("handles null values correctly (null stays null, not 0)", () => {
    const prismaRecords = [
      {
        vendor: "fullmind",
        fiscalYear: "FY27",
        totalRevenue: null,
        totalTake: null,
        sessionCount: null,
        closedWonOppCount: null,
        closedWonBookings: null,
        invoicing: null,
        openPipelineOppCount: null,
        openPipeline: null,
        weightedPipeline: null,
        poCount: null,
      },
    ];

    const result = serializeFinancials(prismaRecords);
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.totalRevenue).toBeNull();
    expect(r.allTake).toBeNull();
    expect(r.sessionCount).toBeNull();
    expect(r.closedWonOppCount).toBeNull();
    expect(r.closedWonBookings).toBeNull();
    expect(r.invoicing).toBeNull();
    expect(r.openPipelineOppCount).toBeNull();
    expect(r.openPipeline).toBeNull();
    expect(r.weightedPipeline).toBeNull();
    expect(r.poCount).toBeNull();
  });

  it("returns empty array for empty input", () => {
    expect(serializeFinancials([])).toEqual([]);
  });
});
