# Database Normalization & Claude Query Tool

**Date:** 2026-04-01
**Status:** Phase 2a complete (query migration), Phase 2b planned (person FK + competitor migration), Query tool not started
**Branch:** `feat/db-normalization-query-tool`

## Summary

Normalize the database schema to eliminate redundant fiscal-year columns, inconsistent naming, and fragmented financial data. Then build an in-app Claude-powered natural language query tool that generates SQL against the clean schema, replacing the materialized-view-based report builder approach. Architecture supports a future MCP tool with zero duplication.

## Motivation

- The `districts` table has 18 FY-specific columns (`fy25_sessions_revenue`, `fy26_open_pipeline`, etc.) that require schema changes every fiscal year
- Financial data is duplicated across `districts` FY columns, `vendor_financials`, and the `district_opportunity_actuals` materialized view
- `competitor_spend` and `vendor_financials` overlap for competitor data
- Person references (owner, sales_executive) are stored as free-text strings in some tables and UUIDs in others
- State references use three different patterns (`state_fips` FK, `state_abbrev`, `state_location`)
- Column names for the same concept differ across tables (`expenditure_pp` vs `expenditure_per_pupil`)
- The report builder worktree uses materialized views and single-entity Prisma queries — can't join across entities

## Part 1: Database Normalization

### 1a. Migrate FY columns to `district_financials`

Rename `vendor_financials` → `district_financials`. Extract the 18 FY-specific columns from `districts` into rows:

| Districts column | district_financials field | Notes |
|---|---|---|
| `fy25_sessions_revenue` | `total_revenue` (vendor=fullmind, FY=FY25) | |
| `fy25_sessions_take` | `all_take` | |
| `fy25_sessions_count` | `session_count` | **New column** |
| `fy25_closed_won_opp_count` | `closed_won_opp_count` | **New column** |
| `fy25_closed_won_net_booking` | `closed_won_bookings` | |
| `fy25_net_invoicing` | `invoicing` | |
| `fy26_open_pipeline_opp_count` | `open_pipeline_opp_count` | **New column** |
| `fy26_open_pipeline` | `open_pipeline` | |
| `fy26_open_pipeline_weighted` | `weighted_pipeline` | **New column** |

Same pattern for FY26 and FY27 columns. The `is_customer` and `has_open_pipeline` boolean flags stay on `districts` — they're computed flags used for fast map filtering/indexing, not fiscal-year data.

New columns added to `district_financials`:
- `session_count` INT
- `closed_won_opp_count` INT
- `open_pipeline_opp_count` INT
- `weighted_pipeline` DECIMAL(15,2)
- `po_count` INT (from competitor_spend merger, see 1f)

### 1b. Normalize person references

Current state — "who owns this" stored inconsistently:

| Table.column | Current | Target |
|---|---|---|
| `districts.owner` | VARCHAR(100) name | `owner_id` UUID FK → user_profiles |
| `districts.sales_executive` | VARCHAR(100) name | `sales_executive_id` UUID FK → user_profiles |
| `unmatched_accounts.sales_executive` | VARCHAR(100) name | `sales_executive_id` UUID FK → user_profiles |
| `states.territory_owner` | VARCHAR(100) name | `territory_owner_id` UUID FK → user_profiles |
| `schools.owner` | VARCHAR(100) name | `owner_id` UUID FK → user_profiles |
| `opportunities.sales_rep_name/email` | Text fields | `sales_rep_id` UUID FK → user_profiles (keep text as fallback) |
| `territory_plans.owner_id` | UUID FK | Already correct |
| `map_views.owner_id` | UUID FK | Already correct |

Add `crm_name` VARCHAR(100) to `user_profiles` so the ETL can match CRM names (e.g., "Jane Smith") to user UUIDs. The sales team is small and known, so this mapping is seeded once and maintained manually.

### 1c. Normalize state references

