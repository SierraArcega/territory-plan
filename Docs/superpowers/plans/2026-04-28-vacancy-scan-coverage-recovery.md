# Vacancy Scan Coverage Recovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover vacancy ingest from a >80% scan failure rate caused by PR #129 (the starvation fix) routing the cron into the long tail of unparseable URLs. Restore daily new-vacancy throughput from ~1/day back toward pre-regression levels (was 0% failures before 2026-04-23).

**Architecture:** Three independent fixes addressing the cascading failure mode the starvation fix exposed.

1. **Backfill `jobBoardPlatform`** on the 7,429 districts whose URLs have a `jobBoardUrl` but no platform set. Many of those URLs are `*.applitrack.com`, `*.olasjobs.org`, `*.schoolspring.com`, or `*.tedk12.com` and were simply never re-classified. Running `detectPlatform()` against current URLs will route them to the correct parser instead of `parseWithClaude` on Vercel.

2. **Cap unknown-platform scans per cron run** to ≤ 1 of the 5 scans, so failure-prone Claude-fallback URLs cannot starve the working districts of bandwidth.

3. **Track per-district scan health** on `District` (new columns `vacancy_consecutive_failures`, `vacancy_last_failure_at`). `runScan` updates them on every terminal status. The cron filters out districts with ≥ 5 consecutive failures so the pipeline naturally sheds dead URLs.

**Tech Stack:** Prisma + Postgres, Next.js 16 App Router cron routes, Vitest.

**Diagnostic context:**

- 12,639 districts have a `jobBoardUrl`. Platform distribution: 7,429 unset, 2,242 schoolspring, 1,511 unknown, 1,411 applitrack, 46 olas. So ~70% of URLs route to the Claude fallback.
- 6,953 districts have **never** completed a scan.
- Failure-rate timeline (vacancy_scans, last 14d): 0% on 2026-04-15 through 2026-04-22, then **45% / 68% / 100% / 100% / 78% / 86% / 100%** starting 2026-04-23 — the day after PR #129 (`fix(vacancies): unstarve never-scanned districts in cron scheduler`) merged.
- 48h error breakdown: 109 "fetch failed", 123 "operation aborted due to timeout", 1 Claude 500. Avg failed-scan duration: 18.4s; avg completed: 13.6s. The 18s failure mode is well below the 180s `SCAN_TIMEOUT_MS` — these are upstream fetch timeouts inside `parseWithClaude` / dead URLs.
- 48h: 50 completed / 233 failed / 0 partial. Net new vacancies last 24h: 1.

**Working directory (IMPORTANT):** all work happens in the worktree, not the main checkout:

```
/Users/sierraarcega/territory-plan/.claude/worktrees/vacancy-recovery
```

Branch: `fix/vacancy-scan-coverage` (off `vacancies-and-news`, which is itself off `origin/main` at `4a76d081`). The companion `fix/news-ingest-timeout` branch runs the parallel news plan; the two branches don't share files and merge to main independently.

**Verification tooling:** `psql "$DATABASE_URL"` (`DATABASE_URL` is in `.env.local`). `npm test` for Vitest. Production verification uses Vercel and Supabase MCPs.

---

## File Structure

**Create:**
- `scripts/backfill-job-board-platform.ts` — one-shot Node script (run via `npx tsx`) that re-runs `detectPlatform()` against every district's `jobBoardUrl` and writes `jobBoardPlatform`
- `prisma/migrations/20260428_district_vacancy_health/migration.sql` — adds the two scan-health columns

**Modify:**
- `prisma/schema.prisma` (model `District`) — add `vacancyConsecutiveFailures` (Int, default 0) and `vacancyLastFailureAt` (DateTime?)
- `src/features/vacancies/lib/scan-runner.ts` — increment / reset health columns on terminal status transitions (failed / completed / completed_partial)
- `src/features/vacancies/lib/__tests__/scan-runner.test.ts` (create if absent) — covers the health-column updates
- `src/app/api/cron/scan-vacancies/route.ts` — (a) filter out districts with ≥ 5 consecutive failures, (b) cap unknown-platform groups in the per-run batch to ≤ 1

