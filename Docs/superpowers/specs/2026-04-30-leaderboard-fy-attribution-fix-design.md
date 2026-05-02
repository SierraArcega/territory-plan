# Leaderboard FY attribution fix — design

**Status:** approved 2026-04-30
**Author:** Sierra (with Claude)
**Context:** Monica showed $1.8M FY26 revenue in territory-plan vs $3.3M+ in es-bi (the OpenSearch-backed source-of-truth report). Investigation in [systematic debugging session, see git log] confirmed three independent contributors to the $747K gap between es-bi's leaderboard total and territory-plan's leaderboard total for the same rep + fiscal year.

## Problem

The territory-plan FY26 leaderboard understates rep revenue by:

1. **Definition mismatch (~$463K of gap).** Territory-plan groups session revenue by `opp.school_yr`. es-bi groups by `session.start_time`. Sessions on multi-year or renewal opps tagged `school_yr = "2024-25"` that occur in FY26 (Jul 2025 – Jun 2026) get filed under FY25 in territory-plan and are invisible on the FY26 leaderboard.
2. **Silent drop of unmatched opps (~$255K of gap).** The `district_opportunity_actuals` materialized view filters out opps with `district_lea_id IS NULL`. Most of these are not unmappable; they're queued in `unmatched_opportunities` waiting for admin resolution. While they wait, their revenue disappears from leaderboards.
3. **Sync staleness (~$30K of gap, variable).** The hourly sync depends on OpenSearch sessions advancing their `lastIndexedAt`. Some sessions land in OpenSearch without that field updating, so their parent opp never gets re-fetched and Supabase's per-opp totals lag.

These compound: the rep sees $1.8M today, the data is correct in OpenSearch as $3.3M+, and there is no surface that explains the difference.

## Goals

- Leaderboard "FY26 Revenue" matches `SUM(session_price)` for sessions that started in FY26, plus subscription revenue tagged FY26 — within the bounds of what's syncable.
- No revenue is silently dropped. Unmatched opps still contribute to a rep's total and are surfaced for resolution.
- Current-FY data is at most 24 hours stale regardless of OpenSearch indexing reliability.
- Subscription handling stays simple (Choice A: keep on `opp.school_yr`).

## Non-goals

- Attribution model for subscriptions across fiscal years (proration). Subscriptions remain bucketed by `opp.school_yr` for now.
- Real-time sync (sub-15-min lag).
- Rebuilding the unmatched-opps admin UI; we use the existing flow.
- Backporting historical leaderboard reports. The fix is forward-looking.

## Design

### 1. Re-bucket session revenue by `session.start_time`

**New view: `rep_session_actuals`** (regular view, not materialized initially)

Aggregates the existing `sessions` table by session-derived fiscal year:

```sql
CREATE VIEW rep_session_actuals AS
SELECT
  o.sales_rep_email,
  o.sales_rep_name,
  COALESCE(o.district_lea_id, '_NOMAP') AS district_lea_id,
  o.state,
  session_fy(s.start_time) AS school_yr,
  SUM(s.session_price) AS session_revenue,
  COUNT(*) AS session_count
FROM sessions s
JOIN opportunities o ON o.id = s.opportunity_id
WHERE s.status NOT IN ('cancelled', 'canceled')
  AND s.session_price IS NOT NULL
  AND session_fy(s.start_time) IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;
```

Where `session_fy(ts timestamptz)` is a new immutable SQL function:

```sql
-- '2025-07-01' .. '2026-06-30' -> '2025-26'
-- Returns NULL for timestamps outside the supported range
CREATE FUNCTION session_fy(ts timestamptz) RETURNS text AS $$
  SELECT CASE
    WHEN ts IS NULL THEN NULL
    WHEN EXTRACT(MONTH FROM ts) >= 7
      THEN EXTRACT(YEAR FROM ts)::int::text || '-' ||
           LPAD(((EXTRACT(YEAR FROM ts)::int + 1) % 100)::text, 2, '0')
    ELSE (EXTRACT(YEAR FROM ts)::int - 1)::text || '-' ||
         LPAD((EXTRACT(YEAR FROM ts)::int % 100)::text, 2, '0')
  END
$$ LANGUAGE SQL IMMUTABLE;
```

