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
const isStatewideBoardAsyncMock = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => false);

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
  isStatewideBoardAsync: (...args: unknown[]) => isStatewideBoardAsyncMock(...args),
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
  isStatewideBoardAsyncMock.mockReset().mockResolvedValue(false);
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

describe("runScan completed_partial paths write failureReason", () => {
  it("statewide_unattributable: >50% missing employerName", async () => {
    // Override the mocked isStatewideBoardAsync for this test only
    isStatewideBoardAsyncMock.mockResolvedValueOnce(true);

    // Parser returns 25 jobs, 20 without employerName -> 80% missing -> trigger
    const rawJobs = Array.from({ length: 25 }, (_, i) => ({
      title: `Job ${i}`,
      url: `https://example.com/${i}`,
      ...(i < 5 ? { employerName: "Test District" } : {}),
    }));
    getParserMock.mockImplementation(() => async () => rawJobs);

    await runScan("scan_abc");

    const partialCall = vacancyScanUpdate.mock.calls.find(
      (c) => (c[0] as any)?.data?.status === "completed_partial",
    );
    expect((partialCall?.[0] as any)?.data?.failureReason).toBe(
      "statewide_unattributable",
    );
  });

  it("enrollment_ratio_skip: too many vacancies for enrollment", async () => {
    // 600 vacancies on a district with enrollment 1000 -> ratio 0.6 > 0.5 -> trigger
    getParserMock.mockImplementation(() => async () =>
      Array.from({ length: 600 }, (_, i) => ({
        title: `Job ${i}`,
        url: `https://example.com/${i}`,
        employerName: "Test District",
      })),
    );

    await runScan("scan_abc");

    const partialCall = vacancyScanUpdate.mock.calls.find(
      (c) => (c[0] as any)?.data?.status === "completed_partial",
    );
    expect((partialCall?.[0] as any)?.data?.failureReason).toBe(
      "enrollment_ratio_skip",
    );
  });

  it("claude_fallback_failed: serverless Claude returns []", async () => {
    // Force the no-parser path (getParser returns null), set serverless +
    // an API key so the runner actually invokes Claude, then have Claude
    // return [].
    getParserMock.mockReturnValue(null);
    process.env.VERCEL = "1";
    process.env.ANTHROPIC_API_KEY = "test-key";
    parseWithClaudeMock.mockResolvedValue([]);

    try {
      await runScan("scan_abc");

      const partialCall = vacancyScanUpdate.mock.calls.find(
        (c) => (c[0] as any)?.data?.status === "completed_partial",
      );
      expect((partialCall?.[0] as any)?.data?.failureReason).toBe(
        "claude_fallback_failed",
      );
      expect((partialCall?.[0] as any)?.data?.errorMessage).toBe(
        "Claude fallback returned no vacancies",
      );

      // District counter must increment (B1 policy) — markDistrictScanFailure path
      const districtFailureCall = districtUpdate.mock.calls.find(
        (c) =>
          (c[0] as any)?.where?.leaid === "0100001" &&
          (c[0] as any)?.data?.vacancyConsecutiveFailures?.increment === 1,
      );
      expect(districtFailureCall).toBeDefined();
    } finally {
      delete process.env.VERCEL;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("claude_fallback_failed: serverless without ANTHROPIC_API_KEY", async () => {
    // No-key serverless path: Claude is never invoked, but the symptom is
    // the same as a Claude empty-return. B1 policy still fires; the
    // errorMessage distinguishes the cause.
    getParserMock.mockReturnValue(null);
    process.env.VERCEL = "1";
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await runScan("scan_abc");

      const partialCall = vacancyScanUpdate.mock.calls.find(
        (c) => (c[0] as any)?.data?.status === "completed_partial",
      );
      expect((partialCall?.[0] as any)?.data?.failureReason).toBe(
        "claude_fallback_failed",
      );
      expect((partialCall?.[0] as any)?.data?.errorMessage).toBe(
        "Serverless: no ANTHROPIC_API_KEY — cannot parse",
      );

      const districtFailureCall = districtUpdate.mock.calls.find(
        (c) =>
          (c[0] as any)?.where?.leaid === "0100001" &&
          (c[0] as any)?.data?.vacancyConsecutiveFailures?.increment === 1,
      );
      expect(districtFailureCall).toBeDefined();
    } finally {
      delete process.env.VERCEL;
    }
  });
});
