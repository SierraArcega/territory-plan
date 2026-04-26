import { describe, it, expect, vi, beforeEach } from "vitest";

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

const mockPool = vi.mocked(pool) as unknown as { connect: ReturnType<typeof vi.fn> };
const mockGetAdminUser = vi.mocked(getAdminUser);

import { GET } from "../route";

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function makeMockClient(): MockClient {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdminUser.mockResolvedValue({ id: "u1" } as never);
});

describe("GET /api/admin/news-ingest-stats", () => {
  it("returns 403 when user is not admin", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("short-circuits health to green when targetDistrictCount is 0", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    // 5 queries: articles7d, coverage, lastRun, failures24h, layerBreakdown
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "0", prior7d: "0" }] })
      .mockResolvedValueOnce({
        rows: [{ target_district_count: "0", green: "0", amber: "0", red: "0" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage.targetDistrictCount).toBe(0);
    expect(body.health).toBe("green");
  });

  it("returns red health when percentGreen below 40", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "30", amber: "20", red: "50" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date("2026-04-22T11:00:00Z"),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.coverage.percentGreen).toBe(30);
    expect(body.health).toBe("red");
  });

  it("returns red health when failures24h > 3", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "80", amber: "10", red: "10" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date(Date.now() - 60 * 60 * 1000),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "5" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.failures24h).toBe(5);
    expect(body.health).toBe("red");
  });

  it("returns amber when coverage between 40 and 70", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "55", amber: "25", red: "20" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date(Date.now() - 60 * 60 * 1000),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.coverage.percentGreen).toBe(55);
    expect(body.health).toBe("amber");
  });

  it("returns green when coverage >= 70 and last run fresh and no failures", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "80", amber: "10", red: "10" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date(Date.now() - 60 * 60 * 1000),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.health).toBe("green");
  });

  it("maps NIR status 'ok' to 'success' in lastRun", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "0", prior7d: "0" }] })
      .mockResolvedValueOnce({
        rows: [{ target_district_count: "10", green: "10", amber: "0", red: "0" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date("2026-04-22T11:00:00Z"),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.lastRun.status).toBe("success");
  });

  it("returns 500 when DB query throws", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query.mockRejectedValue(new Error("boom"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
