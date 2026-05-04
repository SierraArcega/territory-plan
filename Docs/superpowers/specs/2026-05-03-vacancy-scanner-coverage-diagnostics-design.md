---
title: Vacancy Scanner Coverage Diagnostics — Design
date: 2026-05-03
status: draft
owner: sierra.arcega@fullmindlearning.com
---

# Vacancy Scanner Coverage Diagnostics — Design

## Problem

The admin `VacancyScanCard` reports scan coverage — `districts_ever_scanned / districts_with_jobBoardUrl` — at roughly **45%** and the number does not move. Investigation in `src/app/api/cron/scan-vacancies/route.ts`, `src/features/vacancies/lib/scan-runner.ts`, and `src/app/api/admin/vacancy-scan-stats/route.ts` identified three structural ratchets that pin the metric at the percentage of districts whose URL is actually scrapable, not at the percentage we *intend* to scrape:

1. **5-strikes tarpit, no reset.** The cron filter `vacancyConsecutiveFailures: { lt: 5 }` permanently excludes any district whose URL has failed five times. The counter only resets on a successful scan; no other job touches it. Once admitted, a district stays in the tarpit indefinitely while still counting in the denominator.
2. **Unknown-platform throttle vs. ~80% Claude-fallback failure rate.** `MAX_UNKNOWN_PER_RUN = 1` reserves one of five hourly slots for unknown-platform groups because the Claude fallback path has been unreliable since the 2026-04-23 regression. Most attempts fail; five fails sends the district to the tarpit, where it never returns.
3. **Throughput ceiling.** `SCANS_PER_RUN = 5` × hourly cron = 120 scans/day max. State-wide boards (OLAS, SchoolSpring) cover many districts per scan via sibling-coverage records, but per-district platforms scale linearly.

The user already understands the symptom. What they cannot see today, because no instrumentation captures it, is **where the loss is concentrated** — which platforms own the tarpit, which failure modes dominate the last 7 days, whether the scanner is doing well on the reachable pool or poorly across the board. Without that visibility, any fix is a guess.

This spec covers the **logging-and-instrumentation phase** only. Edge-case fixes (failure-counter reset job, Claude fallback regression, parser improvements) are explicitly out of scope and will be designed in a follow-up brainstorm informed by the data this work produces.

This work is complementary to the 2026-04-14 vacancy scanner monitoring spec, which addresses freshness/health (verdict line, sparkline, stuck scans). Both extend the same card and same stats endpoint with non-overlapping fields; if both ship, layout will need a small reconciliation pass at that time.

## Goals

1. Categorize every scan failure into a fixed taxonomy so failure reasons are queryable, not free-text.
2. Surface three new diagnostic numbers on `VacancyScanCard`: tarpit size (with platform breakdown), adjusted coverage (against the reachable pool), and top failure reason in the trailing 7 days.
3. Emit three structured log events that let an operator answer "where did coverage go?" via Vercel log search alone.
4. Make the new column meaningful on day one via a one-time historical backfill.

## Non-goals

- No fix to the failure-counter ratchet, the Claude fallback regression, or any parser. Those are separate efforts informed by this work.
- No dedicated `/admin/vacancy-diagnostics` page. The existing card is the surface.
- No changes to `vacancy-hygiene`, scan scheduling, or any cron cadence.
- No retry logic, alerting, or paging.
- No `parser_empty` *detection* — the bucket exists in the enum for future use (e.g., comparing to prior-scan vacancy counts) but no code path sets it in this PR.

## Design

### Part 1 — Failure-reason taxonomy

A fixed enum of ten buckets, designed to map cleanly onto every existing failure path in `scan-runner.ts` and the cron, with one catch-all:

| Bucket | What triggers it |
|---|---|
| `http_4xx` | URL returns 404/403/410 (string-matched in catch path) |
| `http_5xx` | URL returns 500-class error |
| `network_timeout` | fetch itself times out / connection refused |
| `scan_timeout` | 3-min `SCAN_TIMEOUT_MS` hit |
| `parser_empty` | reserved for future: parser ran cleanly but page format changed (no code path sets this in this PR) |
| `claude_fallback_failed` | Claude path errored OR returned 0 vacancies (see Part 3 — explicit policy choice) |
| `statewide_unattributable` | >50% of jobs lack `employerName` (existing safety net at `scan-runner.ts:163`) |
| `enrollment_ratio_skip` | suspicious-inflation safety net (existing at `scan-runner.ts:240`) |
| `no_job_board_url` | district had URL nulled out between scheduling and runtime |
| `unknown_error` | catch-all when the catch-path string match doesn't recognize the error |

