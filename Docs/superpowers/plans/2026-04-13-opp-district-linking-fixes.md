# Opportunity ↔ District Linking Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three data quality bugs that cause opportunities to be invisibly mis-linked or unlinked from districts, so that reports like "top 40 customers with pipeline and services" return complete, accurate data.

**Architecture:** Three bugs are fixed in three layers. **(a)** 350 historical opps with `district_lea_id IS NULL` but `district_nces_id` populated are repaired by a one-time SQL backfill migration with name-match guardrails. **(b)** The hourly Python sync (`scheduler/sync/compute.py`) is hardened with `.strip()` normalization and a name-consistency check that routes suspected typos to `unmatched_opportunities` instead of blindly trusting the CRM mapping. **(c)** A ghost duplicate district row (Onamia `2721720`) has `$213K` of misattributed revenue merged into the canonical `2725050` row, and a recurring audit query flags other same-name-different-leaid duplicates for review.

**Tech Stack:** PostgreSQL 15+ (Supabase), Prisma migrations (raw SQL files in `prisma/migrations/manual/`), Python 3.11 scheduler (psycopg2, pytest), Next.js 16 / React 19 admin UI (TypeScript, Vitest).

---

## Bugs Being Fixed

**Bug (a) — NCES-only linking.** 350 opportunities have `district_lea_id IS NULL` while `district_nces_id` is populated. The NCES ID *is* the LEAID, just stored in the wrong column; 190 of them also have trailing whitespace. Impact: these opps are silently dropped from `refresh_fullmind_financials()` (it joins on `district_lea_id`) and from any analysis that joins opps by leaid. Example: Richland School District 1 (leaid `4503360`) had a $2.6M FY27 pipeline that was invisible until we normalized the join.

**Bug (b) — Typo'd leaid in source opp data.** A Yuba City opportunity (`17592308838678`, "Yuba City Tutoring", $1M booking) has `district_nces_id = "0643170 "` — that leaid belongs to **Woodville Elementary School District**, not Yuba City. The opp's own `district_name` field says "Yuba City Unified School District". The naive fix for bug (a) (`UPDATE SET district_lea_id = TRIM(district_nces_id)`) would make this worse by confidently linking the opp to the wrong district. Fix: the backfill must validate that the resolved leaid's district name agrees with the opp's stored `district_name`, and the sync must perform the same check at ingest time.

**Bug (c) — Duplicate district rows with revenue on both.** The `districts` table has two rows for "Onamia Public School District":
- `2721720` (is_customer=false, **zero opps**, $213,708 FY26 revenue in `district_financials`)
- `2725050` (is_customer=true, 6 opps totaling $1.15M, $190,052 FY26 revenue)

Both appear in our top-40 list as separate rows. The ghost `2721720` has Fullmind revenue despite having no underlying opps, which means either (i) historical opps that were on `2721720` got re-linked and `refresh_fullmind_financials()` didn't zero out the old row, (ii) a competitor CSV loader mis-attributed revenue, or (iii) a sessions/subscriptions join is matching on the wrong leaid. This plan investigates the source, cleans up the specific Onamia case, and adds a recurring audit to catch future duplicates.

---

## File Structure

**New files:**
- `prisma/migrations/manual/2026-04-13_normalize_district_name_fn.sql` — idempotent Postgres function for normalized name comparison (used by backfill and audit)
- `prisma/migrations/manual/2026-04-13_backfill_opp_district_leaid.sql` — one-time historical backfill for bug (a), with name-match guardrail
- `prisma/migrations/manual/2026-04-13_onamia_cleanup.sql` — one-time cleanup for the specific Onamia ghost row
- `prisma/migrations/manual/2026-04-13_district_dedup_audit.sql` — recurring audit view listing same-name-different-leaid duplicates
- `scheduler/sync/district_resolver.py` — new helper module encapsulating name-normalization and mismatch detection logic (kept small and testable)
- `scheduler/tests/test_district_resolver.py` — pytest coverage for the resolver
- `scripts/backfill_dry_run.py` — small CLI that prints the rows the backfill migration would affect, without touching the DB

**Modified files:**
- `scheduler/sync/compute.py:81-115` — `build_opportunity_record()` learns to `.strip()` NCES/LEA values and reject name-mismatched mappings via the new resolver
- `scheduler/sync/supabase_writer.py` — `upsert_unmatched()` gains two new `reason` constants: `"Name/LEAID mismatch"` and `"NCES-only link"` (the unmatched rows are informational; new opps still flow to `opportunities` if there is any valid link, so this is purely an admin-surfaced audit trail)
- `scheduler/tests/test_compute.py` — new test cases for trim, name-mismatch, and NCES fallback paths
- `src/app/admin/unmatched-opportunities/page.tsx` — add the two new `reason` values to the filter dropdown
- `src/app/admin/unmatched-opportunities/__tests__/page.test.tsx` (new if absent) — Vitest coverage for the filter chip render

**Files intentionally NOT modified:**
- `scripts/etl/loaders/nces_edge.py` — the dedup audit is a separate concern; leaving NCES loads alone avoids scope creep and keeps the NCES source of truth intact.
- `prisma/migrations/manual/create_refresh_fullmind_financials.sql` — the financials refresh function is correct; the bug is upstream (opps linking), not in the aggregate.

---

## Task 0: Prerequisites

**Files:**
- Read: `/Users/sierraarcega/territory-plan/scheduler/sync/compute.py:81-115`
- Read: `/Users/sierraarcega/territory-plan/scheduler/sync/queries.py:92-123`
- Read: `/Users/sierraarcega/territory-plan/scheduler/sync/supabase_writer.py` (search for `upsert_unmatched`)
- Read: `/Users/sierraarcega/territory-plan/prisma/migrations/manual/create_refresh_fullmind_financials.sql`
- Read: `/Users/sierraarcega/territory-plan/scheduler/tests/test_compute.py` — understand existing test fixture style
- Read: `/Users/sierraarcega/territory-plan/scheduler/requirements.txt` — confirm `psycopg2-binary` and `pytest` versions

- [ ] **Step 1: Read all files above** so you can pattern-match on existing conventions

- [ ] **Step 2: Create a feature branch from main**

```bash
cd /Users/sierraarcega/territory-plan
git checkout main
git pull origin main
git checkout -b fix/opp-district-linking
```

- [ ] **Step 3: Take a snapshot of current financial totals for the top 40** so we can verify the backfill hasn't double-counted or corrupted anything

```bash
psql "$DATABASE_URL" -c "
SELECT
  COUNT(*) FILTER (WHERE district_lea_id IS NULL) AS null_lea_count,
  COUNT(*) FILTER (WHERE district_lea_id IS NULL AND district_nces_id IS NOT NULL) AS only_nces_count,
  COUNT(*) FILTER (WHERE district_nces_id <> TRIM(district_nces_id)) AS trailing_ws_count,
  (SELECT SUM(total_revenue)::numeric(15,2) FROM district_financials WHERE vendor='fullmind' AND fiscal_year='FY26') AS fy26_total
FROM opportunities;
" > /tmp/before_snapshot.txt
cat /tmp/before_snapshot.txt
```

