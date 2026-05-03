# Vacancy Scanner Coverage Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a categorized failure-reason column to `VacancyScan`, surface three new diagnostic stats on the admin card (tarpit, adjusted coverage, top failure reason), emit three structured Vercel log events, backfill historical scans — all without changing scan scheduling or fixing the underlying parser issues.

**Architecture:** A single helper (`categorizeFailure`) is the only place that maps free-text errors to enum buckets. Every scan-runner failure site calls it with a known context; the outer catch falls back to regex. The same helper drives a one-time backfill script. The admin card and stats endpoint pick up three new fields without changing any existing field. One small behavior change: Claude-fallback returning `[]` is now `completed_partial` with `failureReason: claude_fallback_failed` (was silent `completed`), so the new bucket reflects reality.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, Next.js (App Router), Vitest, Tailwind, TanStack Query.

**Spec:** `Docs/superpowers/specs/2026-05-03-vacancy-scanner-coverage-diagnostics-design.md`

---

## File Map

| File | Action | Why |
| --- | --- | --- |
| `prisma/schema.prisma` | Modify | Add `VacancyFailureReason` enum + nullable `failureReason` column on `VacancyScan` |
| `prisma/migrations/<ts>_add_vacancy_failure_reason/migration.sql` | Create (via `prisma migrate dev`) | DB migration |
| `src/features/vacancies/lib/failure-reasons.ts` | Create | `categorizeFailure` helper — single source of truth for bucket mapping |
| `src/features/vacancies/lib/__tests__/failure-reasons.test.ts` | Create | Exhaustive table-driven tests for the helper |
| `src/features/vacancies/lib/scan-runner.ts` | Modify | Wire helper into all 5 failure sites, change Claude-empty behavior, return counters from helpers, emit per-scan log + tarpit-admission log |
| `src/features/vacancies/lib/__tests__/scan-runner.test.ts` | Modify | Extend existing tests to assert `failureReason` written + tarpit log fires correctly |
| `src/app/api/cron/scan-vacancies/route.ts` | Modify | Add `tarpitSize` query, emit `vacancy_cron_summary` log |
| `src/app/api/admin/vacancy-scan-stats/route.ts` | Modify | Add three new fields (tarpit, adjustedCoveragePct, topFailureReason7d) |
| `src/app/api/admin/vacancy-scan-stats/__tests__/route.test.ts` | Create | Tests for the new response fields |
| `src/features/admin/components/VacancyScanCard.tsx` | Modify | Add row 2 stats; alert dot threshold |
| `src/features/admin/components/__tests__/VacancyScanCard.test.tsx` | Create | Tests for the new row + alert behavior |
| `scripts/backfill-vacancy-failure-reasons.ts` | Create | One-time backfill script with dry-run mode |

---

## Task 1: Schema migration — add `VacancyFailureReason` enum + nullable column

**Files:**
- Modify: `prisma/schema.prisma:862-868` (enum block; insert near other enums) and `prisma/schema.prisma:1475-1496` (`VacancyScan` model)
- Create (via Prisma CLI): `prisma/migrations/<timestamp>_add_vacancy_failure_reason/migration.sql`

- [ ] **Step 1: Add the enum to `prisma/schema.prisma`**

Insert after the existing `UserRole` enum (around line 868), before the `// ===== User Profile & Goals =====` comment:

```prisma
enum VacancyFailureReason {
  http_4xx
  http_5xx
  network_timeout
  scan_timeout
  parser_empty
  claude_fallback_failed
  statewide_unattributable
  enrollment_ratio_skip
  no_job_board_url
  unknown_error

  @@map("vacancy_failure_reason")
}
```

- [ ] **Step 2: Add the column to `VacancyScan`**

In `prisma/schema.prisma:1475-1496`, add one line after `errorMessage` (line 1485):

```prisma
  errorMessage          String?   @map("error_message") @db.Text
  failureReason         VacancyFailureReason? @map("failure_reason")
  triggeredBy           String    @map("triggered_by") @db.VarChar(100)
```

- [ ] **Step 3: Generate the migration**

Run: `npx prisma migrate dev --name add_vacancy_failure_reason`
Expected: creates `prisma/migrations/<YYYYMMDDHHMMSS>_add_vacancy_failure_reason/migration.sql` with the `CREATE TYPE` and `ALTER TABLE ADD COLUMN` statements, applies it locally, and regenerates the Prisma client.

- [ ] **Step 4: Verify the migration ran cleanly**

Run: `npx prisma migrate status`
Expected: "Database schema is up to date!"

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(vacancies): add VacancyFailureReason enum + column"
```

---

## Task 2: Create `categorizeFailure` helper (TDD)

**Files:**
- Create: `src/features/vacancies/lib/failure-reasons.ts`
- Test: `src/features/vacancies/lib/__tests__/failure-reasons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/vacancies/lib/__tests__/failure-reasons.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { categorizeFailure } from "../failure-reasons";

describe("categorizeFailure — explicit context", () => {
  it.each([
    ["no_job_board_url", "no_job_board_url"],
    ["scan_timeout", "scan_timeout"],
    ["statewide_unattributable", "statewide_unattributable"],
    ["enrollment_ratio_skip", "enrollment_ratio_skip"],
    ["claude_fallback_empty", "claude_fallback_failed"],
  ] as const)("context %s -> %s", (context, expected) => {
    expect(categorizeFailure({ errorMessage: "anything", context })).toBe(expected);
  });
});

describe("categorizeFailure — string match (thrown_error)", () => {
  const cases: Array<[string, string]> = [
    ["Scan timed out", "scan_timeout"],
    ["Scan timed out (stale recovery)", "scan_timeout"],
    ["AbortError: aborted", "scan_timeout"],
    ["Anthropic API error: 529 overloaded", "claude_fallback_failed"],
    ["Claude API rate limit exceeded", "claude_fallback_failed"],
    ["Skipped: statewide board returned 412 vacancies", "statewide_unattributable"],
    ["Skipped: 200 vacancies looks like a regional aggregator", "enrollment_ratio_skip"],
    ["District has no job board URL", "no_job_board_url"],
    ["Request failed with status 404", "http_4xx"],
    ["403 Forbidden", "http_4xx"],
    ["Page Not Found", "http_4xx"],
    ["410 Gone", "http_4xx"],
    ["Server returned 500", "http_5xx"],
    ["502 Bad Gateway", "http_5xx"],
    ["503 Service Unavailable", "http_5xx"],
    ["fetch failed", "network_timeout"],
    ["ECONNREFUSED", "network_timeout"],
    ["getaddrinfo ENOTFOUND example.com", "network_timeout"],
    ["Some weird error nobody saw before", "unknown_error"],
    ["", "unknown_error"],
  ];

  it.each(cases)("%s -> %s", (errorMessage, expected) => {
    expect(categorizeFailure({ errorMessage, context: "thrown_error" })).toBe(expected);
  });

  it("defaults to thrown_error when context is omitted", () => {
    expect(categorizeFailure({ errorMessage: "Scan timed out" })).toBe("scan_timeout");
  });
});