`failureReason` is `null` on successful scans (`status: 'completed'` with non-zero or genuinely-empty results from a known parser). It is set on every `'failed'` and every `'completed_partial'` row.

### Part 2 — Schema change

Additive Prisma migration. No existing data altered.

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
}

model VacancyScan {
  // ...existing fields preserved
  failureReason VacancyFailureReason?
}
```

The existing free-text `errorMessage` column stays. `failureReason` is the machine-categorized companion; the human-readable detail still lives in `errorMessage`.

### Part 3 — Categorization helper and scan-runner integration

New file `src/features/vacancies/lib/failure-reasons.ts`:

```ts
import { VacancyFailureReason } from "@prisma/client";

export type FailureContext =
  | "no_job_board_url"
  | "scan_timeout"
  | "statewide_unattributable"
  | "enrollment_ratio_skip"
  | "claude_fallback_empty"
  | "thrown_error";

export function categorizeFailure(args: {
  errorMessage: string;
  context?: FailureContext;
}): VacancyFailureReason;
```

When `context` is supplied and unambiguous, it maps directly: `"no_job_board_url"` → `no_job_board_url`, `"scan_timeout"` → `scan_timeout`, `"statewide_unattributable"` → `statewide_unattributable`, `"enrollment_ratio_skip"` → `enrollment_ratio_skip`, `"claude_fallback_empty"` → `claude_fallback_failed`. When `context` is `"thrown_error"` (or omitted), the function string-matches `errorMessage` against patterns in this order — first match wins:

- `/timed out|abort|aborted/i` → `scan_timeout`
- `/anthropic|claude api/i` → `claude_fallback_failed` (catches exceptions thrown from the Claude fallback path)
- `/statewide board returned/i` → `statewide_unattributable` (backfill-only; runtime path supplies explicit context)
- `/regional aggregator/i` → `enrollment_ratio_skip` (backfill-only; runtime path supplies explicit context)
- `/no job board url/i` → `no_job_board_url` (backfill-only; runtime path supplies explicit context)
- `/4\d\d|not found|forbidden|gone/i` → `http_4xx`
- `/5\d\d|server error|bad gateway|service unavailable/i` → `http_5xx`
- `/econnrefused|enotfound|network|fetch failed|getaddrinfo/i` → `network_timeout`
- everything else → `unknown_error`

Patterns are case-insensitive. The three "backfill-only" patterns match `errorMessage` strings produced by today's code at sites that, post-this-PR, supply explicit `context` — they exist so the one-time backfill (Part 9) can categorize historical rows correctly without rewriting their messages. The function is pure and exhaustively unit-tested.

**Wiring in `scan-runner.ts`**, every site that sets a non-success status now also writes `failureReason`:

| Existing line range | Status set | Context to pass |
|---|---|---|
| 82–91 | `failed` (no jobBoardUrl) | `no_job_board_url` |
| 152–153 (timeout check) → 286 (catch) | `failed` | helper called with `errorMessage="Scan timed out"` and context `"scan_timeout"` |
| 168–177 | `completed_partial` (statewide unattributable) | `statewide_unattributable` |
| 247–256 | `completed_partial` (enrollment ratio) | `enrollment_ratio_skip` |
| 286–309 | `failed` (outer catch) | `thrown_error` (string-match) |

**Explicit policy choice — Claude-fallback-empty.** Today, when the serverless Claude fallback returns `[]` (no exception, just empty), `scan-runner.ts:130–148` falls through with `rawVacancies = []` and the scan is marked `status: 'completed'`, `vacancyCount: 0`, no failure. This is the dominant failure mode behind the 2026-04-23 regression, and unless we differentiate it the `claude_fallback_failed` bucket would be empty in practice.

**This spec changes that behavior.** When the path that ran was Claude-fallback AND `rawVacancies.length === 0`, the scan is now marked `status: 'completed_partial'` with `failureReason: 'claude_fallback_failed'`, AND `markDistrictScanFailure` is invoked instead of `markDistrictScanSuccess`. This means:

- The metric reflects reality (the bucket fills with the dominant failure mode).
- These districts now accrue `vacancyConsecutiveFailures` and become eligible for the future failure-counter-reset PR.
- Effective tarpit growth rate is unchanged in *truth* — these districts were already silently broken — but is now *visible* in the counter.

This is a small but real behavior change beyond pure logging. It is included intentionally because the alternative — leaving Claude-empty as silent success — defeats the purpose of the taxonomy.

### Part 4 — Cron telemetry

`src/app/api/cron/scan-vacancies/route.ts` adds one query before the existing `Promise.all` block:

```ts
const tarpitSize = await prisma.district.count({
  where: { jobBoardUrl: { not: null }, vacancyConsecutiveFailures: { gte: 5 } },
});
```

After the batch finishes, the existing JSON response is preserved unchanged. A new structured log line is emitted via `console.log(JSON.stringify({...}))`:

```ts
{
  event: "vacancy_cron_summary",
  batch_id: batchId,
  total_stale: staleDistricts.length,
  unique_urls: urlGroups.size,
  scans_run: batch.length,
  districts_processed: districtsProcessed,
  never_scanned_groups_remaining: neverScannedGroupsRemaining,
  sibling_coverage_created: siblingCoverageCreated,
  tarpit_size_at_start: tarpitSize,
  failure_reason_mix: { http_4xx: 1, claude_fallback_failed: 3, ... }
}
```

`failure_reason_mix` is computed by re-reading the `failureReason` of each scan in `batch` after `runScan` completes (the existing post-run `findUnique` already reads each row; one extra column is selected).

### Part 5 — Per-scan log

`scan-runner.ts` emits one log line per scan in the existing `finally` block, before `clearTimeout`:

```ts
{
  event: "vacancy_scan_outcome",
  leaid: scan?.district.leaid,
  platform: detectedPlatform,
  status: finalStatus,
  failure_reason: finalFailureReason ?? null,
  vacancy_count: finalVacancyCount,
  duration_ms: Date.now() - scanStartMs,
  was_first_attempt: !hadPriorCompletedScan,
  consecutive_failures_after: finalConsecutiveFailures
}
```

Two additional reads are required:

- `was_first_attempt` — one `prisma.vacancyScan.count` at runner start, scoped to `leaid` and `status: { in: ['completed','completed_partial'] }`. Captured into a hoisted variable so it's available from the `finally` block.
- `consecutive_failures_after` — `markDistrictScanFailure` already returns the new counter (Part 6 update). `markDistrictScanSuccess` is updated symmetrically to return `0` (its post-update value is always 0 by definition). Both helpers' return values are captured into a hoisted variable that the `finally` reads. No extra DB read is needed beyond what those helpers already do.

These are cheap (indexed point reads) and run once per scan.

`scanStartMs` is captured at the top of `runScan` as `Date.now()`. It joins `scan` in the hoist-out-of-try block, alongside `finalStatus`, `finalFailureReason`, `finalVacancyCount`, `finalConsecutiveFailures`, and `hadPriorCompletedScan` — all the fields the `finally` log needs. The hoist is a small ergonomic addition; no logic moves out of the `try`.

### Part 6 — Tarpit admission log

`markDistrictScanFailure` (currently at `scan-runner.ts:20–28`) gains a returned value and one conditional log line:

```ts
async function markDistrictScanFailure(leaid: string, failureReason: VacancyFailureReason | null) {
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
    console.log(JSON.stringify({
      event: "vacancy_tarpit_admission",
      leaid: updated.leaid,
      name: updated.name,
      platform: updated.jobBoardPlatform,
      job_board_url: updated.jobBoardUrl,
      last_failure_reason: failureReason,
    }));
  }

  return updated.vacancyConsecutiveFailures;
}
```

The strict equality (`=== 5`) ensures the event fires exactly once per district per admission — increments past 5 (which shouldn't happen since the tarpit excludes from the cron pool, but could theoretically happen if a district is enqueued some other way) don't re-fire it.

### Part 7 — Stats endpoint additions

`src/app/api/admin/vacancy-scan-stats/route.ts` adds three fields to its response:

```ts
{
  // ...existing fields preserved
  tarpit: {
    total: number,
    byPlatform: { platform: string, count: number }[]  // top 4 by count
  },
  adjustedCoveragePct: number,  // scanned / max(1, totalDistrictsWithUrl - tarpit.total)
  topFailureReason7d: { reason: string, pct: number } | null
}
```

Three new prisma calls added to the existing `Promise.all`:

```ts
prisma.district.count({
  where: { jobBoardUrl: { not: null }, vacancyConsecutiveFailures: { gte: 5 } },
}),
prisma.district.groupBy({
  by: ["jobBoardPlatform"],
  where: { jobBoardUrl: { not: null }, vacancyConsecutiveFailures: { gte: 5 } },
  _count: true,
}),  // null jobBoardPlatform mapped to "unknown" in the response,
     // matching the existing platform-mix line's handling at route.ts:81.
