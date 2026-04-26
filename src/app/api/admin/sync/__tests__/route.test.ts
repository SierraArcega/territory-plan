import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getAdminUser: vi.fn(),
}));

import pool from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/server";

const mockPool = vi.mocked(pool) as unknown as {
  connect: ReturnType<typeof vi.fn>;
};
const mockGetAdminUser = vi.mocked(getAdminUser);

import { GET } from "../route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

function makeMockClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdminUser.mockResolvedValue({ id: "u1" } as never);
});

describe("GET /api/admin/sync (unified)", () => {
  it("returns 403 when not admin", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/admin/sync"));
    expect(res.status).toBe(403);
  });

  it("merges DRL and NIR rows sorted by startedAt desc", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    client.query
      // drl rows
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            data_source: "nces",
            status: "success",
            records_updated: 100,
            records_failed: 0,
            error_message: null,
            started_at: new Date("2026-04-22T10:00:00Z"),
            completed_at: new Date("2026-04-22T10:05:00Z"),
          },
        ],
      })
      // nir rows
      .mockResolvedValueOnce({
        rows: [
          {
            id: "run1",
            layer: "daily",
            status: "ok",
            started_at: new Date("2026-04-22T11:00:00Z"),
            finished_at: new Date("2026-04-22T11:05:00Z"),
            articles_new: 50,
            articles_dup: 5,
            districts_processed: 200,
            llm_calls: 20,
            error: null,
          },
        ],
      })
      // total counts
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      // distinct sources
      .mockResolvedValueOnce({ rows: [{ data_source: "nces" }] })
      .mockResolvedValueOnce({ rows: [{ layer: "daily" }] });

    const res = await GET(makeRequest("/api/admin/sync?page=1&page_size=10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe("nir:run1"); // newer started_at first
    expect(body.items[1].id).toBe("drl:1");
    expect(body.pagination.total).toBe(2);
    expect(body.sources).toContain("nces");
    expect(body.sources).toContain("news:daily");
  });

  it("news rows have detail block; DRL rows do not", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            data_source: "nces",
            status: "success",
            records_updated: 100,
            records_failed: 0,
            error_message: null,
            started_at: new Date("2026-04-22T10:00:00Z"),
            completed_at: new Date("2026-04-22T10:05:00Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "run1",
            layer: "daily",
            status: "ok",
            started_at: new Date("2026-04-22T11:00:00Z"),
            finished_at: new Date("2026-04-22T11:05:00Z"),
            articles_new: 50,
            articles_dup: 5,
            districts_processed: 200,
            llm_calls: 20,
            error: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(makeRequest("/api/admin/sync"));
    const body = await res.json();

    const newsRow = body.items.find((r: { id: string }) => r.id.startsWith("nir:"));
    const drlRow = body.items.find((r: { id: string }) => r.id.startsWith("drl:"));

    expect(newsRow.detail).toEqual({
      articlesDup: 5,
      districtsProcessed: 200,
      llmCalls: 20,
      layer: "daily",
    });
    expect(drlRow.detail).toBeUndefined();
  });

  it("source filter 'news:*' skips DRL query entirely", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    // Only 3 real queries when newsOnly: nir rows, nir count, nir layers.
    // DRL rows/count/sources are resolved as empty synchronously (no client.query call).
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    await GET(makeRequest("/api/admin/sync?source=news:*"));

    // DRL query should NOT have been invoked
    const queryStrings = client.query.mock.calls.map(
      (c) => (c[0] as string).toLowerCase()
    );
    const drlRowQuery = queryStrings.find(
      (q) => q.includes("from data_refresh_logs") && !q.includes("count(")
    );
    expect(drlRowQuery).toBeUndefined();
  });

  it("paginates the merged set correctly", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    const drlRows = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      data_source: "nces",
      status: "success",
      records_updated: 100,
      records_failed: 0,
      error_message: null,
      started_at: new Date(Date.UTC(2026, 3, 22, 10, i)),
      completed_at: new Date(Date.UTC(2026, 3, 22, 10, i + 1)),
    }));

    client.query
      .mockResolvedValueOnce({ rows: drlRows })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "10" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("/api/admin/sync?page=2&page_size=5")
    );
    const body = await res.json();

    expect(body.items).toHaveLength(5);
    expect(body.pagination.total).toBe(10);
    expect(body.pagination.page).toBe(2);
  });
});
