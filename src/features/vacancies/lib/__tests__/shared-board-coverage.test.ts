import { describe, it, expect } from "vitest";
import { buildSiblingCoverageRecords } from "../shared-board-coverage";

const baseScan = {
  status: "completed",
  platform: "schoolspring",
  startedAt: new Date("2026-04-22T21:00:00Z"),
  completedAt: new Date("2026-04-22T21:00:10Z"),
};

describe("buildSiblingCoverageRecords", () => {
  it("returns one record per non-representative district", () => {
    const result = buildSiblingCoverageRecords({
      districts: [{ leaid: "A" }, { leaid: "B" }, { leaid: "C" }],
      representativeLeaid: "A",
      representativeScan: baseScan,
      batchId: "batch-1",
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.leaid).sort()).toEqual(["B", "C"]);
  });

  it("copies status, platform, and timestamps from the representative", () => {
    const [record] = buildSiblingCoverageRecords({
      districts: [{ leaid: "A" }, { leaid: "B" }],
      representativeLeaid: "A",
      representativeScan: {
        status: "completed_partial",
        platform: "applitrack",
        startedAt: new Date("2026-04-22T21:00:00Z"),
        completedAt: new Date("2026-04-22T21:00:05Z"),
      },
      batchId: "batch-1",
    });

    expect(record).toMatchObject({
      leaid: "B",
      status: "completed_partial",
      platform: "applitrack",
      startedAt: new Date("2026-04-22T21:00:00Z"),
      completedAt: new Date("2026-04-22T21:00:05Z"),
      batchId: "batch-1",
      triggeredBy: "cron",
    });
  });

  it("returns empty when the group has only the representative", () => {
    expect(
      buildSiblingCoverageRecords({
        districts: [{ leaid: "A" }],
        representativeLeaid: "A",
        representativeScan: baseScan,
        batchId: "batch-1",
      })
    ).toEqual([]);
  });

  it("does not mark siblings as covered when the representative scan failed", () => {
    expect(
      buildSiblingCoverageRecords({
        districts: [{ leaid: "A" }, { leaid: "B" }],
        representativeLeaid: "A",
        representativeScan: {
          status: "failed",
          platform: null,
          startedAt: new Date(),
          completedAt: null,
        },
        batchId: "batch-1",
      })
    ).toEqual([]);
  });

  it("does not mark siblings as covered when representative status is pending", () => {
    expect(
      buildSiblingCoverageRecords({
        districts: [{ leaid: "A" }, { leaid: "B" }],
        representativeLeaid: "A",
        representativeScan: {
          status: "pending",
          platform: null,
          startedAt: new Date(),
          completedAt: null,
        },
        batchId: "batch-1",
      })
    ).toEqual([]);
  });

  it("still produces records when the representative is not at index 0", () => {
    const result = buildSiblingCoverageRecords({
      districts: [{ leaid: "A" }, { leaid: "B" }, { leaid: "C" }],
      representativeLeaid: "B",
      representativeScan: baseScan,
      batchId: "batch-1",
    });

    expect(result.map((r) => r.leaid).sort()).toEqual(["A", "C"]);
  });
});