Expected: `null_lea_count ≈ 1145`, `only_nces_count ≈ 350`, `trailing_ws_count ≈ 190`, `fy26_total ≈ 21.6M` (record the actual numbers)

- [ ] **Step 4: Commit the snapshot**

```bash
git add -N /tmp/before_snapshot.txt  # don't actually commit; this is just local reference
# Keep the file around in /tmp for Phase 5 verification
```

---

## Phase 1 — Historical SQL Backfill (Bug a, with guardrail against bug b)

### Task 1: Create the `normalize_district_name()` Postgres function

**Files:**
- Create: `prisma/migrations/manual/2026-04-13_normalize_district_name_fn.sql`

This function takes a district name and produces a lowercased, punctuation-stripped, common-word-stripped canonical form. It is used in both the backfill migration and the future audit query, so it lives in its own file and is idempotent.

- [ ] **Step 1: Write the function SQL**

```sql
-- 2026-04-13_normalize_district_name_fn.sql
-- Idempotent installer for normalize_district_name().
-- Takes a raw district name and returns a canonical form for fuzzy equality.
-- Example:
--   'Richland County School District 1'  -> 'richland1'
--   'Richland School District 1'         -> 'richland1'
--   'Yuba City Unified School District'  -> 'yubacity'
--   'Woodville Elementary School District' -> 'woodville'

CREATE OR REPLACE FUNCTION normalize_district_name(name TEXT) RETURNS TEXT AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(coalesce($1, '')),
      -- strip common district-type words (order matters for multi-word phrases)
      '\s*(unified school district|independent school district|consolidated school district|public school district|school district|schools|school|district|unified|public|elementary|junior|senior|high|middle|central|city|county|independent|charter|community|academy|public)\s*',
      ' ',
      'g'
    ),
    -- strip any remaining non-alphanumeric
    '[^a-z0-9]+', '', 'g'
  );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION normalize_district_name(TEXT) IS
  'Canonical form used to compare district names across opportunities.district_name and districts.name. Stops common district-type words and punctuation.';
```

- [ ] **Step 2: Apply the function to the DB**

```bash
psql "$DATABASE_URL" -f prisma/migrations/manual/2026-04-13_normalize_district_name_fn.sql
```

Expected output: `CREATE FUNCTION`, `COMMENT`

- [ ] **Step 3: Sanity-check the function against the known cases**

```bash
psql "$DATABASE_URL" -c "
SELECT
  normalize_district_name('Richland County School District 1') AS richland_nces,
  normalize_district_name('Richland School District 1')        AS richland_local,
  normalize_district_name('Yuba City Unified School District') AS yuba,
  normalize_district_name('Woodville Elementary School District') AS woodville,
  normalize_district_name('Onamia Public School District')     AS onamia;
"
```

Expected output:
```
 richland_nces | richland_local | yuba     | woodville | onamia
---------------+----------------+----------+-----------+--------
 richland1     | richland1      | yuba     | woodville | onamia
```

`richland_nces` and `richland_local` **must** produce the same string. `yuba` and `woodville` **must** differ. If any of these fail, fix the regex in the function and re-run Step 2.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/manual/2026-04-13_normalize_district_name_fn.sql
git commit -m "feat(db): add normalize_district_name() for fuzzy district-name matching

Used by the historical backfill to validate that an opp's stored district_name
agrees with the district record its NCES ID resolves to, preventing bug
(b)-style typos (Yuba City → Woodville Elementary) from being baked in."
```

---

### Task 2: Write the backfill dry-run query

**Files:**
- Create: `prisma/migrations/manual/2026-04-13_backfill_opp_district_leaid.sql`

This migration file has two halves — a dry-run `SELECT` wrapped in a top-level comment, and the real `UPDATE` wrapped in a transaction. Task 2 writes the dry-run and inspects output; Task 3 writes the apply step.

- [ ] **Step 1: Write the dry-run half of the migration file**

```sql
-- 2026-04-13_backfill_opp_district_leaid.sql
-- Historical backfill for opportunities with district_lea_id IS NULL but
-- district_nces_id populated (bug a), with name-match guardrail against
-- typo'd leaids (bug b).
--
-- This file is split into a DRY-RUN SELECT and an APPLY UPDATE.
-- Run the dry-run first, review the rejection list, then run the apply block.

-- ============================================================
-- DRY RUN — reports rows the apply block would touch + reject.
-- Safe to run; makes no changes.
-- ============================================================

WITH candidates AS (
  SELECT
    o.id                                                      AS opp_id,
    o.name                                                    AS opp_name,
    o.district_name                                           AS opp_district_name,
    TRIM(o.district_nces_id)                                  AS trimmed_nces_id,
    d.leaid                                                   AS resolved_leaid,
    d.name                                                    AS resolved_district_name,
    normalize_district_name(o.district_name)                  AS norm_opp_name,
    normalize_district_name(d.name)                           AS norm_resolved_name
  FROM opportunities o
  LEFT JOIN districts d ON d.leaid = TRIM(o.district_nces_id)
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
)
SELECT
  CASE
    WHEN resolved_leaid IS NULL THEN 'REJECT: NCES does not exist in districts'
    WHEN norm_opp_name = '' OR norm_resolved_name = '' THEN 'ACCEPT: one side has no name, allowing'
    WHEN norm_opp_name = norm_resolved_name THEN 'ACCEPT: name match'
    WHEN position(norm_opp_name in norm_resolved_name) > 0
      OR position(norm_resolved_name in norm_opp_name) > 0 THEN 'ACCEPT: substring match'
    ELSE 'REJECT: name mismatch'
  END AS outcome,
  COUNT(*) AS count,
  SUM(net_booking_amount)::numeric(15,2) AS total_booking
FROM candidates c
LEFT JOIN opportunities o2 ON o2.id = c.opp_id
GROUP BY outcome
ORDER BY outcome;

-- Detailed REJECT list (so you can see what would be skipped):
WITH candidates AS (
  SELECT
    o.id                                                      AS opp_id,
    o.name                                                    AS opp_name,
    o.district_name                                           AS opp_district_name,
    TRIM(o.district_nces_id)                                  AS trimmed_nces_id,
    d.leaid                                                   AS resolved_leaid,
    d.name                                                    AS resolved_district_name,
    normalize_district_name(o.district_name)                  AS norm_opp_name,
    normalize_district_name(d.name)                           AS norm_resolved_name
  FROM opportunities o
  LEFT JOIN districts d ON d.leaid = TRIM(o.district_nces_id)
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
)
SELECT opp_id, opp_name, opp_district_name, trimmed_nces_id, resolved_district_name
FROM candidates
WHERE resolved_leaid IS NULL
   OR (norm_opp_name <> '' AND norm_resolved_name <> ''
       AND norm_opp_name <> norm_resolved_name
       AND position(norm_opp_name in norm_resolved_name) = 0
       AND position(norm_resolved_name in norm_opp_name) = 0)
