# Phase 1: Schema Normalization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all new columns, FK references, and data migration scripts needed to normalize the database — without breaking the running app. Old columns stay. No code-level query changes.

**Architecture:** Additive-only schema changes. New columns are added alongside old ones. SQL migration scripts copy data from denormalized columns into normalized tables. Prisma schema is updated to expose new fields. Physical table/column renames that affect raw SQL are done only where consumers (ETL scripts) are updated in the same commit.

**Tech Stack:** PostgreSQL, Prisma ORM, Python (ETL scripts)

**Spec:** `docs/superpowers/specs/2026-04-01-db-normalization-claude-query-tool-design.md`

**Deviation from spec:** The `vendor_financials` → `district_financials` table rename is deferred to Phase 2. Renaming the physical table in Phase 1 would break raw SQL in 10 files and the running ETL. Instead, Phase 1 adds the new columns to the existing `vendor_financials` table, and Phase 2 renames the table + model when all raw SQL references are being updated anyway.

**Working directory:** `/Users/sierrastorm/thespot/territory-plan/.worktrees/db-normalization-query-tool`

---

### Task 1: Add new columns to VendorFinancials model

**Files:**
- Modify: `prisma/schema.prisma` (VendorFinancials model, lines 336-359)

- [ ] **Step 1: Add new financial columns to VendorFinancials**

In `prisma/schema.prisma`, find the `VendorFinancials` model (line 336) and add these fields before the `lastUpdated` line:

```prisma
  // New columns for FY data migration (from districts table)
  sessionCount        Int?     @default(0) @map("session_count")
  closedWonOppCount   Int?     @default(0) @map("closed_won_opp_count")
  openPipelineOppCount Int?    @default(0) @map("open_pipeline_opp_count")
  weightedPipeline    Decimal? @default(0) @map("weighted_pipeline") @db.Decimal(15, 2)
  // From competitor_spend merger
  poCount             Int?     @map("po_count")
```

- [ ] **Step 2: Add unmatched account FK to VendorFinancials**

Add after the `poCount` field:

```prisma
  // Optional FK — for financial data linked to unmatched accounts (no leaid)
  unmatchedAccountId  Int?     @map("unmatched_account_id")
  unmatchedAccount    UnmatchedAccount? @relation(fields: [unmatchedAccountId], references: [id])
```

