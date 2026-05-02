import { describe, it, expect, vi } from "vitest";

const findManyMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const findUniqueMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  default: { savedReport: { findMany: findManyMock, create: createMock, findUnique: findUniqueMock, update: updateMock, delete: deleteMock } },
}));
vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: vi.fn(async () => ({ fields: [{ name: "a" }], rows: [{ a: 1 }], rowCount: 1 })),
  },
}));

// Reset + seed defaults before each test so mock return values don't leak.
import { beforeEach } from "vitest";
beforeEach(() => {
  findManyMock.mockReset();
  createMock.mockReset();
  findUniqueMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();

  findManyMock.mockResolvedValue([
    { id: 1, title: "A", question: "q", summary: null, updatedAt: new Date(), runCount: 0, lastRunAt: null, isTeamPinned: false },
  ]);
  createMock.mockImplementation(async ({ data }: { data: unknown }) => ({ id: 2, ...(data as object) }));
  findUniqueMock.mockImplementation(async ({ where }: { where: { id: number } }) => {
    if (where.id === 1) {
      return {
        id: 1,
        userId: "user-1",
        title: "A",
        question: "q",
        sql: "SELECT 1 LIMIT 100",
        summary: { source: "x" },
        runCount: 0,
      };
    }
    return null;
  });
  updateMock.mockImplementation(async ({ data }: { data: unknown }) => ({ id: 1, ...(data as object) }));
  deleteMock.mockResolvedValue({ id: 1 });
});

import { GET as listGet, POST as listPost } from "../route";
import { GET as detailGet, PATCH as detailPatch, DELETE as detailDelete } from "../[id]/route";
import { POST as runPost } from "../[id]/run/route";
import { NextRequest } from "next/server";

describe("saved reports CRUD", () => {
  it("GET / lists user's reports", async () => {
    const res = await listGet();
    const json = await res.json();
    expect(json.reports.length).toBe(1);
  });

  it("POST / creates a report", async () => {
    const req = new NextRequest("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({
        title: "New",
        question: "q",
        sql: "SELECT 1 LIMIT 100",
        summary: { source: "x" },
        conversationId: "c1",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await listPost(req);
    expect(res.status).toBe(201);
  });

  it("GET /:id returns a report", async () => {
    const res = await detailGet({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("PATCH /:id updates title", async () => {
    const req = new NextRequest("http://localhost/api/reports/1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Renamed" }),
      headers: { "content-type": "application/json" },
    });
    const res = await detailPatch(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("DELETE /:id deletes", async () => {
    const res = await detailDelete({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("POST /:id/run executes stored SQL (no Claude call)", async () => {
    const res = await runPost({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    const json = await res.json();
    expect(json.rows).toBeDefined();
    expect(json.sql).toBe("SELECT 1 LIMIT 100");
  });
});