ORDER BY opp_name;
```

- [ ] **Step 2: Run the dry-run**

```bash
psql "$DATABASE_URL" -f prisma/migrations/manual/2026-04-13_backfill_opp_district_leaid.sql > /tmp/backfill_dry_run.txt
cat /tmp/backfill_dry_run.txt
```

Expected: an outcome summary (roughly `ACCEPT ~300`, `REJECT: name mismatch ~10-30`, `REJECT: NCES does not exist ~10`) and then a detailed list of rejections. **Critical**: the Yuba City opp `17592308838678` MUST appear in the name-mismatch reject list. If it doesn't, the normalization function is too loose; stop and fix Task 1 before proceeding.

- [ ] **Step 3: Human review of dry-run output**

Open `/tmp/backfill_dry_run.txt`. For each REJECT row, confirm it's a rejection you agree with. If any row you'd expect to ACCEPT is being rejected (e.g., a legitimate abbreviation), update `normalize_district_name()` in Task 1's SQL file and re-run Steps 2–3 here.

**Do not proceed to Task 3 until the dry-run output looks clean.** Record the final accept/reject counts in the commit message for Task 3.

---

### Task 3: Write and apply the backfill UPDATE

**Files:**
- Modify: `prisma/migrations/manual/2026-04-13_backfill_opp_district_leaid.sql` (append apply block)

- [ ] **Step 1: Append the apply block to the migration file**

Append to `prisma/migrations/manual/2026-04-13_backfill_opp_district_leaid.sql`:

```sql

-- ============================================================
-- APPLY — wrapped in a transaction. Run manually after dry-run review.
-- ============================================================
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file> -1
-- (The -1 flag wraps the whole file in a single transaction.)

BEGIN;

-- Record a row in a temp audit table so we can verify counts match the dry-run.
CREATE TEMP TABLE backfill_audit (
  opp_id        TEXT,
  old_lea_id    TEXT,
  new_lea_id    TEXT,
  opp_name      TEXT,
  resolved_name TEXT
) ON COMMIT DROP;

WITH candidates AS (
  SELECT
    o.id,
    o.district_lea_id AS old_lea_id,
    TRIM(o.district_nces_id) AS new_lea_id,
    o.name AS opp_name,
    o.district_name AS opp_district_name,
    d.name AS resolved_district_name,
    normalize_district_name(o.district_name) AS norm_opp_name,
    normalize_district_name(d.name) AS norm_resolved_name
  FROM opportunities o
  JOIN districts d ON d.leaid = TRIM(o.district_nces_id)
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
),
accepted AS (
  SELECT *
  FROM candidates
  WHERE norm_opp_name = '' OR norm_resolved_name = ''
     OR norm_opp_name = norm_resolved_name
     OR position(norm_opp_name in norm_resolved_name) > 0
     OR position(norm_resolved_name in norm_opp_name) > 0
),
updated AS (
  UPDATE opportunities o
     SET district_lea_id  = a.new_lea_id,
         district_nces_id = a.new_lea_id  -- also trim the stored NCES ID
    FROM accepted a
   WHERE o.id = a.id
   RETURNING o.id, a.old_lea_id, a.new_lea_id, a.opp_name, a.resolved_district_name
)
INSERT INTO backfill_audit
SELECT * FROM updated;

-- Print the count of updated rows so we can verify vs. the dry-run.
SELECT COUNT(*) AS updated_count,
       SUM((SELECT net_booking_amount FROM opportunities WHERE id = a.opp_id))::numeric(15,2) AS updated_booking_total
FROM backfill_audit a;

-- Also record every rejected row into unmatched_opportunities so the admin
-- UI surfaces them for manual review.
INSERT INTO unmatched_opportunities (
  id, name, stage, school_yr, account_name, state, net_booking_amount,
  reason, resolved, synced_at
)
SELECT
  o.id,
  o.name,
  o.stage,
  o.school_yr,
  o.district_name,
  o.state,
  o.net_booking_amount,
  CASE
    WHEN d.leaid IS NULL THEN 'NCES-only link: unknown NCES'
    ELSE 'NCES-only link: name mismatch'
  END,
  FALSE,
  NOW()