**Existing view `district_opportunity_actuals` keeps its row shape and grouping** (still keyed on `district_lea_id, school_yr, sales_rep_email, category`), used unchanged by district pages, map features, and subscription rollups. One small change: ensure `sub_revenue` is exposed as its own column on the view, alongside the existing combined `total_revenue` column. The leaderboard's new query needs to pull subscriptions independently of session revenue. If `sub_revenue` is already a column today (per `scripts/district-opportunity-actuals-view.sql`), no change here; if it's only used as an intermediate inside the `total_revenue` SUM, expose it.

**Leaderboard query change** in `src/lib/opportunity-actuals.ts → getRepActuals(email, schoolYr)`:

```ts
// before: SUM(total_revenue) FROM district_opportunity_actuals
//         WHERE sales_rep_email = $1 AND school_yr = $2

// after:
// SELECT
//   COALESCE(s.session_revenue, 0) + COALESCE(d.subscription_revenue, 0) AS total_revenue
// FROM (
//   SELECT SUM(session_revenue) AS session_revenue
//   FROM rep_session_actuals
//   WHERE sales_rep_email = $1 AND school_yr = $2
// ) s
// CROSS JOIN (
//   SELECT SUM(sub_revenue) AS subscription_revenue
//   FROM district_opportunity_actuals
//   WHERE sales_rep_email = $1 AND school_yr = $2
// ) d
```

The two streams continue to share `school_yr` semantics in name (string `"2025-26"`), but they're sourced differently — sessions by `session_fy(start_time)`, subscriptions by `opp.school_yr`. The naming collision is intentional so the existing leaderboard UI doesn't need to know.

### 2. Sentinel bucket for unmatched opps + queue backfill

**View change: `district_opportunity_actuals`**

Replace `WHERE o.district_lea_id IS NOT NULL` (line ~85 in `scripts/district-opportunity-actuals-view.sql`) with `COALESCE(o.district_lea_id, '_NOMAP')` in the GROUP BY. Same change in the new `rep_session_actuals`.

