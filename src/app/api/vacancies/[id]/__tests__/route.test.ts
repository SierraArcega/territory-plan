import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    vacancy: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET, PATCH } from "../route";

// ---------- helpers ----------

function makeRequest(
  url: string,
  options?: { method?: string; body?: unknown }
) {
  const init: RequestInit = { method: options?.method ?? "GET" };
  if (options?.body) {
    init.method = options.method ?? "PATCH";
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

const now = new Date("2026-03-18T12:00:00Z");

function makeVacancyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vac-1",
    title: "SPED Teacher",
    status: "open",
    category: "SPED",
    notes: null,
    datePosted: now,
    districtLeaid: "1234567",
    schoolNcessch: "123456700001",
    createdAt: now,
    updatedAt: now,
    district: {
      leaid: "1234567",
      name: "Test District",
      stateAbbrev: "CA",
      cityLocation: "Sacramento",
    },
    school: {
      ncessch: "123456700001",
      schoolName: "Test Elementary",
      lograde: "KG",
      higrade: "05",
    },
    ...overrides,
  };
}

// ---------- setup ----------

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// GET /api/vacancies/[id]
// ============================================================
describe("GET /api/vacancies/[id]", () => {
  const idParams = { params: Promise.resolve({ id: "vac-1" }) };

  it("returns vacancy with district and school data", async () => {
    const vacancy = makeVacancyRow();
    mockPrisma.vacancy.findUnique.mockResolvedValue(vacancy as never);

    const res = await GET(makeRequest("/api/vacancies/vac-1"), idParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("vac-1");
    expect(data.title).toBe("SPED Teacher");
    expect(data.districtName).toBe("Test District");
    expect(data.schoolName).toBe("Test Elementary");
  });

  it("returns 404 when vacancy not found", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("/api/vacancies/vac-999"), idParams);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Vacancy not found" });
  });

  it("includes district and school in the prisma query", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);

    await GET(makeRequest("/api/vacancies/vac-1"), idParams);

    expect(mockPrisma.vacancy.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vac-1" },
        include: expect.objectContaining({
          district: expect.any(Object),
          school: expect.any(Object),
        }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.vacancy.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeRequest("/api/vacancies/vac-1"), idParams);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch vacancy" });
  });
});

// ============================================================
// PATCH /api/vacancies/[id]
// ============================================================
describe("PATCH /api/vacancies/[id]", () => {
  const idParams = { params: Promise.resolve({ id: "vac-1" }) };

  it("returns 404 when vacancy not found", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { status: "closed" } }),
      idParams
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Vacancy not found" });
  });

  it("updates status successfully", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);
    const updated = makeVacancyRow({ status: "closed" });
    mockPrisma.vacancy.update.mockResolvedValue(updated as never);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { status: "closed" } }),
      idParams
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("closed");
    expect(mockPrisma.vacancy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vac-1" },
        data: expect.objectContaining({ status: "closed" }),
      })
    );
  });

  it("updates category successfully", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);
    const updated = makeVacancyRow({ category: "ELL" });
    mockPrisma.vacancy.update.mockResolvedValue(updated as never);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { category: "ELL" } }),
      idParams
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.category).toBe("ELL");
  });

  it("updates notes and trims whitespace", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);
    const updated = makeVacancyRow({ notes: "Some note" });
    mockPrisma.vacancy.update.mockResolvedValue(updated as never);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { notes: "  Some note  " } }),
      idParams
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.vacancy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: "Some note" }),
      })
    );
  });

  it("allows clearing category by setting null", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);
    const updated = makeVacancyRow({ category: null });
    mockPrisma.vacancy.update.mockResolvedValue(updated as never);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { category: null } }),
      idParams
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.vacancy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: null }),
      })
    );
  });

  it("returns 400 for invalid status", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { status: "invalid" } }),
      idParams
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("status must be one of");
  });

  it("returns 400 for invalid category", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { category: "NotReal" } }),
      idParams
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("category must be one of");
  });

  it("returns 400 for unexpected fields", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { title: "Hacked", status: "open" } }),
      idParams
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unexpected fields");
    expect(data.error).toContain("title");
  });

  it("returns 500 on database error during update", async () => {
    mockPrisma.vacancy.findUnique.mockResolvedValue(makeVacancyRow() as never);
    mockPrisma.vacancy.update.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(
      makeRequest("/api/vacancies/vac-1", { body: { status: "closed" } }),
      idParams
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to update vacancy" });
  });
});