FROM opportunities o
LEFT JOIN districts d ON d.leaid = TRIM(o.district_nces_id)
WHERE o.district_lea_id IS NULL
  AND o.district_nces_id IS NOT NULL
  AND TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
  AND (
    d.leaid IS NULL
    OR (normalize_district_name(o.district_name) <> ''
        AND normalize_district_name(d.name) <> ''
        AND normalize_district_name(o.district_name) <> normalize_district_name(d.name)
        AND position(normalize_district_name(o.district_name) in normalize_district_name(d.name)) = 0
        AND position(normalize_district_name(d.name) in normalize_district_name(o.district_name)) = 0)
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Refresh financials so the new lea_ids roll into district_financials.
SELECT refresh_fullmind_financials();
```

- [ ] **Step 2: Run the apply block (this modifies production data)**

**STOP.** Make sure the dry-run review in Task 2 Step 3 is complete and you have explicit approval to modify production. If in doubt, don't.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/manual/2026-04-13_backfill_opp_district_leaid.sql -1
```

Expected output: `BEGIN`, the updated count (should match dry-run ACCEPT count), an `INSERT N` for unmatched_opportunities, `COMMIT`, and one row from `refresh_fullmind_financials`.

- [ ] **Step 3: Verify Richland 1 shows up now**

```bash
psql "$DATABASE_URL" -c "
SELECT id, stage, school_yr, district_lea_id, district_nces_id, district_name, net_booking_amount
FROM opportunities
WHERE id = '17592309325860';
"
```

Expected: `district_lea_id = '4503360'`, `district_nces_id = '4503360'` (no trailing space)

- [ ] **Step 4: Verify Yuba City was NOT touched**

```bash
psql "$DATABASE_URL" -c "
SELECT id, district_lea_id, district_nces_id, district_name
FROM opportunities
WHERE id = '17592308838678';
SELECT id, reason FROM unmatched_opportunities WHERE id = '17592308838678';
"
```

Expected: Yuba City opp still has `district_lea_id = NULL` (the guardrail held), and a row exists in `unmatched_opportunities` with `reason = 'NCES-only link: name mismatch'`.

- [ ] **Step 5: Commit the migration file**

```bash
git add prisma/migrations/manual/2026-04-13_backfill_opp_district_leaid.sql
git commit -m "fix(db): backfill district_lea_id from trimmed district_nces_id

Updates ~320 historical opportunities that had district_lea_id NULL but
district_nces_id populated (bug a). A normalized-name guardrail rejects
any opp whose stored district_name disagrees with the resolved district's
name, preventing typo'd leaids (bug b) like the Yuba City opp
17592308838678 from being mis-linked to Woodville Elementary.

Rejected rows are inserted into unmatched_opportunities with reason
'NCES-only link: name mismatch' (or 'NCES-only link: unknown NCES') so
the admin UI surfaces them for manual cleanup.

Calls refresh_fullmind_financials() at the end so the newly-linked rows
flow into district_financials immediately."
```

---

## Phase 2 — Python Sync Hardening (Bugs a + b at ingest time)

### Task 4: Set up the resolver module skeleton (failing test first)

**Files:**
- Create: `scheduler/sync/district_resolver.py`
- Create: `scheduler/tests/test_district_resolver.py`

- [ ] **Step 1: Write the failing test**

```python
# scheduler/tests/test_district_resolver.py
"""Tests for scheduler.sync.district_resolver."""
from scheduler.sync.district_resolver import normalize_district_name


def test_normalize_strips_common_suffixes():
    assert normalize_district_name("Richland County School District 1") == \
           normalize_district_name("Richland School District 1")


def test_normalize_distinguishes_yuba_from_woodville():
    yuba = normalize_district_name("Yuba City Unified School District")
    woodville = normalize_district_name("Woodville Elementary School District")
    assert yuba != woodville


def test_normalize_handles_none():
    assert normalize_district_name(None) == ""
    assert normalize_district_name("") == ""
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/sierraarcega/territory-plan/scheduler
python -m pytest tests/test_district_resolver.py -v
```

Expected: `ModuleNotFoundError: No module named 'scheduler.sync.district_resolver'`

- [ ] **Step 3: Write the minimal implementation**

```python
# scheduler/sync/district_resolver.py
"""District name normalization and mismatch detection.

Used by compute.build_opportunity_record() to catch bug (a) and bug (b)
at sync time — see Docs/superpowers/plans/2026-04-13-opp-district-linking-fixes.md.
"""
import re
from typing import Optional

# Keep this list in sync with normalize_district_name() SQL function in
# prisma/migrations/manual/2026-04-13_normalize_district_name_fn.sql
_SUFFIX_PATTERN = re.compile(
    r"\s*(unified school district|independent school district|"
    r"consolidated school district|public school district|school district|"
    r"schools|school|district|unified|public|elementary|junior|senior|"
    r"high|middle|central|city|county|independent|charter|community|"
    r"academy)\s*",
    re.IGNORECASE,
)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_district_name(name: Optional[str]) -> str:
    """Return a canonical form of a district name for fuzzy equality.

    Must stay in sync with the normalize_district_name() Postgres function.
    """
    if not name:
        return ""
    stripped = _SUFFIX_PATTERN.sub(" ", name.lower())
    return _NON_ALNUM.sub("", stripped)
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
python -m pytest tests/test_district_resolver.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/sierraarcega/territory-plan
git add scheduler/sync/district_resolver.py scheduler/tests/test_district_resolver.py
git commit -m "feat(scheduler): add district_resolver.normalize_district_name()

Python equivalent of the Postgres normalize_district_name() function.
Keeps the suffix list in sync so backfill and sync agree on whether two
district names are 'the same'."
```

---

### Task 5: Add `names_match()` mismatch detector

**Files:**
- Modify: `scheduler/sync/district_resolver.py`
- Modify: `scheduler/tests/test_district_resolver.py`

- [ ] **Step 1: Write the failing test**

Append to `scheduler/tests/test_district_resolver.py`:

```python
from scheduler.sync.district_resolver import names_match


def test_names_match_exact():
    assert names_match("Richland School District 1",
                       "Richland County School District 1") is True


def test_names_match_substring():
    assert names_match("Onamia Public School District",
                       "Onamia Public Schools") is True


def test_names_mismatch_blocks_yuba_woodville():
    assert names_match("Yuba City Unified School District",
                       "Woodville Elementary School District") is False


def test_names_match_allows_empty_side():
    assert names_match(None, "Some District") is True
    assert names_match("Some District", "") is True
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python -m pytest tests/test_district_resolver.py -v
```

Expected: `ImportError: cannot import name 'names_match'`

- [ ] **Step 3: Implement `names_match`**

Append to `scheduler/sync/district_resolver.py`:

```python
def names_match(opp_name: Optional[str], district_name: Optional[str]) -> bool:
    """Return True if the two names agree after normalization.

    Empty or missing sides are treated as agreement (we don't reject when
    we simply have no information). Substring matches in either direction
    count as agreement — "Onamia Public Schools" and "Onamia Public School
    District" should both pass.
    """
    norm_a = normalize_district_name(opp_name)
    norm_b = normalize_district_name(district_name)
    if not norm_a or not norm_b:
        return True
    if norm_a == norm_b:
        return True
    return norm_a in norm_b or norm_b in norm_a
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
python -m pytest tests/test_district_resolver.py -v
```

Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add scheduler/sync/district_resolver.py scheduler/tests/test_district_resolver.py
git commit -m "feat(scheduler): add names_match() for bug (b) detection

Used by build_opportunity_record() to reject CRM mappings where the
resolved district's name disagrees with the opp's stored district_name."
```

---

### Task 6: Wire `.strip()` + `names_match()` into `build_opportunity_record`

**Files:**
- Modify: `scheduler/sync/compute.py:81-115`
- Modify: `scheduler/tests/test_compute.py`

- [ ] **Step 1: Write the failing tests**

Append to `scheduler/tests/test_compute.py` (or replace an existing fixture if there's overlap — read the file first to avoid collisions):

```python
from scheduler.sync.compute import build_opportunity_record


def _opp(accounts, **kwargs):
    """Helper: build a minimal opportunity dict."""
    base = {"id": "OPP-1", "accounts": accounts, "invoices": [], "credit_memos": [],
            "sales_rep": {}, "stage": "1 - Discovery", "school_yr": "2026-27"}
    base.update(kwargs)
    return base


def test_build_strips_trailing_whitespace_from_nces():
    mapping = {"ACC-1": {
        "nces_id": "4503360 ",   # trailing space simulating CRM data
        "leaid":   "4503360 ",
        "name":    "Richland School District 1",
        "type":    "district",
    }}
    record = build_opportunity_record(
        _opp([{"id": "ACC-1", "name": "Richland County School District 1"}]),
        sessions=[],
        district_mapping=mapping,
    )
    assert record["district_nces_id"] == "4503360"
    assert record["district_lea_id"] == "4503360"


def test_build_rejects_name_mismatch_and_nulls_the_link():
    """When the CRM mapping disagrees with the opp's own district_name
    (Yuba City → Woodville case), we refuse to trust the mapping and
    leave lea_id NULL so the opp falls into the unmatched path."""
    mapping = {"ACC-2": {
        "nces_id": "0643170",
        "leaid":   "0643170",
        "name":    "Woodville Elementary School District",
        "type":    "district",
    }}
    record = build_opportunity_record(
        _opp([{"id": "ACC-2", "name": "Yuba City Unified School District"}]),
        sessions=[],
        district_mapping=mapping,
    )
    assert record["district_lea_id"] is None
    assert record["district_nces_id"] is None
    assert record["district_name"] == "Yuba City Unified School District"


def test_build_happy_path_matching_names_still_works():
    mapping = {"ACC-3": {
        "nces_id": "1304410",
        "leaid":   "1304410",
        "name":    "Rockdale County Public Schools",
        "type":    "district",
    }}
    record = build_opportunity_record(
        _opp([{"id": "ACC-3", "name": "Rockdale County School District"}]),
        sessions=[],
        district_mapping=mapping,
    )
    assert record["district_lea_id"] == "1304410"
```

- [ ] **Step 2: Run the tests — expect 3 failures**

```bash
python -m pytest tests/test_compute.py::test_build_strips_trailing_whitespace_from_nces tests/test_compute.py::test_build_rejects_name_mismatch_and_nulls_the_link tests/test_compute.py::test_build_happy_path_matching_names_still_works -v
```

Expected: first test fails with assertion on trailing space, second fails with assertion that lea_id is None but it's '0643170'.

- [ ] **Step 3: Modify `build_opportunity_record()` in compute.py**

Replace lines 93–115 (the `accounts` / `district_account` block) with the block below. Note that we also introduce a private `_match_status` field on the returned record — this is a signal for `run_sync.py` in Task 7 and is NOT a database column; Task 7 pops it before the upsert.

```python
    from scheduler.sync.district_resolver import names_match

    accounts = opp.get("accounts") or []
    opp_account_name = accounts[0].get("name") if accounts else None

    district_account = None
    match_status = "no_mapping"  # default when no account is in district_mapping
    for acc in accounts:
        acc_id = str(acc.get("id", ""))
        if acc_id and acc_id in district_mapping:
            mapped = district_mapping[acc_id]
            mapped_name = mapped.get("name")
            raw_nces = mapped.get("nces_id")
            raw_lea  = mapped.get("leaid")
            nces_id = raw_nces.strip() if isinstance(raw_nces, str) else raw_nces
            lea_id  = raw_lea.strip()  if isinstance(raw_lea,  str) else raw_lea

            # Guardrail against bug (b): if the account name on the opp doesn't
            # agree with the resolved district's name, refuse to trust the
            # mapping. The opp will fall into the unmatched path below.
            if not names_match(acc.get("name") or opp_account_name, mapped_name):
                match_status = "name_mismatch"
                continue

            candidate = {
                "district_name": mapped_name or acc.get("name"),
                "district_lms_id": acc_id,
                "district_nces_id": nces_id,
                "district_lea_id": lea_id,
            }
            if mapped.get("type") == "district":
                district_account = candidate
                match_status = "matched"
                break
            if district_account is None:
                district_account = candidate
                match_status = "matched"

    if district_account is None:
        district_account = {
            "district_name": opp_account_name,
            "district_lms_id": accounts[0].get("id") if accounts else None,
            "district_nces_id": None,
            "district_lea_id": None,
        }
```

Then refactor the bottom of `build_opportunity_record()` (currently lines 121–151, a single `return {...}` literal) into a two-step form so `_match_status` can be attached:

```python
    record = {
        "id": opp["id"],
        "name": opp.get("name"),
        "school_yr": opp.get("school_yr"),
        "contract_type": opp.get("contractType"),
        "state": normalize_state(opp.get("state")),
        "sales_rep_name": sales_rep.get("name"),
        "sales_rep_email": sales_rep.get("email"),
        "stage": opp.get("stage"),
        "net_booking_amount": _to_decimal(opp.get("net_booking_amount")),
        "close_date": opp.get("close_date"),
        "created_at": opp.get("created_at"),
        "brand_ambassador": opp.get("referring_contact_name"),
        "contract_through": opp.get("contracting_through"),
        "funding_through": opp.get("funding_through"),
        "payment_type": opp.get("payment_type"),
        "payment_terms": opp.get("payment_terms"),
        "lead_source": opp.get("lead_source"),
        "minimum_purchase_amount": _to_decimal(opp.get("minimum_purchase_amount")) if opp.get("minimum_purchase_amount") is not None else None,
        "maximum_budget": _to_decimal(opp.get("maximum_budget")) if opp.get("maximum_budget") is not None else None,
        "details_link": opp.get("detailsLink"),
        "stage_history": json.dumps(opp.get("stage_history") or []),
        "start_date": opp.get("start_date"),
        "expiration": opp.get("expiration"),
        "invoiced": invoiced,
        "credited": credited,
        **metrics,
        **district_account,
        "service_types": json.dumps(service_types),
        "synced_at": now,
    }
    record["_match_status"] = match_status
    return record
```

- [ ] **Step 4: Run the three new tests — expect pass**

```bash
python -m pytest tests/test_compute.py::test_build_strips_trailing_whitespace_from_nces tests/test_compute.py::test_build_rejects_name_mismatch_and_nulls_the_link tests/test_compute.py::test_build_happy_path_matching_names_still_works -v
```

Expected: 3 passed

- [ ] **Step 5: Run the full scheduler test suite to check for regressions**

```bash
python -m pytest tests/ -v
```

Expected: all existing tests still pass. If any existing `test_compute.py` fixture broke because it relied on the old permissive behavior, fix it — it's almost certainly a test that needs the `accounts[].name` key populated to match the mapped district name.

- [ ] **Step 6: Commit**

```bash
git add scheduler/sync/compute.py scheduler/tests/test_compute.py
git commit -m "fix(scheduler): strip whitespace + validate district name on ingest

Hardens build_opportunity_record() against bug (a) trailing-whitespace
NCES IDs and bug (b) typo'd leaids. When the CRM account mapping resolves
to a district whose name disagrees with the opp's stored account name,
we refuse the mapping and leave district_lea_id NULL so the opp flows
into unmatched_opportunities for manual review instead of being silently
mis-linked."
```

---

### Task 7: Classify the unmatched `reason` in `run_sync.py`

**Files:**
- Modify: `scheduler/run_sync.py:100-138` (the unmatched record build block)
- Modify: `scheduler/sync/supabase_writer.py:113-139` (strip the `_match_status` helper field)
- Modify: `scheduler/tests/test_run_sync.py`

`upsert_unmatched()` already reads `reason` as an ordinary column from the record dict (see `supabase_writer.py:118-121`), so no API change is needed there. All we're doing is: (1) classify the `reason` based on the `_match_status` field Task 6 added, (2) make sure the private `_match_status` field doesn't leak into the opportunities upsert path, and (3) test that a name-mismatch opp produces the correct `reason`.

- [ ] **Step 1: Write a failing test in `scheduler/tests/test_run_sync.py`**

Read the existing `test_run_sync.py` to find the fixture pattern it uses for mocking OpenSearch + Postgres. Append this test (adapt the imports/fixture names to match what's already there):

```python
def test_name_mismatch_opp_routes_to_unmatched_with_correct_reason(monkeypatch):
    """Yuba City opp with Woodville's NCES ID should land in unmatched
    with reason='Name/LEAID mismatch', not 'Needs Review'."""
    from scheduler.run_sync import _build_record_and_classify
    opp = {
        "id": "OPP-YUBA",
        "name": "Yuba City Tutoring",
        "accounts": [{"id": "ACC-YUBA", "name": "Yuba City Unified School District"}],
        "stage": "1 - Discovery",
        "school_yr": "2026-27",
        "invoices": [], "credit_memos": [], "sales_rep": {},
    }
    mapping = {"ACC-YUBA": {
        "nces_id": "0643170",
        "leaid":   "0643170",
        "name":    "Woodville Elementary School District",
        "type":    "district",
    }}
    record, unmatched = _build_record_and_classify(opp, [], mapping, now=None)
    assert record["district_lea_id"] is None
    assert unmatched is not None
    assert unmatched["reason"] == "Name/LEAID mismatch"
```

This test expects a new helper `_build_record_and_classify` in `run_sync.py` so the classification logic is testable without spinning up the whole sync pipeline.

- [ ] **Step 2: Run the test — expect import error**

```bash
cd /Users/sierraarcega/territory-plan/scheduler
python -m pytest tests/test_run_sync.py::test_name_mismatch_opp_routes_to_unmatched_with_correct_reason -v
```

Expected: `ImportError: cannot import name '_build_record_and_classify'`

- [ ] **Step 3: Extract a classification helper in `run_sync.py` and use the `_match_status` signal**

Replace the block in `scheduler/run_sync.py:103-132` (from `for h in opp_hits:` through `matched_records.append(record)`) with:

```python
        for h in opp_hits:
            opp = h["_source"]
            opp_sessions = sessions_by_opp.get(opp["id"], [])
            record, unmatched = _build_record_and_classify(
                opp, opp_sessions, district_mapping, now=now
            )

            # Check if unmatched but manually resolved
            if record["district_lea_id"] is None and opp["id"] in manual_resolutions:
                record["district_lea_id"] = manual_resolutions[opp["id"]]
                unmatched = None  # we just healed the mapping via manual resolution

            matched_records.append(record)
            if unmatched is not None:
                unmatched_records.append(unmatched)
```

Then add this helper function near the top of `run_sync.py` (after the imports, before the `main()` body):

```python
def _build_record_and_classify(opp, opp_sessions, district_mapping, now):
    """Build an opp record and, if the district didn't resolve, produce an
    unmatched_opportunities row with a reason classified from _match_status.

    Returns (record, unmatched_or_None). `_match_status` is stripped from
    the returned record so it never reaches the opportunities table.
    """
    record = build_opportunity_record(opp, opp_sessions, district_mapping, now=now)
    match_status = record.pop("_match_status", None)

    if record["district_lea_id"] is not None:
        return record, None

    if match_status == "name_mismatch":
        reason = "Name/LEAID mismatch"
    else:
        reason = "Needs Review"

    accounts = opp.get("accounts") or []
    first_acc = accounts[0] if accounts else {}
    unmatched = {
        "id": opp["id"],
        "name": opp.get("name"),
        "stage": opp.get("stage"),
        "school_yr": opp.get("school_yr"),
        "account_name": first_acc.get("name"),
        "account_lms_id": first_acc.get("id"),
        "account_type": first_acc.get("type"),
        "state": normalize_state(opp.get("state")),
        "net_booking_amount": record["net_booking_amount"],
        "reason": reason,
        "synced_at": now,
    }
    return record, unmatched
```

Make sure `normalize_state` is already imported in `run_sync.py` (it should be — it was used in the old inline block).

- [ ] **Step 4: Guard against `_match_status` leaking into the opportunities table**

Because `upsert_opportunities()` iterates `OPPORTUNITY_COLUMNS` (defined at `supabase_writer.py:21-35`) and pulls `record.get(c)` for each one, it already silently ignores extra keys like `_match_status`. Verify this by opening `scheduler/sync/supabase_writer.py:42-64` and confirming the `record.get(c) for c in cols` loop doesn't try to read unexpected keys. **No code change needed**, but the helper pops `_match_status` anyway (Step 3 above) to avoid any future code that might do `SELECT *` on the record dict.

- [ ] **Step 5: Run the new test — expect pass**

```bash
python -m pytest tests/test_run_sync.py::test_name_mismatch_opp_routes_to_unmatched_with_correct_reason -v
```

Expected: 1 passed

- [ ] **Step 6: Run the full scheduler test suite to check for regressions**

```bash
python -m pytest tests/ -v
```

Expected: all existing tests pass. If any test for `run_sync.py` broke because the old inline block was replaced, update the test to call the new `_build_record_and_classify` helper — the behavior is functionally the same for previously-matched opps.

- [ ] **Step 7: Commit**

```bash
git add scheduler/run_sync.py scheduler/tests/test_run_sync.py
git commit -m "feat(scheduler): classify unmatched reason as 'Name/LEAID mismatch'

Factors the unmatched-record construction in run_sync.py into a
testable helper _build_record_and_classify(), which reads the
_match_status signal that build_opportunity_record() now sets. Opps
rejected by the bug (b) name-validation guardrail get
reason='Name/LEAID mismatch' so the admin UI can triage them
separately from genuinely unmatched accounts."
```

---

## Phase 3 — Admin UI: Surface the New Reasons

### Task 8: Add the new reason values to the manual-reclassification dropdown

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx:187-194`

Background: the top filter dropdown on this page is populated dynamically from `facets.reasons` (see lines 91 and 1200) — the API `/api/admin/unmatched-opportunities/facets` returns the distinct `reason` values currently in the DB. So once Phase 1 and Phase 2 write rows with the new reasons, the filter dropdown will automatically show them.

**However**, the `UNRESOLVED_REASONS` const at lines 187–194 is used for the *manual reclassification* dropdown inside each row (when an ops person wants to change the reason on an existing row). That array is hardcoded and needs the new values added so ops can reclassify things into the new buckets.

- [ ] **Step 1: Modify the `UNRESOLVED_REASONS` const**

Open `src/app/admin/unmatched-opportunities/page.tsx`. Replace lines 187–194 with:

```typescript
const UNRESOLVED_REASONS = [
  "Needs Review",
  "Missing District",
  "Name/LEAID mismatch",
  "NCES-only link: name mismatch",
  "NCES-only link: unknown NCES",
  "Remove Child Opp",
  "Organization",
  "University",
  "Private/Charter",
] as const;
```

- [ ] **Step 2: Run type-check**

```bash
cd /Users/sierraarcega/territory-plan
npx tsc --noEmit
```

Expected: no errors. (If a consumer of `UNRESOLVED_REASONS[number]` does exhaustive switch, the compiler will flag the missing cases — add them there too.)

- [ ] **Step 3: Start the dev server and manually test**

```bash
npm run dev
```

Open `http://localhost:3005/admin/unmatched-opportunities` and verify:

1. The top filter dropdown shows the new reasons (populated automatically from facets, since Phase 1 Task 3 already inserted rows with those reasons). Filter by `"NCES-only link: name mismatch"` — the Yuba City opp `17592308838678` should appear in the list.
2. On any row, click the reason dropdown control — the five new reason options should appear in the reclassification menu.
3. Reclassifying a row to one of the new reasons should PATCH successfully (no network errors).

Stop the dev server when done (`Ctrl+C`).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): surface NCES-link mismatch reasons in reclassify menu