No changes to admin observability in this plan — that's a follow-up.

---

### Task 1: Backfill `jobBoardPlatform` on existing districts

**Files:**
- Create: `scripts/backfill-job-board-platform.ts`

This is a one-shot script. It reads every district with `jobBoardUrl IS NOT NULL`, runs `detectPlatform()` against the current URL, and writes the result back if it differs. Idempotent — safe to re-run.

- [ ] **Step 1: `cd` into the worktree and confirm branch**

```bash
cd /Users/sierraarcega/territory-plan/.claude/worktrees/vacancy-recovery
git status
```

Expected: `On branch fix/vacancy-scan-coverage`, clean tree.

- [ ] **Step 2: Capture pre-backfill platform distribution**

```bash
set -a; source .env.local; set +a
psql "$DATABASE_URL" -c "
  SELECT COALESCE(job_board_platform, '(unset)') AS platform, COUNT(*)::int AS n
  FROM districts WHERE job_board_url IS NOT NULL
  GROUP BY job_board_platform ORDER BY n DESC;
"
```

Expected (today): roughly `(unset)=7429, schoolspring=2242, unknown=1511, applitrack=1411, olas=46`. Save this output for the post-backfill comparison in Step 6.

- [ ] **Step 3: Write the script**

File: `scripts/backfill-job-board-platform.ts`