prisma.vacancyScan.groupBy({
  by: ["failureReason"],
  where: {
    status: { in: ["failed", "completed_partial"] },
    completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    failureReason: { not: null },
  },
  _count: true,
}),
```

`adjustedCoveragePct` uses `Math.max(1, denominator)` to handle the edge case where every URL-bearing district is in the tarpit (no division by zero). When the tarpit is empty, `adjustedCoveragePct === coveragePct`.

`topFailureReason7d` is computed by sorting the third query's results by `_count` descending, taking the top entry, and computing the percentage against the total of all 7d failures. Returns `null` if there are no failures in the window.

### Part 8 — Admin card additions

`VacancyScanCard.tsx` adopts a two-row stat layout. Existing row 1 is preserved exactly:

```
Open Vacancies | Districts | Coverage | Scans (7d)
```

New row 2 (3 columns, full-width):

```
Tarpit | Adjusted Coverage | Top Failure Reason
```

Each new stat uses the existing `<Stat>` component with its `label` / `value` / `sub` props:

- **Tarpit** — `value` = `data.tarpit.total.toLocaleString()`, `sub` = top-2 platforms joined like `"claude (38), unknown (12)"`. `alert` = true when total > 0.
- **Adjusted Coverage** — `value` = `${data.adjustedCoveragePct}%`, `sub` = `"of reachable pool"`.
- **Top Failure Reason** — `value` = `data.topFailureReason7d?.reason ?? "—"`, `sub` = `data.topFailureReason7d ? `${pct}% of failures (7d)` : "no failures"`.

The existing health-dot logic gains one trigger: red also when `tarpit.total / totalDistrictsWithUrl > 0.30`. This ensures a glance at the dot reflects reality even before the user scans the row 2 numbers.

The existing platform breakdown line and progress bar remain unchanged.

Tailwind tokens follow the existing card — `text-[#403770]` for values, `text-[#8A80A8]` for labels, `text-[#A69DC0]` for subs, `text-[#F37167]` when `alert`. No new tokens.

### Part 9 — Historical backfill

One-time script: `scripts/backfill-vacancy-failure-reasons.ts`. Reads all rows where `status IN ('failed', 'completed_partial') AND failureReason IS NULL`, runs each `errorMessage` through `categorizeFailure({ errorMessage, context: "thrown_error" })`, and writes back in batches of 500. The script is idempotent (the `failureReason IS NULL` filter ensures re-runs are no-ops), logs progress every batch, and prints a final summary keyed by bucket so the result of the backfill is verifiable at a glance.

The script uses the same `categorizeFailure` helper as the runtime path — categorization logic exists in exactly one place. Historical `errorMessage` wordings produced by today's code are categorized via the regex chain documented in Part 3:

- `"Scan timed out"` and `"Scan timed out (stale recovery)"` → `scan_timeout`
- `"District has no job board URL"` → `no_job_board_url`
- `"Skipped: statewide board returned ..."` → `statewide_unattributable`
- `"Skipped: ... regional aggregator ..."` → `enrollment_ratio_skip`
- Anthropic SDK errors → `claude_fallback_failed`
- 4xx/5xx HTTP errors thrown by `fetch` callers → `http_4xx` / `http_5xx`
- Network errors → `network_timeout`
- Anything else → `unknown_error`

The "backfill-only" regex patterns called out in Part 3 (`statewide board returned`, `regional aggregator`, `no job board url`) exist solely to make this backfill possible — at runtime, the corresponding code paths supply explicit `context` and never reach the regex chain.

## Data flow

A scan's failure now flows like this:

1. Scan-runner hits a non-success branch (timeout, exception, statewide-skip, etc.).
2. The branch builds an `errorMessage` and a known `FailureContext`.
3. `categorizeFailure({ errorMessage, context })` returns a `VacancyFailureReason`.
4. The `prisma.vacancyScan.update` call writes both `errorMessage` and `failureReason` in the same transaction.
5. `markDistrictScanFailure(leaid, failureReason)` increments the counter and, if the new value equals 5, emits `vacancy_tarpit_admission`.
6. The `finally` block emits `vacancy_scan_outcome` with the categorized reason.
7. Back in the cron handler, the per-batch summary aggregates each scan's `failureReason` into `failure_reason_mix` and emits `vacancy_cron_summary`.

The admin card pulls all three new stats from the extended endpoint and renders row 2 of the stat grid. The structured logs are searchable in Vercel logs by `event:` key.

## Error handling

- The new prisma queries in the stats endpoint are added to the existing `Promise.all` — any failure is caught by the existing `try/catch` and returns the existing 500 response.
- `categorizeFailure` is total — every input maps to a bucket, with `unknown_error` as the floor. There is no input that throws.
- The tarpit-admission log uses strict equality (`=== 5`) so spurious increments past 5 don't re-fire it. If `vacancyConsecutiveFailures` is somehow ever 0 when we increment (it shouldn't be), the increment-then-read still produces a correct value — the log just won't fire until 5 is reached.
- The backfill script uses transactional batches of 500 with `prisma.$transaction`. A mid-batch failure rolls that batch back; subsequent runs pick up where the failure left off because the `failureReason IS NULL` filter is the resumption signal.