Adds 'Name/LEAID mismatch', 'NCES-only link: name mismatch', and
'NCES-only link: unknown NCES' to UNRESOLVED_REASONS so ops can
reclassify rows into these buckets. The top filter dropdown already
picks them up automatically via the facets endpoint."
```

---

## Phase 4 — Duplicate District Cleanup (Bug c)

### Task 9: Investigate why the Onamia ghost row has revenue

**Files:**
- Read-only SQL exploration

- [ ] **Step 1: Determine where `2721720`'s $213K came from**

```bash
psql "$DATABASE_URL" -c "
-- Does vendor_financials CSV still have a row for 2721720?
SELECT leaid, vendor, fiscal_year, total_revenue, last_updated
FROM district_financials
WHERE leaid = '2721720'
ORDER BY fiscal_year, vendor;

-- Any opps currently linked to 2721720?
SELECT COUNT(*) FROM opportunities
WHERE district_lea_id = '2721720' OR TRIM(district_nces_id) = '2721720';

-- Any sessions linked to an opp whose district is 2721720?
SELECT COUNT(*)
FROM sessions s
JOIN opportunities o ON o.id = s.opportunity_id
WHERE o.district_lea_id = '2721720' OR TRIM(o.district_nces_id) = '2721720';

-- Any subscriptions?
SELECT COUNT(*)
FROM subscriptions s
JOIN opportunities o ON o.id = s.opportunity_id
WHERE o.district_lea_id = '2721720' OR TRIM(o.district_nces_id) = '2721720';
" > /tmp/onamia_investigation.txt
cat /tmp/onamia_investigation.txt
```

- [ ] **Step 2: Interpret the output**

Three possible outcomes, each with a different cleanup strategy:

- **Outcome A: opps/sessions still linked to 2721720.** The ghost isn't a ghost — it's a second real district record. Treat it as bug (c) proper: merge opps to `2725050` first, then refresh financials, then delete the `2721720` financials row.
- **Outcome B: zero opps/sessions, but `district_financials.last_updated` is recent (< 24h).** `refresh_fullmind_financials()` is producing the row from somewhere we missed — probably via `vendor_financials.py` CSV import where a CSV row says `2721720` explicitly. Check `scripts/etl/loaders/vendor_financials.py` and any input CSV for that leaid.
- **Outcome C: zero opps/sessions, `last_updated` is old (> 7 days).** It's a stale residue from historical data. Safe to delete the ghost row directly.

Record which outcome you hit and proceed to Task 10 (Outcome A or C) or Task 9b (Outcome B).

- [ ] **Step 3: Commit the investigation notes**

```bash
# No code change, just capture findings in a commit comment on the next task.
```

---

### Task 9b (conditional): Trace the vendor_financials CSV path

Only if Task 9 Step 2 revealed **Outcome B**.

**Files:**
- Read: `scripts/etl/loaders/vendor_financials.py`
- Read: any referenced input CSV under `data/` or a cloud-storage path

- [ ] **Step 1: Find and inspect the CSV row for `2721720`**

If the input CSV has a row with `leaid = 2721720` and vendor `fullmind`, that's the source. Either:
- Correct the CSV at the source and re-import (preferred if someone maintains the CSV)
- Or add a dedup step to `vendor_financials.py` that skips rows whose `leaid` already has data under a different, customer-flagged leaid with the same district name

Document the decision in a commit message and proceed to Task 10.

---

### Task 10: Write the Onamia cleanup migration

**Files:**
- Create: `prisma/migrations/manual/2026-04-13_onamia_cleanup.sql`

- [ ] **Step 1: Write the cleanup SQL**

This migration is **Onamia-specific**. It is intentionally not generalized — different duplicate cases may need different merge rules, and an automatic "merge all duplicates" script is too risky.

```sql
-- 2026-04-13_onamia_cleanup.sql
-- Merge the ghost 'Onamia Public School District' (leaid 2721720) into the
-- canonical is_customer=true row (leaid 2725050). The ghost has Fullmind
-- revenue in district_financials but no underlying opps or sessions.

