import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma - must be hoisted, so define mock object inline
vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    territoryPlanDistrict: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    district: {
      findMany: vi.fn(),
    },
  },
}));

// Import handlers after mocking
import { GET as listPlans, POST as createPlan } from "../route";
import {
  GET as getPlan,
  PUT as updatePlan,
  DELETE as deletePlan,
} from "../[id]/route";
import { POST as addDistricts } from "../[id]/districts/route";
import { DELETE as removeDistrict } from "../[id]/districts/[leaid]/route";
import prisma from "@/lib/prisma";

// Get typed mock
const mockPrisma = vi.mocked(prisma);

describe("Territory Plans API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/territory-plans", () => {
    it("returns list of plans with district counts", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          name: "Test Plan",
          description: "A test plan",
          owner: "John",
          color: "#403770",
          status: "working",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-12-31"),
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-15"),
          _count: { districts: 5 },
        },
      ];

      mockPrisma.territoryPlan.findMany.mockResolvedValue(mockPlans as never);

      const response = await listPlans();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("plan-1");
      expect(data[0].name).toBe("Test Plan");
      expect(data[0].districtCount).toBe(5);
    });

    it("returns empty array when no plans exist", async () => {
      mockPrisma.territoryPlan.findMany.mockResolvedValue([]);

      const response = await listPlans();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe("POST /api/territory-plans", () => {
    it("creates a new plan with required fields", async () => {
      const mockPlan = {
        id: "new-plan-id",
        name: "New Plan",
        description: null,
        owner: null,
        color: "#403770",
        status: "working",
        startDate: null,
        endDate: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockPrisma.territoryPlan.create.mockResolvedValue(mockPlan as never);

      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "New Plan" }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe("New Plan");
      expect(data.districtCount).toBe(0);
    });

    it("creates a plan with all optional fields", async () => {
      const mockPlan = {
        id: "new-plan-id",
        name: "Full Plan",
        description: "With description",
        owner: "John",
        color: "#F37167",
        status: "planning",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockPrisma.territoryPlan.create.mockResolvedValue(mockPlan as never);

      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({
          name: "Full Plan",
          description: "With description",
          owner: "John",
          color: "#F37167",
          status: "planning",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.description).toBe("With description");
      expect(data.color).toBe("#F37167");
      expect(data.status).toBe("planning");
    });

    it("returns 400 when name is missing", async () => {
      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("name");
    });

    it("returns 400 for invalid color format", async () => {
      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "Plan", color: "red" }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("color");
    });

    it("returns 400 for invalid status", async () => {
      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "Plan", status: "invalid" }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
    });
  });

  describe("GET /api/territory-plans/[id]", () => {
    it("returns plan with districts", async () => {
      const mockPlan = {
        id: "plan-1",
        name: "Test Plan",
        description: null,
        owner: null,
        color: "#403770",
        status: "working",
        startDate: null,
        endDate: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
        districts: [
          {
            districtLeaid: "1234567",
            addedAt: new Date("2024-01-10"),
            district: {
              name: "Test District",
              stateAbbrev: "CA",
              enrollment: 1000,
              fullmindData: {
                isCustomer: true,
                hasOpenPipeline: false,
              },
            },
          },
        ],
      };

      mockPrisma.territoryPlan.findUnique.mockResolvedValue(mockPlan as never);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1"
      );
      const response = await getPlan(request, {
        params: Promise.resolve({ id: "plan-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("plan-1");
      expect(data.districts).toHaveLength(1);
      expect(data.districts[0].leaid).toBe("1234567");
      expect(data.districts[0].isCustomer).toBe(true);
    });

    it("returns 404 when plan not found", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/nonexistent"
      );
      const response = await getPlan(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  describe("PUT /api/territory-plans/[id]", () => {
    it("updates plan metadata", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" } as never);
      mockPrisma.territoryPlan.update.mockResolvedValue({
        id: "plan-1",
        name: "Updated Name",
        description: "Updated desc",
        owner: null,
        color: "#403770",
        status: "working",
        startDate: null,
        endDate: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-20"),
        _count: { districts: 3 },
      } as never);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1",
        {
          method: "PUT",
          body: JSON.stringify({ name: "Updated Name", description: "Updated desc" }),
        }
      );

      const response = await updatePlan(request, {
        params: Promise.resolve({ id: "plan-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Updated Name");
      expect(data.description).toBe("Updated desc");
    });

    it("returns 404 when plan not found", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/nonexistent",
        {
          method: "PUT",
          body: JSON.stringify({ name: "New Name" }),
        }
      );

      const response = await updatePlan(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/territory-plans/[id]", () => {
    it("deletes a plan", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" } as never);
      mockPrisma.territoryPlan.delete.mockResolvedValue({ id: "plan-1" } as never);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1",
        { method: "DELETE" }
      );

      const response = await deletePlan(request, {
        params: Promise.resolve({ id: "plan-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("returns 404 when plan not found", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/nonexistent",
        { method: "DELETE" }
      );

      const response = await deletePlan(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/territory-plans/[id]/districts", () => {
    it("adds a single district to plan", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" } as never);
      mockPrisma.district.findMany.mockResolvedValue([{ leaid: "1234567" }] as never);
      mockPrisma.territoryPlanDistrict.createMany.mockResolvedValue({
        count: 1,
      });

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1/districts",
        {
          method: "POST",
          body: JSON.stringify({ leaids: "1234567" }),
        }
      );

      const response = await addDistricts(request, {
        params: Promise.resolve({ id: "plan-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.added).toBe(1);
    });

    it("adds multiple districts to plan", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" } as never);
      mockPrisma.district.findMany.mockResolvedValue([
        { leaid: "1234567" },
        { leaid: "2345678" },
        { leaid: "3456789" },
      ] as never);
      mockPrisma.territoryPlanDistrict.createMany.mockResolvedValue({
        count: 3,
      });

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1/districts",
        {
          method: "POST",
          body: JSON.stringify({
            leaids: ["1234567", "2345678", "3456789"],
          }),
        }
      );

      const response = await addDistricts(request, {
        params: Promise.resolve({ id: "plan-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.added).toBe(3);
    });

    it("returns 404 when plan not found", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/nonexistent/districts",
        {
          method: "POST",
          body: JSON.stringify({ leaids: "1234567" }),
        }
      );

      const response = await addDistricts(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      });

      expect(response.status).toBe(404);
    });

    it("returns 400 when district not found", async () => {
      mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" } as never);
      mockPrisma.district.findMany.mockResolvedValue([]); // No districts found

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1/districts",
        {
          method: "POST",
          body: JSON.stringify({ leaids: "invalid" }),
        }
      );

      const response = await addDistricts(request, {
        params: Promise.resolve({ id: "plan-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("not found");
    });
  });

  describe("DELETE /api/territory-plans/[id]/districts/[leaid]", () => {
    it("removes district from plan", async () => {
      mockPrisma.territoryPlanDistrict.findUnique.mockResolvedValue({
        planId: "plan-1",
        districtLeaid: "1234567",
      } as never);
      mockPrisma.territoryPlanDistrict.delete.mockResolvedValue({} as never);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1/districts/1234567",
        { method: "DELETE" }
      );

      const response = await removeDistrict(request, {
        params: Promise.resolve({ id: "plan-1", leaid: "1234567" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("returns 404 when district not in plan", async () => {
      mockPrisma.territoryPlanDistrict.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/territory-plans/plan-1/districts/invalid",
        { method: "DELETE" }
      );

      const response = await removeDistrict(request, {
        params: Promise.resolve({ id: "plan-1", leaid: "invalid" }),
      });

      expect(response.status).toBe(404);
    });
  });
});
