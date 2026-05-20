import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.hoisted(() => vi.fn(async () => ({ id: "user-1" })));
const upsertMock = vi.hoisted(() => vi.fn());
const findUniqueMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ getUser: getUserMock }));
vi.mock("@/lib/prisma", () => ({
  default: {
    reportDraft: {
      upsert: upsertMock,
      findUnique: findUniqueMock,
      delete: deleteMock,
    },
  },
}));

import { GET, PUT, DELETE } from "../route";

function makeReq(method: string, body?: object, search?: string): NextRequest {
  const url = new URL(`http://localhost/api/reports/draft${search ?? ""}`);
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  upsertMock.mockReset();
  findUniqueMock.mockReset();
  deleteMock.mockReset();
  getUserMock.mockResolvedValue({ id: "user-1" });
});

describe("GET /api/reports/draft", () => {
  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue(null);
    const res = await GET(makeReq("GET", undefined, "?reportId=0"));
    expect(res.status).toBe(401);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null draft when none exists", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await GET(makeReq("GET", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ draft: null });
  });

  it("returns draft when found", async () => {
    const draft = {
      userId: "user-1",
      reportId: 0,
      params: { sql: "SELECT 1" },
      conversationId: null,
      chatHistory: [],
      lastTouchedAt: new Date("2026-05-19T10:00:00Z"),
      createdAt: new Date("2026-05-19T09:00:00Z"),
    };
    findUniqueMock.mockResolvedValue(draft);
    const res = await GET(makeReq("GET", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft).toMatchObject({
      userId: "user-1",
      reportId: 0,
      lastTouchedAt: "2026-05-19T10:00:00.000Z",
    });
  });
});

describe("PUT /api/reports/draft", () => {
  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue(null);
    const res = await PUT(
      makeReq("PUT", { reportId: 0, params: {}, chatHistory: [] }),
    );
    expect(res.status).toBe(401);
  });

  it("upserts and returns 200", async () => {
    upsertMock.mockResolvedValue({ userId: "user-1", reportId: 0 });
    const res = await PUT(
      makeReq("PUT", {
        reportId: 0,
        params: { sql: "SELECT 1", summary: {}, columns: [], rows: [], rowCount: 0, executionTimeMs: 100, n: 1, createdAt: 0 },
        conversationId: "conv-abc",
        chatHistory: [{ id: "t1", userMessage: "show me districts" }],
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_reportId: { userId: "user-1", reportId: 0 } },
        create: expect.objectContaining({ userId: "user-1", reportId: 0 }),
        update: expect.objectContaining({ conversationId: "conv-abc" }),
      }),
    );
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});

describe("DELETE /api/reports/draft", () => {
  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE", undefined, "?reportId=0"));
    expect(res.status).toBe(401);
  });

  it("deletes the draft and returns 200", async () => {
    deleteMock.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { userId_reportId: { userId: "user-1", reportId: 0 } },
    });
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("returns 200 even if draft did not exist (idempotent)", async () => {
    deleteMock.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "P2025" }),
    );
    const res = await DELETE(makeReq("DELETE", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
  });
});
