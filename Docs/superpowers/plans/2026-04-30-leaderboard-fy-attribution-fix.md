# Leaderboard FY Attribution Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make territory-plan's FY26 leaderboard match es-bi's FY26 session-revenue total by re-bucketing sessions by `session.start_time`, sentinel-bucketing unmatched-district opps so they don't disappear, and adding a daily current-FY full re-sync to close the OpenSearch indexing gap.

**Architecture:** Three independent additions stitched together at the leaderboard query layer. (1) New SQL function `session_fy()` and view `rep_session_actuals` aggregate the existing `sessions` table by session-derived FY. (2) Existing matview `district_opportunity_actuals` is rewritten to keep unmatched opps under a `'_NOMAP'` sentinel, and to expose `sub_revenue` as its own column for independent subscription rollups. (3) `getRepActuals()` reads BOTH views and sums `sessions(by date) + subscriptions(by opp tag)`. (4) A daily cron entry in the scheduler runs a full re-fetch of current/prior-FY opps, bypassing the incremental `since` filter. (5) A one-time TS script auto-resolves the existing `unmatched_opportunities` queue.

**Tech Stack:** PostgreSQL (Supabase), Prisma raw SQL, TypeScript / Vitest, Python / pytest, OpenSearch client.

**Spec:** `docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md`

---

## File Structure

**New files:**
- `prisma/migrations/manual/2026-04-30_session_fy_function.sql` — `session_fy(timestamptz) → text` function
- `prisma/migrations/manual/2026-04-30_rep_session_actuals_view.sql` — `rep_session_actuals` view
- `prisma/migrations/manual/2026-04-30_district_opp_actuals_nomap.sql` — re-create `district_opportunity_actuals` with `_NOMAP` sentinel and `sub_revenue` exposed
- `src/lib/__tests__/session-fy.test.ts` — boundary tests for `session_fy()`
- `src/lib/__tests__/rep-session-actuals.test.ts` — view shape tests
- `src/lib/__tests__/opportunity-actuals.test.ts` — `getRepActuals()` post-rewrite
- `src/lib/unmatched-counts.ts` — new helper `getUnmatchedCountsByRep()`
- `src/lib/__tests__/unmatched-counts.test.ts`
- `scripts/backfill-unmatched-resolutions.ts` — one-time auto-resolve script
- `scripts/__tests__/backfill-unmatched-resolutions.test.ts`
- `scheduler/run_current_fy_backfill.py` — daily backfill entry-point function (re-uses run_sync helpers)
- `scheduler/tests/test_run_current_fy_backfill.py`

**Modified files:**
- `scripts/district-opportunity-actuals-view.sql` — source-of-truth for the matview definition; updated to use `_NOMAP` sentinel and expose `sub_revenue`. The migration above re-runs this script.
- `src/lib/opportunity-actuals.ts` — `getRepActuals()` rewrites query to read both views and sum
- `src/features/leaderboard/lib/fetch-leaderboard.ts` — include unmatched count per rep in the payload
- `src/features/leaderboard/lib/types.ts` — add `unmatchedOppCount`, `unmatchedRevenue` to `LeaderboardEntry`
- `src/features/leaderboard/components/RevenueTable.tsx` — render unmatched-count badge
- `scheduler/sync/queries.py` — new `fetch_opportunities_for_school_yrs(client, school_yrs)` helper
- `scheduler/run_scheduler.py` — register daily 04:00 UTC schedule entry
- `scheduler/tests/test_queries.py` — test for new helper

---

## Migration / Deployment Order

Tasks below are ordered so each merge is independently revertable. Only Task 7 (the `getRepActuals()` rewrite) actually moves user-visible numbers; everything before it is invisible infrastructure, everything after it (badge, daily re-sync, queue backfill) layers on additional fixes.

---

## Task 1: `session_fy()` SQL function

**Files:**
- Create: `prisma/migrations/manual/2026-04-30_session_fy_function.sql`
- Test: `src/lib/__tests__/session-fy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/session-fy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import prisma from "@/lib/prisma";

describe("session_fy()", () => {
  async function fy(iso: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<{ fy: string | null }[]>`
      SELECT session_fy(${iso}::timestamptz) AS fy
    `;
    return rows[0]?.fy ?? null;
  }

  it("July 1 begins the new fiscal year", async () => {
    expect(await fy("2025-07-01T00:00:00Z")).toBe("2025-26");
  });

  it("June 30 is the prior fiscal year", async () => {
    expect(await fy("2025-06-30T23:59:59Z")).toBe("2024-25");
  });

  it("Mid-FY26 timestamp", async () => {
    expect(await fy("2026-04-30T12:00:00Z")).toBe("2025-26");
  });

  it("Returns NULL for NULL input", async () => {
    const rows = await prisma.$queryRaw<{ fy: string | null }[]>`
      SELECT session_fy(NULL::timestamptz) AS fy
    `;
    expect(rows[0].fy).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/session-fy.test.ts`
Expected: FAIL with "function session_fy(timestamp with time zone) does not exist"

- [ ] **Step 3: Write the migration**

Create `prisma/migrations/manual/2026-04-30_session_fy_function.sql`:

```sql
-- Maps a session timestamp to a Fullmind fiscal-year string ("YYYY-YY").
-- Fiscal years run July 1 → June 30. Returns NULL for NULL input.
-- Example: '2025-07-01' → '2025-26'; '2025-06-30' → '2024-25'.

CREATE OR REPLACE FUNCTION session_fy(ts timestamptz) RETURNS text AS $$
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

- [ ] **Step 4: Apply the migration**

Run:
```bash
psql "$SUPABASE_DB_URL" -f prisma/migrations/manual/2026-04-30_session_fy_function.sql
```

Or via the Supabase MCP `apply_migration` tool with the file contents.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/session-fy.test.ts`
Expected: 4 PASS

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/manual/2026-04-30_session_fy_function.sql src/lib/__tests__/session-fy.test.ts
git commit -m "feat(db): add session_fy() function for date-based FY bucketing"
```

---

## Task 2: `rep_session_actuals` view

**Files:**
- Create: `prisma/migrations/manual/2026-04-30_rep_session_actuals_view.sql`
- Test: `src/lib/__tests__/rep-session-actuals.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/rep-session-actuals.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";

const REP_EMAIL = "test+repsessionactuals@example.com";
const OPP_ID = "test_rsa_opp_1";
const SESSION_ID = "test_rsa_sess_1";

