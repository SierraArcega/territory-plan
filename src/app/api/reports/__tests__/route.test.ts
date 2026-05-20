import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const findUniqueMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const userProfileFindUniqueMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn(async () => ({ id: "user-1" })));
const readonlyQueryMock = vi.hoisted(() =>
  vi.fn(async () => ({ fields: [{ name: "a" }], rows: [{ a: 1 }, { a: 2 }], rowCount: 2 })),
);

vi.mock("@/lib/prisma", () => ({
  default: {
    savedReport: {
      findMany: findManyMock,
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
    userProfile: { findUnique: userProfileFindUniqueMock },
  },
}));
vi.mock("@/lib/supabase/server", () => ({ getUser: getUserMock }));
vi.mock("@/lib/db-readonly", () => ({ readonlyPool: { query: readonlyQueryMock } }));

// Default report row used across detail/run tests. user-1 is the owner.
const baseReport = {
  id: 1,
  userId: "user-1",
  title: "A",
  description: null,
  question: "q",
  sql: "SELECT 1 LIMIT 100",
  summary: { source: "x" },
  runCount: 0,
  lastRunAt: null,
  rowCount: null,
  isTeamPinned: false,
  pinnedBy: null,
  updatedAt: new Date("2026-05-01T00:00:00Z"),
};

beforeEach(() => {
  findManyMock.mockReset();
  createMock.mockReset();
  findUniqueMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  userProfileFindUniqueMock.mockReset();
  getUserMock.mockReset();
  readonlyQueryMock.mockReset();

  getUserMock.mockResolvedValue({ id: "user-1" });
  readonlyQueryMock.mockResolvedValue({
    fields: [{ name: "a" }],
    rows: [{ a: 1 }, { a: 2 }],
    rowCount: 2,
  });

  findManyMock.mockResolvedValue([
    {
      id: 1,
      title: "Mine recent",
      description: null,
      question: "q1",
      lastRunAt: new Date("2026-05-02T10:00:00Z"),
      runCount: 3,
      rowCount: 12,
      isTeamPinned: false,
      updatedAt: new Date("2026-05-02T10:00:00Z"),
      userId: "user-1",
      user: { id: "user-1", fullName: "Me", avatarUrl: null },
    },
    {
      id: 2,
      title: "Pinned by admin",
      description: "team-wide",
      question: "q2",
      lastRunAt: new Date("2026-05-01T10:00:00Z"),
      runCount: 7,
      rowCount: 200,
      isTeamPinned: true,
      updatedAt: new Date("2026-05-01T10:00:00Z"),
      userId: "user-2",
      user: { id: "user-2", fullName: "Other Person", avatarUrl: "https://x/a.png" },
    },
    {
      id: 3,
      title: "Team report",
      description: null,
      question: "q3",
      lastRunAt: null,
      runCount: 0,
      rowCount: null,
      isTeamPinned: false,
      updatedAt: new Date("2026-04-30T10:00:00Z"),
      userId: "user-3",
      user: { id: "user-3", fullName: "Coworker", avatarUrl: null },
    },
  ]);
  createMock.mockImplementation(async ({ data }: { data: unknown }) => ({ id: 99, ...(data as object) }));
  findUniqueMock.mockImplementation(async ({ where }: { where: { id: number } }) => {
    if (where.id === 1) return { ...baseReport };
    return null;
  });
  updateMock.mockImplementation(async ({ data, where }: { data: object; where: { id: number } }) => ({
    ...baseReport,
    ...(data as object),
    id: where.id,
  }));
  deleteMock.mockResolvedValue({ id: 1 });

  // Default to non-admin caller; specific tests override.
  userProfileFindUniqueMock.mockResolvedValue({ role: "rep" });
});

import { GET as listGet, POST as listPost } from "../route";
import { GET as detailGet, PATCH as detailPatch, DELETE as detailDelete } from "../[id]/route";
import { POST as runPost } from "../[id]/run/route";
import { NextRequest } from "next/server";

describe("saved reports library + CRUD", () => {
  it("GET / returns three groups partitioned correctly", async () => {
    const res = await listGet();
    const json = await res.json();
    expect(json.mine.map((r: { id: number }) => r.id)).toEqual([1]);
    expect(json.starred.map((r: { id: number }) => r.id)).toEqual([2]);
    expect(json.team.map((r: { id: number }) => r.id)).toEqual([3]);
  });

  it("GET / populates owner on team/starred (when not self) and null on mine", async () => {
    const res = await listGet();
    const json = await res.json();
    expect(json.mine[0].owner).toBeNull();
    expect(json.starred[0].owner).toEqual({
      id: "user-2",
      fullName: "Other Person",
      avatarUrl: "https://x/a.png",
    });
    expect(json.team[0].owner).toEqual({ id: "user-3", fullName: "Coworker", avatarUrl: null });
  });

  it("GET / requests sort lastRunAt DESC NULLS LAST then updatedAt DESC", async () => {
    await listGet();
    const args = findManyMock.mock.calls[0][0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([
      { lastRunAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ]);
  });

  it("POST / creates a report and accepts description passthrough", async () => {
    const req = new NextRequest("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({
        title: "New",
        question: "q",
        sql: "SELECT 1 LIMIT 100",
        summary: { source: "x" },
        description: "why this report exists",
        conversationId: "c1",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await listPost(req);
    expect(res.status).toBe(201);
    const created = createMock.mock.calls[0][0] as { data: { description: string | null } };
    expect(created.data.description).toBe("why this report exists");
  });

  it("GET /:id succeeds for a non-owner", async () => {
    getUserMock.mockResolvedValue({ id: "stranger-1" });
    const res = await detailGet({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("PATCH /:id { isTeamPinned: true } from admin sets pinnedBy", async () => {
    getUserMock.mockResolvedValue({ id: "admin-1" });
    userProfileFindUniqueMock.mockResolvedValue({ role: "admin" });
    const req = new NextRequest("http://localhost/api/reports/1", {
      method: "PATCH",
      body: JSON.stringify({ isTeamPinned: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await detailPatch(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const patchedData = updateMock.mock.calls[0][0].data as {
      isTeamPinned: boolean;
      pinnedBy: string | null;
    };
    expect(patchedData.isTeamPinned).toBe(true);
    expect(patchedData.pinnedBy).toBe("admin-1");
  });

  it("PATCH /:id { isTeamPinned: true } from non-admin returns 403", async () => {
    getUserMock.mockResolvedValue({ id: "rep-1" });
    userProfileFindUniqueMock.mockResolvedValue({ role: "rep" });
    const req = new NextRequest("http://localhost/api/reports/1", {
      method: "PATCH",
      body: JSON.stringify({ isTeamPinned: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await detailPatch(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH /:id { isTeamPinned: false } from admin clears pinnedBy", async () => {
    getUserMock.mockResolvedValue({ id: "admin-1" });
    userProfileFindUniqueMock.mockResolvedValue({ role: "admin" });
    const req = new NextRequest("http://localhost/api/reports/1", {
      method: "PATCH",
      body: JSON.stringify({ isTeamPinned: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await detailPatch(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const patchedData = updateMock.mock.calls[0][0].data as {
      isTeamPinned: boolean;
      pinnedBy: string | null;
    };
    expect(patchedData.isTeamPinned).toBe(false);
    expect(patchedData.pinnedBy).toBeNull();
  });

  it("PATCH /:id { title: 'X' } from non-owner returns 403", async () => {
    getUserMock.mockResolvedValue({ id: "stranger-1" });
    userProfileFindUniqueMock.mockResolvedValue({ role: "rep" });
    const req = new NextRequest("http://localhost/api/reports/1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Renamed" }),
      headers: { "content-type": "application/json" },
    });
    const res = await detailPatch(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH /:id { description } from owner succeeds", async () => {
    const req = new NextRequest("http://localhost/api/reports/1", {
      method: "PATCH",
      body: JSON.stringify({ description: "a new description" }),
      headers: { "content-type": "application/json" },
    });
    const res = await detailPatch(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const patchedData = updateMock.mock.calls[0][0].data as { description: string };
    expect(patchedData.description).toBe("a new description");
  });

  it("PATCH /:id { title } from owner still updates", async () => {
    const req = new NextRequest("http://localhost/api/reports/1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Renamed" }),
      headers: { "content-type": "application/json" },
    });
    const res = await detailPatch(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("DELETE /:id from owner succeeds", async () => {
    const res = await detailDelete({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("DELETE /:id from non-owner returns 403", async () => {
    getUserMock.mockResolvedValue({ id: "stranger-1" });
    const res = await detailDelete({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("POST /:id/run from non-owner succeeds (any authed user can rerun)", async () => {
    getUserMock.mockResolvedValue({ id: "stranger-1" });
    const res = await runPost({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rows).toBeDefined();
    expect(json.sql).toBe("SELECT 1 LIMIT 100");
  });

  it("POST /:id/run increments runCount and persists rowCount", async () => {
    const res = await runPost({} as NextRequest, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const updateArgs = updateMock.mock.calls[0][0].data as {
      runCount: { increment: number };
      lastRunAt: Date;
      rowCount: number;
    };
    expect(updateArgs.runCount).toEqual({ increment: 1 });
    expect(updateArgs.lastRunAt).toBeInstanceOf(Date);
    expect(updateArgs.rowCount).toBe(2);
  });
});