BEGIN;

-- 1. Any opportunities still pointing at the ghost? Redirect them to the canonical row.
UPDATE opportunities
   SET district_lea_id  = '2725050',
       district_nces_id = '2725050'
 WHERE district_lea_id = '2721720'
    OR TRIM(district_nces_id) = '2721720';

-- 2. Delete the ghost district_financials rows. refresh_fullmind_financials()
--    would eventually re-create them from opps, but since no opps are on
--    2721720 anymore, the row will simply stay gone.
DELETE FROM district_financials
 WHERE leaid = '2721720'
   AND vendor = 'fullmind';

-- 3. Re-run the financials refresh so 2725050 aggregates are correct.
SELECT refresh_fullmind_financials();

-- 4. Verify: 2721720 should have no rows in district_financials for fullmind;
--    2725050 should have FY26 revenue in the expected ballpark.
SELECT leaid, fiscal_year, total_revenue
  FROM district_financials
 WHERE leaid IN ('2721720', '2725050')
   AND vendor = 'fullmind'
 ORDER BY leaid, fiscal_year;

COMMIT;
```

- [ ] **Step 2: Run the migration**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/manual/2026-04-13_onamia_cleanup.sql
```

Expected output: `BEGIN`, `UPDATE 0` or small number, `DELETE 1` or `2` (FY26 + FY27), the refresh row, and the verification SELECT showing only `2725050` with FY26 revenue.