```ts
/**
 * Backfill District.jobBoardPlatform from current jobBoardUrl using
 * detectPlatform(). Idempotent — only writes when the detected platform
 * differs from what's currently stored.
 *
 * Usage:
 *   npx tsx scripts/backfill-job-board-platform.ts            # dry run
 *   npx tsx scripts/backfill-job-board-platform.ts --commit   # actually write
 */
import prisma from "@/lib/prisma";
import { detectPlatform } from "@/features/vacancies/lib/platform-detector";

async function main() {
  const commit = process.argv.includes("--commit");

  const districts = await prisma.district.findMany({
    where: { jobBoardUrl: { not: null } },
    select: { leaid: true, jobBoardUrl: true, jobBoardPlatform: true },
  });

  console.log(`[backfill] inspecting ${districts.length} districts`);

  const transitions = new Map<string, number>(); // "from→to" → count
  const updates: { leaid: string; from: string | null; to: string }[] = [];

  for (const d of districts) {
    if (!d.jobBoardUrl) continue;
    const detected = detectPlatform(d.jobBoardUrl);
    if (detected === d.jobBoardPlatform) continue;
    const key = `${d.jobBoardPlatform ?? "(unset)"} → ${detected}`;
    transitions.set(key, (transitions.get(key) ?? 0) + 1);
    updates.push({ leaid: d.leaid, from: d.jobBoardPlatform, to: detected });
  }

  console.log(`[backfill] ${updates.length} districts need an update`);
  for (const [key, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${n}`);
  }

  if (!commit) {
    console.log("[backfill] dry run — pass --commit to apply");
    return;
  }

  let written = 0;
  for (const u of updates) {
    await prisma.district.update({
      where: { leaid: u.leaid },
      data: { jobBoardPlatform: u.to },
    });
    written++;
    if (written % 500 === 0) console.log(`[backfill] wrote ${written}/${updates.length}`);
  }
  console.log(`[backfill] done, wrote ${written}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run the script in dry-run mode**

```bash
npx tsx scripts/backfill-job-board-platform.ts
```

Expected: a transition table is printed, e.g.:

```
[backfill] 5400 districts need an update
  (unset) → schoolspring: 1800
  (unset) → applitrack: 1200
  (unset) → unknown: 4400
  unknown → schoolspring: 50
  ...
```

If the script crashes or the numbers look off (e.g., everything → unknown), STOP and investigate `detectPlatform` against a sample of failing URLs before continuing.

- [ ] **Step 5: Apply the backfill against the dev DB**

```bash
npx tsx scripts/backfill-job-board-platform.ts --commit
```

Expected: progress logs every 500 rows, final `done, wrote N` message matching the dry-run count.

- [ ] **Step 6: Verify post-backfill platform distribution**

```bash
psql "$DATABASE_URL" -c "
  SELECT COALESCE(job_board_platform, '(unset)') AS platform, COUNT(*)::int AS n
  FROM districts WHERE job_board_url IS NOT NULL
  GROUP BY job_board_platform ORDER BY n DESC;
"
```

Expected: `(unset)` row drops to 0; the count moves into `applitrack` / `olas` / `schoolspring` / `unknown`. Compare against the Step 2 baseline.

- [ ] **Step 7: Commit**

```bash
git add scripts/backfill-job-board-platform.ts
git commit -m "feat(vacancies): backfill District.jobBoardPlatform from current URL"
```

Note: the script is committed but the data write is one-shot. Production needs the same script run against prod's `DATABASE_URL` after deploy. Document this in the PR description.

---

### Task 2: Add district vacancy-health columns (Prisma migration)

**Files:**
- Modify: `prisma/schema.prisma` (model `District`)
- Create: `prisma/migrations/20260428_district_vacancy_health/migration.sql`

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, inside `model District { ... }`, add (sort into the existing field block alphabetically; pick a place near the other `vacancy*` / `jobBoard*` fields):

```prisma
  vacancyConsecutiveFailures Int       @default(0) @map("vacancy_consecutive_failures")
  vacancyLastFailureAt       DateTime? @map("vacancy_last_failure_at")
```

- [ ] **Step 2: Create the migration directory**

```bash
mkdir -p prisma/migrations/20260428_district_vacancy_health
```

- [ ] **Step 3: Write the migration SQL**

File: `prisma/migrations/20260428_district_vacancy_health/migration.sql`

```sql
-- Track per-district vacancy scan health for cron-side filtering.
-- - vacancy_consecutive_failures resets to 0 on every successful scan,
--   increments on every failed scan.
-- - vacancy_last_failure_at is the timestamp of the most recent failure
--   (NULL if never failed or last result was success).
-- The scan-vacancies cron skips districts with consecutive_failures >= 5.

ALTER TABLE districts
  ADD COLUMN vacancy_consecutive_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN vacancy_last_failure_at TIMESTAMP(3) NULL;

CREATE INDEX districts_vacancy_consecutive_failures_idx
  ON districts (vacancy_consecutive_failures);
```

- [ ] **Step 4: Apply the migration to dev**

```bash
npx prisma migrate dev --name district_vacancy_health
```

Expected: migration applies; `prisma generate` runs automatically; `node_modules/@prisma/client` updated.

- [ ] **Step 5: Verify the columns exist**

```bash
psql "$DATABASE_URL" -c "
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name='districts'
    AND column_name IN ('vacancy_consecutive_failures', 'vacancy_last_failure_at');
"
```

Expected: 2 rows. `vacancy_consecutive_failures` is `integer NOT NULL DEFAULT 0`; `vacancy_last_failure_at` is `timestamp(3) NULL`.

- [ ] **Step 6: Run the test suite (regression check)**

```bash
npm test -- --run
```

Expected: all tests pass (no test references the new columns yet).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260428_district_vacancy_health/
git commit -m "feat(vacancies): add District.vacancyConsecutiveFailures + vacancyLastFailureAt"
```

---

### Task 3: Update `runScan` to maintain health columns (TDD)

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts`
- Create: `src/features/vacancies/lib/__tests__/scan-runner.test.ts`

The contract:
- On `status='completed'` or `status='completed_partial'`: set `vacancyConsecutiveFailures = 0`, `vacancyLastFailureAt = null` on the district.
- On `status='failed'`: increment `vacancyConsecutiveFailures`, set `vacancyLastFailureAt = now()`.
- The "no jobBoardUrl" early-return path counts as a failure (the URL is missing → it shouldn't be retried often).

The tidiest place to apply this is **inside the existing `prisma.vacancyScan.update` calls** that set terminal status — pair each with a `prisma.district.update` against the same `leaid`. Use a Prisma `$transaction` for atomicity.

- [ ] **Step 1: Read the current scan-runner terminal status branches**

```bash
grep -n "status: \"failed\"\|status: \"completed\"\|status: \"completed_partial\"" src/features/vacancies/lib/scan-runner.ts
```

Note every line where `vacancyScan.update` writes a terminal status. There are roughly 5: the no-URL early-return, the unattributable-statewide partial, the suspicious-aggregator partial, the statewide success, the district-scoped success, and the catch-block failure.

- [ ] **Step 2: Write the failing test**

File: `src/features/vacancies/lib/__tests__/scan-runner.test.ts`

```ts
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
  });
});
```

- [ ] **Step 3: Run the test — confirm it fails for the right reason**

```bash
npm test -- --run src/features/vacancies/lib/__tests__/scan-runner.test.ts
```

Expected: FAIL — the new health-column writes don't exist yet, so `district.update` either isn't called or is called without the new fields.

- [ ] **Step 4: Implement the writes in scan-runner**

Edit `src/features/vacancies/lib/scan-runner.ts`. Define two small helpers near the top of the file (after the imports, before `runScan`):

```ts
import prisma from "@/lib/prisma";
// ... existing imports

