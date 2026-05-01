import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock calls are hoisted to the top of the file by vitest. To reference
// a variable inside a factory we must use vi.hoisted() so the variable is
// also hoisted and available when the factory executes.
const { mockLookup, mockNamesMatch } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockNamesMatch: vi.fn((a: string, b: string) => {
    if (!a || !b) return true;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
  }),
}));

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: vi.fn(), $executeRaw: vi.fn() },
}));

vi.mock("../backfill-unmatched-resolutions-helpers", () => ({
  lookupNcesByLmsId: mockLookup,
  namesMatch: mockNamesMatch,
}));

import prisma from "@/lib/prisma";
import { backfillUnmatched } from "../backfill-unmatched-resolutions";

describe("backfillUnmatched", () => {
  beforeEach(() => {
    // Use clearAllMocks (clears calls/instances) rather than resetAllMocks
    // (which would wipe the implementations set in vi.hoisted above).
    vi.clearAllMocks();
  });

  it("auto-resolves when name matches exactly", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "opp1", account_lms_id: "lms123", account_name: "Yuba City Unified" },
    ] as never);
    mockLookup.mockResolvedValueOnce({ ncesId: "0612345", name: "Yuba City Unified School District" });

    const summary = await backfillUnmatched({ dryRun: false, logDecisions: false });

    expect(summary.autoResolved).toBe(1);
    expect(summary.deferred).toBe(0);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("defers when names do NOT match", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "opp1", account_lms_id: "lms123", account_name: "Foo District" },
    ] as never);
    mockLookup.mockResolvedValueOnce({ ncesId: "0612345", name: "Bar District" });

    const summary = await backfillUnmatched({ dryRun: false, logDecisions: false });

    expect(summary.autoResolved).toBe(0);
    expect(summary.deferred).toBe(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("defers when no district found in OpenSearch", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "opp1", account_lms_id: "lms_unknown", account_name: "Some District" },
    ] as never);
    mockLookup.mockResolvedValueOnce(null);

    const summary = await backfillUnmatched({ dryRun: false, logDecisions: false });

    expect(summary.autoResolved).toBe(0);
    expect(summary.deferred).toBe(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("dry-run mode does not write", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "opp1", account_lms_id: "lms123", account_name: "Yuba City" },
    ] as never);
    mockLookup.mockResolvedValueOnce({ ncesId: "0612345", name: "Yuba City Unified" });

    const summary = await backfillUnmatched({ dryRun: true, logDecisions: false });

    expect(summary.autoResolved).toBe(1);
    expect(summary.dryRun).toBe(true);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("counts errors and continues processing other rows", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "opp1", account_lms_id: "lms123", account_name: "A" },
      { id: "opp2", account_lms_id: "lms456", account_name: "B" },
    ] as never);
    mockLookup
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce({ ncesId: "0612345", name: "B" });

    const summary = await backfillUnmatched({ dryRun: false, logDecisions: false });

    expect(summary.errors).toBe(1);
    expect(summary.autoResolved).toBe(1);
    expect(summary.deferred).toBe(0);
  });
});
