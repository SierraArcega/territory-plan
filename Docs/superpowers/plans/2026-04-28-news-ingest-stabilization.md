# News Ingest Stabilization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the every-15-min `ingest-news-rolling` cron from consistently timing out at 300s. Restore monitoring sanity by retiring stranded `status='running'` rows. Add timing logs so the next tuning round has data, not guesses.

**Architecture:** Three independent, low-risk changes. No schema changes; no new cron routes. (1) Reduce `ROLLING_BATCH_SIZE` from 50 → 15 to bring per-run work well under the 300s ceiling. (2) Add an "orphan sweep" helper that marks pre-existing `status='running'` rows older than 10 minutes as `status='error'` (so each ingest run starts with a clean monitoring picture). (3) Add structured timing logs around RSS fetches and the rolling-layer ingest function so the next tuning pass can identify the real bottleneck (Google rate-limit vs matcher vs DB).

If 504s persist after this plan ships, the next plan should decouple `matchArticles` from the ingest cron entirely (write a `match_pass1_at` column on `news_articles` and add a dedicated `match-articles` cron that drains it). That refactor is intentionally **not** in this plan — we want to measure first.

**Tech Stack:** Next.js 16 App Router cron routes, Prisma, Vitest, Vercel Cron.

**Diagnostic context:**

- `news_ingest_runs` last 14d: rolling layer = 12 finished / 620 started; daily layer = 1 finished / 7 started. Average **finished** rolling run = 1631s (these are pre-300s-cap runs); current behavior is "killed at 300s wall, status stays 'running' forever."
- Despite the 504s, articles are still arriving (~270 fetched/day, ~274 classified/day, ~44 Fullmind-relevant/day) because the route writes articles before the matcher step.
- `district_news_fetch` table: 18,817 districts have NULL `last_status`, 185 have `'ok'` — most of the queue has never produced a successful fetch under the current scheme.

**Working directory (IMPORTANT):** all work happens in the worktree, not the main checkout:

```
/Users/sierraarcega/territory-plan/.claude/worktrees/vacancies-and-news
```

Branch: `vacancies-and-news` (created fresh from `origin/main` at `4a76d081`).

**Verification tooling:** `psql "$DATABASE_URL"` for DB inspection (`DATABASE_URL` is in `.env.local`). `npm test` for Vitest. Production verification uses the Vercel and Supabase MCPs (the agent should ask the user to drive those if no MCP access).

---

## File Structure

**Create:**
- `src/features/news/lib/orphan-sweep.ts` — pure helper that marks stranded `news_ingest_runs` rows as errored
- `src/features/news/lib/__tests__/orphan-sweep.test.ts` — Vitest unit test for the helper

**Modify:**
- `src/features/news/lib/config.ts` (line 114) — change `ROLLING_BATCH_SIZE = 50` → `15`
- `src/app/api/cron/ingest-news-rolling/route.ts` — call sweep at start; add summary log line at end
- `src/app/api/cron/ingest-news-daily/route.ts` — call sweep at start
- `src/features/news/lib/rss.ts` — log fetch duration on every Google News + RSS fetch
- `src/features/news/lib/ingest.ts` — log per-batch summary in `ingestRollingLayer`

No Prisma migration. No new cron routes. No new env vars.

---

### Task 1: Reduce `ROLLING_BATCH_SIZE` 50 → 15

**Files:**
- Modify: `src/features/news/lib/config.ts:114`

- [ ] **Step 1: `cd` into the worktree and confirm branch**

```bash
cd /Users/sierraarcega/territory-plan/.claude/worktrees/vacancies-and-news
git status
```

Expected: `On branch vacancies-and-news` and a clean working tree.

- [ ] **Step 2: Make the change**

Edit `src/features/news/lib/config.ts`. Change line 114:

```ts
// before
export const ROLLING_BATCH_SIZE = 50;

// after
export const ROLLING_BATCH_SIZE = 15;
```

No tests required — this is a tuning constant; behavioral correctness is identical.

- [ ] **Step 3: Run the test suite as a regression check**

```bash
npm test -- --run
```

Expected: all tests pass (no test references the literal `50`).

- [ ] **Step 4: Commit**

```bash
git add src/features/news/lib/config.ts
git commit -m "perf(news): reduce ROLLING_BATCH_SIZE 50→15 to fit Vercel 300s cap"
```

---

### Task 2: Write the orphan-sweep helper (TDD)

**Files:**
- Create: `src/features/news/lib/orphan-sweep.ts`
- Create: `src/features/news/lib/__tests__/orphan-sweep.test.ts`

The helper marks `news_ingest_runs` rows that are still `status='running'` more than 10 minutes after `started_at` as `status='error', error='orphaned (timeout)', finished_at=now()`. It's idempotent and returns the number of rows swept.

The 10-minute threshold is deliberately wider than the 300s `maxDuration` (5min) — anything still "running" at 10min is definitely dead.

- [ ] **Step 1: Write the failing test**