async function markDistrictScanSuccess(leaid: string) {
  await prisma.district.update({
    where: { leaid },
    data: { vacancyConsecutiveFailures: 0, vacancyLastFailureAt: null },
  });
}

async function markDistrictScanFailure(leaid: string) {
  await prisma.district.update({
    where: { leaid },
    data: {
      vacancyConsecutiveFailures: { increment: 1 },
      vacancyLastFailureAt: new Date(),
    },
  });
}
```

Then, **after** each `vacancyScan.update` that sets a terminal status, add the matching helper call:

- After the no-URL early-return update (`status: "failed"` for missing URL): `await markDistrictScanFailure(scan.district.leaid);`
- After the unattributable-statewide partial update (`status: "completed_partial"`): `await markDistrictScanSuccess(scan.district.leaid);` (treat partial as success — the parser worked, the data just wasn't attributable)
- After the suspicious-aggregator partial update: `await markDistrictScanSuccess(scan.district.leaid);`
- After the statewide success update (`status: "completed"`): `await markDistrictScanSuccess(scan.district.leaid);`
- After the district-scoped success update (`status: "completed"`): `await markDistrictScanSuccess(scan.district.leaid);`
- Inside the catch block, after the `vacancyScan.update` that sets `status: "failed"`: `await markDistrictScanFailure(scan.district.leaid);` — but be careful: in the catch block `scan` may be `undefined` if `findUnique` failed. Guard with `if (scan?.district?.leaid)`.

- [ ] **Step 5: Run the test — confirm it passes**

```bash
npm test -- --run src/features/vacancies/lib/__tests__/scan-runner.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full test suite (regression check)**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts src/features/vacancies/lib/__tests__/scan-runner.test.ts
git commit -m "feat(vacancies): track per-district scan health in scan-runner"
```

---

### Task 4: Make the cron filter out failing districts and cap unknown-platform scans

**Files:**
- Modify: `src/app/api/cron/scan-vacancies/route.ts`

Two changes in the same file:

(A) Filter out districts with `vacancyConsecutiveFailures >= 5` from the `staleDistricts` pool. They get auto-resurrected if/when an admin manually resets the counter (out of scope for this plan).

(B) Within the per-run batch of 5 scans, allow at most 1 unknown-platform group. If more than 1 unknown sits at the top of the sort, push the rest behind known-platform groups.

- [ ] **Step 1: Add the failure-count filter in `prisma.district.findMany`**

In `src/app/api/cron/scan-vacancies/route.ts`, find the existing `prisma.district.findMany({ where: { jobBoardUrl: { not: null } }, ... })` block (currently around line 57). Modify the `where`:

```ts
    const districts = await prisma.district.findMany({
      where: {
        jobBoardUrl: { not: null },
        vacancyConsecutiveFailures: { lt: 5 },
      },
      select: { leaid: true, name: true, jobBoardUrl: true },
    });
