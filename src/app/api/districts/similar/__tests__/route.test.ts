import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

// Helper to create mock district
const createMockDistrict = (overrides: Partial<{
  leaid: string;
  name: string;
  stateAbbrev: string;
  enrollment: number;
  urbanCentricLocale: number;
  ellStudents: number;
  specEdStudents: number;
  educationData: object | null;
  enrollmentDemographics: object | null;
  territoryPlans: { planId: string }[];
}> = {}) => ({
  leaid: "1234567",
  name: "Test District",
  stateAbbrev: "CA",
  enrollment: 1000,
  urbanCentricLocale: 3,
  ellStudents: 100,
  specEdStudents: 150,
  educationData: {
    medianHouseholdIncome: 75000,
    expenditurePerPupil: 12000,
    salariesTotal: 5000000,
    staffTotalFte: 100,
  },
  enrollmentDemographics: {
    totalEnrollment: 1000,
    enrollmentWhite: 400,
  },
  territoryPlans: [],
  ...overrides,
});

describe("GET /api/districts/similar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when leaid is missing", async () => {
    const request = new NextRequest("http://localhost/api/districts/similar?metrics=enrollment");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("leaid");
  });

  it("returns 400 when metrics is missing", async () => {
    const request = new NextRequest("http://localhost/api/districts/similar?leaid=1234567");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("metrics");
  });

  it("returns 400 when more than 3 metrics requested", async () => {
    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1234567&metrics=enrollment,locale,medianIncome,avgSalary"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("1-3 metrics");
  });

  it("returns 404 when source district not found", async () => {
    mockPrisma.district.findUnique.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=invalid&metrics=enrollment"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("returns similar districts sorted by distance", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111", enrollment: 1000 });
    const similarDistrict = createMockDistrict({ leaid: "2222222", name: "Similar District", enrollment: 1100 });
    const lessSimilarDistrict = createMockDistrict({ leaid: "3333333", name: "Less Similar", enrollment: 1200 });

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue([similarDistrict, lessSimilarDistrict] as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment&tolerance=medium"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(2);
    // Closer match (1100 vs 1000 = 10% diff) should be first
    expect(data.results[0].leaid).toBe("2222222");
    // Further match (1200 vs 1000 = 20% diff) should be second
    expect(data.results[1].leaid).toBe("3333333");
  });

  it("excludes districts outside tolerance range", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111", enrollment: 1000 });
    const withinTolerance = createMockDistrict({ leaid: "2222222", enrollment: 1100 }); // 10% diff
    const outsideTolerance = createMockDistrict({ leaid: "3333333", enrollment: 2000 }); // 100% diff

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue([withinTolerance, outsideTolerance] as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment&tolerance=tight"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].leaid).toBe("2222222");
  });

  it("returns 400 when source district missing metric data", async () => {
    const sourceDistrict = createMockDistrict({
      leaid: "1111111",
      educationData: null, // Missing education data
    });

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=medianIncome"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("missing data");
  });

  it("includes territory plan IDs in results", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111" });
    const similarDistrict = createMockDistrict({
      leaid: "2222222",
      territoryPlans: [{ planId: "plan-1" }, { planId: "plan-2" }],
    });

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue([similarDistrict] as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment&tolerance=loose"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].territoryPlanIds).toEqual(["plan-1", "plan-2"]);
  });

  it("returns source metrics in response", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111", enrollment: 1000 });
    const similarDistrict = createMockDistrict({ leaid: "2222222", enrollment: 1050 });

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue([similarDistrict] as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sourceMetrics).toEqual({ enrollment: 1000 });
  });

  it("returns total count of matches (before limit)", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111", enrollment: 1000 });
    // Create 15 similar districts
    const similarDistricts = Array.from({ length: 15 }, (_, i) =>
      createMockDistrict({ leaid: `200000${i}`, enrollment: 1000 + (i * 10) })
    );

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue(similarDistricts as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment&tolerance=loose"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Results should be limited to 10
    expect(data.results).toHaveLength(10);
    // But total should show all matches
    expect(data.total).toBe(15);
  });
});
