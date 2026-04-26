import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    savedReport: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userProfile: { findUnique: vi.fn() },
    queryLog: { create: vi.fn() },
    reportDraft: { upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET as listReports, POST as createReport } from "../reports/route";
import {
  GET as getReport,
  PATCH as patchReport,
  DELETE as deleteReport,
} from "../reports/[id]/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

function req(url: string, init?: { method?: string; body?: unknown }) {
  const r: RequestInit = { method: init?.method ?? "GET" };
  if (init?.body !== undefined) {
    r.method = init.method ?? "POST";
    r.body = JSON.stringify(init.body);
    r.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost"), r as never);
}

const USER = { id: "00000000-0000-0000-0000-000000000001", email: "u@x" };
const ADMIN = { id: "00000000-0000-0000-0000-0000000000ad", email: "a@x" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/ai/query/reports — list", () => {
  it("401 without user", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await listReports(req("/api/ai/query/reports"));
    expect(res.status).toBe(401);
  });

  it("filters by mine tab using user.id", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.savedReport.findMany.mockResolvedValue([]);
    await listReports(req("/api/ai/query/reports?tab=mine"));
    const args = p.savedReport.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: USER.id });
  });

  it("filters by team tab using isTeamPinned", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.savedReport.findMany.mockResolvedValue([]);
    await listReports(req("/api/ai/query/reports?tab=team"));
    const args = p.savedReport.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ isTeamPinned: true });
  });
});

describe("/api/ai/query/reports — create", () => {
  it("400 when title missing", async () => {
    mockGetUser.mockResolvedValue(USER);
    const res = await createReport(
      req("/api/ai/query/reports", {
        body: { params: { table: "districts" } },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when params missing", async () => {
    mockGetUser.mockResolvedValue(USER);
    const res = await createReport(
      req("/api/ai/query/reports", { body: { title: "X" } }),
    );
    expect(res.status).toBe(400);
  });

  it("201 on valid create", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.savedReport.create.mockResolvedValue({ id: 1, title: "OK" });
    const res = await createReport(
      req("/api/ai/query/reports", {
        body: { title: "OK", params: { table: "districts" } },
      }),
    );
    expect(res.status).toBe(201);
  });
});

describe("/api/ai/query/reports/[id] — patch", () => {
  it("403 when non-admin tries to pin", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.savedReport.findUnique.mockResolvedValue({
      id: 1,
      userId: USER.id,
      isTeamPinned: false,
    });
    p.userProfile.findUnique.mockResolvedValue({ id: USER.id, role: "rep" });
    const res = await patchReport(
      req("/api/ai/query/reports/1", {
        method: "PATCH",
        body: { isTeamPinned: true },
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("allows admin to pin", async () => {
    mockGetUser.mockResolvedValue(ADMIN);
    p.savedReport.findUnique.mockResolvedValue({
      id: 1,
      userId: USER.id,
      isTeamPinned: false,
    });
    p.userProfile.findUnique.mockResolvedValue({ id: ADMIN.id, role: "admin" });
    p.savedReport.update.mockResolvedValue({ id: 1, isTeamPinned: true });
    const res = await patchReport(
      req("/api/ai/query/reports/1", {
        method: "PATCH",
        body: { isTeamPinned: true },
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(200);
  });

  it("403 when non-owner non-admin edits title", async () => {
    mockGetUser.mockResolvedValue({ id: "someone-else", email: "x@y" });
    p.savedReport.findUnique.mockResolvedValue({
      id: 1,
      userId: USER.id,
      isTeamPinned: false,
    });
    p.userProfile.findUnique.mockResolvedValue({
      id: "someone-else",
      role: "rep",
    });
    const res = await patchReport(
      req("/api/ai/query/reports/1", {
        method: "PATCH",
        body: { title: "Renamed" },
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("/api/ai/query/reports/[id] — delete", () => {
  it("403 when non-owner non-admin", async () => {
    mockGetUser.mockResolvedValue({ id: "someone-else", email: "x@y" });
    p.savedReport.findUnique.mockResolvedValue({ userId: USER.id });
    p.userProfile.findUnique.mockResolvedValue({
      id: "someone-else",
      role: "rep",
    });
    const res = await deleteReport(
      req("/api/ai/query/reports/1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("204 on owner delete", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.savedReport.findUnique.mockResolvedValue({ userId: USER.id });
    p.userProfile.findUnique.mockResolvedValue({ id: USER.id, role: "rep" });
    p.savedReport.delete.mockResolvedValue({ id: 1 });
    const res = await deleteReport(
      req("/api/ai/query/reports/1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(204);
  });
});

describe("/api/ai/query/reports/[id] — get", () => {
  it("400 on non-numeric id", async () => {
    mockGetUser.mockResolvedValue(USER);
    const res = await getReport(req("/api/ai/query/reports/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("404 when report missing", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.savedReport.findUnique.mockResolvedValue(null);
    const res = await getReport(req("/api/ai/query/reports/99"), {
      params: Promise.resolve({ id: "99" }),
    });
    expect(res.status).toBe(404);
  });
});