describe("rep_session_actuals view", () => {
  beforeAll(async () => {
    await prisma.$executeRaw`DELETE FROM sessions WHERE id = ${SESSION_ID}`;
    await prisma.$executeRaw`DELETE FROM opportunities WHERE id = ${OPP_ID}`;
    await prisma.$executeRaw`
      INSERT INTO opportunities (id, sales_rep_email, district_lea_id, school_yr, state)
      VALUES (${OPP_ID}, ${REP_EMAIL}, '0612345', '2024-25', 'CA')
    `;
    await prisma.$executeRaw`
      INSERT INTO sessions (id, opportunity_id, session_price, start_time, status)
      VALUES (${SESSION_ID}, ${OPP_ID}, 1000, '2025-09-15T10:00:00Z', 'completed')
    `;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM sessions WHERE id = ${SESSION_ID}`;
    await prisma.$executeRaw`DELETE FROM opportunities WHERE id = ${OPP_ID}`;
  });

  it("buckets sessions by session_fy(start_time), not opp.school_yr", async () => {
    const rows = await prisma.$queryRaw<
      { school_yr: string; session_revenue: number }[]
    >`
      SELECT school_yr, session_revenue::float
      FROM rep_session_actuals
      WHERE sales_rep_email = ${REP_EMAIL}
    `;
    // Opp tagged 2024-25, but session.start_time = Sep 2025 → FY26 bucket
    expect(rows).toHaveLength(1);
    expect(rows[0].school_yr).toBe("2025-26");
    expect(rows[0].session_revenue).toBe(1000);
  });

  it("excludes cancelled sessions", async () => {
    await prisma.$executeRaw`
      INSERT INTO sessions (id, opportunity_id, session_price, start_time, status)
      VALUES ('test_rsa_cancelled', ${OPP_ID}, 500, '2025-10-01T10:00:00Z', 'cancelled')
    `;
    const rows = await prisma.$queryRaw<{ session_revenue: number }[]>`
      SELECT SUM(session_revenue)::float AS session_revenue
      FROM rep_session_actuals
      WHERE sales_rep_email = ${REP_EMAIL}
    `;
    expect(rows[0].session_revenue).toBe(1000); // unchanged
    await prisma.$executeRaw`DELETE FROM sessions WHERE id = 'test_rsa_cancelled'`;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/rep-session-actuals.test.ts`
Expected: FAIL with "relation rep_session_actuals does not exist"

- [ ] **Step 3: Write the migration**

Create `prisma/migrations/manual/2026-04-30_rep_session_actuals_view.sql`:

```sql
-- View: rep_session_actuals
-- Aggregates the sessions table by (rep, district, session_fy(start_time)).
-- Used by the leaderboard to bucket session revenue by when the session
-- actually happened, not by the parent opportunity's school_yr tag.
-- Subscriptions are NOT in this view — they continue to come from
-- district_opportunity_actuals (Choice A in the design spec).

DROP VIEW IF EXISTS rep_session_actuals;

CREATE VIEW rep_session_actuals AS
SELECT
  o.sales_rep_email,
  o.sales_rep_name,
  COALESCE(o.district_lea_id, '_NOMAP') AS district_lea_id,
  o.state,
  session_fy(s.start_time) AS school_yr,
  SUM(s.session_price) AS session_revenue,
  COUNT(*)::int AS session_count
FROM sessions s
JOIN opportunities o ON o.id = s.opportunity_id
WHERE s.status NOT IN ('cancelled', 'canceled')
  AND s.session_price IS NOT NULL
  AND session_fy(s.start_time) IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;

COMMENT ON VIEW rep_session_actuals IS
  'Sessions aggregated by session-date FY (not opp.school_yr). See spec 2026-04-30-leaderboard-fy-attribution-fix-design.md';
```

- [ ] **Step 4: Apply the migration**

Run:
```bash
psql "$SUPABASE_DB_URL" -f prisma/migrations/manual/2026-04-30_rep_session_actuals_view.sql
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/rep-session-actuals.test.ts`
Expected: 2 PASS

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/manual/2026-04-30_rep_session_actuals_view.sql src/lib/__tests__/rep-session-actuals.test.ts
git commit -m "feat(db): add rep_session_actuals view bucketing sessions by start_time"
```

---

## Task 3: `district_opportunity_actuals` — `_NOMAP` sentinel + expose `sub_revenue`

**Files:**
- Modify: `scripts/district-opportunity-actuals-view.sql:85, 131-135`
- Create: `prisma/migrations/manual/2026-04-30_district_opp_actuals_nomap.sql` (calls the modified script)
- Test: `src/lib/__tests__/district-opp-actuals-nomap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/district-opp-actuals-nomap.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";

const REP_EMAIL = "test+nomap@example.com";
const OPP_NULL_DISTRICT = "test_nomap_opp_null";
const OPP_REAL_DISTRICT = "test_nomap_opp_real";

describe("district_opportunity_actuals _NOMAP sentinel", () => {
  beforeAll(async () => {
    await prisma.$executeRaw`DELETE FROM opportunities WHERE id IN (${OPP_NULL_DISTRICT}, ${OPP_REAL_DISTRICT})`;
    await prisma.$executeRaw`
      INSERT INTO opportunities (id, sales_rep_email, district_lea_id, school_yr, state, stage,
                                 net_booking_amount, total_revenue, completed_revenue, scheduled_revenue,
                                 total_take, completed_take, scheduled_take, contract_type)
      VALUES
        (${OPP_NULL_DISTRICT}, ${REP_EMAIL}, NULL, '2025-26', 'CA', 'Closed Won',
         5000, 5000, 5000, 0, 1000, 1000, 0, 'New Business'),
        (${OPP_REAL_DISTRICT}, ${REP_EMAIL}, '0612345', '2025-26', 'CA', 'Closed Won',
         3000, 3000, 3000, 0, 600, 600, 0, 'New Business')
    `;
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW district_opportunity_actuals`;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM opportunities WHERE id IN (${OPP_NULL_DISTRICT}, ${OPP_REAL_DISTRICT})`;
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW district_opportunity_actuals`;
  });

  it("includes opps with NULL district_lea_id under _NOMAP sentinel", async () => {
    const rows = await prisma.$queryRaw<{ district_lea_id: string; total_revenue: number }[]>`
      SELECT district_lea_id, total_revenue::float
      FROM district_opportunity_actuals
      WHERE sales_rep_email = ${REP_EMAIL} AND school_yr = '2025-26'
      ORDER BY district_lea_id
    `;
    expect(rows.map(r => r.district_lea_id).sort()).toEqual(["0612345", "_NOMAP"]);
    expect(rows.find(r => r.district_lea_id === "_NOMAP")?.total_revenue).toBe(5000);
  });

  it("rep total includes _NOMAP rows", async () => {
    const rows = await prisma.$queryRaw<{ total: number }[]>`
      SELECT SUM(total_revenue)::float AS total
      FROM district_opportunity_actuals
      WHERE sales_rep_email = ${REP_EMAIL} AND school_yr = '2025-26'
    `;
    expect(rows[0].total).toBe(8000); // 5000 + 3000
  });

  it("exposes sub_revenue as its own column", async () => {
    const rows = await prisma.$queryRaw<{ sub_revenue: number; total_revenue: number }[]>`
      SELECT sub_revenue::float, total_revenue::float
      FROM district_opportunity_actuals
      WHERE sales_rep_email = ${REP_EMAIL}
      LIMIT 1
    `;
    expect(rows[0]).toHaveProperty("sub_revenue");
    expect(typeof rows[0].sub_revenue).toBe("number");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/district-opp-actuals-nomap.test.ts`
Expected: FAIL — `_NOMAP` row missing (current view filter drops it) and/or `sub_revenue` column missing.

- [ ] **Step 3: Modify the source-of-truth view script**

In `scripts/district-opportunity-actuals-view.sql`:

Change line 85 from:
```sql
  WHERE o.district_lea_id IS NOT NULL
```
to remove the WHERE clause entirely (drop that line):
```sql
  -- (no WHERE — opps with NULL district_lea_id are bucketed under _NOMAP below)
```

Change line ~116 (inside the final SELECT, the `co.district_lea_id` reference) from:
```sql
  co.district_lea_id,
```
to:
```sql
  COALESCE(co.district_lea_id, '_NOMAP') AS district_lea_id,
```

Change line ~133–134 to ALSO expose `sub_revenue` as its own column:
```sql
  -- Revenue: Fullmind session-derived totals + Elevate K12 subscription revenue
  -- sub_revenue is signed so credits/cancellations offset positives
  COALESCE(SUM(co.total_revenue), 0)     + COALESCE(SUM(co.sub_revenue), 0) AS total_revenue,
  COALESCE(SUM(co.completed_revenue), 0) + COALESCE(SUM(co.sub_revenue), 0) AS completed_revenue,
  COALESCE(SUM(co.scheduled_revenue), 0) AS scheduled_revenue,
  COALESCE(SUM(co.sub_revenue), 0) AS sub_revenue,
```

Update the GROUP BY at line 161:
```sql
GROUP BY COALESCE(co.district_lea_id, '_NOMAP'), co.school_yr, co.sales_rep_email, co.category;
```

And update the `chain_floors` and `bucket_min_purchase` CTEs (lines 96, 105) to also use the COALESCE so they aggregate consistently:

```sql
chain_floors AS (
  SELECT
    COALESCE(district_lea_id, '_NOMAP') AS district_lea_id,
    school_yr,
    sales_rep_email,
    category,
    chain_key,
    MAX(minimum_purchase_amount) FILTER (WHERE stage_prefix >= 6) AS chain_floor
  FROM categorized_opps
  GROUP BY COALESCE(district_lea_id, '_NOMAP'), school_yr, sales_rep_email, category, chain_key
),
bucket_min_purchase AS (
  SELECT
    COALESCE(district_lea_id, '_NOMAP') AS district_lea_id,
    school_yr,
    sales_rep_email,
    category,
    COALESCE(SUM(chain_floor), 0) AS min_purchase_bookings
  FROM chain_floors
  GROUP BY COALESCE(district_lea_id, '_NOMAP'), school_yr, sales_rep_email, category
)
```

(Note: chain_floors already pulls from categorized_opps which would have the COALESCE if applied at that CTE level. Simpler: apply COALESCE in `categorized_opps` too. Equivalent end result; pick one and stay consistent.)

- [ ] **Step 4: Write the deploy migration**

Create `prisma/migrations/manual/2026-04-30_district_opp_actuals_nomap.sql`:

```sql
-- Re-create district_opportunity_actuals to:
--  1. Bucket opps with NULL district_lea_id under '_NOMAP' sentinel (was dropped)
--  2. Expose sub_revenue as its own column (was only inside total_revenue SUM)
--
-- Source of truth: scripts/district-opportunity-actuals-view.sql.
-- This migration inlines the same SQL so a CI runner without the scripts/
-- directory can apply it.
--
-- Spec: docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md

-- (Paste full updated content of scripts/district-opportunity-actuals-view.sql here.)
```

Note: paste the full contents of the modified `scripts/district-opportunity-actuals-view.sql` into this file. The two artifacts intentionally duplicate; the script is the source of truth, the migration is the deploy artifact.

- [ ] **Step 5: Apply the migration**

```bash
psql "$SUPABASE_DB_URL" -f prisma/migrations/manual/2026-04-30_district_opp_actuals_nomap.sql
```

- [ ] **Step 6: Run consumer audit grep**

Search for assumptions about `district_lea_id` being numeric/7-digit:

```bash
rg "district_lea_id\s*[~!=]" --type ts --type sql src/ scripts/ scheduler/
rg "district_lea_id.*LIKE" --type ts --type sql src/ scripts/ scheduler/
```

For each hit, confirm whether `_NOMAP` would break the assumption. Most district pages already filter by a specific lea_id value (e.g. `WHERE district_lea_id = $1`), which trivially excludes `_NOMAP`. Map features that JOIN to `districts` table will naturally exclude `_NOMAP` because no row in `districts` has that ID. Add an explicit `AND district_lea_id != '_NOMAP'` only where (a) consumer aggregates across districts and (b) `_NOMAP` rows shouldn't contribute. Document each case in the commit message.

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/district-opp-actuals-nomap.test.ts`
Expected: 3 PASS

- [ ] **Step 8: Commit**

```bash
git add scripts/district-opportunity-actuals-view.sql prisma/migrations/manual/2026-04-30_district_opp_actuals_nomap.sql src/lib/__tests__/district-opp-actuals-nomap.test.ts
git commit -m "feat(db): keep unmatched-district opps in district_opportunity_actuals via _NOMAP sentinel and expose sub_revenue separately"
```

---

## Task 4: `getRepActuals()` — read both views, sum sessions(by date) + subs(by tag)

**Files:**
- Modify: `src/lib/opportunity-actuals.ts:156-217` (`getRepActuals` function only)
- Create: `src/lib/__tests__/opportunity-actuals.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/opportunity-actuals.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import { getRepActuals } from "@/lib/opportunity-actuals";

const REP_EMAIL = "test+repactuals@example.com";
const OPP_ID = "test_repactuals_opp_1";
const SESSION_FY26 = "test_repactuals_sess_fy26";

describe("getRepActuals (post-rewrite)", () => {
  beforeAll(async () => {
    await prisma.$executeRaw`DELETE FROM sessions WHERE id = ${SESSION_FY26}`;
    await prisma.$executeRaw`DELETE FROM opportunities WHERE id = ${OPP_ID}`;

    // Opp tagged FY25 ('2024-25') but with a session in FY26 (Sep 2025).
    // This is exactly Monica's pattern: multi-year contract w/ FY26-dated work.
    await prisma.$executeRaw`
      INSERT INTO opportunities (id, sales_rep_email, district_lea_id, school_yr, state,
                                 stage, net_booking_amount, total_revenue, completed_revenue,
                                 scheduled_revenue, total_take, completed_take, scheduled_take,
                                 contract_type)
      VALUES (${OPP_ID}, ${REP_EMAIL}, '0612345', '2024-25', 'CA', 'Closed Won',
              10000, 10000, 10000, 0, 2000, 2000, 0, 'Renewal')
    `;
    await prisma.$executeRaw`
      INSERT INTO sessions (id, opportunity_id, session_price, start_time, status)
      VALUES (${SESSION_FY26}, ${OPP_ID}, 7500, '2025-09-15T10:00:00Z', 'completed')
    `;
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW district_opportunity_actuals`;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM sessions WHERE id = ${SESSION_FY26}`;
    await prisma.$executeRaw`DELETE FROM opportunities WHERE id = ${OPP_ID}`;
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW district_opportunity_actuals`;
  });

  it("counts FY26-dated session revenue under FY26 even when opp is tagged FY25", async () => {
    const actuals = await getRepActuals(REP_EMAIL, "2025-26");
    expect(actuals.totalRevenue).toBe(7500);
  });

  it("does NOT double-count: FY25 query excludes the FY26-dated session", async () => {
    const actuals = await getRepActuals(REP_EMAIL, "2024-25");
    // The opp tagged 2024-25 has 10000 in opportunities.total_revenue, but the
    // post-rewrite query reads SESSION revenue from rep_session_actuals (which
    // attributes by date), so the FY26-dated session is NOT in FY25.
    // Subscriptions still come from district_opportunity_actuals; this opp
    // has none, so 0 is the expected total for FY25.
    expect(actuals.totalRevenue).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/opportunity-actuals.test.ts`
Expected: FAIL — current `getRepActuals()` returns `0` for FY26 (because opp.school_yr ≠ '2025-26') and `10000` for FY25 (the opp's tagged year).

- [ ] **Step 3: Rewrite `getRepActuals()`**

In `src/lib/opportunity-actuals.ts`, replace the body of `getRepActuals()` (lines 156–217):

```ts
export async function getRepActuals(
  salesRepEmail: string,
  schoolYr: string
): Promise<RepActuals> {
  // Sessions: bucketed by session.start_time → session_fy() → school_yr.
  // Subscriptions, pipeline, take, bookings, min purchases: bucketed by
  // opp.school_yr (existing semantics, unchanged).
  const [sessionRows, subAndOtherRows] = await Promise.all([
    safeQueryRaw(
      prisma.$queryRaw<{ session_revenue: number }[]>`
        SELECT COALESCE(SUM(session_revenue), 0) AS session_revenue
        FROM rep_session_actuals
        WHERE sales_rep_email = ${salesRepEmail}
          AND school_yr = ${schoolYr}
      `,
      [{ session_revenue: 0 }]
    ),
    safeQueryRaw(
      prisma.$queryRaw<
        {
          sub_revenue: number;
          total_take: number;
          completed_take: number;
          scheduled_take: number;
          weighted_pipeline: number;
          open_pipeline: number;
          bookings: number;
          min_purchase_bookings: number;
          invoiced: number;
        }[]
      >`
        SELECT
          COALESCE(SUM(sub_revenue), 0) AS sub_revenue,
          COALESCE(SUM(total_take), 0) AS total_take,
          COALESCE(SUM(completed_take), 0) AS completed_take,
          COALESCE(SUM(scheduled_take), 0) AS scheduled_take,
          COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
          COALESCE(SUM(open_pipeline), 0) AS open_pipeline,
          COALESCE(SUM(bookings), 0) AS bookings,
          COALESCE(SUM(min_purchase_bookings), 0) AS min_purchase_bookings,
          COALESCE(SUM(invoiced), 0) AS invoiced
        FROM district_opportunity_actuals
        WHERE sales_rep_email = ${salesRepEmail}
          AND school_yr = ${schoolYr}
      `,
      [{ sub_revenue: 0, total_take: 0, completed_take: 0, scheduled_take: 0,
         weighted_pipeline: 0, open_pipeline: 0, bookings: 0,
         min_purchase_bookings: 0, invoiced: 0 }]
    ),
  ]);

  const sessionRevenue = Number(sessionRows[0]?.session_revenue ?? 0);
  const r = subAndOtherRows[0] ?? {
    sub_revenue: 0, total_take: 0, completed_take: 0, scheduled_take: 0,
    weighted_pipeline: 0, open_pipeline: 0, bookings: 0,
    min_purchase_bookings: 0, invoiced: 0,
  };

  return {
    totalRevenue: sessionRevenue + Number(r.sub_revenue),
    totalTake: Number(r.total_take),
    completedTake: Number(r.completed_take),
    scheduledTake: Number(r.scheduled_take),
    weightedPipeline: Number(r.weighted_pipeline),
    openPipeline: Number(r.open_pipeline),
    bookings: Number(r.bookings),
    minPurchaseBookings: Number(r.min_purchase_bookings),
    invoiced: Number(r.invoiced),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/opportunity-actuals.test.ts`
Expected: 2 PASS

- [ ] **Step 5: Run the existing leaderboard test suite to verify no regressions**

Run: `npm test -- src/features/leaderboard/`
Expected: All existing tests still PASS. The mocked `getRepActuals` in `fetch-leaderboard.test.ts` returns the same shape, so consumer tests are unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/lib/opportunity-actuals.ts src/lib/__tests__/opportunity-actuals.test.ts
git commit -m "feat(leaderboard): bucket session revenue by session date, not opp.school_yr"
```

---

## Task 5: Helper to count unmatched opps per rep

**Files:**
- Create: `src/lib/unmatched-counts.ts`
- Test: `src/lib/__tests__/unmatched-counts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/unmatched-counts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: vi.fn() },
}));

import prisma from "@/lib/prisma";
import { getUnmatchedCountsByRep } from "@/lib/unmatched-counts";

const mockQueryRaw = vi.mocked(prisma.$queryRaw);

describe("getUnmatchedCountsByRep", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("groups unresolved unmatched opps by sales_rep_email", async () => {
    mockQueryRaw.mockResolvedValue([
      { sales_rep_email: "alice@x.com", unmatched_count: 3, unmatched_revenue: 12500 },
      { sales_rep_email: "bob@x.com", unmatched_count: 1, unmatched_revenue: 7000 },
    ] as never);

    const result = await getUnmatchedCountsByRep(["alice@x.com", "bob@x.com"]);

    expect(result.get("alice@x.com")).toEqual({ count: 3, revenue: 12500 });
    expect(result.get("bob@x.com")).toEqual({ count: 1, revenue: 7000 });
  });

  it("returns empty map when no rep emails passed", async () => {
    const result = await getUnmatchedCountsByRep([]);
    expect(result.size).toBe(0);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/unmatched-counts.test.ts`
Expected: FAIL — module `@/lib/unmatched-counts` doesn't exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/unmatched-counts.ts`:

```ts
import prisma from "@/lib/prisma";

export interface UnmatchedSummary {
  count: number;
  revenue: number;
}

export async function getUnmatchedCountsByRep(
  repEmails: string[]
): Promise<Map<string, UnmatchedSummary>> {
  if (repEmails.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    { sales_rep_email: string; unmatched_count: number; unmatched_revenue: number }[]
  >`
    SELECT
      o.sales_rep_email,
      COUNT(*)::int AS unmatched_count,
      COALESCE(SUM(o.total_revenue), 0)::float AS unmatched_revenue
    FROM unmatched_opportunities u
    JOIN opportunities o ON o.id = u.id
    WHERE u.resolved = false
      AND o.sales_rep_email = ANY(${repEmails})
    GROUP BY o.sales_rep_email
  `;

  const map = new Map<string, UnmatchedSummary>();
  for (const row of rows) {
    map.set(row.sales_rep_email, {
      count: Number(row.unmatched_count),
      revenue: Number(row.unmatched_revenue),
    });
  }
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/unmatched-counts.test.ts`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/unmatched-counts.ts src/lib/__tests__/unmatched-counts.test.ts
git commit -m "feat: add getUnmatchedCountsByRep helper"
```

---

## Task 6: Wire unmatched count into leaderboard payload

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts` (add fields to `LeaderboardEntry`)
- Modify: `src/features/leaderboard/lib/fetch-leaderboard.ts:34-231`
- Modify: `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts` (update mocks + add assertion)

- [ ] **Step 1: Add fields to the type**

In `src/features/leaderboard/lib/types.ts`, add to the `LeaderboardEntry` interface:

```ts
  unmatchedOppCount: number;
  unmatchedRevenue: number;
```

- [ ] **Step 2: Write the failing test**

In `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`, add a new test:

```ts
it("populates unmatchedOppCount and unmatchedRevenue from getUnmatchedCountsByRep", async () => {
  vi.doMock("@/lib/unmatched-counts", () => ({
    getUnmatchedCountsByRep: vi.fn().mockResolvedValue(new Map([
      ["alice@x.com", { count: 3, revenue: 12500 }],
    ])),
  }));
  // re-import after mocking
  const { fetchLeaderboardData } = await import("../fetch-leaderboard");

  mockUserProfile.mockResolvedValue([
    { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
  ] as never);
  mockGetRepActuals.mockResolvedValue({
    openPipeline: 0, totalTake: 0, totalRevenue: 0, minPurchaseBookings: 0,
  } as never);

  const payload = await fetchLeaderboardData();
  const entry = payload.entries.find((e) => e.userId === "u1")!;
  expect(entry.unmatchedOppCount).toBe(3);
  expect(entry.unmatchedRevenue).toBe(12500);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`
Expected: FAIL — `unmatchedOppCount` is undefined on the entry.

- [ ] **Step 4: Wire into `fetchLeaderboardData()`**

In `src/features/leaderboard/lib/fetch-leaderboard.ts`:

Add at the top of the file with other imports:
```ts
import { getUnmatchedCountsByRep } from "@/lib/unmatched-counts";
```

Inside `fetchLeaderboardData()`, after `rosterEmails` is built (around line 97), parallelize the fetch:

```ts
const unmatchedByRep = await getUnmatchedCountsByRep(rosterEmails);
```

Inside the `entries` map (around line 162) where each entry is constructed, add:

```ts
const unmatched = unmatchedByRep.get(profile.email) ?? { count: 0, revenue: 0 };
return {
  // ...existing fields...
  unmatchedOppCount: unmatched.count,
  unmatchedRevenue: unmatched.revenue,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`
Expected: All tests PASS (existing + new one).

- [ ] **Step 6: Commit**

```bash
git add src/features/leaderboard/lib/types.ts src/features/leaderboard/lib/fetch-leaderboard.ts src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts
git commit -m "feat(leaderboard): include unmatched-opp counts in payload"
```

---

## Task 7: Unmatched-count badge in `RevenueTable.tsx`

**Files:**
- Modify: `src/features/leaderboard/components/RevenueTable.tsx`
- Test: extend an existing component test (or create one if none exists for RevenueTable)

- [ ] **Step 1: Locate existing tests for RevenueTable**

Run:
```bash
ls src/features/leaderboard/components/__tests__/ 2>/dev/null
rg "RevenueTable" --type ts -l src/features/leaderboard/
```

If no test file exists for RevenueTable, create `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`. Otherwise extend the existing one.

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevenueTable } from "../RevenueTable";

describe("RevenueTable unmatched badge", () => {
  it("shows unmatched count + revenue for reps with pending unmatched opps", () => {
    const entries = [
      {
        userId: "u1", fullName: "Monica", avatarUrl: null, rank: 1,
        take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
        revenue: 1800000, revenueCurrentFY: 1800000, revenuePriorFY: 0,
        priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
        revenueTargeted: 0, targetedCurrentFY: 0, targetedNextFY: 0,
        unmatchedOppCount: 7, unmatchedRevenue: 254000,
      },
    ];
    render(<RevenueTable entries={entries as never} /* other required props */ />);
    expect(screen.getByText(/7 unmatched/i)).toBeInTheDocument();
    expect(screen.getByText(/\$254/)).toBeInTheDocument();
  });

  it("hides badge when unmatchedOppCount is 0", () => {
    const entries = [
      {
        userId: "u1", fullName: "Alice", avatarUrl: null, rank: 1,
        take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
        revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0,
        priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
        revenueTargeted: 0, targetedCurrentFY: 0, targetedNextFY: 0,
        unmatchedOppCount: 0, unmatchedRevenue: 0,
      },
    ];
    render(<RevenueTable entries={entries as never} />);
    expect(screen.queryByText(/unmatched/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`
Expected: FAIL — badge not rendered.

- [ ] **Step 4: Implement the badge**

In `src/features/leaderboard/components/RevenueTable.tsx`, in the row-rendering JSX next to the rep's name, add:

```tsx
{entry.unmatchedOppCount > 0 && (
  <a
    href={`/admin/unmatched?rep=${encodeURIComponent(entry.userId)}`}
    className="ml-2 inline-flex items-center gap-1 rounded bg-[#EFEDF5] px-2 py-0.5 text-xs text-[#5B4B7A] hover:bg-[#E0DCEB]"
    title={`${entry.unmatchedOppCount} opportunities awaiting district resolution`}
  >
    {entry.unmatchedOppCount} unmatched · ${Math.round(entry.unmatchedRevenue / 1000)}k
  </a>
)}
```

(Color tokens are pulled from `Documentation/UI Framework/tokens.md` — plum-derived neutrals per CLAUDE.md.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`
Expected: 2 PASS

- [ ] **Step 6: Manual UI sanity check**

```bash
npm run dev
```
Navigate to `/leaderboard`. For Monica (or any rep with unmatched opps), confirm a small badge appears next to her name and clicks through to `/admin/unmatched`.

- [ ] **Step 7: Commit**

```bash
git add src/features/leaderboard/components/RevenueTable.tsx src/features/leaderboard/components/__tests__/RevenueTable.test.tsx
git commit -m "feat(leaderboard): show unmatched-opp badge per rep"
```

---

## Task 8: New `fetch_opportunities_for_school_yrs()` helper

**Files:**
- Modify: `scheduler/sync/queries.py`
- Modify: `scheduler/tests/test_queries.py`

- [ ] **Step 1: Write the failing test**

In `scheduler/tests/test_queries.py`, add:

```python
from unittest.mock import patch, MagicMock
from sync.queries import fetch_opportunities_for_school_yrs


@patch("sync.queries.scroll_all")
def test_fetch_opportunities_for_school_yrs_filters_by_provided_list(mock_scroll):
    mock_scroll.return_value = []
    client = MagicMock()
    fetch_opportunities_for_school_yrs(client, ["2025-26", "2024-25"])
    args = mock_scroll.call_args
    body = args[0][2]  # query body
    filters = body["bool"]["filter"]
    yr_filter = next(f for f in filters if "terms" in f)
    assert yr_filter["terms"]["school_yr.keyword"] == ["2025-26", "2024-25"]


@patch("sync.queries.scroll_all")
def test_fetch_opportunities_for_school_yrs_does_not_apply_since(mock_scroll):
    mock_scroll.return_value = []
    client = MagicMock()
    fetch_opportunities_for_school_yrs(client, ["2025-26"])
    body = mock_scroll.call_args[0][2]
    filters = body["bool"]["filter"]
    # No range filter on updated_at — every opp in the school year is fetched
    assert not any("range" in f and "updated_at" in (f.get("range") or {}) for f in filters)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scheduler && pytest tests/test_queries.py::test_fetch_opportunities_for_school_yrs_filters_by_provided_list -v`
Expected: FAIL — `ImportError: cannot import name 'fetch_opportunities_for_school_yrs'`

- [ ] **Step 3: Implement the helper**

In `scheduler/sync/queries.py`, after `fetch_opportunities()` (around line 39), add:

```python
def fetch_opportunities_for_school_yrs(client, school_yrs):
    """Fetch opportunities for an explicit list of school years, ignoring incremental.

    Used by the daily current-FY backfill: re-fetches every opp in the supplied
    school years regardless of opp.updated_at, so sessions whose lastIndexedAt
    didn't advance still get pulled into Supabase via Phase 2b's full session
    refresh in run_sync's downstream pipeline.
    """
    logger.info(f"Full re-fetch of opportunities for school years: {school_yrs}")
    query = {
        "bool": {
            "filter": [{"terms": {"school_yr.keyword": school_yrs}}],
        }
    }
    hits = scroll_all(client, "clj-prod-opportunities", query, OPPORTUNITY_SOURCE_FIELDS)
    logger.info(f"Fetched {len(hits)} opportunities for {school_yrs}")
    return hits
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scheduler && pytest tests/test_queries.py -v -k school_yrs`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add scheduler/sync/queries.py scheduler/tests/test_queries.py
git commit -m "feat(scheduler): add fetch_opportunities_for_school_yrs helper"
```

---

## Task 9: `run_current_fy_backfill()` function

**Files:**
- Modify: `scheduler/run_sync.py` (add new function alongside existing `run_sync()`)
- Test: `scheduler/tests/test_run_current_fy_backfill.py` (new)

- [ ] **Step 1: Write the failing test**

Create `scheduler/tests/test_run_current_fy_backfill.py`:

```python
import os
os.environ["OPENSEARCH_HOST"] = "https://test:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"
os.environ["SUPABASE_DB_URL"] = "postgresql://test:test@localhost:5432/test"

from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from run_sync import run_current_fy_backfill


@patch("run_sync.refresh_opportunity_actuals")
@patch("run_sync.refresh_fullmind_financials")
@patch("run_sync.refresh_map_features")
@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.upsert_unmatched")
@patch("run_sync.upsert_sessions")
@patch("run_sync.upsert_opportunities")
@patch("run_sync.get_connection")
@patch("run_sync.build_opportunity_record")
@patch("run_sync.fetch_district_mappings")
@patch("run_sync.fetch_sessions")
@patch("run_sync.fetch_opportunities_for_school_yrs")
@patch("run_sync.get_client")
def test_run_current_fy_backfill_uses_school_yr_helper_not_incremental(
    mock_get_client, mock_fetch_yrs, mock_fetch_sessions,
    mock_fetch_districts, mock_build, mock_get_conn,
    mock_upsert_opps, mock_upsert_sessions, mock_upsert_unmatched,
    mock_update_agg, mock_refresh_map, mock_refresh_fin, mock_refresh_actuals,
):
    mock_fetch_yrs.return_value = [
        {"_source": {"id": "opp1", "accounts": [{"id": "acc1"}]}}
    ]
    mock_fetch_sessions.return_value = []
    mock_fetch_districts.return_value = {}
    mock_build.return_value = {
        "id": "opp1", "district_lea_id": "0100001", "net_booking_amount": 1,
        "service_types": [],
    }
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_get_conn.return_value = mock_conn

    # Today is 2026-04-30 → current FY = 2025-26, prior FY = 2024-25
    with patch("run_sync.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 4, 30, tzinfo=timezone.utc)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
        result = run_current_fy_backfill()

    mock_fetch_yrs.assert_called_once()
    school_yrs_arg = mock_fetch_yrs.call_args[0][1]
    assert sorted(school_yrs_arg) == ["2024-25", "2025-26"]
    assert result["status"] == "success"
    assert result["opps_synced"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scheduler && pytest tests/test_run_current_fy_backfill.py -v`
Expected: FAIL — `ImportError: cannot import name 'run_current_fy_backfill'`

- [ ] **Step 3: Implement `run_current_fy_backfill()`**

In `scheduler/run_sync.py`, add the import and a new function alongside `run_sync()`:

Update the imports block:
```python
from sync.queries import (
    fetch_opportunities,
    fetch_opportunities_by_ids,
    fetch_opportunities_for_school_yrs,  # NEW
    fetch_changed_sessions,
    fetch_sessions,
    fetch_district_mappings,
)
```

After `run_sync()`, add:

```python
def _derive_current_and_prior_school_yrs(now: datetime) -> list[str]:
    """e.g. now=2026-04-30 -> ['2024-25', '2025-26']. now=2025-09-01 -> ['2024-25', '2025-26']."""
    if now.month >= 7:
        current_start = now.year
    else:
        current_start = now.year - 1
    current = f"{current_start}-{str(current_start + 1)[-2:]}"
    prior_start = current_start - 1
    prior = f"{prior_start}-{str(prior_start + 1)[-2:]}"
    return [prior, current]


def run_current_fy_backfill():
    """Daily backfill: re-fetch all opps in current FY + prior FY unconditionally.

    Bypasses incremental's `since` filter to catch sessions that landed in
    OpenSearch without advancing `lastIndexedAt`. Reuses the same downstream
    pipeline as run_sync().
    """
    now = datetime.now(timezone.utc)
    school_yrs = _derive_current_and_prior_school_yrs(now)
    logger.info(f"=== Starting current-FY backfill at {now.isoformat()} for {school_yrs} ===")

    conn = get_connection()
    os_client = get_client()
    opp_hits = fetch_opportunities_for_school_yrs(os_client, school_yrs)
    if not opp_hits:
        logger.info("No opportunities returned, skipping backfill")
        conn.close()
        return {"status": "success", "opps_synced": 0, "sessions_stored": 0,
                "unmatched_count": None, "error": None}

    opp_ids = [h["_source"]["id"] for h in opp_hits]
    session_hits = fetch_sessions(os_client, opp_ids)

    sessions_by_opp = defaultdict(list)
    for sh in session_hits:
        src = sh["_source"]
        src["_id"] = sh["_id"]
        sessions_by_opp[src["opportunityId"]].append(src)

    account_ids = set()
    for h in opp_hits:
        for acc in (h["_source"].get("accounts") or []):
            if acc.get("id"):
                account_ids.add(acc["id"])
    district_mapping = fetch_district_mappings(os_client, list(account_ids))

    try:
        manual_resolutions = _load_manual_resolutions(conn)
        matched_records = []
        unmatched_records = []
        for h in opp_hits:
            opp = h["_source"]
            opp_sessions = sessions_by_opp.get(opp["id"], [])
            record, unmatched = _build_record_and_classify(
                opp, opp_sessions, district_mapping, now=now
            )
            if record["district_lea_id"] is None and opp["id"] in manual_resolutions:
                record["district_lea_id"] = manual_resolutions[opp["id"]]
                unmatched = None
            matched_records.append(record)
            if unmatched is not None:
                unmatched_records.append(unmatched)

        upsert_opportunities(conn, matched_records)
        if unmatched_records:
            upsert_unmatched(conn, unmatched_records)

        session_records_by_opp = {}
        for opp_id, opp_sessions in sessions_by_opp.items():
            session_records_by_opp[opp_id] = [
                {
                    "id": s["_id"],
                    "opportunity_id": s["opportunityId"],
                    "service_type": s.get("serviceType"),
                    "session_price": _to_decimal(s.get("sessionPrice")),
                    "educator_price": _to_decimal(s.get("educatorPrice")),
                    "educator_approved_price": _to_decimal(s.get("educatorApprovedPrice")),
                    "start_time": s.get("startTime"),
                    "type": s.get("type"),
                    "status": s.get("status"),
                    "service_name": s.get("serviceName"),
                    "synced_at": now,
                }
                for s in opp_sessions
            ]
        total_sessions = sum(len(v) for v in session_records_by_opp.values())
        upsert_sessions(conn, session_records_by_opp)

        newly_matched_ids = [
            r["id"] for r in matched_records if r.get("district_lea_id") is not None
        ]
        remove_matched_from_unmatched(conn, newly_matched_ids)

        update_district_pipeline_aggregates(conn)
        refresh_map_features(conn)
        refresh_fullmind_financials(conn)
        refresh_opportunity_actuals(conn)

        logger.info(
            f"=== Backfill complete: {len(matched_records)} opps, "
            f"{total_sessions} sessions, "
            f"{len(unmatched_records)} unmatched ==="
        )
        return {
            "status": "success",
            "opps_synced": len(matched_records),
            "sessions_stored": total_sessions,
            "unmatched_count": len(unmatched_records),
            "error": None,
        }
    finally:
        conn.close()
```

Note: this function intentionally does NOT call `set_last_synced_at()` because it isn't an incremental cycle — leaving the watermark untouched lets the next hourly incremental still pick up everything since the previous hourly run.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scheduler && pytest tests/test_run_current_fy_backfill.py -v`
Expected: 1 PASS

- [ ] **Step 5: Run the existing run_sync test suite to verify no regressions**

Run: `cd scheduler && pytest tests/test_run_sync.py -v`
Expected: All existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add scheduler/run_sync.py scheduler/tests/test_run_current_fy_backfill.py
git commit -m "feat(scheduler): add run_current_fy_backfill for daily full re-sync of current FY"
```

---

## Task 10: Wire daily 04:00 UTC schedule entry

**Files:**
- Modify: `scheduler/run_scheduler.py:148`
- Test: `scheduler/tests/test_run_scheduler.py` (or extend)

- [ ] **Step 1: Write the failing test**

In `scheduler/tests/test_run_scheduler.py`, add:

```python
from unittest.mock import patch, MagicMock


@patch("run_scheduler.schedule")
def test_daily_backfill_is_registered_at_04_00(mock_schedule):
    # Importing the module should set up both schedules.
    import importlib
    import run_scheduler
    importlib.reload(run_scheduler)

    # The hourly + daily entries should both be registered.
    every_calls = mock_schedule.every.call_args_list
    # Hourly: schedule.every(1).hour.do(...)
    # Daily:  schedule.every().day.at("04:00").do(...)
    daily_chain_seen = any(
        # `.day.at("04:00")` on the chain — verify by tracing through the mock
        True for c in mock_schedule.every.return_value.day.at.call_args_list
        if c.args == ("04:00",)
    )
    assert daily_chain_seen, "expected schedule.every().day.at('04:00').do(...) to be wired"
```

(Note: this test verifies the schedule registration only. The runtime behavior of the wrapper function is covered in Task 9.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scheduler && pytest tests/test_run_scheduler.py::test_daily_backfill_is_registered_at_04_00 -v`
Expected: FAIL — `assert daily_chain_seen` fails because no `.day.at("04:00")` registration exists.

- [ ] **Step 3: Wire the schedule**

In `scheduler/run_scheduler.py`:

Update the import:
```python
from run_sync import run_sync, run_current_fy_backfill
```

Add a wrapper next to `safe_sync()`:

```python
def safe_current_fy_backfill():
    """Run current-FY backfill with retry + state logging."""
    max_retries = 3
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            result = run_current_fy_backfill()
            result["attempts"] = attempt
            return result
        except Exception as e:
            last_error = str(e)
            logger.error(f"Backfill attempt {attempt}/{max_retries} failed: {e}")
            logger.error(traceback.format_exc())
            if attempt < max_retries:
                wait = 2 ** attempt * 10
                logger.info(f"Retrying in {wait}s...")
                time.sleep(wait)
    logger.error("All backfill attempts failed for this cycle")
    return {
        "status": "failed", "opps_synced": 0, "unmatched_count": None,
        "error": last_error, "attempts": max_retries,
    }


def scheduled_current_fy_backfill():
    result = safe_current_fy_backfill()
    write_sync_state(LOG_DIR, result)
    append_sync_history(LOG_DIR, result)
```

In the `if __name__ == "__main__"` block, after the existing hourly registration (line 148), add:

```python
# Daily current-FY full re-sync at 04:00 UTC — catches sessions that didn't
# advance lastIndexedAt and so missed the hourly incremental.
schedule.every().day.at("04:00").do(scheduled_current_fy_backfill)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scheduler && pytest tests/test_run_scheduler.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scheduler/run_scheduler.py scheduler/tests/test_run_scheduler.py
git commit -m "feat(scheduler): register daily 04:00 UTC current-FY backfill"
```

---

## Task 11: One-time backfill script for unmatched-opp queue

**Files:**
- Create: `scripts/backfill-unmatched-resolutions.ts`
- Test: `scripts/__tests__/backfill-unmatched-resolutions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/backfill-unmatched-resolutions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: vi.fn(), $executeRaw: vi.fn() },
}));

const mockNcesLookup = vi.fn();
vi.mock("../backfill-unmatched-resolutions-helpers", () => ({
  lookupNcesByLmsId: mockNcesLookup,
  namesMatch: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
}));

import prisma from "@/lib/prisma";
import { backfillUnmatched } from "../backfill-unmatched-resolutions";

describe("backfill-unmatched-resolutions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("auto-resolves when names match exactly", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "opp1", account_lms_id: "lms123", account_name: "Yuba City USD" },
    ] as never);
    mockNcesLookup.mockResolvedValueOnce({ ncesId: "0612345", name: "Yuba City USD" });

    const summary = await backfillUnmatched();

    expect(summary.autoResolved).toBe(1);
    expect(summary.deferred).toBe(0);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("defers when names do NOT match", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "opp1", account_lms_id: "lms123", account_name: "Foo District" },
    ] as never);
    mockNcesLookup.mockResolvedValueOnce({ ncesId: "0612345", name: "Bar District" });

    const summary = await backfillUnmatched();

    expect(summary.autoResolved).toBe(0);
    expect(summary.deferred).toBe(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scripts/__tests__/backfill-unmatched-resolutions.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the script**

Create `scripts/backfill-unmatched-resolutions.ts`:

```ts
/**
 * One-time backfill: auto-resolve unmatched_opportunities entries where
 * the resolved district name matches the opp's account name.
 *
 * Run:
 *   npx tsx scripts/backfill-unmatched-resolutions.ts
 *
 * Strict guardrail: only auto-resolves when (a) the LMS account_id has
 * exactly one matching district in OpenSearch, AND (b) the district name
 * matches the opp's account_name per the existing `names_match()` rule.
 * Anything ambiguous stays in the queue for manual admin review.
 */
import prisma from "@/lib/prisma";
import { lookupNcesByLmsId, namesMatch } from "./backfill-unmatched-resolutions-helpers";

export interface BackfillSummary {
  candidates: number;
  autoResolved: number;
  deferred: number;
  errors: number;
}

export async function backfillUnmatched(): Promise<BackfillSummary> {
  const candidates = await prisma.$queryRaw<
    { id: string; account_lms_id: string | null; account_name: string | null }[]
  >`
    SELECT id, account_lms_id, account_name
    FROM unmatched_opportunities
    WHERE resolved = false
      AND account_lms_id IS NOT NULL
      AND account_name IS NOT NULL
  `;

  const summary: BackfillSummary = {
    candidates: candidates.length, autoResolved: 0, deferred: 0, errors: 0,
  };

  for (const row of candidates) {
    try {
      const district = await lookupNcesByLmsId(row.account_lms_id!);
      if (!district || !district.ncesId || !namesMatch(row.account_name!, district.name)) {
        summary.deferred++;
        continue;
      }
      await prisma.$executeRaw`
        UPDATE unmatched_opportunities
        SET resolved = true,
            resolved_district_leaid = ${district.ncesId},
            resolved_at = now(),
            resolved_by = 'backfill-2026-04-30'
        WHERE id = ${row.id}
      `;
      summary.autoResolved++;
    } catch (e) {
      console.error(`Error processing ${row.id}:`, e);
      summary.errors++;
    }
  }

  console.log(`Backfill summary:`, summary);
  return summary;
}

if (require.main === module) {
  backfillUnmatched().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

Create `scripts/backfill-unmatched-resolutions-helpers.ts`:

```ts
/**
 * Helpers separated for testability — the OpenSearch client + names_match
 * rule live here so the main script can be unit-tested with mocks.
 */
import { Client } from "@opensearch-project/opensearch";

const client = new Client({
  node: process.env.ELASTICSEARCH_HOST!,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME!,
    password: process.env.ELASTICSEARCH_PASSWORD!,
  },
});

export async function lookupNcesByLmsId(
  lmsId: string
): Promise<{ ncesId: string; name: string } | null> {
  const res = await client.search({
    index: "clj-prod-districts",
    body: {
      size: 1,
      query: { term: { id: lmsId } },
      _source: ["id", "ncesId", "name"],
    },
  });
  const hits = res.body?.hits?.hits ?? [];
  if (hits.length === 0) return null;
  const src = hits[0]._source;
  if (!src.ncesId || src.ncesId.length !== 7 || !/^\d{7}$/.test(src.ncesId)) {
    return null; // matches the rejection rule in scheduler/sync/queries.py:121
  }
  return { ncesId: src.ncesId, name: src.name };
}

/**
 * Mirrors scheduler/sync/district_resolver.py::names_match.
 * Lowercase + strip punctuation + collapse whitespace, then exact-match.
 */
export function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scripts/__tests__/backfill-unmatched-resolutions.test.ts`
Expected: 2 PASS

- [ ] **Step 5: Dry-run on production data (read-only first)**

Modify a copy of the script (or add a `--dry-run` flag) so it logs candidates without writing. Run once, eyeball the output, confirm the auto-resolution candidates look right.

```bash
DRY_RUN=true npx tsx scripts/backfill-unmatched-resolutions.ts
```

(Optional but recommended before the real run. If you skip this, at minimum stop the run after the first 5 auto-resolutions and verify them manually.)

- [ ] **Step 6: Run for real**

```bash
npx tsx scripts/backfill-unmatched-resolutions.ts
```

Expected output: `Backfill summary: { candidates: N, autoResolved: M, deferred: N-M, errors: 0 }`. The next hourly sync will then propagate `resolved_district_leaid` into `opportunities.district_lea_id`.

- [ ] **Step 7: Commit (the script, not the run)**

```bash
git add scripts/backfill-unmatched-resolutions.ts scripts/backfill-unmatched-resolutions-helpers.ts scripts/__tests__/backfill-unmatched-resolutions.test.ts
git commit -m "feat: one-time backfill script to auto-resolve unmatched_opportunities by exact name match"
```

---

## Task 12: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Re-run Monica's diagnostic against post-fix data**

```bash
cd "/Users/sierraarcega/Fullmind LMS/es-bi"
python3 debug_monica_fy26_attribution.py
```

Capture the OpenSearch step-4 number. As of 2026-04-30 it was $2,821,691.96.

- [ ] **Step 2: Compare to leaderboard view total**

```sql
-- Run via Supabase MCP or psql
SELECT
  -- Sessions by date (new path)
  (SELECT COALESCE(SUM(session_revenue), 0)
     FROM rep_session_actuals
     WHERE sales_rep_email = 'monica.sherwood@fullmindlearning.com'
       AND school_yr = '2025-26') AS session_revenue_by_date,
  -- Subscriptions by tag
  (SELECT COALESCE(SUM(sub_revenue), 0)
     FROM district_opportunity_actuals
     WHERE sales_rep_email = 'monica.sherwood@fullmindlearning.com'
       AND school_yr = '2025-26') AS subscription_revenue_by_tag,
  -- Combined (matches what getRepActuals returns)
  (SELECT COALESCE(SUM(session_revenue), 0)
     FROM rep_session_actuals
     WHERE sales_rep_email = 'monica.sherwood@fullmindlearning.com'
       AND school_yr = '2025-26')
  +
  (SELECT COALESCE(SUM(sub_revenue), 0)
     FROM district_opportunity_actuals
     WHERE sales_rep_email = 'monica.sherwood@fullmindlearning.com'
       AND school_yr = '2025-26') AS leaderboard_total;
```

- [ ] **Step 3: Verify `leaderboard_total` is within ~$30K of `step 4 + Monica's FY26 subs`**

The remaining gap, if any, is sync staleness (≤ 24 hours after the daily 04:00 UTC backfill runs once).

- [ ] **Step 4: Spot-check the unmatched badge in the UI**

```bash
npm run dev
```

Navigate to `/leaderboard`. Confirm:
- Monica's FY26 number is now in the $2.8M range (not $1.8M)
- The unmatched badge shows expected count + revenue (after the Task 11 backfill, this should be much smaller — only opps whose name didn't match cleanly)
- Click-through to `/admin/unmatched` works and the queue UI loads

- [ ] **Step 5: Document expected ongoing behavior**

Append a note to the spec confirming the post-fix state and expected ongoing behavior (e.g., "leaderboard refreshes every hour via incremental sync; daily 04:00 UTC backfill catches edge cases; admin should drain unmatched queue weekly to keep `_NOMAP` revenue minimal"). This closes the loop on the spec.

---

## Self-Review Notes

Reviewed against spec sections:

- **Spec §1 (re-bucket sessions by date):** Tasks 1, 2, 4 — `session_fy()`, `rep_session_actuals` view, `getRepActuals()` rewrite. Subscriptions stay tag-based per Choice A — confirmed in Task 4's query (sub_revenue still pulled from district_opportunity_actuals filtered by school_yr).
- **Spec §2 (sentinel + queue backfill):** Task 3 (sentinel), Tasks 5–7 (badge UI), Task 11 (one-time backfill). All sub-points covered.
- **Spec §3 (daily current-FY refresh):** Tasks 8, 9, 10 — helper, function, schedule entry.
- **Spec migration order (1–6):** Tasks map cleanly: 1→§1, 2→§2, 3→§3, 4→§4, 10→§5, 11→§6.
- **Spec risks called out:** `_NOMAP` collision (Task 3, Step 6 audit), perf (deferred — view starts non-materialized; spec acknowledges), auto-resolve false positives (Task 11 reuses names_match guardrail), traffic spike (mentioned, low for Fullmind volume).

Type consistency: `RepActuals` interface unchanged through the rewrite (all the same fields), only the SQL backing the populated values changes. `LeaderboardEntry` extended additively in Task 6 with `unmatchedOppCount` + `unmatchedRevenue`. `BackfillSummary` is local to the script.

Placeholders: none. Each step has either concrete code, a concrete command, or a concrete check.

Scope: 12 tasks for three independent fixes — borderline large but the tasks are linear, independently revertable, and each produces shippable improvement. No task is over ~30 minutes of work.