File: `src/features/news/lib/__tests__/orphan-sweep.test.ts`

```ts
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
```

- [ ] **Step 2: Run the test — confirm it fails for the right reason**

```bash
npm test -- --run src/features/news/lib/__tests__/orphan-sweep.test.ts
```

Expected: FAIL with `Cannot find module '../orphan-sweep'`.

- [ ] **Step 3: Implement the helper**

File: `src/features/news/lib/orphan-sweep.ts`

```ts
import { prisma } from "@/lib/prisma";

const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Marks `news_ingest_runs` rows that are still `status='running'` past the
 * orphan threshold as errored. Vercel kills functions at 300s; anything
 * "running" at 10min is definitely dead. Idempotent — safe to call on every
 * cron invocation.
 *
 * @returns number of rows swept
 */
export async function sweepOrphanedNewsRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS);
  const result = await prisma.newsIngestRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: cutoff },
    },
    data: {
      status: "error",
      error: "orphaned (timeout — function killed before finishing)",
      finishedAt: new Date(),
    },
  });
  return result.count;
}
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
npm test -- --run src/features/news/lib/__tests__/orphan-sweep.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/news/lib/orphan-sweep.ts src/features/news/lib/__tests__/orphan-sweep.test.ts
git commit -m "feat(news): orphan-sweep helper for stranded ingest runs"
```

---

### Task 3: Wire orphan sweep into the rolling cron

**Files:**
- Modify: `src/app/api/cron/ingest-news-rolling/route.ts`

- [ ] **Step 1: Import the helper and call it after auth, before run creation**

Edit `src/app/api/cron/ingest-news-rolling/route.ts`. Add the import at the top of the import block:

```ts
import { sweepOrphanedNewsRuns } from "@/features/news/lib/orphan-sweep";
```

Then, in the `GET` handler, immediately after the auth check (after line 33 — the `if (CRON_SECRET && ...) return Unauthorized`) and **before** `const batchSize = ...`, add:

```ts
  const orphansSwept = await sweepOrphanedNewsRuns();
  if (orphansSwept > 0) {
    console.log(`[ingest-news-rolling] swept ${orphansSwept} orphaned runs`);
  }
```

- [ ] **Step 2: Run the test suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/ingest-news-rolling/route.ts
git commit -m "feat(news): sweep orphaned runs at start of rolling cron"
```

---

### Task 4: Wire orphan sweep into the daily cron

**Files:**
- Modify: `src/app/api/cron/ingest-news-daily/route.ts`

The daily cron has the same stranded-run problem (1/7 finished in 14d). Same fix.

- [ ] **Step 1: Read the current daily route**

```bash
cat src/app/api/cron/ingest-news-daily/route.ts
```

Confirm the structure mirrors the rolling cron: auth check → create run → ingest → match → finalize.

- [ ] **Step 2: Add the import and the sweep call**

Edit `src/app/api/cron/ingest-news-daily/route.ts`. Add to imports:

```ts
import { sweepOrphanedNewsRuns } from "@/features/news/lib/orphan-sweep";
```

In the `GET` handler, after auth and before `prisma.newsIngestRun.create`:

```ts
  const orphansSwept = await sweepOrphanedNewsRuns();
  if (orphansSwept > 0) {
    console.log(`[ingest-news-daily] swept ${orphansSwept} orphaned runs`);
  }
```

- [ ] **Step 3: Run the test suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/ingest-news-daily/route.ts
git commit -m "feat(news): sweep orphaned runs at start of daily cron"
```

---

### Task 5: Add per-fetch duration logs in `rss.ts`

**Files:**
- Modify: `src/features/news/lib/rss.ts`

We don't yet know whether the 27-min historical-average run was Google News rate-limiting, slow RSS feeds, or something else. Add structured logs to the two fetch entry points so the next tuning pass has hard numbers from production.

- [ ] **Step 1: Read the current `fetchGoogleNewsRss` and `fetchRssFeed`**

```bash
grep -n "export async function fetch" src/features/news/lib/rss.ts
```

Note the function signatures and the line where each makes its outbound `fetch()` call.

- [ ] **Step 2: Wrap each fetch with timing**

In `fetchGoogleNewsRss(query)`, wrap the outbound network call. Pattern:

```ts
const t0 = Date.now();
const res = await fetch(url, { /* existing options */ });
const ms = Date.now() - t0;
const status = res.status;
console.log(`[news.rss] google_news q="${query.slice(0, 60)}" status=${status} ms=${ms}`);
```

Apply the equivalent pattern to `fetchRssFeed(url, source)`. Truncate `query` / `source` to 60 chars for log readability. Log on both success **and** failure paths (wrap in try/finally if needed so a thrown fetch error still logs the duration).

- [ ] **Step 3: Run tests**

```bash
npm test -- --run src/features/news/lib/__tests__/rss.test.ts
```

Expected: existing rss tests pass. If a test asserts on `console.log` count, update its expectations.

