import { describe, it, expect } from "vitest";
import { extractFullmindFinancials, getFinancialValue } from "../financial-helpers";

const mockFinancials = [
  {
    fiscalYear: "FY25",
    vendor: "fullmind",
    totalRevenue: 50000,
    totalTake: 25000,
    sessionCount: 100,
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
    closedWonOppCount: 0,
    closedWonBookings: 0,
    invoicing: 0,
    openPipeline: 35000,
    openPipelineOppCount: 3,
    weightedPipeline: 28000,
  },
];

describe("extractFullmindFinancials", () => {
  it("extracts FY25 session fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy25SessionsRevenue).toBe(50000);
    expect(result.fy25SessionsTake).toBe(25000);
    expect(result.fy25SessionsCount).toBe(100);
  });

  it("extracts FY25 booking fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy25ClosedWonOppCount).toBe(3);
    expect(result.fy25ClosedWonNetBooking).toBe(45000);
    expect(result.fy25NetInvoicing).toBe(48000);
  });

  it("extracts FY26 session fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy26SessionsRevenue).toBe(60000);
    expect(result.fy26SessionsTake).toBe(30000);
    expect(result.fy26SessionsCount).toBe(120);
  });

  it("extracts FY26 booking fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy26ClosedWonOppCount).toBe(4);
    expect(result.fy26ClosedWonNetBooking).toBe(55000);
    expect(result.fy26NetInvoicing).toBe(58000);
  });

  it("extracts FY26 pipeline fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy26OpenPipeline).toBe(20000);
    expect(result.fy26OpenPipelineOppCount).toBe(2);
    expect(result.fy26OpenPipelineWeighted).toBe(15000);
  });

  it("extracts FY27 pipeline fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy27OpenPipeline).toBe(35000);
    expect(result.fy27OpenPipelineOppCount).toBe(3);
    expect(result.fy27OpenPipelineWeighted).toBe(28000);
  });

  it("returns zeros for empty array", () => {
    const result = extractFullmindFinancials([]);
    expect(result.fy25SessionsRevenue).toBe(0);
    expect(result.fy26OpenPipeline).toBe(0);
    expect(result.fy27OpenPipeline).toBe(0);
  });

  it("handles missing fiscal years gracefully", () => {
    const partial = [mockFinancials[1]]; // only FY26
    const result = extractFullmindFinancials(partial);
    expect(result.fy25SessionsRevenue).toBe(0);
    expect(result.fy26NetInvoicing).toBe(58000);
    expect(result.fy27OpenPipeline).toBe(0);
  });
});

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