Establish `state_fips` FK as the canonical state reference everywhere. `state_abbrev` stays on `districts` as a **denormalized cache** (it's indexed 3 ways and used in nearly every map/filter query — joining through `states` for every `WHERE state = 'NY'` would be a real performance hit). But it should be treated as derived from the FK, not set independently.

Changes to `districts`:
- Keep `state_fips` (FK to states) as the canonical reference
- Keep `state_abbrev` as denormalized cache (populated from states FK during ETL, not set independently)
- Drop `state_location` — fully redundant with `state_abbrev`

Add proper state FKs to other tables:
- `schools`: add `state_fips` FK, keep `state_abbrev` as cache (same perf reasoning)
- `unmatched_accounts`: add `state_fips` FK, drop `state_abbrev` (small table, join is fine)
- `opportunities`: add `state_fips` FK, keep `state` text as fallback for unmatched data

### 1d. Column naming cleanup

Normalize names across `district_data_history` to match `districts`:

| Current (district_data_history) | Rename to | Matches districts column |
|---|---|---|
| `expenditure_pp` | `expenditure_per_pupil` | `expenditure_per_pupil` |
| `poverty_pct` | `poverty_percent` | `children_poverty_percent` |
| `graduation_rate` | `graduation_rate` | `graduation_rate_total` → also rename to `graduation_rate` |
| `math_proficiency` | `math_proficiency_pct` | `math_proficiency_pct` |
| `read_proficiency` | `read_proficiency_pct` | `read_proficiency_pct` |
| `sped_expenditure` | `sped_expenditure_total` | `sped_expenditure_total` |

Also rename `districts.graduation_rate_total` → `graduation_rate` for consistency.

### 1e. Unmatched accounts FY fields

`unmatched_accounts` has FY-specific columns (`fy25_net_invoicing`, `fy26_net_invoicing`, `fy26_open_pipeline`, `fy27_open_pipeline`). Since these accounts don't have a `leaid`, add an optional `unmatched_account_id` FK to `district_financials`:

- Unique constraint: `(leaid, unmatched_account_id, vendor, fiscal_year)`
- Check constraint: exactly one of `leaid` / `unmatched_account_id` is set
- Drop the FY columns from `unmatched_accounts`

### 1f. Financial data consolidation

**`district_financials` becomes the single source of truth** for aggregated financial metrics.

Merge `competitor_spend` into `district_financials`:
- `competitor_spend.total_spend` → `district_financials.total_revenue`
- `competitor_spend.po_count` → `district_financials.po_count` (new column)
- `competitor_spend.competitor` → `district_financials.vendor`
- Drop `competitor_spend` table after migration

**Data flow after normalization:**

```
Customer Book CSV ──→ district_financials (all vendors, all FYs)
Railway Docker ─────→ opportunities (raw Fullmind deals, unchanged)
GovSpend POs ───────→ district_financials (competitors, via existing ETL)
```

**Opportunities vs district_financials — separate concerns:**
- `opportunities` = raw deal-level records from CRM. Column names reflect source system (`net_booking_amount`, `completed_revenue`, `stage`).
- `district_financials` = aggregated metrics per vendor/district/FY. Column names reflect aggregated meaning (`closed_won_bookings`, `delivered_revenue`, `open_pipeline`).
- These are not 1:1 mappings. The semantic schema reference (Part 2) bridges the conceptual gap for Claude.

**Materialized views after normalization:**
- `district_opportunity_actuals` — **keep (revised).** Originally planned to drop, but this view aggregates raw opportunities by rep + category (renewal/expansion/winback/new) — data that `district_financials` can't provide because it has no `sales_rep_email` or deal-level category columns. Used by profile goals, leaderboard rank, and team-progress dashboards. Long-term, consider consolidating the duplicate aggregation logic between this view and `refresh_fullmind_financials()` (both compute from the same source with the same stage weighting).
- `district_vendor_comparison` — **drop.** Claude generates equivalent SQL on demand.
- `district_map_features` — **keep** but update to join `district_financials`. This serves MapLibre tile rendering, which needs pre-computed geometry data for performance. **Done (Phase 2a).**

## Part 2: Claude Query Tool

### 2a. Semantic Schema Reference

A YAML config file (`src/features/reports/lib/schema-reference.yaml`) that tells Claude what each table is, what columns mean, how tables relate, and how concepts map across tables.

Structure:
```yaml
tables:
  districts:
    description: "~13K US school districts with demographics, education metrics, staffing, ICP scores"
    primary_key: leaid
    relationships:
      - table: district_financials
        join: "district_financials.leaid = districts.leaid"
        description: "Financial data by vendor and fiscal year"
      - table: opportunities
        join: "opportunities.district_lea_id = districts.leaid"
        description: "Individual Fullmind deal records"
      - table: activity_districts
        join: "activity_districts.district_leaid = districts.leaid"
        description: "Junction to activities (join activities via activity_districts.activity_id)"
      - table: contacts
        join: "contacts.leaid = districts.leaid"
        description: "People at the district"
      - table: territory_plan_districts
        join: "territory_plan_districts.district_leaid = districts.leaid"
        description: "Plan membership (join territory_plans via plan_id)"
      - table: states
        join: "states.fips = districts.state_fips"
        description: "State name, abbreviation, aggregates"
    excluded_columns:
      - geometry
      - centroid
      - point_location

  district_financials:
    description: "Aggregated financial metrics per district per vendor per fiscal year"
    primary_key: id
    unique_key: [leaid, vendor, fiscal_year]
    columns_of_note:
      vendor: "fullmind, elevate, proximity, tbt"
      fiscal_year: "FY24, FY25, FY26, FY27"
      open_pipeline: "Deals in stages 0-5, not yet closed"
      closed_won_bookings: "Signed contracts"
      total_revenue: "For Fullmind: delivered + scheduled. For competitors: PO spend total"

  opportunities:
    description: "Individual deal records from CRM (Fullmind only, synced from Railway)"
    primary_key: id
    columns_of_note:
      stage: "Text with numeric prefix. 0-5 = open pipeline, 6+ = closed-won"
      net_booking_amount: "Contract value. Aggregated = district_financials.closed_won_bookings"
      school_yr: "Fiscal year identifier, e.g., 'FY26'"

concept_mappings:
  bookings:
    aggregated: "district_financials.closed_won_bookings WHERE vendor = 'fullmind'"
    deal_level: "SUM(opportunities.net_booking_amount) WHERE stage prefix >= 6"
  pipeline:
    aggregated: "district_financials.open_pipeline"
    deal_level: "SUM(opportunities.net_booking_amount) WHERE stage prefix BETWEEN 0 AND 5"
  revenue:
    aggregated: "district_financials.total_revenue"
    deal_level: "opportunities.total_revenue (per deal) or completed_revenue + scheduled_revenue"
  our_data:
    note: "When user says 'our' or 'Fullmind', filter district_financials WHERE vendor = 'fullmind' or query opportunities directly"

excluded_tables:
  - user_profiles (contains PII and OAuth tokens)
  - calendar_connections (contains OAuth tokens)
  - calendar_events (contains calendar data)
  - user_integrations (contains encrypted tokens)
```

### 2b. Query Engine API

**Endpoint:** `POST /api/ai/query`

**Request:**
```json
{
  "question": "Which districts in my FY27 plan have the most open pipeline?"
}
```

**Server flow:**
1. Receive question from authenticated user
2. Load semantic schema reference
3. Call Claude API with system prompt containing the schema reference + user question
4. Claude returns SQL query
5. Validate SQL:
   - Parse and confirm it's a SELECT statement only (no INSERT/UPDATE/DELETE/DROP/CREATE/ALTER)
   - Confirm no access to excluded tables
   - Append `LIMIT 500` if no LIMIT present, cap at 500 if higher
6. Execute via read-only `pg` pool connection with 5-second timeout
7. Return response

**Response:**
```json
{
  "sql": "SELECT d.name, df.open_pipeline...",
  "columns": ["name", "open_pipeline", ...],
  "rows": [...],
  "rowCount": 42,
  "truncated": false
}
```

**Safety guardrails:**
- **Read-only database user** — separate Supabase connection with SELECT-only permissions
- **Statement whitelist** — only SELECT; reject DML, DDL, and CTEs with side effects
- **Row limit** — automatic LIMIT 500 ceiling
- **Query timeout** — 5-second maximum execution time
- **Table exclusion** — schema reference omits sensitive tables; SQL validation confirms no access
- **No user scoping** — team-wide read access (all users see all data)

### 2c. In-App UI

Chat-style interface accessible from the app navigation:

- Text input for natural language questions
- Results displayed as a sortable data table
- "Show SQL" toggle for transparency
- Export to CSV button
- Suggested follow-up questions based on the results
- Query history (persisted per user, recent 20 queries)

### 2d. Future MCP Tool

The same query engine powers an MCP tool later. The MCP tool calls the same validation + execution logic, just with a different entry point (MCP protocol instead of HTTP). No additional design needed now — the architecture supports it by keeping the query engine as a shared library (`src/features/reports/lib/query-engine.ts`).

## Part 3: Migration Strategy

### Phase 1: Schema changes (additive only) — COMPLETE

Merged via PR #97. All schema changes applied:

- ✅ Add new columns to `vendor_financials` (`session_count`, `closed_won_opp_count`, `open_pipeline_opp_count`, `weighted_pipeline`, `po_count`)
- ✅ Add `crm_name` to `user_profiles`
- ✅ Add UUID FK columns (`districts.owner_id`, `districts.sales_executive_id`, `states.territory_owner_id`, `schools.owner_id`)
- ✅ Add `state_fips` FK to `schools`, `unmatched_accounts`, `opportunities`
- ✅ Add `unmatched_account_id` FK to `district_financials`
- ✅ Rename inconsistent columns on `district_data_history`
- ✅ Rename `districts.graduation_rate_total` → `graduation_rate`
- ✅ Migrate `competitor_spend` data into `vendor_financials` rows
- ✅ Migrate FY column data from `districts` into `vendor_financials` rows
- ✅ Migrate FY column data from `unmatched_accounts` into `vendor_financials` rows
- ✅ Populate new UUID FK columns from string name matching

### Phase 2a: Query migration — COMPLETE

Branch: `feat/db-normalization-query-tool`. All API routes now read from `district_financials` instead of districts FY columns:

- ✅ Rename Prisma model `VendorFinancials` → `DistrictFinancials`, physical table `vendor_financials` → `district_financials`
- ✅ Create shared `extractFullmindFinancials` helper (converts relation data to flat FY field shape)
- ✅ Update `district_map_features` view — no more `d.fy*` columns or `competitor_spend` references
- ✅ Swap `/api/districts` list route
- ✅ Swap `/api/districts/[leaid]` detail route
- ✅ Swap `/api/territory-plans` list route (dynamic FY pipeline lookup)
- ✅ Swap `/api/explore/[entity]` — LTV, aggregates, competitor sort, plan entity
- ✅ Swap `/api/profile` and `/api/profile/goals/[fiscalYear]`
- ✅ Swap `/api/states/[code]` and `/api/states/[code]/districts`
- ✅ Swap `/api/customer-dots` and `/api/metrics/quantiles` (raw SQL)
- ✅ Swap `/api/districts/search` (relation + response flatten)
- ✅ Swap `/api/districts/[leaid]/competitor-spend` and `/api/explore/competitor-meta`
- ✅ Update `refresh_fullmind_financials()` DB function to reference new table name
- ✅ Customer Book ETL (`import-customer-book.ts`) already dual-writes

**Not migrated (intentionally deferred):**
- `district_opportunity_actuals` mat view queries — these aggregate raw opportunities by rep + category, which `district_financials` can't provide (no `sales_rep_email`). See materialized views note above.
- Person FK migration (owner → owner_id lookups) — independent work
- State FK migration (state_abbrev → state_fips lookups) — independent work

**Still using `CompetitorSpend` model (Phase 3 cleanup):**
- `auto-tags.ts` — 4 calls to `prisma.competitorSpend.findMany()` for competitor engagement tagging
- `districts/search/route.ts` — `competitorSpend` relation in Prisma where filters for "has competitor" chips

### Phase 2b: Claude query tool — NOT STARTED

- Build semantic schema reference YAML
- Build `/api/ai/query` endpoint
- Build chat UI
- Deferred to separate implementation plan

### Phase 3: Cleanup

- Drop FY columns from `districts` (18 columns)
- Drop `CompetitorSpend` model and `competitor_spend` table
- Migrate `auto-tags.ts` and search route competitor filters from `competitorSpend` → `districtFinancials`
- Drop `state_location` from `districts` (state_abbrev stays as denormalized cache)
- Drop string owner/sales_executive columns (replaced by UUID FKs)
- Drop FY columns from `unmatched_accounts`
- Drop `district_vendor_comparison` materialized view
- Remove FY field names from frontend types (`api-types.ts`) — consume relation data directly
- Stop ETL dual-write (Python `fullmind.py` stops writing districts FY columns)
- Clean up report builder worktree (superseded by Claude query tool)
- Consider consolidating `district_opportunity_actuals` and `refresh_fullmind_financials()` — they duplicate aggregation logic from the same source

**Only after Phase 2a is fully validated in production.**

## Out of Scope

- Changing the opportunities sync pipeline (Railway Docker container) — column names stay as-is
- Modifying the `district_data_history` table structure beyond column renames
- Row-level security / per-user data scoping (team-wide access for now)
- MCP tool implementation (architecture supports it, build later)
- Migrating the existing report builder UI (replaced, not migrated)