`'_NOMAP'` is 6 characters and fits the existing `VARCHAR(7)` constraint on `district_lea_id`. No schema migration required, but the migration that creates the new view should also `ALTER TABLE` the unmatched_opportunities resolution flow to never write `'_NOMAP'` as a real resolution (it's an aggregation sentinel only, not a stored opp value).

**Consumer guards.** Audit downstream consumers of these views for any `WHERE district_lea_id LIKE '%[0-9]%'` style assumptions. District-detail pages already filter by a specific `district_lea_id` value, so they naturally exclude `'_NOMAP'`. Map features should explicitly add `WHERE district_lea_id != '_NOMAP'` if they don't already filter to a known LEAID.

**Frontend: unmatched badge on leaderboard**

In `src/features/leaderboard/components/RevenueTable.tsx`, add a small inline badge per rep:

> "3 unmatched · $X" → links to `/admin/unmatched?rep=<email>`

Sourced from a new query against `unmatched_opportunities` grouped by `sales_rep_email`. Already-existing admin route handles the resolution UX (see commit `64de013e`).

**One-time backfill: `scripts/backfill-unmatched-resolutions.ts`**

For each row in `unmatched_opportunities` with `resolved = false`:
1. Look up the opp's `account_lms_id` in OpenSearch's `clj-prod-districts` index.
2. If exactly one district matches by `(account_lms_id → ncesId)` AND the resolved district name matches the opp's `account_name` per the existing `names_match()` rule, auto-set `resolved = true, resolved_district_leaid = ncesId`.
3. Otherwise leave for manual review.
4. Log a summary: N auto-resolved, M deferred.

Conservative on purpose. Anything ambiguous stays in the admin queue.

### 3. Daily current-FY full re-sync

**`scheduler/run_sync.py`:** new function

```python
def run_current_fy_backfill():
    """Re-fetch all current-FY and prior-FY opps unconditionally.

    Bypasses incremental's `since` filter to catch sessions that
    landed in OpenSearch without advancing `lastIndexedAt`.
    """
    now = datetime.now(timezone.utc)
    current_fy = derive_current_school_yr(now)   # e.g. "2025-26"
    prior_fy = derive_prior_school_yr(now)       # e.g. "2024-25"

    os_client = get_client()
    opp_hits = fetch_opportunities_for_school_yrs(
        os_client, [current_fy, prior_fy]
    )
    # Reuse the existing pipeline from run_sync(): fetch sessions,
    # district mappings, build records, upsert, refresh views.
    ...
```

`fetch_opportunities_for_school_yrs(client, school_yrs)` is a new helper in `scheduler/sync/queries.py` — same as `fetch_opportunities` but takes an explicit school_yr list instead of relying on the module-level `SCHOOL_YEARS` constant, and never applies the `since` filter.

**`scheduler/run_scheduler.py`:** add daily entry

```python
schedule.every().day.at("04:00").do(scheduled_current_fy_backfill)
```

Wraps `run_current_fy_backfill()` with the same retry / state-write / Slack-monitor logic as `safe_sync()`.

### Data flow

```
OpenSearch (clj-prod-opportunities, clj-prod-sessions-v2, clj-prod-districts)
  │
  ├── hourly: incremental sync (existing)
  ├── 04:00 daily: current-FY full re-sync (new)
  │
  ▼
Supabase
  ├── opportunities (existing)
  ├── sessions (existing — unchanged)
  ├── unmatched_opportunities (existing)
  │
  ├── district_opportunity_actuals (matview, modified — sentinel for null district)
  └── rep_session_actuals (new view — sessions-by-session_fy)
       │
       ▼
src/lib/opportunity-actuals.ts → getRepActuals()
  reads BOTH views, sums sessions(by date) + subscriptions(by opp tag)
       │
       ▼
src/features/leaderboard/components/RevenueTable.tsx
  + unmatched-count badge per rep, links to existing admin queue
```

### Testing

- **vitest:** `getRepActuals()` returns `session_revenue + subscription_revenue` from both sources. Leaderboard surfaces the unmatched badge when `unmatched_opportunities` has rows for that rep.
- **pgTAP / sql tests:** `session_fy('2025-07-01'::timestamptz) = '2025-26'`, edge cases at June 30 / July 1 boundaries, NULL passthrough. View row counts before/after migration to verify no spurious zeros.
- **pytest:** `run_current_fy_backfill()` calls `fetch_opportunities_for_school_yrs` without `since`, processes all sessions, refreshes views.
- **Manual reconciliation:** after deploy, re-run `Fullmind LMS/es-bi/debug_monica_fy26_attribution.py` and the per-opp Supabase query. Step 4 OS total ($2.82M as of 2026-04-30) should match `rep_session_actuals` for Monica + FY26 within sync-lag tolerance. Plus subscription revenue from the existing view, for the final leaderboard number.

### Migration order

1. Deploy `session_fy()` SQL function (no consumers yet).
2. Deploy `rep_session_actuals` view (no consumers yet).
3. Deploy view rewrite for `district_opportunity_actuals` with `_NOMAP` sentinel + audit any consumer that filters on `district_lea_id`. Verify map and district pages still work.
4. Deploy `getRepActuals()` rewrite + leaderboard badge UI.
5. Deploy daily-backfill scheduler entry. First run lands at 04:00 UTC the next day.
6. Run `backfill-unmatched-resolutions.ts` once. Inspect the auto-resolved batch before the next scheduled sync runs (which would refresh `district_lea_id` for those opps).

Each step is independently revertable. Only step 4 changes user-visible numbers.

## Risks

- **`'_NOMAP'` sentinel collisions.** A real LEAID happens to be `'_NOMAP'`. Mitigation: real LEAIDs are 7-digit numerics (the `fetch_district_mappings()` rejection rule already enforces this); `'_NOMAP'` is 6 chars and starts with underscore — definitionally non-numeric.
- **View perf.** `rep_session_actuals` over the full sessions table on every leaderboard load. If slow, materialize it and refresh in `run_sync()` alongside `district_opportunity_actuals`. Defer the materialization decision until we measure.
- **Auto-resolve false positives in the backfill.** Mitigation: the existing `names_match()` guardrail (commit `33d4e9c7`) already rejects mismatched account names. The backfill reuses it.
- **Daily backfill traffic spike.** ~current_FY + prior_FY opp count fetched at 04:00. For Fullmind's volume (low thousands) this is small; if it becomes a load issue, throttle or move to off-hours window.

## What this does NOT fix

- Subscription FY attribution remains tag-based. A subscription on a `school_yr = "2024-25"` opp that bills into FY26 won't appear on the FY26 leaderboard. Reps generally don't surface this; revisit if anyone asks.
- Reps evaluated on past-FY metrics (e.g. "FY24 revenue") will see slightly different numbers than the old view returned, because session-date attribution will be more accurate. This is a feature, not a regression, but worth a heads-up before rollout.
- The 24-hour worst-case staleness for the daily backfill. If a rep needs intra-day fresh totals, the hourly incremental sync still applies; the backfill is the safety net.
