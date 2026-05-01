import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(),
  },
}));

import pool from "@/lib/db";
import { selectNextRollingBatch } from "../rolling-batch";

const mockPool = vi.mocked(pool) as unknown as { connect: ReturnType<typeof vi.fn> };

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function makeMockClient(): MockClient {
  return { query: vi.fn(), release: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("selectNextRollingBatch", () => {
  it("returns mapped rows from the pg query", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query.mockResolvedValueOnce({
      rows: [
        {
          leaid: "0100005",
          name: "Albertville City",
          city_location: "Albertville",
          state_abbrev: "AL",
          tier: 1,
        },
        {
          leaid: "0100008",
          name: "Marshall County",
          city_location: null,
          state_abbrev: "AL",
          tier: 2,
        },
      ],
    });

    const out = await selectNextRollingBatch(50);

    expect(out).toEqual([
      {
        leaid: "0100005",
        name: "Albertville City",
        cityLocation: "Albertville",
        stateAbbrev: "AL",
        tier: 1,
      },
      {
        leaid: "0100008",
        name: "Marshall County",
        cityLocation: null,
        stateAbbrev: "AL",
        tier: 2,
      },
    ]);
  });

  it("passes batchSize as the SQL parameter", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query.mockResolvedValueOnce({ rows: [] });

    await selectNextRollingBatch(123);

    expect(client.query).toHaveBeenCalledTimes(1);
    const [, params] = client.query.mock.calls[0];
    expect(params).toEqual([123]);
  });

  it("uses a query that computes tier from customer/pipeline/plan/activity signals", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query.mockResolvedValueOnce({ rows: [] });

    await selectNextRollingBatch(10);

    const [sql] = client.query.mock.calls[0] as [string];
    // Tier 1 signals
    expect(sql).toMatch(/is_customer/i);
    expect(sql).toMatch(/has_open_pipeline/i);
    // Tier 2 signals
    expect(sql).toMatch(/territory_plan_districts/i);
    expect(sql).toMatch(/activity_districts/i);
    expect(sql).toMatch(/activities/i);
    // SLA intervals
    expect(sql).toMatch(/6 hours/);
    expect(sql).toMatch(/24 hours/);
    expect(sql).toMatch(/30 days/);
    // Ordering
    expect(sql).toMatch(/ORDER BY[\s\S]*tier/i);
  });

  it("releases the client even if the query throws", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query.mockRejectedValueOnce(new Error("boom"));

    await expect(selectNextRollingBatch(10)).rejects.toThrow("boom");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