Also change the `leaid` field from required to optional (since unmatched account rows won't have one):

```prisma
  leaid             String?  @db.VarChar(7)
```

Update the unique constraint to include unmatchedAccountId:

```prisma
  @@unique([leaid, vendor, fiscalYear])
  @@unique([unmatchedAccountId, vendor, fiscalYear])
```

And make the district relation optional:

```prisma
  district District? @relation(fields: [leaid], references: [leaid])
```

- [ ] **Step 3: Add inverse relation on UnmatchedAccount**

In the `UnmatchedAccount` model (line 385), add before the `@@index`:

```prisma
  financials VendorFinancials[]
```

- [ ] **Step 4: Verify schema compiles**

Run: `npx prisma generate`
Expected: "✔ Generated Prisma Client"

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add new columns to VendorFinancials for FY migration"
```

---

### Task 2: Add crm_name to UserProfile + person UUID FK columns

**Files:**
- Modify: `prisma/schema.prisma` (UserProfile, District, State, School, UnmatchedAccount, Opportunity models)

- [ ] **Step 1: Add crm_name to UserProfile**

In the `UserProfile` model (line 757), add after `bio`:

```prisma
  crmName           String?   @map("crm_name") @db.VarChar(100)
```

Add inverse relations for the new FK columns we're about to create. After `initiativeScores`:

```prisma
  // Inverse relations for normalized person FKs
  ownedDistricts       District[] @relation("DistrictOwner")
  assignedDistricts    District[] @relation("DistrictSalesExec")
  ownedStates          State[]    @relation("StateOwner")
  ownedSchools         School[]   @relation("SchoolOwner")
```

- [ ] **Step 2: Add UUID FK columns to District**

In the `District` model, add in the "User Edits" section (near line 160):

```prisma
  // Normalized person references (Phase 1: populated from string names)
  ownerId            String?   @map("owner_id") @db.Uuid
  salesExecutiveId   String?   @map("sales_executive_id") @db.Uuid
  ownerUser          UserProfile? @relation("DistrictOwner", fields: [ownerId], references: [id])
  salesExecutiveUser UserProfile? @relation("DistrictSalesExec", fields: [salesExecutiveId], references: [id])
```

Add indexes after existing ones:

```prisma
  @@index([ownerId])
  @@index([salesExecutiveId])
```

- [ ] **Step 3: Add UUID FK column to State**

In the `State` model (line 422), add after `territoryOwner`:

```prisma
  territoryOwnerId String?     @map("territory_owner_id") @db.Uuid
  territoryOwnerUser UserProfile? @relation("StateOwner", fields: [territoryOwnerId], references: [id])
```

- [ ] **Step 4: Add UUID FK column to School**

In the `School` model (line 1051), add after the existing `owner` field (line 1098):

```prisma
  ownerId        String?      @map("owner_id") @db.Uuid
  ownerUser      UserProfile? @relation("SchoolOwner", fields: [ownerId], references: [id])
```

- [ ] **Step 5: Add UUID FK column to UnmatchedAccount**

In the `UnmatchedAccount` model (line 385), add after `salesExecutive`:

```prisma
  salesExecutiveId String?     @map("sales_executive_id") @db.Uuid
```

Note: No Prisma relation here — UnmatchedAccount doesn't need a navigation property to UserProfile for now.

- [ ] **Step 6: Add UUID FK column to Opportunity**

In the `Opportunity` model (line 1215), add after `salesRepEmail`:

```prisma
  salesRepId     String?   @map("sales_rep_id") @db.Uuid
```

- [ ] **Step 7: Verify schema compiles**

Run: `npx prisma generate`
Expected: "✔ Generated Prisma Client"

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add crm_name and person UUID FK columns"
```

---

### Task 3: Add state_fips FK columns

**Files:**
- Modify: `prisma/schema.prisma` (School, UnmatchedAccount, Opportunity models)

- [ ] **Step 1: Add state_fips to School**

In the `School` model, add after `stateAbbrev` (line 1065):

```prisma
  stateFips          String?  @map("state_fips") @db.VarChar(2)
  stateRef           State?   @relation(fields: [stateFips], references: [fips])
```

Add the inverse relation on `State` model. In the relations section of `State` (around line 464), add:

```prisma
  schools        School[]
```

- [ ] **Step 2: Add state_fips to UnmatchedAccount**

In the `UnmatchedAccount` model, add after `stateAbbrev`:

```prisma
  stateFips          String?  @map("state_fips") @db.VarChar(2)
```

Add an index:

```prisma
  @@index([stateFips])
```

- [ ] **Step 3: Add state_fips to Opportunity**

In the `Opportunity` model, add after `state`:

```prisma
  stateFips          String?  @map("state_fips") @db.VarChar(2)
```

Add an index:

```prisma
  @@index([stateFips])
```

- [ ] **Step 4: Verify schema compiles**

Run: `npx prisma generate`
Expected: "✔ Generated Prisma Client"

- [ ] **Step 5: Run existing tests**

Run: `npx vitest run`
Expected: Same pass/fail counts as baseline (84 passed, 3 pre-existing failures)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add state_fips FK columns to schools, unmatched_accounts, opportunities"
```

---

### Task 4: Rename district_data_history columns + graduation_rate

**Files:**
- Modify: `prisma/schema.prisma` (DistrictDataHistory model lines 1154-1192, District model)
- Modify: `scripts/etl/loaders/historical_backfill.py`
- Modify: `scripts/etl/loaders/compute_benchmarks.py`

- [ ] **Step 1: Update DistrictDataHistory @map annotations**

In the `DistrictDataHistory` model, change these `@map` values:

```prisma
  // Old: expenditurePp    Decimal? @map("expenditure_pp") @db.Decimal(12, 2)
  expenditurePp    Decimal? @map("expenditure_per_pupil") @db.Decimal(12, 2)

  // Old: spedExpenditure  Decimal? @map("sped_expenditure") @db.Decimal(15, 2)
  spedExpenditure  Decimal? @map("sped_expenditure_total") @db.Decimal(15, 2)

  // Old: povertyPct      Decimal? @map("poverty_pct") @db.Decimal(5, 2)
  povertyPct      Decimal? @map("poverty_percent") @db.Decimal(5, 2)

  // Old: mathProficiency Decimal? @map("math_proficiency") @db.Decimal(5, 2)
  mathProficiency Decimal? @map("math_proficiency_pct") @db.Decimal(5, 2)

  // Old: readProficiency Decimal? @map("read_proficiency") @db.Decimal(5, 2)
  readProficiency Decimal? @map("read_proficiency_pct") @db.Decimal(5, 2)
```

Note: `graduation_rate` stays as-is — it's already the correct name on district_data_history.

- [ ] **Step 2: Update District graduation_rate_total @map**

In the `District` model, change:

```prisma
  // Old: graduationRateTotal Decimal? @map("graduation_rate_total") @db.Decimal(5, 2)
  graduationRateTotal Decimal? @map("graduation_rate") @db.Decimal(5, 2)
```

Keep the Prisma field name `graduationRateTotal` for now — renaming it would break 8 app files. That's a Phase 2 change.

- [ ] **Step 3: Verify schema compiles**

Run: `npx prisma generate`
Expected: "✔ Generated Prisma Client"

- [ ] **Step 4: Commit schema changes**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): rename district_data_history columns and graduation_rate_total"
```

---

### Task 5: Write DDL migration SQL

**Files:**
- Create: `prisma/migrations/manual/phase1_schema_normalization_ddl.sql`

This SQL file will be run manually against Supabase. It makes all schema changes in one transaction.

- [ ] **Step 1: Write the DDL migration file**

```sql
-- Phase 1: Schema Normalization — DDL Changes
-- Run this BEFORE deploying the updated Prisma schema.
-- All changes are additive (new columns, renamed columns). No drops.

BEGIN;

-- =====================================================
-- 1. Add new columns to vendor_financials
-- =====================================================
ALTER TABLE vendor_financials
  ADD COLUMN IF NOT EXISTS session_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_won_opp_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_pipeline_opp_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weighted_pipeline DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS po_count INT,
  ADD COLUMN IF NOT EXISTS unmatched_account_id INT REFERENCES unmatched_accounts(id);

-- Make leaid nullable (for unmatched account rows)
ALTER TABLE vendor_financials ALTER COLUMN leaid DROP NOT NULL;

-- Add unique constraint for unmatched account financials
-- (NULLs are distinct in PostgreSQL unique indexes, so this won't conflict
-- with district rows where unmatched_account_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vf_unmatched_vendor_fy
  ON vendor_financials (unmatched_account_id, vendor, fiscal_year);

-- Check constraint: exactly one of leaid/unmatched_account_id must be set
ALTER TABLE vendor_financials
  ADD CONSTRAINT chk_vf_leaid_or_unmatched
  CHECK (
    (leaid IS NOT NULL AND unmatched_account_id IS NULL) OR
    (leaid IS NULL AND unmatched_account_id IS NOT NULL)
  );

-- =====================================================
-- 2. Add crm_name to user_profiles
-- =====================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS crm_name VARCHAR(100);

-- =====================================================
-- 3. Add person UUID FK columns
-- =====================================================

-- Districts
ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS sales_executive_id UUID REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_districts_owner_id ON districts(owner_id);
CREATE INDEX IF NOT EXISTS idx_districts_sales_exec_id ON districts(sales_executive_id);

-- States
ALTER TABLE states
  ADD COLUMN IF NOT EXISTS territory_owner_id UUID REFERENCES user_profiles(id);

-- Schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id);

-- Unmatched accounts
ALTER TABLE unmatched_accounts
  ADD COLUMN IF NOT EXISTS sales_executive_id UUID REFERENCES user_profiles(id);

-- Opportunities
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES user_profiles(id);

-- =====================================================
-- 4. Add state_fips FK columns
-- =====================================================

-- Schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS state_fips VARCHAR(2) REFERENCES states(fips);

-- Unmatched accounts
ALTER TABLE unmatched_accounts
  ADD COLUMN IF NOT EXISTS state_fips VARCHAR(2) REFERENCES states(fips);

CREATE INDEX IF NOT EXISTS idx_unmatched_state_fips ON unmatched_accounts(state_fips);

-- Opportunities
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS state_fips VARCHAR(2) REFERENCES states(fips);

CREATE INDEX IF NOT EXISTS idx_opportunities_state_fips ON opportunities(state_fips);

-- =====================================================
-- 5. Rename district_data_history columns
-- =====================================================
ALTER TABLE district_data_history
  RENAME COLUMN expenditure_pp TO expenditure_per_pupil;

ALTER TABLE district_data_history
  RENAME COLUMN sped_expenditure TO sped_expenditure_total;

ALTER TABLE district_data_history
  RENAME COLUMN poverty_pct TO poverty_percent;

ALTER TABLE district_data_history
  RENAME COLUMN math_proficiency TO math_proficiency_pct;

ALTER TABLE district_data_history
  RENAME COLUMN read_proficiency TO read_proficiency_pct;

-- =====================================================
-- 6. Rename graduation_rate_total on districts
-- =====================================================
ALTER TABLE districts
  RENAME COLUMN graduation_rate_total TO graduation_rate;

COMMIT;

-- Verify
SELECT 'DDL migration complete' AS status;
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'vendor_financials'
  AND column_name IN ('session_count', 'closed_won_opp_count', 'open_pipeline_opp_count',
                       'weighted_pipeline', 'po_count', 'unmatched_account_id')
  ORDER BY column_name;
```

- [ ] **Step 2: Commit**

```bash
git add prisma/migrations/manual/phase1_schema_normalization_ddl.sql
git commit -m "feat(migration): Phase 1 DDL — add columns, FKs, rename columns"
```

---

### Task 6: Write DML migration — FY data to vendor_financials

**Files:**
- Create: `prisma/migrations/manual/phase1_migrate_fy_data.sql`

- [ ] **Step 1: Write the FY data migration**

This copies the 18 FY-specific columns from `districts` into `vendor_financials` rows (vendor='fullmind').

```sql
-- Phase 1: Migrate FY columns from districts → vendor_financials
-- Only inserts rows that don't already exist (ON CONFLICT DO NOTHING)
-- Existing vendor_financials data from the CSV ETL takes precedence.

BEGIN;

-- FY25 data
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  total_revenue, all_take, session_count,
  closed_won_opp_count, closed_won_bookings, invoicing
)
SELECT
  d.leaid, 'fullmind', 'FY25',
  COALESCE(d.fy25_sessions_revenue, 0),
  COALESCE(d.fy25_sessions_take, 0),
  COALESCE(d.fy25_sessions_count, 0),
  COALESCE(d.fy25_closed_won_opp_count, 0),
  COALESCE(d.fy25_closed_won_net_booking, 0),
  COALESCE(d.fy25_net_invoicing, 0)
FROM districts d
WHERE d.fy25_sessions_revenue IS NOT NULL
   OR d.fy25_sessions_take IS NOT NULL
   OR d.fy25_sessions_count IS NOT NULL
   OR d.fy25_closed_won_opp_count IS NOT NULL
   OR d.fy25_closed_won_net_booking IS NOT NULL
   OR d.fy25_net_invoicing IS NOT NULL
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  session_count = COALESCE(EXCLUDED.session_count, vendor_financials.session_count),
  closed_won_opp_count = COALESCE(EXCLUDED.closed_won_opp_count, vendor_financials.closed_won_opp_count);

-- FY26 data (sessions + bookings + pipeline)
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  total_revenue, all_take, session_count,
  closed_won_opp_count, closed_won_bookings, invoicing,
  open_pipeline_opp_count, open_pipeline, weighted_pipeline
)
SELECT
  d.leaid, 'fullmind', 'FY26',
  COALESCE(d.fy26_sessions_revenue, 0),
  COALESCE(d.fy26_sessions_take, 0),
  COALESCE(d.fy26_sessions_count, 0),
  COALESCE(d.fy26_closed_won_opp_count, 0),
  COALESCE(d.fy26_closed_won_net_booking, 0),
  COALESCE(d.fy26_net_invoicing, 0),
  COALESCE(d.fy26_open_pipeline_opp_count, 0),
  COALESCE(d.fy26_open_pipeline, 0),
  COALESCE(d.fy26_open_pipeline_weighted, 0)
FROM districts d
WHERE d.fy26_sessions_revenue IS NOT NULL
   OR d.fy26_closed_won_opp_count IS NOT NULL
   OR d.fy26_open_pipeline IS NOT NULL
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  session_count = COALESCE(EXCLUDED.session_count, vendor_financials.session_count),
  closed_won_opp_count = COALESCE(EXCLUDED.closed_won_opp_count, vendor_financials.closed_won_opp_count),
  open_pipeline_opp_count = COALESCE(EXCLUDED.open_pipeline_opp_count, vendor_financials.open_pipeline_opp_count),
  weighted_pipeline = COALESCE(EXCLUDED.weighted_pipeline, vendor_financials.weighted_pipeline);

-- FY27 data (pipeline only)
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  open_pipeline_opp_count, open_pipeline, weighted_pipeline
)
SELECT
  d.leaid, 'fullmind', 'FY27',
  COALESCE(d.fy27_open_pipeline_opp_count, 0),
  COALESCE(d.fy27_open_pipeline, 0),
  COALESCE(d.fy27_open_pipeline_weighted, 0)
FROM districts d
WHERE d.fy27_open_pipeline IS NOT NULL
   OR d.fy27_open_pipeline_opp_count IS NOT NULL
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  open_pipeline_opp_count = COALESCE(EXCLUDED.open_pipeline_opp_count, vendor_financials.open_pipeline_opp_count),
  weighted_pipeline = COALESCE(EXCLUDED.weighted_pipeline, vendor_financials.weighted_pipeline);

COMMIT;

-- Verify: compare row counts
SELECT 'FY data migration complete' AS status;
SELECT fiscal_year, COUNT(*) AS rows
FROM vendor_financials
WHERE vendor = 'fullmind'
GROUP BY fiscal_year
ORDER BY fiscal_year;
```

- [ ] **Step 2: Commit**

```bash
git add prisma/migrations/manual/phase1_migrate_fy_data.sql
git commit -m "feat(migration): Phase 1 DML — migrate FY columns to vendor_financials"
```

---

### Task 7: Write DML migration — merge competitor_spend + unmatched accounts

**Files:**
- Create: `prisma/migrations/manual/phase1_merge_competitor_and_unmatched.sql`

- [ ] **Step 1: Write the competitor_spend + unmatched accounts migration**

```sql
-- Phase 1: Merge competitor_spend into vendor_financials
-- and migrate unmatched_accounts FY data

BEGIN;

-- =====================================================
-- 1. Copy competitor_spend → vendor_financials
-- =====================================================
-- Map competitor names to the short vendor IDs used in vendor_financials
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  total_revenue, po_count
)
SELECT
  cs.leaid,
  CASE cs.competitor
    WHEN 'Proximity Learning' THEN 'proximity'
    WHEN 'Elevate K12' THEN 'elevate'
    WHEN 'Tutored By Teachers' THEN 'tbt'
    ELSE LOWER(REPLACE(cs.competitor, ' ', '_'))
  END AS vendor,
  cs.fiscal_year,
  cs.total_spend,
  cs.po_count
FROM competitor_spend cs
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  total_revenue = GREATEST(vendor_financials.total_revenue, EXCLUDED.total_revenue),
  po_count = COALESCE(EXCLUDED.po_count, vendor_financials.po_count);

-- =====================================================
-- 2. Migrate unmatched_accounts FY data
-- =====================================================
-- FY25 invoicing
INSERT INTO vendor_financials (
  unmatched_account_id, vendor, fiscal_year, invoicing
)
SELECT
  ua.id, 'fullmind', 'FY25', ua.fy25_net_invoicing
FROM unmatched_accounts ua
WHERE ua.fy25_net_invoicing > 0
ON CONFLICT (unmatched_account_id, vendor, fiscal_year) DO UPDATE SET
  invoicing = EXCLUDED.invoicing;

-- FY26 invoicing + pipeline
INSERT INTO vendor_financials (
  unmatched_account_id, vendor, fiscal_year, invoicing, open_pipeline
)
SELECT
  ua.id, 'fullmind', 'FY26', ua.fy26_net_invoicing, ua.fy26_open_pipeline
FROM unmatched_accounts ua
WHERE ua.fy26_net_invoicing > 0 OR ua.fy26_open_pipeline > 0
ON CONFLICT (unmatched_account_id, vendor, fiscal_year) DO UPDATE SET
  invoicing = EXCLUDED.invoicing,
  open_pipeline = EXCLUDED.open_pipeline;

-- FY27 pipeline
INSERT INTO vendor_financials (
  unmatched_account_id, vendor, fiscal_year, open_pipeline
)
SELECT
  ua.id, 'fullmind', 'FY27', ua.fy27_open_pipeline
FROM unmatched_accounts ua
WHERE ua.fy27_open_pipeline > 0
ON CONFLICT (unmatched_account_id, vendor, fiscal_year) DO UPDATE SET
  open_pipeline = EXCLUDED.open_pipeline;

COMMIT;

-- Verify
SELECT 'Competitor + unmatched migration complete' AS status;

SELECT 'competitor_spend rows' AS source, COUNT(*) AS original FROM competitor_spend
UNION ALL
SELECT 'vendor_financials (non-fullmind)' AS source, COUNT(*) FROM vendor_financials WHERE vendor != 'fullmind'
UNION ALL
SELECT 'vendor_financials (unmatched)' AS source, COUNT(*) FROM vendor_financials WHERE unmatched_account_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add prisma/migrations/manual/phase1_merge_competitor_and_unmatched.sql
git commit -m "feat(migration): Phase 1 DML — merge competitor_spend and unmatched FY data"
```

---

### Task 8: Write DML migration — populate FK columns

**Files:**
- Create: `prisma/migrations/manual/phase1_populate_fks.sql`

- [ ] **Step 1: Write the FK population migration**

```sql
-- Phase 1: Populate new FK columns from existing string data
-- Run AFTER seeding crm_name on user_profiles.

BEGIN;

-- =====================================================
-- 1. Populate state_fips from state_abbrev lookups
-- =====================================================

-- Schools: state_abbrev → state_fips via states table
UPDATE schools s
SET state_fips = st.fips
FROM states st
WHERE UPPER(s.state_abbrev) = st.abbrev
  AND s.state_fips IS NULL;

-- Unmatched accounts: state_abbrev → state_fips
UPDATE unmatched_accounts ua
SET state_fips = st.fips
FROM states st
WHERE UPPER(ua.state_abbrev) = st.abbrev
  AND ua.state_fips IS NULL;

-- Opportunities: free-text state → state_fips
-- state column may contain full name ("California") or abbrev ("CA")
UPDATE opportunities o
SET state_fips = st.fips
FROM states st
WHERE (UPPER(o.state) = st.abbrev OR LOWER(o.state) = LOWER(st.name))
  AND o.state_fips IS NULL;

-- =====================================================
-- 2. Populate person UUID FKs from crm_name matching
-- =====================================================
-- Requires crm_name to be seeded on user_profiles first.
-- Match is case-insensitive on trimmed names.

-- Districts: sales_executive → sales_executive_id
UPDATE districts d
SET sales_executive_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(d.sales_executive)) = LOWER(TRIM(up.crm_name))
  AND d.sales_executive IS NOT NULL
  AND d.sales_executive_id IS NULL;

-- Districts: owner → owner_id
UPDATE districts d
SET owner_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(d.owner)) = LOWER(TRIM(up.crm_name))
  AND d.owner IS NOT NULL
  AND d.owner_id IS NULL;

-- States: territory_owner → territory_owner_id
UPDATE states s
SET territory_owner_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(s.territory_owner)) = LOWER(TRIM(up.crm_name))
  AND s.territory_owner IS NOT NULL
  AND s.territory_owner_id IS NULL;

-- Schools: owner → owner_id
UPDATE schools sc
SET owner_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(sc.owner)) = LOWER(TRIM(up.crm_name))
  AND sc.owner IS NOT NULL
  AND sc.owner_id IS NULL;

-- Unmatched accounts: sales_executive → sales_executive_id
UPDATE unmatched_accounts ua
SET sales_executive_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(ua.sales_executive)) = LOWER(TRIM(up.crm_name))
  AND ua.sales_executive IS NOT NULL
  AND ua.sales_executive_id IS NULL;

-- Opportunities: sales_rep_email → sales_rep_id (match on email, more reliable)
UPDATE opportunities o
SET sales_rep_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(o.sales_rep_email)) = LOWER(TRIM(up.email))
  AND o.sales_rep_email IS NOT NULL
  AND o.sales_rep_id IS NULL;

COMMIT;

-- =====================================================
-- Verify: show match rates
-- =====================================================
SELECT 'state_fips population' AS metric,
  (SELECT COUNT(*) FROM schools WHERE state_fips IS NOT NULL) AS schools_matched,
  (SELECT COUNT(*) FROM schools WHERE state_abbrev IS NOT NULL) AS schools_total,
  (SELECT COUNT(*) FROM unmatched_accounts WHERE state_fips IS NOT NULL) AS ua_matched,
  (SELECT COUNT(*) FROM unmatched_accounts) AS ua_total,
  (SELECT COUNT(*) FROM opportunities WHERE state_fips IS NOT NULL) AS opps_matched,
  (SELECT COUNT(*) FROM opportunities WHERE state IS NOT NULL) AS opps_total;

SELECT 'person UUID population' AS metric,
  (SELECT COUNT(*) FROM districts WHERE sales_executive_id IS NOT NULL) AS districts_se_matched,
  (SELECT COUNT(*) FROM districts WHERE sales_executive IS NOT NULL) AS districts_se_total,
  (SELECT COUNT(*) FROM districts WHERE owner_id IS NOT NULL) AS districts_owner_matched,
  (SELECT COUNT(*) FROM districts WHERE owner IS NOT NULL) AS districts_owner_total,
  (SELECT COUNT(*) FROM opportunities WHERE sales_rep_id IS NOT NULL) AS opps_matched,
  (SELECT COUNT(*) FROM opportunities WHERE sales_rep_email IS NOT NULL) AS opps_total;
```

- [ ] **Step 2: Commit**

```bash
git add prisma/migrations/manual/phase1_populate_fks.sql
git commit -m "feat(migration): Phase 1 DML — populate state and person FK columns"
```

---

### Task 9: Update ETL scripts for renamed columns

**Files:**
- Modify: `scripts/etl/loaders/historical_backfill.py`
- Modify: `scripts/etl/loaders/compute_benchmarks.py`

- [ ] **Step 1: Find and update column references in historical_backfill.py**

Search for the old column names and replace with new names:

```bash
cd /Users/sierrastorm/thespot/territory-plan/.worktrees/db-normalization-query-tool
grep -n 'expenditure_pp\|sped_expenditure\b\|poverty_pct\|math_proficiency\b\|read_proficiency\b' scripts/etl/loaders/historical_backfill.py
```

Replace all occurrences:
- `expenditure_pp` → `expenditure_per_pupil`
- `sped_expenditure` → `sped_expenditure_total` (be careful not to match `sped_expenditure_total` which is already correct)
- `poverty_pct` → `poverty_percent`
- `math_proficiency` → `math_proficiency_pct` (be careful not to match `math_proficiency_pct` which is already correct)
- `read_proficiency` → `read_proficiency_pct` (same caution)

- [ ] **Step 2: Find and update column references in compute_benchmarks.py**

Same search and replace:

```bash
grep -n 'expenditure_pp\|sped_expenditure\b\|poverty_pct\|math_proficiency\b\|read_proficiency\b' scripts/etl/loaders/compute_benchmarks.py
```

Apply the same replacements.

- [ ] **Step 3: Search for any other scripts referencing old column names**

```bash
grep -rn 'expenditure_pp\|poverty_pct' scripts/etl/ --include='*.py'
```

Update any remaining references.

- [ ] **Step 4: Commit**

```bash
git add scripts/etl/
git commit -m "fix(etl): update column names for district_data_history renames"
```

---

### Task 10: Generate Prisma client + final verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Generate Prisma client**

Run: `npx prisma generate`
Expected: "✔ Generated Prisma Client"

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: Same baseline results (84 passed, 3 pre-existing failures). No new failures.

If there ARE new failures, they are likely caused by the Prisma @map changes for `graduation_rate_total` → `graduation_rate`. Since the DB column doesn't exist yet (migration hasn't run), any test that hits the actual database would fail. But Vitest tests in this project use mocks/jsdom, not a real database, so this should not be an issue.

