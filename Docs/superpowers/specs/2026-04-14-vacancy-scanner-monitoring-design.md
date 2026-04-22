---
title: Vacancy Scanner Monitoring — Design
date: 2026-04-14
status: draft
owner: sierra.arcega@fullmindlearning.com
---

# Vacancy Scanner Monitoring — Design

## Problem

The vacancy scanner has been running on its own for some time via two Vercel crons (`/api/cron/scan-vacancies` hourly, `/api/cron/vacancy-hygiene` daily at 6 AM UTC), but there is no day-to-day visibility into its health. The existing `VacancyScanCard` in admin → Data Sync shows cumulative state — total open vacancies, coverage %, scans in the last 7 days, failures in the last 24 hours — but it cannot answer any of these questions at a glance:

1. How many new vacancies came in today? This week?
2. How many were removed or expired today? This week?
3. Is the scanner actually healthy right now, or is something silently degraded?

As a result, the user had no way to confirm whether the scanner was still running. When they asked "is it still running?", the answer required a direct DB query — that is a visibility failure, not a scanner failure. The scanner is currently healthy: 115 scans in the last 24 hours, 0 failures, 354 new vacancies brought in, last completed scan ~1 minute ago. But one real anomaly surfaced during the investigation: **25 scans are stuck in `running` status**, which `recoverStaleScans()` is supposed to catch but currently isn't.

## Goals

1. Turn `VacancyScanCard` into something a human can read in 2 seconds and trust — a plain-English health verdict, a daily delta sparkline, and a surfaced warning for stuck scans.
2. Push proactive Slack notifications to the same `#data-flow` channel used by `scheduler/monitor.py`, matching its format and cadence so alerts feel like one monitoring family.
3. Fix the schema gap that prevents accurate daily-removal counts by adding a `closedAt` timestamp to `Vacancy`.

## Non-goals

- No dedicated monitoring page. Everything lives on the existing Data Sync card.
- No changes to how scans are actually run (`scan-vacancies` cron logic is untouched).
- No backfill of historical `closedAt` values. The column starts empty and fills forward.
- No refactor of `scheduler/monitor.py`. It continues to watch the Python opportunity-sync scheduler; this new cron is a sibling, not a replacement.
- No on-call paging or PagerDuty integration. Slack alerts only.

## Design

### Part 1 — `VacancyScanCard` extensions

The card keeps its current layout and adds three elements.

**Health verdict line** — appears at the top, above the existing colored dot and "Last scan Xm ago" subtitle.

> `Healthy — 5 scans completed this hour, 354 new vacancies today, 0 failures.`

The sentence is derived server-side from the stats response and returned as a pre-formatted string. Health states:

| State | Criteria | Sentence template |
|---|---|---|
| `healthy` | Last successful scan <2h ago AND `failed_24h < 3` AND `stuckScans < 20` | `Healthy — {scans1h} scans completed this hour, {newToday} new vacancies today, {failed24h} failures.` |
| `degraded` | Last successful scan 2–6h ago OR `failed_24h ≥ 3` OR `stuckScans ≥ 20` | `Degraded — {reason}. Last successful scan {relative}.` |
| `broken` | Last successful scan ≥6h ago OR `failed_1h ≥ 5` | `Broken — {reason}. No successful scan since {relative}.` |

The dot color (`#8AA891` green / `#E5A53D` yellow / `#F37167` red) is driven by the same state.

**Daily delta sparkline** — a new row below the existing 4-column stats grid, full width.

Inline SVG, 7 paired bars, one pair per day (left = plum `#403770` for new, right = muted coral `#F37167` for closed). Hover over a day shows a tooltip with exact numbers and the date. No chart library — the component renders SVG directly using computed heights. ~60 lines of code.

Example:

```
New vs closed, last 7 days
 ▌▌  ▌▌  ▌▌  ▌▌  ▌▌  ▌▌  ▌▌
 █▌  ██  █▌  ▐█  ██  █▐  █▌
 Apr 8  9  10  11  12  13  14
```

**Stuck-scan warning** — a new conditional row rendered only when `stuckScans > 0`:

```
⚠ 25 scans stuck in "running" status for >2h.    [Recover]
```