- [ ] **Step 3: Spot-check that the canonical Onamia row now shows combined data in the top-40 query**

```bash
psql "$DATABASE_URL" -c "
SELECT df.leaid, d.name, df.total_revenue
FROM district_financials df
JOIN districts d ON d.leaid = df.leaid
WHERE d.name ILIKE '%Onamia%' AND df.vendor='fullmind' AND df.fiscal_year='FY26';
"
```

Expected: a single row for `2725050`. The `2721720` row is gone.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/manual/2026-04-13_onamia_cleanup.sql
git commit -m "fix(db): merge ghost Onamia district row 2721720 into canonical 2725050

The districts table had two rows for 'Onamia Public School District'.
The ghost (2721720, is_customer=false) had \$213K FY26 Fullmind revenue
in district_financials despite having zero opps, sessions, or
subscriptions — stale residue from an earlier data state.

Redirects any stragglers to the canonical row, deletes the ghost
financials rows, and refreshes the aggregates."
```

---

### Task 11: Add a recurring duplicate-district audit query

**Files:**
- Create: `prisma/migrations/manual/2026-04-13_district_dedup_audit.sql`

This installs a view, not a migration. Nothing auto-runs — the view exists so operators can query `SELECT * FROM district_dedup_audit` on demand or hook it into a dashboard later.

- [ ] **Step 1: Write the view SQL**

```sql
-- 2026-04-13_district_dedup_audit.sql
-- Read-only audit view: districts whose normalized name is shared across
-- multiple leaids AND where more than one of those leaids has Fullmind
-- revenue in district_financials. These are candidates for a cleanup
-- pattern similar to the Onamia case.

