import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    vacancy: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET } from "../route";

function makeRequest(qs = "") {
  return new NextRequest(
    new URL(`/api/vacancies${qs}`, "http://localhost:3000"),
    { method: "GET" } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/vacancies", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("?leaid=0600001"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no leaid/leaids supplied", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid status", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    const res = await GET(makeRequest("?leaid=0600001&status=junk"));
    expect(res.status).toBe(400);
  });

  it("returns vacancies for a single leaid", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.vacancy.findMany.mockResolvedValue([
      {
        id: "v1",
        leaid: "0600001",
        scanId: "s1",
        fingerprint: "f1",
        status: "open",
        title: "Math Teacher",
        category: "General Ed",
        schoolNcessch: null,
        schoolName: null,
        hiringManager: null,
        hiringEmail: null,
        contactId: null,
        startDate: null,
        datePosted: new Date("2026-05-01"),
        fullmindRelevant: true,
        relevanceReason: null,
        sourceUrl: null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        district: { leaid: "0600001", name: "Test ISD", stateAbbrev: "CA" },
        school: null,
      },
    ]);

    const res = await GET(makeRequest("?leaid=0600001"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.vacancies).toHaveLength(1);
    expect(data.vacancies[0].districtName).toBe("Test ISD");
    expect(mockPrisma.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leaid: "0600001",
          status: "open",
        }),
      }),
    );
  });

  it("accepts multiple leaids via comma-separated leaids param", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.vacancy.findMany.mockResolvedValue([]);
    await GET(makeRequest("?leaids=0600001,0600002"));
    expect(mockPrisma.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leaid: { in: ["0600001", "0600002"] },
        }),
      }),
    );
  });

  it("filters by category when supplied", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.vacancy.findMany.mockResolvedValue([]);
    await GET(makeRequest("?leaid=0600001&category=SPED"));
    expect(mockPrisma.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "SPED" }),
      }),
    );
  });
});