- [ ] **Step 4: Commit**

```bash
git add src/features/news/lib/rss.ts
git commit -m "obs(news): log per-fetch duration in rss.ts"
```

---

### Task 6: Add per-run summary log in `ingestRollingLayer`

**Files:**
- Modify: `src/features/news/lib/ingest.ts`

After `await queue.onIdle()` returns, log totals so a single grep on the Vercel runtime logs surfaces the per-run cost.

- [ ] **Step 1: Add the timing wrapper**

In `src/features/news/lib/ingest.ts`, modify `ingestRollingLayer`. At the top of the function (before the `prisma.districtNewsFetch.findMany`):

```ts
const t0 = Date.now();
```

After `await queue.onIdle();` and before `return stats;`:

```ts
const elapsedMs = Date.now() - t0;
console.log(
  `[news.ingest.rolling] batch=${fetches.length} ` +
  `articlesNew=${stats.articlesNew} articlesDup=${stats.articlesDup} ` +
  `districtsProcessed=${stats.districtsProcessed} errors=${stats.errors.length} ` +
  `ms=${elapsedMs}`
);
```

Also add the equivalent at the end of `ingestDailyLayers` so the daily cron is observable too:

```ts
const elapsedMs = Date.now() - t0;
console.log(
  `[news.ingest.daily] articlesNew=${stats.articlesNew} articlesDup=${stats.articlesDup} ` +
  `errors=${stats.errors.length} ms=${elapsedMs}`
);
```

(Add `const t0 = Date.now();` near the top of `ingestDailyLayers` as well.)

- [ ] **Step 2: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/news/lib/ingest.ts
git commit -m "obs(news): log per-run summary in ingest layers"
```

---

### Task 7: Pre-deploy verification + production deploy + post-deploy verification

**Files:** none (deploy + DB verification only)

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
git push -u origin vacancies-and-news
```

Expected: status clean, ~6 commits ahead of origin/main, push succeeds.

- [ ] **Step 3: Open the PR (or hand off to user)**

If the user wants a PR opened:

```bash
gh pr create --title "fix(news): stabilize ingest-news-rolling — batch cap + orphan sweep + timing logs" --body "$(cat <<'EOF'
## Summary
- Reduce `ROLLING_BATCH_SIZE` 50 → 15 to fit Vercel 300s cap
- Add `sweepOrphanedNewsRuns` helper, called at start of both rolling and daily ingest crons (marks stranded `status='running'` rows older than 10min as errored)
- Add per-fetch and per-run duration logs to surface the actual bottleneck

## Diagnostic
Last 14d: 608/620 rolling runs and 6/7 daily runs hit the Vercel 300s timeout, leaving `news_ingest_runs.status='running'` stranded forever. Articles still get partially saved (~270/day) because the ingest step runs before the matcher.

## Test plan
- [ ] Type check passes
- [ ] All Vitest tests pass
- [ ] After deploy, watch `/api/cron/ingest-news-rolling` for 1 hour: expect 504 rate to drop substantially (target <50%)
- [ ] After deploy, query `news_ingest_runs` for `status='running' AND started_at < NOW() - INTERVAL '15 minutes'` — should be 0 within 15 minutes of the next cron tick
- [ ] Watch Vercel runtime logs for `[news.ingest.rolling]` summary lines and `[news.rss]` per-fetch lines

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After deploy — verify orphan sweep works**

Run this 15+ minutes after deploy (next rolling cron tick):

```bash
psql "$DATABASE_URL" -c "
  SELECT
    layer,
    status,
    COUNT(*) AS n,
    MAX(started_at) AS latest
  FROM news_ingest_runs
  WHERE started_at > NOW() - INTERVAL '24 hours'
  GROUP BY layer, status
  ORDER BY layer, status;
"
```

Expected after the next rolling tick: rows with `status='running'` should only exist for the **most recent** start (in flight). Older `running` rows should be gone (rewritten to `status='error'` with `error='orphaned ...'`).

- [ ] **Step 5: After 1 hour — verify 504 rate dropped**

In the Vercel dashboard (or via the Vercel MCP), pull last 1h of runtime logs filtered to `/api/cron/ingest-news-rolling`. Expected: 504 share well below 100% — most runs should return 200 with the new batch size.

If 504s persist >50%, the matcher itself is the bottleneck (not the fetches). Open a follow-up plan to decouple `matchArticles` from the ingest cron.

---

## Self-review checklist

- [x] All 6 implementation tasks have actual code, not placeholders.
- [x] File paths are absolute or unambiguous relative to the worktree root.
- [x] Test for `orphan-sweep` covers happy path, threshold logic, and zero-row case.
- [x] No types/functions referenced that aren't either pre-existing or defined in an earlier task in this plan.
- [x] Commit messages follow the repo's `feat(scope):` convention seen in `git log`.
- [x] Verification SQL targets the columns that actually exist (`started_at`, `finished_at`, `status` confirmed via `information_schema.columns`).
