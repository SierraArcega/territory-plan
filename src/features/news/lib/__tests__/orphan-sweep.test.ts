import { describe, it, expect, vi, beforeEach } from "vitest";
import { sweepOrphanedNewsRuns } from "../orphan-sweep";

const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsIngestRun: {
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

beforeEach(() => {
  updateMany.mockReset();
  updateMany.mockResolvedValue({ count: 0 });
});

describe("sweepOrphanedNewsRuns", () => {
  it("targets only status='running' rows older than 10 minutes", async () => {
    await sweepOrphanedNewsRuns();
    expect(updateMany).toHaveBeenCalledTimes(1);
    const call = updateMany.mock.calls[0][0];
    expect(call.where.status).toBe("running");
    const cutoff = call.where.startedAt.lt as Date;
    const ageMs = Date.now() - cutoff.getTime();
    // 10 minutes ± 1s tolerance
    expect(ageMs).toBeGreaterThanOrEqual(10 * 60_000 - 1000);
    expect(ageMs).toBeLessThanOrEqual(10 * 60_000 + 1000);
  });

  it("marks targeted rows as errored with 'orphaned' message", async () => {
    await sweepOrphanedNewsRuns();
    const call = updateMany.mock.calls[0][0];
    expect(call.data.status).toBe("error");
    expect(call.data.error).toMatch(/orphaned/i);
    expect(call.data.finishedAt).toBeInstanceOf(Date);
  });

  it("returns the number of rows swept", async () => {
    updateMany.mockResolvedValueOnce({ count: 7 });
    const swept = await sweepOrphanedNewsRuns();
    expect(swept).toBe(7);
  });

  it("returns 0 when there are no orphaned rows", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    const swept = await sweepOrphanedNewsRuns();
    expect(swept).toBe(0);
  });
});