## Testing strategy

- **`failure-reasons.test.ts`** (new) — exhaustive table-driven tests for `categorizeFailure`. Every bucket has at least three positive cases and the catch-all has its own coverage. The string-match path is tested via a fixture of historical `errorMessage` strings (collected from a quick prod-DB sample). This file is the foundation; everything else relies on it.
- **`scan-runner.test.ts`** (extend existing) — assert that `failureReason` is written at each of the five failure sites and at the new B1 Claude-empty path. Assert that `markDistrictScanFailure` returns the new counter and that the tarpit-admission log is emitted exactly when the post-increment value is 5.
- **`vacancy-scan-stats/__tests__/route.test.ts`** (new) — mock prisma, assert the three new response fields are computed correctly. Edge cases: zero tarpit (adjusted = base coverage), every district in tarpit (adjusted denominator floors at 1), zero failures in 7d (`topFailureReason7d === null`).
- **Cron summary log shape** — one happy-path test in `scan-vacancies` route tests that asserts the `vacancy_cron_summary` event is emitted with the expected JSON keys and types after a batch run.
- **Admin card** — Vitest+RTL test of `VacancyScanCard` with mocked stats covering: empty tarpit (no alert dot), populated tarpit (alert dot, sub-line shows top platforms), null `topFailureReason7d` (renders "—"), populated reason (renders bucket name and percentage). Co-located in `src/features/admin/components/__tests__/`.
- **Backfill script** — manual test only. The script's effect is observable in DB state and in its summary output; a unit test would mostly re-test `categorizeFailure`.

