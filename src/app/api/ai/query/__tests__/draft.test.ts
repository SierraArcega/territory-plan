import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    reportDraft: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  GET as getDraft,
  PUT as putDraft,
  DELETE as deleteDraft,
} from "../draft/route";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/ai/query/draft", () => {
  it("GET 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await getDraft();
    expect(res.status).toBe(401);
  });

  it("GET 404 when user has no draft", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.reportDraft.findUnique.mockResolvedValue(null);
    const res = await getDraft();
    expect(res.status).toBe(404);
  });

  it("GET 200 when draft exists", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.reportDraft.findUnique.mockResolvedValue({
      userId: USER.id,
      params: { table: "districts" },
    });
    const res = await getDraft();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.params.table).toBe("districts");
  });

  it("PUT 400 when params missing", async () => {
    mockGetUser.mockResolvedValue(USER);
    const res = await putDraft(
      req("/api/ai/query/draft", { method: "PUT", body: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT 400 when params invalid", async () => {
    mockGetUser.mockResolvedValue(USER);
    const res = await putDraft(
      req("/api/ai/query/draft", {
        method: "PUT",
        body: { params: { table: "bogus_not_registered" } },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT 200 on valid upsert", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.reportDraft.upsert.mockResolvedValue({
      userId: USER.id,
      params: { table: "districts" },
    });
    const res = await putDraft(
      req("/api/ai/query/draft", {
        method: "PUT",
        body: { params: { table: "districts" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(p.reportDraft.upsert).toHaveBeenCalledOnce();
  });

  it("DELETE 204 on discard", async () => {
    mockGetUser.mockResolvedValue(USER);
    p.reportDraft.deleteMany.mockResolvedValue({ count: 1 });
    const res = await deleteDraft();
    expect(res.status).toBe(204);
  });

  it("DELETE 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await deleteDraft();
    expect(res.status).toBe(401);
  });
});
