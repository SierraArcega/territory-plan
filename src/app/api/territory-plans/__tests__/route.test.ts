import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock supabase server - routes call getUser()
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

// Mock auto-tags and rollup-sync (used by district routes)
vi.mock("@/features/shared/lib/auto-tags", () => ({
  syncClassificationTagsForDistrict: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/plans/lib/rollup-sync", () => ({
  syncPlanRollups: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/explore/lib/filters", () => ({
  buildWhereClause: vi.fn().mockReturnValue({}),
  DISTRICT_FIELD_MAP: {},
}));

// Mock Prisma - must be hoisted, so define mock object inline
const mockTransaction = vi.fn();
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
      upsert: vi.fn(),
    },
    territoryPlanDistrictService: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    district: {
      findMany: vi.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
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
import { getUser } from "@/lib/supabase/server";

// Get typed mocks
const mockPrisma = vi.mocked(prisma);
const mockGetUser = vi.mocked(getUser);

describe("Territory Plans API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
  });

  describe("GET /api/territory-plans", () => {
    it("returns list of plans with district counts", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          name: "Test Plan",
          description: "A test plan",
          color: "#403770",
          status: "working",
          fiscalYear: 2026,
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-12-31"),
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-15"),
          _count: { districts: 5 },
          districts: [
            { district: { enrollment: 500, stateAbbrev: "CA" } },
            { district: { enrollment: 300, stateAbbrev: "CA" } },
          ],
          taskLinks: [
            { task: { status: "done" } },
            { task: { status: "open" } },
          ],
          ownerUser: { id: "user-1", fullName: "John", avatarUrl: null },
          states: [{ state: { fips: "06", abbrev: "CA", name: "California" } }],
          collaborators: [],
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
      expect(data[0].totalEnrollment).toBe(800);
      expect(data[0].taskCount).toBe(2);
      expect(data[0].completedTaskCount).toBe(1);
      expect(data[0].owner).toEqual({ id: "user-1", fullName: "John", avatarUrl: null });
    });

    it("returns empty array when no plans exist", async () => {
      mockPrisma.territoryPlan.findMany.mockResolvedValue([]);

      const response = await listPlans();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue(null as never);

      const response = await listPlans();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication");
    });
  });

  describe("POST /api/territory-plans", () => {
    it("creates a new plan with required fields", async () => {
      const mockPlan = {
        id: "new-plan-id",
        name: "New Plan",
        description: null,
        color: "#403770",
        status: "planning",
        fiscalYear: 2026,
        startDate: null,
        endDate: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ownerUser: null,
        states: [],
        collaborators: [],
      };

      mockPrisma.territoryPlan.create.mockResolvedValue(mockPlan as never);

      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "New Plan", fiscalYear: 2026 }),
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
        color: "#F37167",
        status: "planning",
        fiscalYear: 2026,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ownerUser: null,
        states: [],
        collaborators: [],
      };

      mockPrisma.territoryPlan.create.mockResolvedValue(mockPlan as never);

      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({
          name: "Full Plan",
          description: "With description",
          color: "#F37167",
          status: "planning",
          fiscalYear: 2026,
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
        body: JSON.stringify({ fiscalYear: 2026 }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("name");
    });

    it("returns 400 when fiscalYear is missing", async () => {
      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "Plan" }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("fiscalYear");
    });

    it("returns 400 for invalid color format", async () => {
      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "Plan", fiscalYear: 2026, color: "red" }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("color");
    });

    it("returns 400 for invalid status", async () => {
      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "Plan", fiscalYear: 2026, status: "invalid" }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
    });

    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue(null as never);

      const request = new NextRequest("http://localhost/api/territory-plans", {
        method: "POST",
        body: JSON.stringify({ name: "Plan", fiscalYear: 2026 }),
      });

      const response = await createPlan(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication");
    });
  });

  describe("GET /api/territory-plans/[id]", () => {
    it("returns plan with districts", async () => {
      const mockPlan = {
        id: "plan-1",
        name: "Test Plan",
        description: null,
        color: "#403770",
        status: "working",
        fiscalYear: 2026,
        startDate: null,
        endDate: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
        ownerUser: null,
        states: [],
        collaborators: [],
        districts: [
          {
            districtLeaid: "1234567",
            addedAt: new Date("2024-01-10"),
            renewalTarget: null,
            winbackTarget: null,
            expansionTarget: null,
            newBusinessTarget: null,
            notes: null,
            district: {
              name: "Test District",
              stateAbbrev: "CA",
              enrollment: 1000,
              owner: null,
              districtTags: [],
            },
            targetServices: [],
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
      expect(data.districts[0].name).toBe("Test District");
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
      // PUT now uses $transaction - mock accordingly
      const updatedPlan = {
        id: "plan-1",
        name: "Updated Name",
        description: "Updated desc",
        color: "#403770",
        status: "working",
        fiscalYear: 2026,
        startDate: null,
        endDate: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-20"),
        _count: { districts: 3 },
        ownerUser: null,
        states: [],
        collaborators: [],
      };

      mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" } as never);
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          territoryPlan: {
            update: vi.fn().mockResolvedValue(updatedPlan),
            findUniqueOrThrow: vi.fn().mockResolvedValue(updatedPlan),
          },
          territoryPlanState: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          territoryPlanCollaborator: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        };
        return fn(tx);
      });

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
      mockPrisma.district.findMany.mockResolvedValue([{ leaid: "1234567" }] as never);

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