```

- [ ] **Step 2: Add the unknown-platform cap after the existing sort**

In the same file, after the `sortedGroups = [...urlGroups.values()].sort(...)` block (around line 122) and **before** `const batch = sortedGroups.slice(0, SCANS_PER_RUN);`, add:

```ts
    /**
     * Cap unknown-platform groups in the per-run batch to MAX_UNKNOWN_PER_RUN.
     * The Claude fallback path is failure-prone (~80% timeout rate as of
     * 2026-04-23 regression); reserving most slots for districts with a
     * dedicated parser keeps the pipeline producing while the unknown URLs
     * are addressed separately (backfill, manual triage).
     */
    const MAX_UNKNOWN_PER_RUN = 1;
    const cappedGroups: typeof sortedGroups = [];
    let unknownPicked = 0;
    for (const g of sortedGroups) {
      if (g.platform === "unknown") {
        if (unknownPicked >= MAX_UNKNOWN_PER_RUN) continue;
        unknownPicked++;
      }
      cappedGroups.push(g);
      if (cappedGroups.length >= SCANS_PER_RUN) break;
    }
    // Append remaining sortedGroups after the capped batch so coverage stats
    // (`remaining`, `neverScannedGroupsRemaining`) still reflect the full pool.
    const tail = sortedGroups.filter((g) => !cappedGroups.includes(g));
    const orderedGroups = [...cappedGroups, ...tail];
```

Then change `const batch = sortedGroups.slice(0, SCANS_PER_RUN);` to:

```ts
    const batch = orderedGroups.slice(0, SCANS_PER_RUN);
```

…and update the two later references to `sortedGroups` so the per-run accounting still matches the pool the user can see:

```ts
    const neverScannedGroupsRemaining = orderedGroups
      .slice(batch.length)
      .filter((g) => g.hasNeverScanned).length;
```

(`urlGroups.size` in the `remaining: Math.max(0, urlGroups.size - batch.length)` line stays as-is — it represents the entire pool, which is the right denominator.)

- [ ] **Step 3: Run the full test suite (regression check)**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 4: Manual smoke-test against dev**

```bash
curl -s "http://localhost:3005/api/cron/scan-vacancies?secret=$CRON_SECRET&stale=7" | jq .
```

(Start `npm run dev` first if not running.) Expected: response includes `scansRun`, `districtsProcessed`, `results` array. No 5xx. The `results` array's `status` values should be a mix of `completed` / `failed` — not all-failed.

If the response throws because `vacancyConsecutiveFailures` doesn't exist on `District` in the Prisma client: re-run `npx prisma generate` and restart `npm run dev`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/scan-vacancies/route.ts
git commit -m "feat(vacancies): skip 5x-failed districts + cap unknown-platform scans per run"
```

---

### Task 5: Pre-deploy verification + production deploy + post-deploy verification

**Files:** none (deploy + verification only)

- [ ] **Step 1: Type check + full test run**

```bash
npx tsc --noEmit
npm test -- --run
```

Expected: zero type errors; all tests pass.

- [ ] **Step 2: Verify the branch is clean and pushed**

```bash
git status
git log --oneline origin/main..HEAD
git push -u origin fix/vacancy-scan-coverage
```

Expected: status clean, ~6 commits ahead of origin/main (5 from this plan + the plan-docs commit on `vacancies-and-news`), push succeeds.

- [ ] **Step 3: Open the PR (or hand off to user)**

