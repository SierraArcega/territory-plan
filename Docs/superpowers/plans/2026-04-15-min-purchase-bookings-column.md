# Min Purchase Bookings Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the leaderboard's "Prior Year Closed" column (currently session-delivered revenue) with a "Prior Year Bookings" column backed by `minimum_purchase_amount` (contracted floor), with historical opportunities backfilled from `invoiced + credited` and future syncs protected from clobber.

**Architecture:** Four layers of change, strictly additive: (1) scheduler compute.py falls back to `invoiced + credited` when the OpenSearch source returns NULL for `minimum_purchase_amount` — applies to all stages so open opps also get a derived value. (2) One-time SQL backfill for historical opportunities where the field was never populated. (3) New aggregate column `min_purchase_bookings` on the existing `district_opportunity_actuals` matview, filtered to closed-won opportunities. (4) `getRepActuals` exposes the new field, the leaderboard API swaps `priorYearRevenue` to read it, and the table column label renames to "Prior Year Bookings".

**Tech Stack:** Python 3 (scheduler), Prisma 5 + Postgres 17 (matview migration), TypeScript (API + React), Vitest + Testing Library (frontend tests), pytest (Python tests).

**Branch context:** `feat/min-purchase-bookings-column`, based on `origin/main` (currently at `b17c71c7`, the merge commit for PR #116). The diagnostic script `scheduler/scripts/inspect_opp_credit_memos.py` is already in the working tree from the investigation that surfaced this work — it gets committed in Task 0 as a reference artifact.

**Background reading:**
- `scheduler/sync/compute.py:88-139` — current `invoiced`/`credited`/`minimum_purchase_amount` handling
- `scheduler/sync/supabase_writer.py:52-56` — upsert logic that clobbers fields on re-sync
- `scripts/district-opportunity-actuals-view.sql` — current matview definition (reference when writing the migration)
- `prisma/migrations/20260412_actuals_view_includes_subscriptions/migration.sql` — precedent for matview-rebuild migration
- `src/lib/opportunity-actuals.ts` — `getRepActuals` query and `RepActuals` interface
- `src/app/api/leaderboard/route.ts:76-88` — where `priorYearRevenue` is currently computed
- `src/features/leaderboard/components/RevenueTable.tsx:16-21` — `COLUMNS` array with labels

**Key finding from investigation:** OpenSearch credit memos are stored with NEGATIVE `amount` values (accounting convention). `compute.py:89` already sums them as-is, so the `credited` column in Postgres is already signed negative. The formula is therefore `invoiced + credited`, NOT `invoiced - credited`. 2217 opportunities across 3 fiscal years have 113 with credit memos totaling -\$8.9M.

---

## Task 0: Commit the OpenSearch diagnostic script

**Files:**
- Modify (already untracked): `scheduler/scripts/inspect_opp_credit_memos.py`

This script was written during investigation to prove that `credit_memos` are correctly synced from OpenSearch (they just have negative amounts). It's a one-off diagnostic but valuable as a runbook for future sync debugging — committing it makes the audit trail complete.

- [ ] **Step 1: Verify the script exists in the working tree**

Run: `ls -la scheduler/scripts/inspect_opp_credit_memos.py`
Expected: file exists, ~130 lines.

- [ ] **Step 2: Stage only that file**

```bash
git add scheduler/scripts/inspect_opp_credit_memos.py
git diff --cached --stat
```

Expected: exactly 1 file staged.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(scheduler): add OpenSearch credit-memo diagnostic script

One-off script used to verify that credit_memos are being synced correctly
from OpenSearch. Found that they ARE synced, but with negative amount
values (accounting convention) — so the Postgres 'credited' column is
already signed negative and the net billings formula is invoiced + credited,
not invoiced - credited. Commits the script as a reusable runbook for
future sync debugging.

Usage:
    cd scheduler
    OPENSEARCH_HOST=... OPENSEARCH_USERNAME=... OPENSEARCH_PASSWORD=... \\
        python3 scripts/inspect_opp_credit_memos.py"
```

---

## Task 1: Add `invoiced + credited` fallback to `compute.py`

**Files:**
- Modify: `scheduler/sync/compute.py:139`
- Modify: `scheduler/tests/test_compute.py` (add test cases)

When the OpenSearch source returns `None` for `minimum_purchase_amount`, fall back to `invoiced + credited`. The fallback applies to **all stages** per the design decision — open opps will typically derive 0 (because they have no invoices yet) and closed-won opps will derive a positive net-billings value. If OpenSearch provides a non-null value, we keep it (no clobber).

The fallback happens at sync time, so future syncs won't revert backfilled values.

- [ ] **Step 1: Read the existing test file to understand fixture patterns**

Run: `cat scheduler/tests/test_compute.py`

Note the existing test for `build_opportunity_record`. The pattern uses a fake opp dict and a sessions list. We'll mirror it for the new test cases.

- [ ] **Step 2: Write failing tests for the fallback**

In `scheduler/tests/test_compute.py`, add these test cases at the end of the file (inside the existing test module, matching the existing pytest style):

```python
def test_minimum_purchase_amount_uses_fallback_when_source_null():
    """When OpenSearch returns None for minimum_purchase_amount, fall back to
    invoiced + credited. Credited is already signed negative, so the sum yields
    net billings."""
    opp = {
        "id": "opp-no-min-purchase",
        "name": "Historical opp without min purchase",
        "stage": "Closed Won",
        "school_yr": "2024-25",
        "contractType": "renewal",
        "state": "California",
        "net_booking_amount": 50000,
        "sales_rep": {"name": "Alex", "email": "alex@example.com"},
        "accounts": [],
        "invoices": [{"amount": 48000}],
        "credit_memos": [{"amount": -2000}],
        "minimum_purchase_amount": None,
        "stage_history": [],
    }

    record = build_opportunity_record(opp, sessions=[], district_mapping={})

    # invoiced = 48000, credited = -2000, fallback = 46000
    assert record["minimum_purchase_amount"] == Decimal("46000")


def test_minimum_purchase_amount_keeps_source_value_when_set():
    """When OpenSearch provides a minimum_purchase_amount, keep it — do not
    overwrite with the invoiced+credited fallback."""
    opp = {
        "id": "opp-with-min-purchase",
        "name": "Modern opp with min purchase",
        "stage": "Closed Won",
        "school_yr": "2025-26",
        "contractType": "new_business",
        "state": "California",
        "net_booking_amount": 75000,
        "sales_rep": {"name": "Bailey", "email": "bailey@example.com"},
        "accounts": [],
        "invoices": [{"amount": 10000}],
        "credit_memos": [],
        "minimum_purchase_amount": 60000,
        "stage_history": [],
    }

    record = build_opportunity_record(opp, sessions=[], district_mapping={})

    # Source value kept, not 10000 (invoiced)
    assert record["minimum_purchase_amount"] == Decimal("60000")


def test_minimum_purchase_amount_fallback_on_open_opp_with_no_invoices():
    """Open opportunities with no invoices and no min_purchase get a fallback
    of 0 (not None) — the 1B scoping choice means all stages get a value."""
    opp = {
        "id": "opp-open-no-data",
        "name": "Lead with nothing",
        "stage": "1 - Lead",
        "school_yr": "2025-26",
        "contractType": "new_business",
        "state": "California",
        "net_booking_amount": 25000,
        "sales_rep": {"name": "Cameron", "email": "cameron@example.com"},
        "accounts": [],
        "invoices": [],
        "credit_memos": [],
        "minimum_purchase_amount": None,
        "stage_history": [],
    }

    record = build_opportunity_record(opp, sessions=[], district_mapping={})

    assert record["minimum_purchase_amount"] == Decimal("0")
```

Make sure `from decimal import Decimal` is imported at the top of the test file (it should already be — the existing `build_opportunity_record` tests use Decimal).

- [ ] **Step 3: Run the new tests and confirm they fail**

```bash
cd scheduler
python -m pytest tests/test_compute.py::test_minimum_purchase_amount_uses_fallback_when_source_null tests/test_compute.py::test_minimum_purchase_amount_keeps_source_value_when_set tests/test_compute.py::test_minimum_purchase_amount_fallback_on_open_opp_with_no_invoices -v
```

Expected: 3 FAILED tests. The two "uses_fallback" tests fail because the current code returns `None`; the "keeps_source_value" test passes vacuously because the current code keeps the source value. Only 2 actually-failing tests is fine — the third is a regression guard.

- [ ] **Step 4: Implement the fallback in `compute.py`**

Edit `scheduler/sync/compute.py`. Find the `minimum_purchase_amount` line in `build_opportunity_record`:

```python
        "minimum_purchase_amount": _to_decimal(opp.get("minimum_purchase_amount")) if opp.get("minimum_purchase_amount") is not None else None,
```

Replace with:

```python
        # Fallback: when OpenSearch doesn't provide a minimum_purchase_amount
        # (e.g., historical opps imported before Salesforce exposed the field),
        # derive it from invoiced + credited (credited is signed negative).
        # Applies to all stages — open opps typically derive 0.
        "minimum_purchase_amount": (
            _to_decimal(opp.get("minimum_purchase_amount"))
            if opp.get("minimum_purchase_amount") is not None
            else (invoiced + credited)
        ),
```

`invoiced` and `credited` are already computed at the top of the function (lines 88–89). They're `Decimal` objects, so `invoiced + credited` returns a `Decimal` directly — no extra conversion.

- [ ] **Step 5: Run the new tests and confirm they pass**

```bash
cd scheduler
python -m pytest tests/test_compute.py -v
```

Expected: all tests pass (including the pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add scheduler/sync/compute.py scheduler/tests/test_compute.py
git commit -m "feat(scheduler): derive minimum_purchase_amount from net billings when source is NULL

OpenSearch doesn't populate minimum_purchase_amount on historical opportunities.
When the source is None, fall back to invoiced + credited (credited is already
signed negative, so the sum is net billings). Applies to all stages — open opps
typically derive 0.

This prevents the writer's ON CONFLICT DO UPDATE from clobbering backfilled
values on future syncs."
```

---

## Task 2: Backfill historical `minimum_purchase_amount`

**Files:**
- Create: `prisma/migrations/manual/2026-04-15-backfill-min-purchase-from-net-billings.sql`

Historical opportunities with `minimum_purchase_amount IS NULL` need a one-time data backfill. We use the same formula that compute.py now derives: `invoiced + credited`. Applying this once brings the DB into a consistent state; future syncs will then preserve the values (per Task 1).

The project uses `prisma/migrations/manual/` for ops-only SQL (not tracked by Prisma migrate). Examples: `2026-04-09-calendar-backfill-fields.sql`, `phase2_rename_vendor_financials.sql`. We follow that pattern. The file gets committed as the audit record; the user runs it via Supabase MCP.

- [ ] **Step 1: Check current state of prior-year min_purchase in the DB**

Use the Supabase MCP tool `execute_sql` with project `nroilqjlzvvjekntjngq`:

```sql
SELECT school_yr,
       COUNT(*) AS opp_count,
       COUNT(*) FILTER (WHERE minimum_purchase_amount IS NULL) AS null_count,
       COUNT(*) FILTER (WHERE minimum_purchase_amount IS NOT NULL) AS populated_count
FROM opportunities
WHERE school_yr IN ('2023-24', '2024-25', '2025-26')
GROUP BY school_yr
ORDER BY school_yr;
```

Expected: FY23-24 and FY24-25 are mostly or entirely NULL; FY25-26 has ~640 populated. Record the null counts — you'll compare against the backfill's affected-rows count.

- [ ] **Step 2: Write the manual migration SQL file**

Create `prisma/migrations/manual/2026-04-15-backfill-min-purchase-from-net-billings.sql`:

```sql
-- 2026-04-15-backfill-min-purchase-from-net-billings.sql
-- One-off data backfill. Run once via Supabase SQL console or MCP.
--
-- Populates minimum_purchase_amount on historical opportunities where the
-- Salesforce/OpenSearch source never provided a value. The derivation uses
-- invoiced + credited (credited is already signed negative, so the sum is
-- net billings). Matches the fallback logic in scheduler/sync/compute.py so
-- future syncs preserve these values rather than clobbering them.
--
-- Scope: all stages (matches the compute.py fallback scope).
-- Idempotent: the WHERE clause skips rows that already have a value.

UPDATE opportunities
SET minimum_purchase_amount = COALESCE(invoiced, 0) + COALESCE(credited, 0)
WHERE minimum_purchase_amount IS NULL;

-- Verification: no rows should remain NULL after this runs (within sync lag).
SELECT school_yr,
       COUNT(*) AS opp_count,
       COUNT(*) FILTER (WHERE minimum_purchase_amount IS NULL) AS still_null,
       ROUND(SUM(minimum_purchase_amount)::numeric, 2) AS sum_min_purchase
FROM opportunities
GROUP BY school_yr
ORDER BY school_yr;
```

- [ ] **Step 3: Apply the backfill against the live database**

Use the Supabase MCP tool `execute_sql` with project `nroilqjlzvvjekntjngq` to run the UPDATE statement (and its verification SELECT) from the SQL file above. Record the number of rows affected.

**Safety check:** before running, confirm the UPDATE only touches rows where `minimum_purchase_amount IS NULL`. It will NOT overwrite any existing values.

- [ ] **Step 4: Commit the manual migration file**

```bash
git add prisma/migrations/manual/2026-04-15-backfill-min-purchase-from-net-billings.sql
git commit -m "feat(db): backfill minimum_purchase_amount from net billings on historical opps

One-off data backfill applied via Supabase MCP. Populates
minimum_purchase_amount for the ~1500 historical opportunities where
Salesforce/OpenSearch never provided a value, deriving it from
invoiced + credited (credited is already signed negative so the sum is
net billings).

Matches the fallback logic added to scheduler/sync/compute.py in the
previous commit, so future syncs preserve the backfilled values instead
of clobbering them with NULL."
```

---

## Task 3: Add `min_purchase_bookings` column to the actuals matview

**Files:**
- Modify: `scripts/district-opportunity-actuals-view.sql`
- Create: `prisma/migrations/20260415_actuals_view_adds_min_purchase_bookings/migration.sql`

The matview rebuilds on DROP/CREATE (same as the EK12 subscription fix that shipped in PR #116). We add one new aggregate column: `min_purchase_bookings = SUM(minimum_purchase_amount) FILTER (WHERE stage_prefix >= 6)`. This mirrors the existing `bookings` column but aggregates the contracted floor instead of the Salesforce net booking amount.

- [ ] **Step 1: Update the canonical matview SQL**

Edit `scripts/district-opportunity-actuals-view.sql`. Find the final SELECT list — look for the `bookings` aggregate line:

```sql
  -- Bookings: closed-won (stage prefix >= 6)
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 6), 0) AS bookings,
```

Immediately after that line, add:

```sql
  -- Min-purchase bookings: closed-won floor, sourced from minimum_purchase_amount
  -- (backfilled from invoiced + credited on historical opps — see
  -- prisma/migrations/manual/2026-04-15-backfill-min-purchase-from-net-billings.sql).
  -- Used by the leaderboard's "Prior Year Bookings" column.
  COALESCE(SUM(co.minimum_purchase_amount) FILTER (WHERE co.stage_prefix >= 6), 0) AS min_purchase_bookings,
```

- [ ] **Step 2: Create the Prisma migration directory**

```bash
mkdir -p prisma/migrations/20260415_actuals_view_adds_min_purchase_bookings
```

- [ ] **Step 3: Write the migration SQL**

Create `prisma/migrations/20260415_actuals_view_adds_min_purchase_bookings/migration.sql` by copying the full content of the updated `scripts/district-opportunity-actuals-view.sql` — the matview is rebuilt in full (DROP + CREATE), which is the pattern used by `20260412_actuals_view_includes_subscriptions`.

**Implementation note:** use `cat scripts/district-opportunity-actuals-view.sql > prisma/migrations/20260415_actuals_view_adds_min_purchase_bookings/migration.sql` after your edit in Step 1. Then prepend a header comment block to the migration file explaining what changed:

```sql
-- Add min_purchase_bookings column to district_opportunity_actuals matview.
--
-- The existing `bookings` column aggregates Salesforce's net_booking_amount on
-- closed-won opportunities. This adds a parallel `min_purchase_bookings` column
-- that aggregates minimum_purchase_amount instead — the contracted spending
-- floor. Historical opps were backfilled from invoiced + credited; see
-- prisma/migrations/manual/2026-04-15-backfill-min-purchase-from-net-billings.sql.
--
-- Used by the leaderboard's "Prior Year Bookings" column, which swaps from
-- session-delivered total_revenue (too lagging) to this contracted-floor metric.
--
-- Matview rebuild pattern matches 20260412_actuals_view_includes_subscriptions.
```

So the file starts with that header comment, then immediately follows with the full updated view SQL from `scripts/district-opportunity-actuals-view.sql`.

- [ ] **Step 4: Apply the migration locally (or on the shared dev DB)**

Run:

```bash
npx prisma migrate deploy
```

Expected: one new migration applied (`20260415_actuals_view_adds_min_purchase_bookings`). Look for the line `Applying migration \`20260415_actuals_view_adds_min_purchase_bookings\`` in the output.

Then verify the new column exists via Supabase MCP:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'district_opportunity_actuals'
  AND column_name = 'min_purchase_bookings';
```

Expected: 1 row returned.

Also spot-check a populated row:

```sql
SELECT sales_rep_email, school_yr, bookings, min_purchase_bookings
FROM district_opportunity_actuals
WHERE bookings > 0
ORDER BY bookings DESC
LIMIT 5;
```

Expected: `min_purchase_bookings` values are non-zero and roughly comparable in magnitude to `bookings` (both aggregate closed-won opps, just different numerator fields).

- [ ] **Step 5: Commit**

```bash
git add scripts/district-opportunity-actuals-view.sql \
        prisma/migrations/20260415_actuals_view_adds_min_purchase_bookings/
git commit -m "feat(db): add min_purchase_bookings to district_opportunity_actuals matview

New closed-won aggregate over minimum_purchase_amount, mirroring the existing
bookings column that uses net_booking_amount. The leaderboard's
'Prior Year Bookings' column reads from this new field — it captures the
contracted floor rather than what's been session-delivered, which is
especially meaningful for in-progress years where session delivery lags
significantly behind contract value.

Matview rebuild pattern matches 20260412_actuals_view_includes_subscriptions
(DROP + CREATE)."
```

---

## Task 4: Expose `minPurchaseBookings` in `getRepActuals`

**Files:**
- Modify: `src/lib/opportunity-actuals.ts`

Add a `minPurchaseBookings` field to the `RepActuals` interface, include it in the SQL query, and map it in the return.

- [ ] **Step 1: Add the field to `RepActuals`**

Edit `src/lib/opportunity-actuals.ts`. Find the `RepActuals` interface (around line 140):

```ts
export interface RepActuals {
  totalRevenue: number;
  totalTake: number;
  completedTake: number;
  scheduledTake: number;
  weightedPipeline: number;
  openPipeline: number;
  bookings: number;
  invoiced: number;
}
```

Add `minPurchaseBookings: number;` after `bookings`:

```ts
export interface RepActuals {
  totalRevenue: number;
  totalTake: number;
  completedTake: number;
  scheduledTake: number;
  weightedPipeline: number;
  openPipeline: number;
  bookings: number;
  minPurchaseBookings: number;
  invoiced: number;
}
```

- [ ] **Step 2: Add the field to the raw SQL query inside `getRepActuals`**

In the same file, find `getRepActuals` (around line 155). Inside the `prisma.$queryRaw` SELECT list, find `SUM(bookings)`:

```ts
        COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
        COALESCE(SUM(open_pipeline), 0) AS open_pipeline,
        COALESCE(SUM(bookings), 0) AS bookings,
        COALESCE(SUM(invoiced), 0) AS invoiced
```

Add `min_purchase_bookings` between `bookings` and `invoiced`:

```ts
        COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
        COALESCE(SUM(open_pipeline), 0) AS open_pipeline,
        COALESCE(SUM(bookings), 0) AS bookings,
        COALESCE(SUM(min_purchase_bookings), 0) AS min_purchase_bookings,
        COALESCE(SUM(invoiced), 0) AS invoiced
```

Also update the raw row type (the inline type argument to `$queryRaw`):

```ts
    prisma.$queryRaw<
      {
        total_revenue: number;
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
```

- [ ] **Step 3: Map the new field in the return statements**

Find both return statements — the empty fallback and the populated one.

The empty fallback (around line 188) currently looks like:

```ts
  if (rows.length === 0) {
    return {
      totalRevenue: 0,
      totalTake: 0,
      completedTake: 0,
      scheduledTake: 0,
      weightedPipeline: 0,
      openPipeline: 0,
      bookings: 0,
      invoiced: 0,
    };
  }
```

Add `minPurchaseBookings: 0,`:

```ts
  if (rows.length === 0) {
    return {
      totalRevenue: 0,
      totalTake: 0,
      completedTake: 0,
      scheduledTake: 0,
      weightedPipeline: 0,
      openPipeline: 0,
      bookings: 0,
      minPurchaseBookings: 0,
      invoiced: 0,
    };
  }
```

The populated return statement (around line 201) currently looks like:

```ts
  const row = rows[0];
  return {
    totalRevenue: Number(row.total_revenue),
    totalTake: Number(row.total_take),
    completedTake: Number(row.completed_take),
    scheduledTake: Number(row.scheduled_take),
    weightedPipeline: Number(row.weighted_pipeline),
    openPipeline: Number(row.open_pipeline),
    bookings: Number(row.bookings),
    invoiced: Number(row.invoiced),
  };
```

Add `minPurchaseBookings: Number(row.min_purchase_bookings),`:

```ts
  const row = rows[0];
  return {
    totalRevenue: Number(row.total_revenue),
    totalTake: Number(row.total_take),
    completedTake: Number(row.completed_take),
    scheduledTake: Number(row.scheduled_take),
    weightedPipeline: Number(row.weighted_pipeline),
    openPipeline: Number(row.open_pipeline),
    bookings: Number(row.bookings),
    minPurchaseBookings: Number(row.min_purchase_bookings),
    invoiced: Number(row.invoiced),
  };
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/opportunity-actuals.ts
git commit -m "feat(lib): expose minPurchaseBookings on getRepActuals"
```

---

## Task 5: Swap `priorYearRevenue` to use `minPurchaseBookings`

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`

One-line change in the per-rep actuals mapping block inside the `scores.map` loop. The old formula used `totalRevenue` (session-delivered). The new formula uses `minPurchaseBookings` (contracted floor, closed-won only).

- [ ] **Step 1: Update the `priorYearRevenue` field in the rep actuals build**

Edit `src/app/api/leaderboard/route.ts`. Find the block where `priorYearRevenue` is computed (around line 83):

```ts
            priorYearRevenue: yearActuals.get(priorSchoolYr)?.totalRevenue ?? 0,
```

Replace with:

```ts
            priorYearRevenue: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
```

The field name `priorYearRevenue` is intentionally kept the same — it's the shape exposed on the `LeaderboardEntry` type and used throughout the frontend. Renaming it would ripple. The SEMANTIC meaning changes (bookings, not revenue), which is handled by the column label rename in Task 6.

- [ ] **Step 2: Also check the fallback in the catch branch**

A few lines below (around line 86), there's a catch-branch fallback:

```ts
        } catch {
          return { userId: score.userId, take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0, revenue: 0, priorYearRevenue: 0 };
        }
```

No change needed — it already returns 0 for `priorYearRevenue`, which is correct.

- [ ] **Step 3: Also check the default actuals fallback in the entries.map block**

Further down (around line 231 after the admin exclusion work), there's another fallback:

```ts
    const entries = rosterScores.map((score, index) => {
      const actuals = actualsMap.get(score.userId) ?? {
        userId: score.userId,
        take: 0,
        pipeline: 0,
        pipelineCurrentFY: 0,
        pipelineNextFY: 0,
        revenue: 0,
        priorYearRevenue: 0,
      };
```

Also correct already — the fallback object has `priorYearRevenue: 0`. No change needed.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leaderboard/route.ts
git commit -m "feat(leaderboard): switch Prior Year column to read minPurchaseBookings

Previous source was total_revenue (session-delivered revenue for the prior FY)
which lags significantly behind what was actually sold on paper, especially
for opportunities still mid-delivery at year-end. Swap to min_purchase_bookings
(contracted floor, closed-won only). Historical opps were backfilled from
invoiced + credited in a previous commit."
```

---

## Task 6: Rename the UI column label to "Prior Year Bookings"

**Files:**
- Modify: `src/features/leaderboard/components/RevenueTable.tsx`

One-line change in the `COLUMNS` array. The column `key` stays as `priorYearRevenue` (so everything else in the table still works); only the display label changes.

- [ ] **Step 1: Update the column label**

Edit `src/features/leaderboard/components/RevenueTable.tsx`. Find the `COLUMNS` array (around line 16):

```ts
const COLUMNS: { key: RevenueSortColumn; label: string }[] = [
  { key: "revenue", label: "Current Revenue" },
  { key: "priorYearRevenue", label: "Prior Year Closed" },
  { key: "pipeline", label: "Pipeline" },
  { key: "revenueTargeted", label: "Targeted" },
];
```

Change the `priorYearRevenue` row:

```ts
const COLUMNS: { key: RevenueSortColumn; label: string }[] = [
  { key: "revenue", label: "Current Revenue" },
  { key: "priorYearRevenue", label: "Prior Year Bookings" },
  { key: "pipeline", label: "Pipeline" },
  { key: "revenueTargeted", label: "Targeted" },
];
```

- [ ] **Step 2: Verify no tests depend on the old label**

```bash
grep -rn "Prior Year Closed" src/
```

Expected: zero hits (after your edit). If any remain, update them to "Prior Year Bookings".

- [ ] **Step 3: Run the RevenueTable test suite**

```bash
npm test -- src/features/leaderboard/components/__tests__/RevenueTable.test.tsx
```

Expected: all 8 tests pass. The tests match on currency formatted text and "Team Total", not the column labels — so they should be unaffected.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 5: Visual spot-check in the browser**

Start the dev server if not running (`npm run dev`), then open `http://localhost:3005/?tab=leaderboard`. Confirm:
- The column header reads "Prior Year Bookings" (not "Prior Year Closed").
- Numbers in that column are different from the previous deploy (they should reflect closed-won min_purchase, which is typically much larger than session-delivered revenue for in-progress years).

- [ ] **Step 6: Commit**

```bash
git add src/features/leaderboard/components/RevenueTable.tsx
git commit -m "feat(leaderboard): rename Prior Year column label to 'Prior Year Bookings'

Matches the semantic shift from session-delivered revenue to contracted floor
(min_purchase_bookings). Column key is unchanged — only the display label."
```

---

## Task 7: Final verification + PR

**Files:** none (verification and push only)

- [ ] **Step 1: Full test suite**

```bash
npm test -- --run
```

Expected: all tests pass, including the scheduler Python tests if they run via a CI hook. If only Vitest runs, separately run:

```bash
cd scheduler && python -m pytest
```

Expected: all tests pass.

- [ ] **Step 2: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Confirm the commit log**

```bash
git log origin/main..HEAD --oneline
```

Expected 7 commits (0: diagnostic script, 1: compute.py fallback, 2: backfill SQL, 3: matview migration, 4: getRepActuals, 5: leaderboard API, 6: UI rename).

- [ ] **Step 4: Push and open PR**

Ask the user for confirmation before pushing (the backfill has already been applied to the live DB, so the push/PR is the last step that affects anyone else).

```bash
git push -u origin feat/min-purchase-bookings-column
```

Then:

```bash
gh pr create --base main --head feat/min-purchase-bookings-column \
  --title "feat(leaderboard): prior year bookings from min_purchase (with historical backfill)" \
  --body "..."
```

Use the plan's Goal + Architecture sections as the PR body basis. Mention:
- The historical backfill has already been applied to prod
- The compute.py fallback prevents future clobber
- The matview rebuild is reasonably fast but will briefly disrupt any live reads (CONCURRENTLY refresh can't be used when the view is being DROP/CREATE'd)

---

## Files Touched Summary

| File | Change | Task |
|------|--------|------|
| `scheduler/scripts/inspect_opp_credit_memos.py` | Commit (already exists in working tree) | 0 |
| `scheduler/sync/compute.py` | Fallback for `minimum_purchase_amount` when source null | 1 |
| `scheduler/tests/test_compute.py` | 3 new pytest cases for the fallback | 1 |
| `prisma/migrations/manual/2026-04-15-backfill-min-purchase-from-net-billings.sql` | Create (one-off data backfill, applied via MCP) | 2 |
| `scripts/district-opportunity-actuals-view.sql` | Add `min_purchase_bookings` aggregate column | 3 |
| `prisma/migrations/20260415_actuals_view_adds_min_purchase_bookings/migration.sql` | New matview-rebuild migration | 3 |
| `src/lib/opportunity-actuals.ts` | Add `minPurchaseBookings` to `RepActuals` | 4 |
| `src/app/api/leaderboard/route.ts` | Use `minPurchaseBookings` for `priorYearRevenue` | 5 |
| `src/features/leaderboard/components/RevenueTable.tsx` | Column label rename | 6 |

**8 files, 7 commits**, 1 matview rebuild, 1 one-off data backfill.