CREATE OR REPLACE VIEW district_dedup_audit AS
WITH grouped AS (
  SELECT
    normalize_district_name(d.name) AS norm_name,
    d.leaid,
    d.name,
    d.state_abbrev,
    d.is_customer,
    COALESCE((
      SELECT SUM(total_revenue)
      FROM district_financials df
      WHERE df.leaid = d.leaid AND df.vendor = 'fullmind'
    ), 0) AS fullmind_lifetime_revenue
  FROM districts d
  WHERE d.name IS NOT NULL
),
dupes AS (
  SELECT norm_name
  FROM grouped
  WHERE fullmind_lifetime_revenue > 0
  GROUP BY norm_name
  HAVING COUNT(*) > 1
)
SELECT g.*
FROM grouped g
JOIN dupes x USING (norm_name)
ORDER BY g.norm_name, g.fullmind_lifetime_revenue DESC;

COMMENT ON VIEW district_dedup_audit IS
  'Duplicate-name districts with Fullmind revenue on >1 leaid. Run
   SELECT * FROM district_dedup_audit when triaging bug (c) cleanups.';
```

- [ ] **Step 2: Apply**

```bash
psql "$DATABASE_URL" -f prisma/migrations/manual/2026-04-13_district_dedup_audit.sql
```

- [ ] **Step 3: Run it and eyeball the output**

```bash
psql "$DATABASE_URL" -c "SELECT * FROM district_dedup_audit LIMIT 20;"
```

Expected: Onamia no longer appears (Task 10 cleaned it up). Any rows that do appear are candidates for the next round of human-reviewed cleanup — **don't** auto-fix them in this plan.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/manual/2026-04-13_district_dedup_audit.sql
git commit -m "feat(db): add district_dedup_audit view for bug (c) triage

Lists same-normalized-name districts where more than one leaid has
Fullmind revenue. Ops can check this periodically and run Onamia-style
merge cleanups for each pair."
```

---

## Phase 5 — Verification

### Task 12: Compare before/after snapshots and re-run top 40

**Files:**
- Read-only SQL

- [ ] **Step 1: Compare counts vs Task 0 Step 3 snapshot**

```bash
psql "$DATABASE_URL" -c "
SELECT
  COUNT(*) FILTER (WHERE district_lea_id IS NULL) AS null_lea_count,
  COUNT(*) FILTER (WHERE district_lea_id IS NULL AND district_nces_id IS NOT NULL) AS only_nces_count,
  COUNT(*) FILTER (WHERE district_nces_id <> TRIM(district_nces_id)) AS trailing_ws_count,
  (SELECT SUM(total_revenue)::numeric(15,2) FROM district_financials WHERE vendor='fullmind' AND fiscal_year='FY26') AS fy26_total
FROM opportunities;
" > /tmp/after_snapshot.txt
diff /tmp/before_snapshot.txt /tmp/after_snapshot.txt
```

Expected diff:
- `only_nces_count` drops to ~0–30 (just the rejected name-mismatch cases that went to unmatched_opportunities)
- `trailing_ws_count` drops to ~0
- `fy26_total` should be **approximately unchanged** — the backfill only affects leaid linkage, and the newly-linked opps mostly bring FY27 pipeline, not FY26 completed revenue. If FY26 total jumped by more than ~$2M, something double-counted; investigate before moving on.

- [ ] **Step 2: Re-run the "top 40 FY26" query WITHOUT any normalization hacks**

```bash
psql "$DATABASE_URL" -c "
WITH top40 AS (
  SELECT df.leaid, df.total_revenue, ROW_NUMBER() OVER (ORDER BY df.total_revenue DESC NULLS LAST) AS rank
  FROM district_financials df WHERE df.vendor='fullmind' AND df.fiscal_year='FY26'
  ORDER BY df.total_revenue DESC NULLS LAST LIMIT 40
),
pipe AS (
  SELECT district_lea_id AS leaid, COUNT(*) AS n, SUM(net_booking_amount)::numeric(15,2) AS total
  FROM opportunities
  WHERE stage IN ('0 - Meeting Booked','1 - Discovery','2 - Presentation','3 - Proposal','4 - Negotiation','5 - Commitment')
    AND school_yr = '2026-27'
  GROUP BY district_lea_id
)
SELECT t.rank, d.name, COALESCE(p.n, 0) AS fy27_opps, COALESCE(p.total, 0) AS fy27_booking
FROM top40 t
LEFT JOIN districts d ON d.leaid = t.leaid
LEFT JOIN pipe p ON p.leaid = t.leaid
ORDER BY t.rank;
"
```

Expected:
- **Richland School District 1** now shows FY27 opps > 0 (the 7 opps, ~$2.6M that were hiding before)
- **Hopi** and **Browning** also show FY27 opps where they didn't before
- Only Onamia (now a single row) and Poughkeepsie should still have 0 FY27 opps among the top 40 — and Poughkeepsie is a genuine gap, not a linking bug

- [ ] **Step 3: Re-run the "customers with no opps" query** and compare against the original 63-row export

```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*)
FROM (
  SELECT df.leaid FROM district_financials df
  WHERE df.vendor='fullmind' AND df.total_revenue > 0
  GROUP BY df.leaid
) customers
LEFT JOIN (
  SELECT DISTINCT district_lea_id AS leaid FROM opportunities WHERE district_lea_id IS NOT NULL
) o USING (leaid)
WHERE o.leaid IS NULL;
"
```

Expected: significantly fewer than 63 (dropped by ~20–30 rows that were NCES-only-linked historical customers whose opps are now correctly joined).

- [ ] **Step 4: If all three checks pass, merge the branch**

```bash
git checkout main
git merge --no-ff fix/opp-district-linking -m "Merge fix/opp-district-linking

Fixes three data quality bugs in opp↔district linking:
(a) 350 opps with NCES-only links → backfilled with name-match guardrail
(b) Typo'd leaids (Yuba City→Woodville) → rejected at ingest and backfill
(c) Onamia ghost district row → merged into canonical; audit view added"
git push origin main
```

- [ ] **Step 5: Monitor the next scheduler run** (within 1 hour, or manually trigger it)

```bash
# If you can manually invoke the sync:
python scheduler/run_sync.py --once 2>&1 | tail -50
```

Watch for:
- No new rows appearing with trailing whitespace in `district_nces_id`
- Any `Name/LEAID mismatch` rows in `unmatched_opportunities` that appear post-merge (they should be rare — most existing typos are already caught by the backfill)

---

## Done

At the end of this plan:

- Bug (a) is fixed historically (backfill) and prevented going forward (`.strip()` in compute.py)
- Bug (b) is detected at both backfill time (name-match guardrail in the UPDATE) and ingest time (`names_match()` in compute.py), and routed to unmatched_opportunities with a clear reason
- Bug (c) is cleaned up for the Onamia case, with a recurring audit view for future duplicates
- The top 40 analysis — and every similar report that joins opps to districts — returns complete data
- The admin UI has new filter options so ops can triage the rejected rows

Open follow-ups (intentionally left out of scope):
- The 795 opps with neither `district_lea_id` nor `district_nces_id` (the existing "unmatched" pile) still need manual resolution in the admin UI. This plan does not touch that pile.
- The `nces_edge.py` NCES loader still has no dedup logic. Duplicate districts from a future NCES SY25 release would re-create the kind of ghost rows we just cleaned up. Add a dedup pre-check the next time that loader is touched.
- The `district_dedup_audit` view is read-only; wiring it into a dashboard or alerting is a future task.
