import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks use the closure-deferral pattern (matches platform-detector.test.ts).
// Each fn() is a vi.fn declared with `const`; the vi.mock factory references
// them through an arrow that defers the variable lookup until call time, so
// it doesn't trip Vitest's mock-hoisting TDZ.
const districtUpdate = vi.fn();
const vacancyScanFindUnique = vi.fn();
const vacancyScanUpdate = vi.fn();
const getParserMock = vi.fn();
const parseWithClaudeMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      update: (...args: unknown[]) => districtUpdate(...args),
    },
    vacancyScan: {
      findUnique: (...args: unknown[]) => vacancyScanFindUnique(...args),
      update: (...args: unknown[]) => vacancyScanUpdate(...args),
    },
  },
}));

vi.mock("@/features/vacancies/lib/platform-detector", () => ({
  detectPlatform: () => "applitrack",
  isStatewideBoardAsync: async () => false,
  getAppliTrackInstance: () => null,
}));
vi.mock("@/features/vacancies/lib/post-processor", () => ({
  processVacancies: async () => ({ vacancyCount: 0, fullmindRelevantCount: 0 }),
}));
vi.mock("@/features/vacancies/lib/parsers", () => ({
  getParser: (...args: unknown[]) => getParserMock(...args),
}));
vi.mock("@/features/vacancies/lib/parsers/playwright-fallback", () => ({
  parseWithPlaywright: async () => [],
}));
vi.mock("@/features/vacancies/lib/parsers/claude-fallback", () => ({
  parseWithClaude: (...args: unknown[]) => parseWithClaudeMock(...args),
}));

import { runScan } from "../scan-runner";

const baseScan = {
  id: "scan_abc",
  leaid: "0100001",
  district: {
    leaid: "0100001",
    name: "Test District",
    jobBoardUrl: "https://example.applitrack.com/onlineapp",
    jobBoardPlatform: "applitrack",
    enrollment: 1000,
  },
};

beforeEach(() => {
  districtUpdate.mockReset().mockResolvedValue({});
  vacancyScanFindUnique.mockReset().mockResolvedValue(baseScan);
  vacancyScanUpdate.mockReset().mockResolvedValue({});
  // Default parser: returns 0 vacancies — drives runScan to the success path.
  getParserMock.mockReset().mockImplementation(() => async () => []);
  parseWithClaudeMock.mockReset().mockResolvedValue([]);
});

describe("runScan health-column updates", () => {
  it("on completed: resets vacancyConsecutiveFailures and clears vacancyLastFailureAt", async () => {
    await runScan("scan_abc");

    const districtCalls = districtUpdate.mock.calls.filter(
      (c) => (c[0] as any)?.where?.leaid === "0100001"
    );
    const last = districtCalls.at(-1)?.[0] as any;
    expect(last?.data).toMatchObject({
      vacancyConsecutiveFailures: 0,
      vacancyLastFailureAt: null,
    });
  });

  it("on failed: increments consecutive failures and stamps vacancyLastFailureAt", async () => {
    // Make the parser itself throw — runScan's try/catch turns that into
    // the failed-status branch.
    getParserMock.mockImplementation(() => async () => {
      throw new Error("boom");
    });

    await runScan("scan_abc");

    const districtCalls = districtUpdate.mock.calls.filter(
      (c) => (c[0] as any)?.where?.leaid === "0100001"
    );
    const last = districtCalls.at(-1)?.[0] as any;
    expect(last?.data?.vacancyConsecutiveFailures).toMatchObject({ increment: 1 });
    expect(last?.data?.vacancyLastFailureAt).toBeInstanceOf(Date);
  });

  it("on failed: writes failureReason via categorizeFailure", async () => {
    getParserMock.mockImplementation(() => async () => {
      throw new Error("Request failed with status 404");
    });

    await runScan("scan_abc");

    const failedCall = vacancyScanUpdate.mock.calls.find(
      (c) => (c[0] as any)?.data?.status === "failed",
    );
    expect((failedCall?.[0] as any)?.data?.failureReason).toBe("http_4xx");
  });

  it("on no-jobBoardUrl early-return: counts as a failure", async () => {
    vacancyScanFindUnique.mockResolvedValueOnce({
      ...baseScan,
      district: { ...baseScan.district, jobBoardUrl: null },
    });

    await runScan("scan_abc");

    const districtCalls = districtUpdate.mock.calls.filter(
      (c) => (c[0] as any)?.where?.leaid === "0100001"
    );
    expect(districtCalls.length).toBeGreaterThan(0);
    const last = districtCalls.at(-1)?.[0] as any;
    expect(last?.data?.vacancyConsecutiveFailures).toMatchObject({ increment: 1 });

    const failedScanCall = vacancyScanUpdate.mock.calls.find(
      (c) => (c[0] as any)?.data?.status === "failed",
    );
    expect((failedScanCall?.[0] as any)?.data?.failureReason).toBe("no_job_board_url");
  });

  it("on scan_timeout: writes failureReason='scan_timeout'", async () => {
    // Make the parser hang past the timeout. The runner aborts via the controller
    // and throws "Scan timed out" — caught by the outer catch.
    getParserMock.mockImplementation(() => async () => {
      throw new Error("Scan timed out");
    });

    await runScan("scan_abc");

    const failedCall = vacancyScanUpdate.mock.calls.find(
      (c) => (c[0] as any)?.data?.status === "failed",
    );
    expect((failedCall?.[0] as any)?.data?.failureReason).toBe("scan_timeout");
  });
});
