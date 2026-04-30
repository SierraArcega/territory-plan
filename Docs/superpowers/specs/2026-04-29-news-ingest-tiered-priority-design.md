# News Ingest — Tiered Priority + Throughput Bump

**Status:** Approved (2026-04-29)
**Owner:** Sierra Arcega

## Problem

The rolling news ingest cron (`/api/cron/ingest-news-rolling`, every 15 min)
moves through districts too slowly to keep coverage current. Admin's
`news-ingest-stats` reports ~8% green coverage and the figure barely changes
day-to-day. Three compounding causes:

1. **Throughput is artificially capped.** `ROLLING_BATCH_SIZE = 15`, p-queue
   concurrency 4. Each cron run finishes in ~10–20s and exits, leaving ~280s
   of the 300s Vercel budget unused. At 15 districts × 96 runs/day = 1,440
   districts/day. With ~13K US districts that's a ~9-day full sweep — and
   most of those fetches go to districts no rep cares about.

2. **Priority is frozen at migration time.** The seed SQL in
   `prisma/migrations/20260422090000_add_news_tables/migration.sql` set
   `district_news_fetch.priority` once based on `is_customer` and
   `has_open_pipeline`. No code path updates priority when a district
   becomes a customer, gets added to a pipeline, or is added to a
   territory plan. Most of the *coverage targets* counted by
   `news-ingest-stats` (which include `territory_plan_districts`) are
   sitting at `priority = 0`, competing on equal terms with the long tail.

3. **"Few articles per run" is a downstream symptom.** Each Google News
   district query returns 10–25 items, but URL-hash dedup kills most of
   them on subsequent sweeps. Until the queue actually targets districts
   reps care about, this looks like the queue is grinding without
   producing relevant content.

## Goal

Coverage of districts reps actually care about should reach ≥70% green
within 24 hours of deploy, and stay there. Customer/pipeline districts
should never have news older than ~6 hours.

Non-goal: surfacing news faster *to a single rep on demand* (already
handled by Layer 4 manual refresh).

## Design

### Tiered freshness SLAs

Replace the single integer priority score with three tiers, each with a
target re-fetch interval:

| Tier | Membership | SLA |
|------|------------|-----|
| **T1** | `districts.is_customer = true` OR `districts.has_open_pipeline = true` | 6 hours |
| **T2** | District is in any `territory_plan_districts` row, OR has an `activity_districts` row whose joined `activities.created_at` is within the last 30 days | 24 hours |
| **T3** | All other US districts | 30 days |

Tiers are derived live from current state on every batch query — no
stored tier column, no refresh cron, no drift.

### Batch query

Replace the Prisma `findMany` in `ingestRollingLayer`
(`src/features/news/lib/ingest.ts:146-154`) with raw SQL via the
`pg` pool (`src/lib/db.ts`):

```sql
WITH ranked AS (
  SELECT
    f.leaid,
    f.last_fetched_at,
    CASE
      WHEN d.is_customer OR d.has_open_pipeline THEN 1
      WHEN EXISTS (
        SELECT 1 FROM territory_plan_districts tpd
        WHERE tpd.district_leaid = f.leaid
      )
        OR EXISTS (
          SELECT 1
          FROM activity_districts ad
          JOIN activities a ON a.id = ad.activity_id
          WHERE ad.district_leaid = f.leaid
            AND a.created_at > NOW() - INTERVAL '30 days'
        )
      THEN 2
      ELSE 3
    END AS tier
  FROM district_news_fetch f
  JOIN districts d ON d.leaid = f.leaid
)
SELECT leaid, tier
FROM ranked
WHERE last_fetched_at IS NULL
   OR last_fetched_at < NOW() - (
        CASE tier
          WHEN 1 THEN INTERVAL '6 hours'
          WHEN 2 THEN INTERVAL '24 hours'
          ELSE INTERVAL '30 days'
        END
      )
ORDER BY tier ASC, last_fetched_at NULLS FIRST
LIMIT $1
```

The CTE materializes tier per row, the WHERE clause filters to rows
overdue against their SLA, and the ORDER BY guarantees T1 always
drains before T2, which drains before T3. When every tier is up to
date, the LIMIT just returns fewer rows and the cron run is a cheap
no-op.

The two `EXISTS` predicates rely on existing indexes:
- `territory_plan_districts` PK is `(plan_id, district_leaid)` — sufficient.
- `activity_districts` has `@@index([districtLeaid])` (verified at
  `prisma/schema.prisma:692`).
- `activities.created_at` is not currently indexed; if EXPLAIN shows
  this dominates query cost we can add `CREATE INDEX
  activities_created_at_idx ON activities (created_at)` in a follow-up.

### After-fetch update path stays the same

`UPDATE district_news_fetch SET last_fetched_at = NOW(), last_status = ...
WHERE leaid = $1` is unchanged from current code. We only swap *which*
districts get pulled into the batch.

### Throughput knobs

In `src/features/news/lib/config.ts`:
- `ROLLING_BATCH_SIZE`: 15 → **100**

In `src/features/news/lib/ingest.ts:144`:
- `new PQueue({ concurrency: 4 })` → `new PQueue({ concurrency: 6 })`

Per-run cost estimate at the new knobs: 100 districts at concurrency 6,
each Google News RSS round-trip ~1–3s → ~17–50s per run. Comfortably
under the 300s `maxDuration`. Daily throughput becomes 100 × 96 =
9,600 fetches/day, which is more than enough to keep T1 (~50–200
districts × 4 fetches/day) and T2 (~500–1,500 districts × 1 fetch/day)
satisfied with budget left for T3.

If we hit Google News 429s we manually roll back concurrency to 4 in
a follow-up commit. Per-district fetch errors land in
`district_news_fetch.last_status`; run-level failures are surfaced via
`news_ingest_runs.status` in the existing admin failure counter.

### Dead column

`district_news_fetch.priority` becomes unused. Leave the column in
place for v1 — dropping it is a separate cleanup PR after this
deploys clean.

## Out of scope

- **Admin UI surfacing tier state.** The current admin
  `news-ingest-stats` panel still shows a single "% green" number.
  Replacing that with per-tier overdue counts ("12 T1 overdue, 47 T2
  overdue, 4,300 T3 overdue") is worth doing so we can *see* the
  tiers, but it's a follow-up — the underlying SQL change here is
  what unblocks coverage.
- **Dropping the dead `priority` column.** Cleanup PR after this
  deploys clean.
- **Activity-weighted dynamic scoring** (the option C we considered).
  Kept as a future option if T2's "any activity in 30d" turns out to
  be too coarse.
- **Refreshing tier on plan changes / customer flips.** Not needed —
  tier is computed live per batch.

## Testing

- Unit test on the batch SQL: seed a few districts in each tier
  (customer, pipeline, plan-only, activity-only, none), run the
  query, assert ordering and that fresh rows are excluded.
- Smoke run the cron locally with `?secret=&batch=20` against a
  copy of production data; confirm T1 districts drain first and
  the run finishes well under 300s.

## Migration / rollout

No DB migration. Single commit changes:
- `src/features/news/lib/config.ts` — bump `ROLLING_BATCH_SIZE`.
- `src/features/news/lib/ingest.ts` — replace findMany with raw SQL,
  bump concurrency.
- New test file alongside `ingest.ts`.

After deploy, watch the `lastStatus = 'error'` rate in the admin
panel for 24h. Coverage should climb visibly within the first few
cron runs as T1/T2 districts drain ahead of T3.