- [ ] **Step 3: Verify all migration files exist**

```bash
ls -la prisma/migrations/manual/phase1_*
```

Expected files:
- `phase1_schema_normalization_ddl.sql`
- `phase1_migrate_fy_data.sql`
- `phase1_merge_competitor_and_unmatched.sql`
- `phase1_populate_fks.sql`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 schema normalization complete — ready for manual SQL execution"
```

---

## Execution Order (for production)

After this plan is implemented and the code is deployed:

1. **Seed crm_name on user_profiles** — Manually set `crm_name` for each sales team member in Supabase
2. **Run DDL migration** — `phase1_schema_normalization_ddl.sql`
3. **Deploy code** — Updated Prisma schema expects renamed columns + new columns
4. **Run FY data migration** — `phase1_migrate_fy_data.sql`
5. **Run competitor + unmatched migration** — `phase1_merge_competitor_and_unmatched.sql`
6. **Run FK population** — `phase1_populate_fks.sql`
7. **Verify** — Check match rates from verification queries

Steps 4-6 can run at any time after step 3. The app works with or without the migrated data (old columns still exist and are still read).

## What's Next

After Phase 1 is validated in production:
- **Plan 2: App Query Migration (Phase 2a)** — Update 50+ app files to read from new schema
- **Plan 3: Claude Query Tool (Phase 2b)** — Build the query engine + UI
- **Plan 4: Cleanup (Phase 3)** — Drop old columns, tables, views
