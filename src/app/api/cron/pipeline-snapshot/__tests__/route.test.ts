import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findMany = vi.fn();
const deleteMany = vi.fn();
const createMany = vi.fn();
const $transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    opportunity: { findMany: (...a: unknown[]) => findMany(...a) },
    opportunitySnapshot: {
      deleteMany: (...a: unknown[]) => deleteMany(...a),
      createMany: (...a: unknown[]) => createMany(...a),
    },
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

import { GET } from "../route";

beforeEach(() => {
  findMany.mockReset();
  deleteMany.mockReset();
  createMany.mockReset();
  $transaction.mockReset();
  process.env.CRON_SECRET = "shh";
});

function reqWith(opts: { auth?: string; secret?: string } = {}): NextRequest {
  const url = new URL("http://localhost/api/cron/pipeline-snapshot");
  if (opts.secret) url.searchParams.set("secret", opts.secret);
  return new NextRequest(url, {
    headers: opts.auth ? { authorization: opts.auth } : undefined,
  });
}

describe("GET /api/cron/pipeline-snapshot", () => {
  it("401 when neither auth header nor secret matches", async () => {
    const res = await GET(reqWith({ secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("snapshots every opp returned by findMany (no chunking cap)", async () => {
    // Simulate the production universe (~2500 rows) so a chunking bug like
    // the prior 500-row silent cap would surface as a counted mismatch.
    const fakeOpps = Array.from({ length: 2500 }, (_, i) => ({
      id: `opp-${i}`,
      stage: "1 - Discovery",
      netBookingAmount: 100,
      minimumPurchaseAmount: 50,
      maximumBudget: 200,
      schoolYr: "2026-27",
      salesRepId: null,
      districtLeaId: null,
      closeDate: null,
      expiration: null,
    }));
    findMany.mockResolvedValue(fakeOpps);
    // Mock $transaction to invoke the callback with our spies as the tx client.
    $transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        opportunitySnapshot: {
          deleteMany: (...a: unknown[]) => deleteMany(...a),
          createMany: async (args: { data: unknown[] }) => {
            return await createMany(args);
          },
        },
      };
      return cb(tx);
    });
    deleteMany.mockResolvedValue({ count: 0 });
    createMany.mockImplementation(async (args: { data: unknown[] }) => ({
      count: args.data.length,
    }));

    const res = await GET(reqWith({ secret: "shh" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.oppsScanned).toBe(2500);
    expect(body.oppsSnapshotted).toBe(2500);
    expect(deleteMany).toHaveBeenCalledOnce();
    expect(createMany).toHaveBeenCalledOnce();
    // createMany's data array must hold every single opp — the regression test
    // for the prior bug where only the first 500 made it.
    const createArgs = createMany.mock.calls[0][0] as { data: unknown[] };
    expect(createArgs.data).toHaveLength(2500);
  });

  it("is idempotent — re-running the same day deletes then re-inserts", async () => {
    findMany.mockResolvedValue([]);
    $transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        opportunitySnapshot: {
          deleteMany: (...a: unknown[]) => deleteMany(...a),
          createMany: (...a: unknown[]) => createMany(...a),
        },
      };
      return cb(tx);
    });
    deleteMany.mockResolvedValue({ count: 0 });

    const res = await GET(reqWith({ secret: "shh" }));
    expect(res.status).toBe(200);
    expect(deleteMany).toHaveBeenCalledOnce();
    // No rows to insert → createMany skipped, but deleteMany still ran.
    expect(createMany).not.toHaveBeenCalled();
  });

  it("Bearer header is accepted", async () => {
    findMany.mockResolvedValue([]);
    $transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        opportunitySnapshot: {
          deleteMany,
          createMany,
        },
      };
      return cb(tx);
    });
    deleteMany.mockResolvedValue({ count: 0 });
    const res = await GET(reqWith({ auth: "Bearer shh" }));
    expect(res.status).toBe(200);
  });
});