```bash
gh pr create --title "fix(vacancies): recover from 80%+ scan failure rate (post-PR-#129 regression)" --body "$(cat <<'EOF'
## Summary
- Backfill `District.jobBoardPlatform` from current URLs (one-shot script — many "unset" districts are actually applitrack/olas/schoolspring)
- Add `District.vacancyConsecutiveFailures` + `vacancyLastFailureAt` columns; `runScan` maintains them on every terminal status
- Cron skips districts with 5+ consecutive failures so dead URLs auto-shed from the rotation
- Cap unknown-platform scans at 1 of 5 per cron run so the Claude-fallback failure mode can't starve working districts

## Diagnostic
PR #129 (2026-04-22) correctly unstuck the never-scanned long tail, but ~70% of district URLs (8,940 of 12,639) have no platform set or `unknown`, falling through to `parseWithClaude` on Vercel which mostly times out at ~18s. Failure rate jumped from 0% on 4/22 to 45%/68%/100%/100%/78%/86%/100% from 4/23 onward; net new vacancies dropped from steady-state to 1/day.

## Production deploy steps (after merge)
1. Vercel auto-deploys the migration on push.
2. Run the backfill against prod: `npx tsx scripts/backfill-job-board-platform.ts --commit` (with `DATABASE_URL` pointed at prod).
3. Wait one cron tick (next hour at :00) and verify the failure rate drops in `vacancy_scans`.

## Test plan
- [ ] Type check passes
- [ ] All Vitest tests pass
- [ ] Manual `curl /api/cron/scan-vacancies` against dev returns mixed `completed` / `failed` results (not all-failed)
- [ ] After backfill: platform distribution shows 0 `(unset)` districts
- [ ] After 24h prod soak: `vacancy_scans` failure rate drops to <30% (from 80%+)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After merge — run the backfill against prod**

The script lives in the codebase but the data-write must be triggered manually against prod's `DATABASE_URL`:

```bash
# With prod DATABASE_URL in the environment
DATABASE_URL=$PROD_DATABASE_URL npx tsx scripts/backfill-job-board-platform.ts          # dry run
DATABASE_URL=$PROD_DATABASE_URL npx tsx scripts/backfill-job-board-platform.ts --commit
```

Expected: dry run shows the same transition table as on dev; commit run writes ~5,000+ rows.

- [ ] **Step 5: Wait one cron tick, then verify the failure rate dropped**

After the next top-of-hour tick:

```bash
psql "$PROD_DATABASE_URL" -c "
  SELECT
    to_char(date_trunc('hour', started_at), 'YYYY-MM-DD HH24:MI') AS hour,
    COUNT(*) FILTER (WHERE status='completed') AS completed,
    COUNT(*) FILTER (WHERE status='failed') AS failed,
    (COUNT(*) FILTER (WHERE status='failed') * 100 / NULLIF(COUNT(*),0))::int AS pct_failed
  FROM vacancy_scans
  WHERE started_at > NOW() - INTERVAL '6 hours'
  GROUP BY date_trunc('hour', started_at)
  ORDER BY hour DESC;
"
```

Expected: post-deploy ticks show `pct_failed` below 30% (was 80%+). New vacancies should also start arriving at >1/day.

- [ ] **Step 6: Spot-check the unknown-platform cap is working**

```bash
psql "$PROD_DATABASE_URL" -c "
  SELECT batch_id, COUNT(*) FILTER (WHERE platform='unknown') AS unknown_count, COUNT(*) AS total
  FROM vacancy_scans
  WHERE batch_id IS NOT NULL AND started_at > NOW() - INTERVAL '6 hours'
  GROUP BY batch_id
  ORDER BY started_at DESC LIMIT 10;
"
```

Expected: every batch row shows `unknown_count <= 1`.

If `unknown_count > 1` for any batch: re-check Task 4 Step 2 — either the cap loop isn't reached or the platform string doesn't match `"unknown"` exactly.

---

## Self-review checklist

- [x] All 5 implementation tasks have actual code, not placeholders.
- [x] File paths are absolute or unambiguous relative to the worktree root.
- [x] Migration SQL targets the correct table (`districts`) and column types match `prisma migrate` output for analogous columns elsewhere in the schema.
- [x] `runScan` test mocks every external dependency (`platform-detector`, `post-processor`, parsers) so it isolates the health-column logic.
- [x] The cron change preserves the original sort priority (statewide > never-scanned > size) — the cap only re-orders within the unknown-platform tail.
- [x] Production verification SQL targets the columns that actually exist (`status`, `started_at`, `batch_id`, `platform` — all confirmed via `information_schema.columns`).
- [x] The plan does not depend on the news-ingest plan landing first; the two are fully independent.