## Out of scope (deliberate)

- **Failure-counter reset job.** A periodic or manual mechanism to clear `vacancyConsecutiveFailures` on tarpit residents so they get retried. Separate brainstorm; this work makes that future job's targeting trivial via the new column.
- **Claude fallback regression fix.** The 2026-04-23 issue itself. Separate effort; the new metrics will tell us when it's resolved.
- **Dedicated `/admin/vacancy-diagnostics` page.** Drillable tarpit roster, per-platform coverage, full failure-reason histogram. May graduate from this card if the row-2 numbers consistently point us toward needing a deeper view.
- **Coverage delta over 7d.** "+N districts this week" stat. Useful but redundant with the existing 7-day scan count for an instrumentation pass.
- **Never-scanned pool size as a separate stat.** Largely redundant with the tarpit number once the future reset job exists; if it doesn't, "never-scanned but not in tarpit" is a small population and the card is already adding three numbers.
- **Per-parser timing breakdown.** Possible future log fields; not included because timing isn't currently a pain point and the per-scan event is already wide.

## Migration plan

1. Apply the additive Prisma migration. Existing rows get `failureReason = NULL`.
2. Deploy the code changes (helper, scan-runner wiring, cron telemetry, stats endpoint, admin card).
3. Run the backfill script once. Verify the summary output makes sense before committing the result (the script can be run in dry-run mode by setting `DRY_RUN=true` to print summary without writing).
4. Verify the admin card now shows non-zero values in row 2 within one cron cycle.

No reverse-migration path is required — the column is nullable and additive, so a rollback is just deploying the prior code with the column unused.