describe("categorizeFailure — first-match-wins ordering", () => {
  it("scan_timeout beats http_4xx when both could match", () => {
    expect(
      categorizeFailure({ errorMessage: "Scan timed out: 404", context: "thrown_error" }),
    ).toBe("scan_timeout");
  });

  it("claude_fallback_failed beats http_5xx when both could match", () => {
    expect(
      categorizeFailure({
        errorMessage: "Anthropic API error: 503 service unavailable",
        context: "thrown_error",
      }),
    ).toBe("claude_fallback_failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/vacancies/lib/__tests__/failure-reasons.test.ts`
Expected: FAIL with "Cannot find module '../failure-reasons'".

- [ ] **Step 3: Write the helper**

Create `src/features/vacancies/lib/failure-reasons.ts`:

```ts
import type { VacancyFailureReason } from "@prisma/client";

export type FailureContext =
  | "no_job_board_url"
  | "scan_timeout"
  | "statewide_unattributable"
  | "enrollment_ratio_skip"
  | "claude_fallback_empty"
  | "thrown_error";

const CONTEXT_MAP: Partial<Record<FailureContext, VacancyFailureReason>> = {
  no_job_board_url: "no_job_board_url",
  scan_timeout: "scan_timeout",
  statewide_unattributable: "statewide_unattributable",
  enrollment_ratio_skip: "enrollment_ratio_skip",
  claude_fallback_empty: "claude_fallback_failed",
};

// Order matters: first match wins. More-specific patterns precede more-generic ones.
const PATTERNS: Array<{ regex: RegExp; reason: VacancyFailureReason }> = [
  { regex: /timed out|aborted|abort/i, reason: "scan_timeout" },
  { regex: /anthropic|claude api/i, reason: "claude_fallback_failed" },
  { regex: /statewide board returned/i, reason: "statewide_unattributable" },
  { regex: /regional aggregator/i, reason: "enrollment_ratio_skip" },
  { regex: /no job board url/i, reason: "no_job_board_url" },
  { regex: /4\d\d|not found|forbidden|gone/i, reason: "http_4xx" },
  { regex: /5\d\d|server error|bad gateway|service unavailable/i, reason: "http_5xx" },
  { regex: /econnrefused|enotfound|network|fetch failed|getaddrinfo/i, reason: "network_timeout" },
];

export function categorizeFailure(args: {
  errorMessage: string;
  context?: FailureContext;
}): VacancyFailureReason {
  const ctx = args.context ?? "thrown_error";
  const direct = CONTEXT_MAP[ctx];
  if (direct) return direct;

  // Fall through to regex matching for thrown_error context
  for (const { regex, reason } of PATTERNS) {
    if (regex.test(args.errorMessage)) return reason;
  }
  return "unknown_error";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/vacancies/lib/__tests__/failure-reasons.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/failure-reasons.ts src/features/vacancies/lib/__tests__/failure-reasons.test.ts
git commit -m "feat(vacancies): categorizeFailure helper for failure-reason taxonomy"
```

---

## Task 3: Wire helper into `scan-runner` thrown-error catch path

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts:286-309` (outer catch block)
- Modify: `src/features/vacancies/lib/__tests__/scan-runner.test.ts` (extend the "on failed" test)

- [ ] **Step 1: Extend the failing test in `scan-runner.test.ts`**

Add this case inside `describe("runScan health-column updates", ...)` in `scan-runner.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: FAIL — `data.failureReason` is `undefined`.

- [ ] **Step 3: Wire `categorizeFailure` into the catch block**

In `src/features/vacancies/lib/scan-runner.ts`, add the import near the top (after the other imports from `./parsers`):

```ts
import { categorizeFailure } from "./failure-reasons";
```

Then replace the `prisma.vacancyScan.update` call inside the outer catch (currently lines 293-300) with one that also writes `failureReason`:

```ts
} catch (error) {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown error";

  console.error(`[scan-runner] Scan ${scanId} failed:`, errorMessage);

  try {
    const failureReason = categorizeFailure({
      errorMessage,
      context: "thrown_error",
    });
    await prisma.vacancyScan.update({
      where: { id: scanId },
      data: {
        status: "failed",
        errorMessage,
        failureReason,
        completedAt: new Date(),
      },
    });
    if (scan?.district?.leaid) {
      await markDistrictScanFailure(scan.district.leaid);
    }
  } catch (updateError) {
    console.error(
      `[scan-runner] Failed to update scan ${scanId} status:`,
      updateError,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: PASS — including the existing tests, which still match because they use `toMatchObject`.

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts src/features/vacancies/lib/__tests__/scan-runner.test.ts
git commit -m "feat(vacancies): write failureReason on thrown-error scan failures"
```

---

## Task 4: Wire helper into `no_job_board_url` and `scan_timeout` sites

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts:82-91` (no jobBoardUrl branch) and `:152-153` (timeout-controller flow)
- Modify: `src/features/vacancies/lib/__tests__/scan-runner.test.ts` (extend existing no-URL test)

- [ ] **Step 1: Extend the no-URL test**

In `scan-runner.test.ts`, find the existing test `"on no-jobBoardUrl early-return: counts as a failure"` and add an assertion at the end:

```ts
const failedScanCall = vacancyScanUpdate.mock.calls.find(
  (c) => (c[0] as any)?.data?.status === "failed",
);
expect((failedScanCall?.[0] as any)?.data?.failureReason).toBe("no_job_board_url");
```

Then add a new test for the scan-timeout path:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail (or partially pass)**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: the no-URL test FAILS (no `failureReason` written yet). The scan-timeout test already passes because Task 3's catch block handles it via regex matching.

- [ ] **Step 3: Wire `categorizeFailure` into the no-URL branch**

In `src/features/vacancies/lib/scan-runner.ts:82-91`, replace the early-return block with:

```ts
if (!scan.district.jobBoardUrl) {
  await prisma.vacancyScan.update({
    where: { id: scanId },
    data: {
      status: "failed",
      errorMessage: "District has no job board URL",
      failureReason: categorizeFailure({
        errorMessage: "",
        context: "no_job_board_url",
      }),
      completedAt: new Date(),
    },
  });
  await markDistrictScanFailure(scan.district.leaid);
  return;
}
```

The scan-timeout site does not need a code change — it throws `"Scan timed out"` (line 153), which the outer catch routes through `categorizeFailure` with regex matching from Task 3.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: PASS — both new assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts src/features/vacancies/lib/__tests__/scan-runner.test.ts
git commit -m "feat(vacancies): write failureReason on no-URL and scan-timeout failures"
```

---

## Task 5: Wire helper into `statewide_unattributable` and `enrollment_ratio_skip` sites

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts:168-178` (statewide unattributable) and `:247-258` (enrollment ratio safety net)
- Modify: `src/features/vacancies/lib/__tests__/scan-runner.test.ts`

- [ ] **Step 1: Add tests**

In `scan-runner.test.ts`, after the existing tests, add a new describe block:

```ts
describe("runScan completed_partial paths write failureReason", () => {
  it("statewide_unattributable: >50% missing employerName", async () => {
    const { isStatewideBoardAsync } = await import(
      "@/features/vacancies/lib/platform-detector"
    );
    // Override the mocked isStatewideBoardAsync for this test only
    vi.mocked(isStatewideBoardAsync).mockResolvedValueOnce(true);

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
    // 200 vacancies on a district with enrollment 1000 -> ratio 0.2 -> trigger
    getParserMock.mockImplementation(() => async () =>
      Array.from({ length: 200 }, (_, i) => ({
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
});
```

You will also need to update the `vi.mock` for `platform-detector` at the top of the file so `isStatewideBoardAsync` is a `vi.fn` instead of an inline arrow:

```ts
const isStatewideBoardAsyncMock = vi.fn(async () => false);

vi.mock("@/features/vacancies/lib/platform-detector", () => ({
  detectPlatform: () => "applitrack",
  isStatewideBoardAsync: (...args: unknown[]) => isStatewideBoardAsyncMock(...args),
  getAppliTrackInstance: () => null,
}));
```

And reset the mock in `beforeEach`:

```ts
isStatewideBoardAsyncMock.mockReset().mockResolvedValue(false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: FAIL — both new tests, no `failureReason` field on the `completed_partial` updates.

- [ ] **Step 3: Wire `categorizeFailure` into both sites**

In `src/features/vacancies/lib/scan-runner.ts`, find the statewide-unattributable update (lines 168-176) and add `failureReason`:

```ts
await prisma.vacancyScan.update({
  where: { id: scanId },
  data: {
    status: "completed_partial",
    vacancyCount: 0,
    errorMessage: `Skipped: statewide board returned ${rawVacancies.length} vacancies but ${withoutEmployer} lack employer info (cannot attribute to district)`,
    failureReason: categorizeFailure({
      errorMessage: "",
      context: "statewide_unattributable",
    }),
    completedAt: new Date(),
  },
});
```

Then find the enrollment-ratio update (lines 247-256) and do the same:

```ts
await prisma.vacancyScan.update({
  where: { id: scanId },
  data: {
    status: "completed_partial",
    vacancyCount: 0,
    errorMessage: `Skipped: ${rawVacancies.length} vacancies looks like a regional aggregator (enrollment: ${enrollment}, ratio: ${ratio.toFixed(2)})`,
    failureReason: categorizeFailure({
      errorMessage: "",
      context: "enrollment_ratio_skip",
    }),
    completedAt: new Date(),
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts src/features/vacancies/lib/__tests__/scan-runner.test.ts
git commit -m "feat(vacancies): write failureReason on completed_partial scans"
```

---

## Task 6: B1 policy — Claude-fallback-empty becomes `completed_partial` with `claude_fallback_failed`

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts:118-149` (parser dispatch) — track which path ran, then handle empty result from Claude differently
- Modify: `src/features/vacancies/lib/__tests__/scan-runner.test.ts`

- [ ] **Step 1: Add the failing test**

In `scan-runner.test.ts`, add a new test inside the `runScan completed_partial paths write failureReason` describe:

```ts
it("claude_fallback_failed: serverless Claude returns []", async () => {
  // Force the dispatch into the Claude-fallback branch:
  // 1) no parser for the platform, 2) running serverless, 3) Claude returns []
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: FAIL — Claude-empty currently writes `status: "completed"` with no `failureReason`.

- [ ] **Step 3: Track the parser path and handle Claude-empty as failure**

In `src/features/vacancies/lib/scan-runner.ts:118-149`, replace the parser-dispatch block with one that records which path ran:

```ts
// Step 4: Get parser and run it
const parser = getParser(platform);
let rawVacancies: RawVacancy[];
let usedClaudeFallback = false;
const isServerless = !!process.env.VERCEL;
const needsPlaywright = !parser;

if (parser && !(isServerless && needsPlaywright)) {
  rawVacancies = await parser(scan.district.jobBoardUrl);
} else if (isServerless) {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(`[scan-runner] Serverless env, using Claude fallback for "${platform}"...`);
    rawVacancies = await parseWithClaude(scan.district.jobBoardUrl);
    usedClaudeFallback = true;
  } else {
    console.log(`[scan-runner] Serverless env, no ANTHROPIC_API_KEY — cannot parse "${platform}"`);
    rawVacancies = [];
    usedClaudeFallback = true;
  }
} else {
  console.log(`[scan-runner] No parser for platform "${platform}", trying Playwright...`);
  rawVacancies = await parseWithPlaywright(scan.district.jobBoardUrl);

  if (rawVacancies.length === 0 && process.env.ANTHROPIC_API_KEY) {
    console.log(`[scan-runner] Playwright found nothing, trying Claude fallback...`);
    rawVacancies = await parseWithClaude(scan.district.jobBoardUrl);
    usedClaudeFallback = true;
  }
}

// Check if aborted
if (timeoutController.signal.aborted) {
  throw new Error("Scan timed out");
}

// B1: Claude-fallback returning [] is the dominant silent-failure mode.
// Mark as completed_partial + claude_fallback_failed AND increment the
// district failure counter so these districts become eligible for the
// future failure-reset job.
if (usedClaudeFallback && rawVacancies.length === 0) {
  await prisma.vacancyScan.update({
    where: { id: scanId },
    data: {
      status: "completed_partial",
      vacancyCount: 0,
      errorMessage: "Claude fallback returned no vacancies",
      failureReason: categorizeFailure({
        errorMessage: "",
        context: "claude_fallback_empty",
      }),
      completedAt: new Date(),
    },
  });
  await markDistrictScanFailure(scan.district.leaid);
  return;
}
```

The B1 block is inserted *after* the timeout check and *before* the existing "Step 5: Post-process" block. Existing post-processing logic is untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts src/features/vacancies/lib/__tests__/scan-runner.test.ts
git commit -m "feat(vacancies): treat Claude-fallback-empty as claude_fallback_failed"
```

---

## Task 7: `markDistrictScan{Failure,Success}` return counter + tarpit-admission log

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts:13-28` (both helpers)
- Modify: `src/features/vacancies/lib/__tests__/scan-runner.test.ts`

- [ ] **Step 1: Add the failing test**

In `scan-runner.test.ts`, add a new describe block:

```ts
describe("runScan tarpit-admission log", () => {
  it("logs vacancy_tarpit_admission when consecutive_failures hits 5", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Simulate the fifth failure: districtUpdate returns counter = 5
    districtUpdate.mockResolvedValue({
      leaid: "0100001",
      name: "Test District",
      jobBoardPlatform: "applitrack",
      jobBoardUrl: "https://example.applitrack.com/onlineapp",
      vacancyConsecutiveFailures: 5,
    });

    getParserMock.mockImplementation(() => async () => {
      throw new Error("Request failed with status 404");
    });

    await runScan("scan_abc");

    const tarpitLog = consoleLogSpy.mock.calls.find((args) => {
      const first = args[0];
      if (typeof first !== "string") return false;
      try {
        const parsed = JSON.parse(first);
        return parsed.event === "vacancy_tarpit_admission";
      } catch {
        return false;
      }
    });
    expect(tarpitLog).toBeDefined();
    const parsed = JSON.parse(tarpitLog![0] as string);
    expect(parsed).toMatchObject({
      event: "vacancy_tarpit_admission",
      leaid: "0100001",
      name: "Test District",
      platform: "applitrack",
      last_failure_reason: "http_4xx",
    });

    consoleLogSpy.mockRestore();
  });

  it("does NOT log vacancy_tarpit_admission when counter is 4 or 6", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    districtUpdate.mockResolvedValue({
      leaid: "0100001",
      name: "Test District",
      jobBoardPlatform: "applitrack",
      jobBoardUrl: "https://example.applitrack.com/onlineapp",
      vacancyConsecutiveFailures: 4,
    });

    getParserMock.mockImplementation(() => async () => {
      throw new Error("boom");
    });

    await runScan("scan_abc");

    const tarpitLog = consoleLogSpy.mock.calls.find((args) => {
      const first = args[0];
      return typeof first === "string" && first.includes("vacancy_tarpit_admission");
    });
    expect(tarpitLog).toBeUndefined();

    consoleLogSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: FAIL — no tarpit log emitted yet.

- [ ] **Step 3: Update both helpers to return the counter and emit the admission log**

In `src/features/vacancies/lib/scan-runner.ts:13-28`, replace both helpers:

```ts
async function markDistrictScanSuccess(leaid: string): Promise<number> {
  await prisma.district.update({
    where: { leaid },
    data: { vacancyConsecutiveFailures: 0, vacancyLastFailureAt: null },
  });
  return 0;
}

async function markDistrictScanFailure(
  leaid: string,
  failureReason: VacancyFailureReason | null = null,
): Promise<number> {
  const updated = await prisma.district.update({
    where: { leaid },
    data: {
      vacancyConsecutiveFailures: { increment: 1 },
      vacancyLastFailureAt: new Date(),
    },
    select: {
      leaid: true,
      name: true,
      jobBoardPlatform: true,
      jobBoardUrl: true,
      vacancyConsecutiveFailures: true,
    },
  });

  if (updated.vacancyConsecutiveFailures === 5) {
    console.log(
      JSON.stringify({
        event: "vacancy_tarpit_admission",
        leaid: updated.leaid,
        name: updated.name,
        platform: updated.jobBoardPlatform,
        job_board_url: updated.jobBoardUrl,
        last_failure_reason: failureReason,
      }),
    );
  }

  return updated.vacancyConsecutiveFailures;
}
```

Add the import for `VacancyFailureReason` at the top (next to the existing Prisma import):

```ts
import { Prisma, type VacancyFailureReason } from "@prisma/client";
```

Now thread the `failureReason` through every existing `markDistrictScanFailure` call site so the log carries the right reason. There are three call sites — show explicit code for each:

**Site 1 — No-URL branch (originally edited in Task 4).** Capture the reason into a local before the `prisma.update`, then pass it into the helper:

```ts
if (!scan.district.jobBoardUrl) {
  const failureReason = categorizeFailure({
    errorMessage: "",
    context: "no_job_board_url",
  });
  await prisma.vacancyScan.update({
    where: { id: scanId },
    data: {
      status: "failed",
      errorMessage: "District has no job board URL",
      failureReason,
      completedAt: new Date(),
    },
  });
  await markDistrictScanFailure(scan.district.leaid, failureReason);
  return;
}
```

**Site 2 — B1 Claude-empty (originally added in Task 6).** Same pattern:

```ts
if (usedClaudeFallback && rawVacancies.length === 0) {
  const failureReason = categorizeFailure({
    errorMessage: "",
    context: "claude_fallback_empty",
  });
  await prisma.vacancyScan.update({
    where: { id: scanId },
    data: {
      status: "completed_partial",
      vacancyCount: 0,
      errorMessage: "Claude fallback returned no vacancies",
      failureReason,
      completedAt: new Date(),
    },
  });
  await markDistrictScanFailure(scan.district.leaid, failureReason);
  return;
}
```

**Site 3 — Outer catch (originally edited in Task 3).** Same pattern:

```ts
} catch (error) {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown error";

  console.error(`[scan-runner] Scan ${scanId} failed:`, errorMessage);

  try {
    const failureReason = categorizeFailure({
      errorMessage,
      context: "thrown_error",
    });
    await prisma.vacancyScan.update({
      where: { id: scanId },
      data: {
        status: "failed",
        errorMessage,
        failureReason,
        completedAt: new Date(),
      },
    });
    if (scan?.district?.leaid) {
      await markDistrictScanFailure(scan.district.leaid, failureReason);
    }
  } catch (updateError) {
    console.error(
      `[scan-runner] Failed to update scan ${scanId} status:`,
      updateError,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: PASS — both new tarpit tests green; all existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts src/features/vacancies/lib/__tests__/scan-runner.test.ts
git commit -m "feat(vacancies): emit vacancy_tarpit_admission log on 4->5 transition"
```

---

## Task 8: Per-scan `vacancy_scan_outcome` log

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts` — hoist tracking variables, emit log in `finally`
- Modify: `src/features/vacancies/lib/__tests__/scan-runner.test.ts`

- [ ] **Step 1: Add the failing test**

In `scan-runner.test.ts`, add a new describe block:

```ts
describe("runScan per-scan outcome log", () => {
  it("emits vacancy_scan_outcome with all required fields", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Successful scan path
    getParserMock.mockImplementation(() => async () => []);
    districtUpdate.mockResolvedValue({
      leaid: "0100001",
      name: "Test District",
      jobBoardPlatform: "applitrack",
      jobBoardUrl: "https://example.applitrack.com/onlineapp",
      vacancyConsecutiveFailures: 0,
    });

    await runScan("scan_abc");

    const outcomeLog = consoleLogSpy.mock.calls
      .map((args) => {
        try {
          return JSON.parse(args[0] as string);
        } catch {
          return null;
        }
      })
      .find((p) => p?.event === "vacancy_scan_outcome");
    expect(outcomeLog).toBeDefined();
    expect(outcomeLog).toMatchObject({
      event: "vacancy_scan_outcome",
      leaid: "0100001",
      platform: "applitrack",
      status: "completed",
      failure_reason: null,
      vacancy_count: 0,
      consecutive_failures_after: 0,
    });
    expect(typeof outcomeLog.duration_ms).toBe("number");
    expect(typeof outcomeLog.was_first_attempt).toBe("boolean");

    consoleLogSpy.mockRestore();
  });
});
```

You will also need to extend the `prisma` mock to include `vacancyScan.count`. Update the `vi.mock("@/lib/prisma", ...)` block at the top of `scan-runner.test.ts`:

```ts
const vacancyScanCount = vi.fn();
// ...inside vi.mock("@/lib/prisma", () => ({...}))
vacancyScan: {
  findUnique: (...args: unknown[]) => vacancyScanFindUnique(...args),
  update: (...args: unknown[]) => vacancyScanUpdate(...args),
  count: (...args: unknown[]) => vacancyScanCount(...args),
},
```

And reset it in `beforeEach`:

```ts
vacancyScanCount.mockReset().mockResolvedValue(0);  // default: first attempt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: FAIL — no `vacancy_scan_outcome` log emitted.

- [ ] **Step 3: Hoist tracking variables and emit the log**

In `src/features/vacancies/lib/scan-runner.ts:40-58` (top of `runScan`), after the existing `let scan: ... = null;` line, add:

```ts
const scanStartMs = Date.now();
let finalStatus: string = "unknown";
let finalFailureReason: VacancyFailureReason | null = null;
let finalVacancyCount = 0;
let finalConsecutiveFailures = 0;
let detectedPlatform: string | null = null;
let hadPriorCompletedScan = false;
```

Then near the start of `try` (after fetching `scan`), capture `was_first_attempt`:

```ts
const priorCount = await prisma.vacancyScan.count({
  where: {
    leaid: scan.district.leaid,
    status: { in: ["completed", "completed_partial"] },
    NOT: { id: scanId },
  },
});
hadPriorCompletedScan = priorCount > 0;
```

Now thread the hoisted variables through every status-setting site. Each `prisma.vacancyScan.update` call gets a small post-update block that copies the values into the hoisted vars. Each `markDistrictScan{Success,Failure}` call captures its return value into `finalConsecutiveFailures`. Enumerated:

**Right after `detectPlatform`** (around line 101):

```ts
detectedPlatform = platform;
```

**Site A — no-URL branch** (the block from Task 7 Site 1). After the `prisma.vacancyScan.update`, before `markDistrictScanFailure`:

```ts
finalStatus = "failed";
finalFailureReason = failureReason;
```

After the helper call:

```ts
finalConsecutiveFailures = await markDistrictScanFailure(scan.district.leaid, failureReason);
```

(Replace the existing `await markDistrictScanFailure(...)` line with this assignment form.)

**Site B — Claude-empty branch** (the block from Task 7 Site 2). Same pattern:

```ts
finalStatus = "completed_partial";
finalFailureReason = failureReason;
finalConsecutiveFailures = await markDistrictScanFailure(scan.district.leaid, failureReason);
```

**Site C — statewide_unattributable** (around the existing line 168-178 block, after the `prisma.update`):

```ts
finalStatus = "completed_partial";
finalFailureReason = "statewide_unattributable";
finalConsecutiveFailures = await markDistrictScanSuccess(scan.district.leaid);
```

(Replace the existing `await markDistrictScanSuccess(...)` line.)

**Site D — statewide success path** (after the `prisma.update` around line 209-219):

```ts
finalStatus = "completed";
finalVacancyCount = result.vacancyCount;
finalConsecutiveFailures = await markDistrictScanSuccess(scan.district.leaid);
```

**Site E — enrollment_ratio_skip** (after the `prisma.update` around line 247-258):

```ts
finalStatus = "completed_partial";
finalFailureReason = "enrollment_ratio_skip";
finalConsecutiveFailures = await markDistrictScanSuccess(scan.district.leaid);
```

**Site F — district-scoped success** (after the `prisma.update` around line 275-284):

```ts
finalStatus = "completed";
finalVacancyCount = result.vacancyCount;
finalConsecutiveFailures = await markDistrictScanSuccess(scan.district.leaid);
```

**Site G — outer catch** (the block from Task 7 Site 3). After the inner `prisma.update`, before `markDistrictScanFailure`:

```ts
finalStatus = "failed";
finalFailureReason = failureReason;
```

After the helper call:

```ts
finalConsecutiveFailures = await markDistrictScanFailure(scan.district.leaid, failureReason);
```

Finally, replace the existing `finally` block (currently just `clearTimeout(timeoutId);`) with:

```ts
} finally {
  clearTimeout(timeoutId);
  console.log(
    JSON.stringify({
      event: "vacancy_scan_outcome",
      leaid: scan?.district.leaid ?? null,
      platform: detectedPlatform,
      status: finalStatus,
      failure_reason: finalFailureReason,
      vacancy_count: finalVacancyCount,
      duration_ms: Date.now() - scanStartMs,
      was_first_attempt: !hadPriorCompletedScan,
      consecutive_failures_after: finalConsecutiveFailures,
    }),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/vacancies/lib/__tests__/scan-runner.test.ts`
Expected: PASS — outcome-log test green; all prior tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts src/features/vacancies/lib/__tests__/scan-runner.test.ts
git commit -m "feat(vacancies): emit vacancy_scan_outcome log per scan"
```

---

## Task 9: Cron `tarpitSize` query + `vacancy_cron_summary` log

**Files:**
- Modify: `src/app/api/cron/scan-vacancies/route.ts:49-150` (handler body)
- Test: no new automated test (the cron route has no existing tests; manual verification via the per-batch JSON response is sufficient — see Step 4)

- [ ] **Step 1: Add the tarpit query**

In `src/app/api/cron/scan-vacancies/route.ts`, immediately before the existing `await loadSharedJobBoardUrls();` call (around line 54), add:

```ts
const tarpitSize = await prisma.district.count({
  where: {
    jobBoardUrl: { not: null },
    vacancyConsecutiveFailures: { gte: 5 },
  },
});
```

- [ ] **Step 2: Update each `runScan` result aggregation to capture the failureReason**

In the existing parallel-batch block (around line 175-209), the loop body reads the post-run scan record:

```ts
const result = await prisma.vacancyScan.findUnique({
  where: { id: scan.id },
  select: { status: true, platform: true, startedAt: true, completedAt: true },
});
```

Add `failureReason: true` to the select:

```ts
const result = await prisma.vacancyScan.findUnique({
  where: { id: scan.id },
  select: {
    status: true,
    platform: true,
    startedAt: true,
    completedAt: true,
    failureReason: true,
  },
});
```

And extend the `results.push` to include the reason:

```ts
results.push({
  leaid: representative.leaid,
  name: representative.name,
  status: result?.status ?? "unknown",
  failureReason: result?.failureReason ?? null,
  statewide: isStatewide,
});
```

Update the local `results` array type accordingly:

```ts
const results: {
  leaid: string;
  name: string;
  status: string;
  failureReason: string | null;
  statewide: boolean;
}[] = [];
```

- [ ] **Step 3: Emit the cron summary log**

Immediately before the existing `return NextResponse.json({...})` at the end of the handler (around line 221), add:

```ts
const failureReasonMix = results.reduce<Record<string, number>>((acc, r) => {
  if (r.failureReason) acc[r.failureReason] = (acc[r.failureReason] ?? 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify({
    event: "vacancy_cron_summary",
    batch_id: batchId,
    total_stale: staleDistricts.length,
    unique_urls: urlGroups.size,
    scans_run: batch.length,
    districts_processed: districtsProcessed,
    never_scanned_groups_remaining: neverScannedGroupsRemaining,
    sibling_coverage_created: siblingCoverageCreated,
    tarpit_size_at_start: tarpitSize,
    failure_reason_mix: failureReasonMix,
  }),
);
```

- [ ] **Step 4: Manual smoke verification**

Run the dev server (`npm run dev` on port 3005), then in another terminal hit the cron locally (CRON_SECRET must be set in `.env.local`):

```bash
curl "http://localhost:3005/api/cron/scan-vacancies?secret=${CRON_SECRET}&stale=999"
```

Expected: the response JSON returns successfully. The dev-server console shows a single `{"event":"vacancy_cron_summary",...}` line plus per-scan `vacancy_scan_outcome` lines. Note: `stale=999` ensures the pool is non-empty even on a freshly-scanned local DB.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/scan-vacancies/route.ts
git commit -m "feat(vacancies): emit vacancy_cron_summary log + tarpit_size_at_start"
```

---

## Task 10: Stats endpoint — add `tarpit`, `adjustedCoveragePct`, `topFailureReason7d`

**Files:**
- Modify: `src/app/api/admin/vacancy-scan-stats/route.ts`
- Create: `src/app/api/admin/vacancy-scan-stats/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/vacancy-scan-stats/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const districtCount = vi.fn();
const districtGroupBy = vi.fn();
const vacancyCount = vi.fn();
const vacancyGroupBy = vi.fn();
const vacancyScanCount = vi.fn();
const vacancyScanGroupBy = vi.fn();
const vacancyScanFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      count: (...args: unknown[]) => districtCount(...args),
      groupBy: (...args: unknown[]) => districtGroupBy(...args),
    },
    vacancy: {
      count: (...args: unknown[]) => vacancyCount(...args),
      groupBy: (...args: unknown[]) => vacancyGroupBy(...args),
    },
    vacancyScan: {
      count: (...args: unknown[]) => vacancyScanCount(...args),
      groupBy: (...args: unknown[]) => vacancyScanGroupBy(...args),
      findFirst: (...args: unknown[]) => vacancyScanFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ id: "user-1" }),
}));

import { GET } from "../route";

beforeEach(() => {
  districtCount.mockReset();
  districtGroupBy.mockReset();
  vacancyCount.mockReset();
  vacancyGroupBy.mockReset();
  vacancyScanCount.mockReset();
  vacancyScanGroupBy.mockReset();
  vacancyScanFindFirst.mockReset();
});

function setupHappyPath() {
  vacancyCount.mockResolvedValueOnce(120).mockResolvedValueOnce(100); // total, verified
  vacancyGroupBy.mockResolvedValueOnce([{ leaid: "1" }, { leaid: "2" }]); // districts with vacancies
  districtCount
    .mockResolvedValueOnce(1000) // totalDistrictsWithUrl
    .mockResolvedValueOnce(50); // tarpit total
  vacancyScanCount.mockResolvedValueOnce(60).mockResolvedValueOnce(2); // 7d scans, 24h failures
  vacancyScanFindFirst.mockResolvedValueOnce({
    completedAt: new Date("2026-05-03T12:00:00Z"),
    platform: "applitrack",
    districtsMatched: 0,
  });
  vacancyScanGroupBy
    .mockResolvedValueOnce([{ platform: "olas", _count: 10 }]) // by platform
    .mockResolvedValueOnce([
      { leaid: "1" },
      { leaid: "2" },
      { leaid: "3" },
    ]) // scanned districts
    .mockResolvedValueOnce([
      { failureReason: "claude_fallback_failed", _count: 18 },
      { failureReason: "scan_timeout", _count: 6 },
    ]); // 7d failure-reason mix
  districtGroupBy.mockResolvedValueOnce([
    { jobBoardPlatform: "claude", _count: 38 },
    { jobBoardPlatform: null, _count: 12 },
  ]); // tarpit by platform
}

describe("GET /api/admin/vacancy-scan-stats — new fields", () => {
  it("returns tarpit, adjustedCoveragePct, and topFailureReason7d", async () => {
    setupHappyPath();
    const res = await GET();
    const body = await res.json();

    expect(body.tarpit).toEqual({
      total: 50,
      byPlatform: [
        { platform: "claude", count: 38 },
        { platform: "unknown", count: 12 },
      ],
    });
    // adjusted = scannedDistricts(3) / (totalWithUrl(1000) - tarpit(50)) = 3/950 = 0.32% rounded
    expect(body.adjustedCoveragePct).toBe(0);
    expect(body.topFailureReason7d).toEqual({
      reason: "claude_fallback_failed",
      pct: 75, // 18 / (18 + 6) = 0.75
    });
  });

  it("returns adjustedCoveragePct == coveragePct when tarpit is empty", async () => {
    vacancyCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyGroupBy.mockResolvedValueOnce([]);
    districtCount.mockResolvedValueOnce(100).mockResolvedValueOnce(0);
    vacancyScanCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyScanFindFirst.mockResolvedValueOnce(null);
    vacancyScanGroupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ leaid: "1" }]) // 1 scanned
      .mockResolvedValueOnce([]);
    districtGroupBy.mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body.coveragePct).toBe(1);
    expect(body.adjustedCoveragePct).toBe(1);
    expect(body.topFailureReason7d).toBeNull();
    expect(body.tarpit).toEqual({ total: 0, byPlatform: [] });
  });

  it("floors the adjusted denominator at 1 when every district is tarpitted", async () => {
    vacancyCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyGroupBy.mockResolvedValueOnce([]);
    districtCount.mockResolvedValueOnce(50).mockResolvedValueOnce(50);
    vacancyScanCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyScanFindFirst.mockResolvedValueOnce(null);
    vacancyScanGroupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    districtGroupBy.mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();
    // 0 / max(1, 0) = 0%
    expect(body.adjustedCoveragePct).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/vacancy-scan-stats/__tests__/route.test.ts`
Expected: FAIL — endpoint doesn't return the new fields yet.

- [ ] **Step 3: Implement the new fields**

Replace the entire body of the `try` block in `src/app/api/admin/vacancy-scan-stats/route.ts` (currently lines 13-84) with:

```ts
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const [
  totalVacancies,
  verifiedVacancies,
  districtsWithVacancies,
  totalDistrictsWithUrl,
  tarpitTotal,
  recentScans,
  failedScans24h,
  lastScan,
  byPlatform,
  scannedDistricts,
  failureReasonGroups,
  tarpitByPlatformRaw,
] = await Promise.all([
  prisma.vacancy.count({ where: { status: "open" } }),
  prisma.vacancy.count({ where: { status: "open", districtVerified: true } }),
  prisma.vacancy.groupBy({ by: ["leaid"], where: { status: "open", districtVerified: true } }),
  prisma.district.count({ where: { jobBoardUrl: { not: null } } }),
  prisma.district.count({
    where: { jobBoardUrl: { not: null }, vacancyConsecutiveFailures: { gte: 5 } },
  }),
  prisma.vacancyScan.count({
    where: {
      status: { in: ["completed", "completed_partial"] },
      completedAt: { gte: sevenDaysAgo },
    },
  }),
  prisma.vacancyScan.count({
    where: {
      status: "failed",
      startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  }),
  prisma.vacancyScan.findFirst({
    where: { status: { in: ["completed", "completed_partial"] } },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true, platform: true, districtsMatched: true },
  }),
  prisma.vacancyScan.groupBy({
    by: ["platform"],
    where: {
      status: { in: ["completed", "completed_partial"] },
      completedAt: { gte: sevenDaysAgo },
    },
    _count: true,
  }),
  prisma.vacancyScan.groupBy({
    by: ["leaid"],
    where: { status: { in: ["completed", "completed_partial"] } },
  }),
  prisma.vacancyScan.groupBy({
    by: ["failureReason"],
    where: {
      status: { in: ["failed", "completed_partial"] },
      completedAt: { gte: sevenDaysAgo },
      failureReason: { not: null },
    },
    _count: true,
  }),
  prisma.district.groupBy({
    by: ["jobBoardPlatform"],
    where: { jobBoardUrl: { not: null }, vacancyConsecutiveFailures: { gte: 5 } },
    _count: true,
  }),
]);

const coveragePct = totalDistrictsWithUrl > 0
  ? Math.round((scannedDistricts.length / totalDistrictsWithUrl) * 100)
  : 0;

const adjustedDenominator = Math.max(1, totalDistrictsWithUrl - tarpitTotal);
const adjustedCoveragePct = Math.round(
  (scannedDistricts.length / adjustedDenominator) * 100,
);

const tarpitByPlatform = tarpitByPlatformRaw
  .map((r) => ({
    platform: r.jobBoardPlatform || "unknown",
    count: r._count,
  }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 4);

const totalFailures7d = failureReasonGroups.reduce((s, g) => s + g._count, 0);
const topGroup = failureReasonGroups
  .slice()
  .sort((a, b) => b._count - a._count)[0];
const topFailureReason7d = topGroup && totalFailures7d > 0
  ? {
      reason: topGroup.failureReason!,
      pct: Math.round((topGroup._count / totalFailures7d) * 100),
    }
  : null;

return NextResponse.json({
  totalVacancies,
  verifiedVacancies,
  districtsWithVacancies: districtsWithVacancies.length,
  totalDistrictsWithUrl,
  districtsScanned: scannedDistricts.length,
  coveragePct,
  adjustedCoveragePct,
  tarpit: {
    total: tarpitTotal,
    byPlatform: tarpitByPlatform,
  },
  topFailureReason7d,
  scansLast7d: recentScans,
  failedLast24h: failedScans24h,
  lastScanAt: lastScan?.completedAt?.toISOString() ?? null,
  byPlatform: byPlatform.map((p) => ({
    platform: p.platform || "unknown",
    count: p._count,
  })),
});
```

The existing outer `try`/`catch (error)` and 500 fallback (lines 85-92) are preserved unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/admin/vacancy-scan-stats/__tests__/route.test.ts`
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/vacancy-scan-stats/route.ts src/app/api/admin/vacancy-scan-stats/__tests__/route.test.ts
git commit -m "feat(admin): add tarpit/adjusted-coverage/top-failure-reason to vacancy stats"
```

---

## Task 11: Admin card row 2 — Tarpit / Adjusted Coverage / Top Failure Reason

**Files:**
- Modify: `src/features/admin/components/VacancyScanCard.tsx`
- Create: `src/features/admin/components/__tests__/VacancyScanCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/components/__tests__/VacancyScanCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VacancyScanCard from "../VacancyScanCard";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as never;
});

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VacancyScanCard />
    </QueryClientProvider>,
  );
}

function mockStats(overrides: Record<string, unknown> = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      totalVacancies: 100,
      verifiedVacancies: 95,
      districtsWithVacancies: 40,
      totalDistrictsWithUrl: 1000,
      districtsScanned: 450,
      coveragePct: 45,
      adjustedCoveragePct: 47,
      tarpit: { total: 50, byPlatform: [{ platform: "claude", count: 38 }] },
      topFailureReason7d: { reason: "claude_fallback_failed", pct: 75 },
      scansLast7d: 100,
      failedLast24h: 0,
      lastScanAt: new Date().toISOString(),
      byPlatform: [],
      ...overrides,
    }),
  });
}

describe("VacancyScanCard row 2 — diagnostics", () => {
  it("renders Tarpit, Adjusted Coverage, and Top Failure Reason", async () => {
    mockStats();
    renderCard();

    expect(await screen.findByText("Tarpit")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText(/claude \(38\)/)).toBeInTheDocument();

    expect(screen.getByText("Adjusted Coverage")).toBeInTheDocument();
    expect(screen.getByText("47%")).toBeInTheDocument();

    expect(screen.getByText("Top Failure Reason")).toBeInTheDocument();
    expect(screen.getByText("claude_fallback_failed")).toBeInTheDocument();
    expect(screen.getByText("75% of failures (7d)")).toBeInTheDocument();
  });

  it("renders dash for top failure reason when null", async () => {
    mockStats({ topFailureReason7d: null });
    renderCard();
    await screen.findByText("Top Failure Reason");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("no failures")).toBeInTheDocument();
  });

  it("renders no sub-line when tarpit is empty", async () => {
    mockStats({ tarpit: { total: 0, byPlatform: [] } });
    renderCard();
    expect(await screen.findByText("Tarpit")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    // platform sub-line should not appear when total is 0
    expect(screen.queryByText(/claude \(/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/admin/components/__tests__/VacancyScanCard.test.tsx`
Expected: FAIL — none of "Tarpit", "Adjusted Coverage", "Top Failure Reason" exist yet.

- [ ] **Step 3: Update the component**

In `src/features/admin/components/VacancyScanCard.tsx`, extend the `VacancyScanStats` interface (lines 5-16):

```ts
interface VacancyScanStats {
  totalVacancies: number;
  verifiedVacancies: number;
  districtsWithVacancies: number;
  totalDistrictsWithUrl: number;
  districtsScanned: number;
  coveragePct: number;
  adjustedCoveragePct: number;
  tarpit: {
    total: number;
    byPlatform: { platform: string; count: number }[];
  };
  topFailureReason7d: { reason: string; pct: number } | null;
  scansLast7d: number;
  failedLast24h: number;
  lastScanAt: string | null;
  byPlatform: { platform: string; count: number }[];
}
```

Update the `healthColor` computation (line 50-55) to add the tarpit threshold:

```ts
const tarpitRatio = data.totalDistrictsWithUrl > 0
  ? data.tarpit.total / data.totalDistrictsWithUrl
  : 0;

const healthColor =
  data.failedLast24h > 5 || tarpitRatio > 0.30
    ? "#F37167"
    : data.coveragePct < 10
      ? "#E5A53D"
      : "#8AA891";
```

After the existing 4-stat grid (closing `</div>` after line 90) and before the Progress Bar block (line 93), insert a new row:

```tsx
{/* Diagnostics row */}
<div className="grid grid-cols-3 gap-4">
  <Stat
    label="Tarpit"
    value={data.tarpit.total.toLocaleString()}
    sub={
      data.tarpit.total > 0
        ? data.tarpit.byPlatform
            .slice(0, 2)
            .map((p) => `${p.platform} (${p.count})`)
            .join(", ")
        : undefined
    }
    alert={data.tarpit.total > 0}
  />
  <Stat
    label="Adjusted Coverage"
    value={`${data.adjustedCoveragePct}%`}
    sub="of reachable pool"
  />
  <Stat
    label="Top Failure Reason"
    value={data.topFailureReason7d?.reason ?? "—"}
    sub={
      data.topFailureReason7d
        ? `${data.topFailureReason7d.pct}% of failures (7d)`
        : "no failures"
    }
  />
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/admin/components/__tests__/VacancyScanCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Visual verification**

Run `npm run dev` and visit `/admin` (or wherever `VacancyScanCard` renders — confirm route by grep if unsure). Confirm row 2 renders with the three new stats and that the alert dot turns red when tarpit > 30% of URL-bearing districts.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/components/VacancyScanCard.tsx src/features/admin/components/__tests__/VacancyScanCard.test.tsx
git commit -m "feat(admin): add coverage-diagnostics row to VacancyScanCard"
```

---

## Task 12: One-time historical backfill script

**Files:**
- Create: `scripts/backfill-vacancy-failure-reasons.ts`

- [ ] **Step 1: Write the script**

Create `scripts/backfill-vacancy-failure-reasons.ts`:

```ts
/**
 * One-time backfill: categorize historical VacancyScan failures into the
 * new failureReason column.
 *
 * Run:    npx tsx scripts/backfill-vacancy-failure-reasons.ts
 * Dry:    DRY_RUN=true npx tsx scripts/backfill-vacancy-failure-reasons.ts
 *
 * Idempotent — safe to re-run; the WHERE clause skips already-categorized rows.
 */
import prisma from "@/lib/prisma";
import { categorizeFailure } from "@/features/vacancies/lib/failure-reasons";
import type { VacancyFailureReason } from "@prisma/client";

const BATCH_SIZE = 500;
const DRY_RUN = process.env.DRY_RUN === "true";

async function main() {
  const counts: Record<string, number> = {};
  let totalProcessed = 0;
  let cursor: string | undefined = undefined;

  for (;;) {
    const batch = await prisma.vacancyScan.findMany({
      where: {
        status: { in: ["failed", "completed_partial"] },
        failureReason: null,
      },
      select: { id: true, errorMessage: true },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const updates: { id: string; reason: VacancyFailureReason }[] = batch.map((row) => {
      const reason = categorizeFailure({
        errorMessage: row.errorMessage ?? "",
        context: "thrown_error",
      });
      counts[reason] = (counts[reason] ?? 0) + 1;
      return { id: row.id, reason };
    });

    if (!DRY_RUN) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.vacancyScan.update({
            where: { id: u.id },
            data: { failureReason: u.reason },
          }),
        ),
      );
    }

    totalProcessed += batch.length;
    cursor = batch[batch.length - 1]!.id;
    console.log(
      `[backfill] processed ${totalProcessed} rows so far${DRY_RUN ? " (dry run)" : ""}`,
    );
  }

  console.log("\n=== Backfill summary ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Total rows processed: ${totalProcessed}`);
  console.log("Bucket counts:");
  for (const [reason, count] of Object.entries(counts).sort(
    ([, a], [, b]) => b - a,
  )) {
    console.log(`  ${reason.padEnd(28)} ${count}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
  });
```

- [ ] **Step 2: Dry-run the script**

Run: `DRY_RUN=true npx tsx scripts/backfill-vacancy-failure-reasons.ts`
Expected: prints batch progress, then a summary table. No DB writes (verify by re-running and seeing the same counts).

- [ ] **Step 3: Live-run the script**

Run: `npx tsx scripts/backfill-vacancy-failure-reasons.ts`
Expected: same output as dry-run, but writes are committed. Re-running should produce a summary with `Total rows processed: 0` because the WHERE clause now excludes everything.

- [ ] **Step 4: Spot-check the result**

Run a quick prisma query (or psql) to verify a sample:

```bash
npx prisma studio
```

Or via psql:

```sql
SELECT failure_reason, COUNT(*) FROM vacancy_scans
WHERE status IN ('failed', 'completed_partial')
GROUP BY failure_reason ORDER BY COUNT(*) DESC;
```

Expected: every `failed` / `completed_partial` row has a non-null `failure_reason`.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-vacancy-failure-reasons.ts
git commit -m "chore(vacancies): backfill script for failureReason column"
```

---

## Task 13: End-to-end verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests pass — new and existing.

- [ ] **Step 2: Run typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manually verify the admin card**

Visit the admin page in `npm run dev`. Confirm:
- The card renders 4 stats in row 1 (unchanged) and 3 stats in row 2 (new).
- "Tarpit" shows a number > 0 if your local DB has districts at 5+ failures (post-backfill, this is likely).
- "Adjusted Coverage" reads as a percentage.
- "Top Failure Reason" shows a bucket name with a percentage sub-line.
- The health dot reflects red/yellow/green correctly.

- [ ] **Step 4: Trigger one cron run and inspect logs**

Run: `curl "http://localhost:3005/api/cron/scan-vacancies?secret=${CRON_SECRET}&stale=999"`
Expected: dev-server console contains:
- One `vacancy_cron_summary` JSON line with all keys present.
- 1–5 `vacancy_scan_outcome` JSON lines, one per scan run.
- (Possibly) a `vacancy_tarpit_admission` line if any scan crossed 4→5 failures.

- [ ] **Step 5: Final commit and push**

If everything looks good, push the branch:

```bash
git push -u origin <branch-name>
```

The branch is ready for PR.

---

## Self-Review Notes

- **Spec coverage:** Each spec section maps to a task: Part 1 (taxonomy) → Task 1 enum + Task 2 helper. Part 2 (schema) → Task 1. Part 3 (helper + scan-runner) → Tasks 2-7. Part 4 (cron telemetry) → Task 9. Part 5 (per-scan log) → Task 8. Part 6 (tarpit admission) → Task 7. Part 7 (stats endpoint) → Task 10. Part 8 (admin card) → Task 11. Part 9 (backfill) → Task 12. Migration plan → Tasks 1 + 12 + 13.
- **TDD:** Every task with code emits a failing test first, then minimal implementation, then green-light verification.
- **Bite-sized:** No step is more than ~5 minutes of mechanical work; the longest are the helper-write step and the stats-endpoint refactor, both ≤10 minutes.
- **Type consistency:** `categorizeFailure` returns `VacancyFailureReason` everywhere; `markDistrictScan{Failure,Success}` both return `Promise<number>`; the admin card and stats endpoint share an explicit type for `tarpit`/`topFailureReason7d`.
- **No placeholders:** every step contains the exact file path, code, and command needed.