Plum border, coral accent. The Recover button POSTs to a new `/api/admin/vacancy-scan-recover` endpoint that calls the existing `recoverStaleScans()` function and then invalidates the stats query. No destructive action — it just flips stale `running` rows to `failed` so the next cron can retry them.

### Part 2 — Extend `/api/admin/vacancy-scan-stats`

Existing response fields are kept. New fields added:

```ts
{
  // ...existing fields (totalVacancies, verifiedVacancies, coveragePct, etc)

  health: "healthy" | "degraded" | "broken",
  healthSentence: string,
  scans1h: number,
  newVacanciesToday: number,    // first_seen_at within the current ET calendar day
  closedVacanciesToday: number, // closed_at within the current ET calendar day
  stuckScans: number,           // status=running AND started_at < NOW() - INTERVAL '2 hours'
  dailyDeltas: Array<{
    date: string,               // YYYY-MM-DD (ET)
    newCount: number,           // vacancies where first_seen_at in that day
    closedCount: number,        // vacancies where closed_at in that day
  }>,                           // last 7 days (ET-bucketed), oldest first
}
```

All new counts are computed via the same `Promise.all` pattern the existing route uses. The `dailyDeltas` array uses a single grouped SQL query (not 14 separate counts). `newVacanciesToday` must agree with the newest entry in `dailyDeltas` — they read the same ET-calendar bucket and should never diverge.

### Part 3 — New endpoint `/api/admin/vacancy-scan-recover`

```ts
POST /api/admin/vacancy-scan-recover
// Auth: getAdminUser() — admin only
// Body: {}
// Returns: { recovered: number }
```

Calls `recoverStaleScans()` (already exists in `src/features/vacancies/lib/scan-queue.ts`) and returns how many rows were flipped from `running`/`pending` to `failed`. Non-destructive — the next hourly cron re-queues anything that was in progress.

### Part 4 — Slack monitoring cron

**New route**: `/api/cron/vacancy-monitor` (GET, Vercel Cron posture — `CRON_SECRET` auth via query param or Bearer).

**Schedule**: hourly, `0 * * * *`, added to `vercel.json`:

```json
{
  "path": "/api/cron/vacancy-monitor?secret=${CRON_SECRET}",
  "schedule": "0 * * * *"
}
```

**Alert checks** (run every invocation):

| Alert type | Trigger | Emoji | Message |
|---|---|---|---|
| `stale_scan` | Last completed scan >2h ago | `:warning:` | `*Vacancy Scanner Alert — No Successful Scan*\nLast successful scan: {relative}\nThe hourly cron may be failing silently.` |
| `high_failure_rate` | ≥3 failed scans in the last hour | `:red_circle:` | `*Vacancy Scanner Alert — High Failure Rate*\n{failed} scans failed in the last hour (out of {total}).\nLatest error: \`{errorMessage}\`` |
| `stuck_scans` | >20 scans stuck in `running` for >2h | `:warning:` | `*Vacancy Scanner Alert — Stuck Scans*\n{count} scans stuck in "running" status for >2h.\nRun recovery from admin → Data Sync.` |

Each alert has independent anti-spam: the same alert type is suppressed for 1 hour after being sent. Implemented via a new `MonitorAlertState` table (see Data Model).

**Daily summary** at 12:00 UTC (8 AM ET), sent once per day:

```
:chart_with_upwards_trend: *Vacancy Scanner Summary — Apr 14*
Scans: 120 | Failed: 0 | New: 354 | Closed: 211 | Open: 25,954
```

Format intentionally mirrors `build_daily_summary()` in `scheduler/monitor.py:65`. Same structure, same pipe separators, same relative date phrasing.

**Slack transport**: HTTP POST to `process.env.SLACK_WEBHOOK_URL` (already set in prod `.env`). Payload is `{ text: string }`, matching the Python monitor's simple incoming-webhook pattern. No Block Kit, no attachments — plain Markdown body for parity.

**Anti-spam logic**:

```ts
async function shouldAlert(alertType: string): Promise<boolean> {
  const state = await prisma.monitorAlertState.findUnique({ where: { alertType } });
  if (!state) return true;
  const ageMs = Date.now() - state.lastSentAt.getTime();
  return ageMs > 60 * 60 * 1000; // 1 hour
}

async function recordAlert(alertType: string): Promise<void> {
  await prisma.monitorAlertState.upsert({
    where: { alertType },
    create: { alertType, lastSentAt: new Date() },
    update: { lastSentAt: new Date() },
  });
}
```

The daily summary uses a separate check — it's suppressed if a summary was sent within the last 23 hours (matches Python monitor line 207).

### Part 5 — Data model changes

**`Vacancy` model** (`prisma/schema.prisma:1344`):

Add one nullable column:

```prisma
closedAt DateTime? @map("closed_at")
```

Indexed — `@@index([closedAt])` — because the daily delta query filters by it.

The post-processor in `src/features/vacancies/lib/post-processor.ts` is the only code that transitions a vacancy from `open` → `closed`. It must set `closedAt: new Date()` alongside the status change. Any row that transitions back to `open` (rare — requires the vacancy to reappear on the source) clears the timestamp.

Historical closed vacancies do not get backfilled. The sparkline starts showing "closed" counts from the day of deploy forward. Days before that will show `closedCount: 0`, which is a known and accepted artifact.

**New model `MonitorAlertState`**:

```prisma
model MonitorAlertState {
  alertType  String   @id @db.VarChar(50)
  lastSentAt DateTime @map("last_sent_at")
  @@map("monitor_alert_state")
}
```

Two columns, one row per alert type. Mirrors `scheduler/monitor.py`'s `monitor_state.json` but in Postgres so it works across Vercel's serverless cold starts.

### Part 6 — Migrations

One Prisma migration: `add-vacancy-closed-at-and-monitor-state`. Adds:

```sql
ALTER TABLE vacancies ADD COLUMN closed_at timestamp(3);
CREATE INDEX vacancies_closed_at_idx ON vacancies(closed_at);

CREATE TABLE monitor_alert_state (
  alert_type varchar(50) PRIMARY KEY,
  last_sent_at timestamp(3) NOT NULL
);
```

Run via `npx prisma migrate dev --name add-vacancy-closed-at-and-monitor-state`.

## Implementation notes

- **Post-processor update**: the only code path that closes a vacancy is in `post-processor.ts` during the "mark missing as closed" step. That update must be changed to set both `status` and `closedAt`. Confirm via test that re-opening a vacancy (status back to `open`) clears `closedAt`.
- **`vacancy-hygiene` cron** currently **deletes** over-threshold vacancies outright (`prisma.vacancy.deleteMany`, `vacancy-hygiene/route.ts:101`). Deleted rows never go through the "closed" transition, so they will not appear in the `dailyDeltas.closedCount`. This is an accepted limitation — "removed" in the user's language maps to `closed`, not `deleted`. The hygiene path is noisy cleanup, not routine churn.
- **Auth on new endpoints**: `/api/admin/vacancy-scan-recover` uses `getAdminUser()` from `@/lib/supabase/server` (consistent with other admin routes). `/api/cron/vacancy-monitor` uses the `CRON_SECRET` pattern already used by `scan-vacancies` and `vacancy-hygiene`.
- **Time zones**: daily summary fires at 12:00 UTC = 8 AM ET, matching Python monitor. Daily delta buckets in the sparkline are bucketed by ET calendar day (not UTC), so "today" on the chart matches what a sales rep sees on their clock.
- **Zero-state**: on the day of deploy, `closedCount` will be 0 across all 7 days. The chart should still render. The health sentence should still work (it doesn't depend on deltas).
- **Testing**: Vitest tests for (a) the health-verdict logic given various stats inputs, (b) the anti-spam `shouldAlert` / `recordAlert` pair, (c) the daily-delta SQL producing the right bucket counts against a seeded DB.

## Success criteria

1. User opens admin → Data Sync. Within 2 seconds, they can answer: is the scanner healthy, how many new vacancies today, is anything stuck?
2. If the scanner goes silent for 2+ hours, the user gets a Slack alert within an hour of the outage — without having to check anything.
3. Every morning at 8 AM ET, a Slack summary tells them yesterday's net movement.
4. The 25 stuck scans found during investigation get cleaned up by the recovery button, and future stuck scans surface automatically instead of being invisible.

## Open questions

None.
