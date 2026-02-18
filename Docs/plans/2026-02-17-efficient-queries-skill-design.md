# Efficient Queries Skill + Data Dictionary — Design

## Goal

Build a Claude Code skill that enforces a discovery-and-review process every time Claude writes a database query, paired with a project data dictionary that defines every metric, table, and gotcha.

## Deliverables

### 1. Skill: `~/.claude/skills/efficient-queries/SKILL.md`

**Trigger:** Auto-fires whenever Claude writes, modifies, or reviews any database query — Prisma findMany/create/update, raw SQL, API route handlers that touch the DB, materialized view definitions, or ETL scripts.

**5-step process:**

**Step 1 — Goal Discovery**
- What question does this query answer?
- What consumes the result? (tile layer, API response, UI component, ETL)
- How often is it called? (per-tile = thousands/sec, page load = once, cron = daily)

**Step 2 — Scope Check**
- How many rows will this touch?
- Which columns are actually needed downstream? (prevent SELECT *)
- Does pagination apply? What's the max result set?

**Step 3 — Pattern Match** (references data dictionary)
- Does `district_map_features` materialized view already have this data?
- Is there an existing API route that already serves this?
- Should this be Prisma (convenience, type safety) or raw SQL (performance, PostGIS)?

**Step 4 — Write + Review Checklist**
- No unnecessary JOINs
- WHERE clauses hit indexed columns
- No N+1 patterns (batch instead of loop)
- Projection: only SELECT the columns needed
- Pagination present for list endpoints

**Step 5 — Supabase Reality Check**
- Pool budget: max 2 connections in prod — will this hold a connection too long?
- Materialized view freshness: is the query hitting a view that might be stale?
- Serverless cold start: is this query in a hot path that could timeout?

**Red flags table:**

| Thought | Reality |
|---------|---------|
| "It's just a quick query" | Quick queries called 1000x/sec aren't quick |
| "Prisma handles optimization" | Prisma generates SQL — it can generate bad SQL |
| "I'll optimize later" | Later never comes; get it right now |
| "I need all the columns" | You almost never need all 250 district columns |
| "This view has what I need" | Check if the view is stale or missing your FY |

### 2. Data Dictionary: `Docs/data-dictionary.md`

**Organized by domain, not by table.** Sierra reads it to understand what metrics mean; Claude reads it to know which table/column to query.

**Sections:**

#### Fullmind Sales Data
- **Naming pattern:** `fy{YY}_{metric}` on the `districts` table
- **Metrics defined:** sessions (revenue, take, count), bookings (closed_won_net_booking), net_invoicing, pipeline (open_pipeline, open_pipeline_weighted)
- **Key definitions:**
  - `sessions_revenue` / `sessions_take` / `sessions_count` = delivery/usage metrics (sessions actually taught)
  - `closed_won_net_booking` = signed deals (committed revenue)
  - `net_invoicing` = amount actually billed through invoices (can differ from contract value or session revenue depending on contract structure). **Default revenue metric** unless specifically asking about delivery or deals.
- **Flags:**
  - `is_customer` = simplified boolean, does not distinguish contracted-but-not-invoiced from active. See [issue #8](https://github.com/SierraArcega/territory-plan/issues/8) for planned redesign.
  - `has_open_pipeline` = has open pipeline in any FY
- **Currently existing FYs:** FY25 (sessions + bookings), FY26 (sessions + bookings + pipeline), FY27 (pipeline only)
- **Source:** Fullmind CRM CSV imports via ETL

#### Education & Demographics
- Enrollment, staffing FTEs, ratios, finance, poverty, graduation, assessments, absenteeism
- Each metric group has a `*_data_year` column indicating source year freshness
- Different data sources have different latest years — queries combining multiple sources should be aware
- **Source:** Urban Institute Education Data Portal via ETL

#### Trends & Comparisons
- **3-year trends:** `{metric}_trend_3yr` = percentage change over 3 years (e.g., 3.5 means 3.5% growth)
- **Materialized view bucketing:** trends bucketed as strong_growth (>=5), growth (>=1), stable (>=-1), decline (>=-5), strong_decline (<-5)
- **State/national deltas:** `{metric}_vs_state` / `{metric}_vs_national` = raw difference (district value minus average). **Positive = higher, NOT necessarily "better."** See [issue #9](https://github.com/SierraArcega/territory-plan/issues/9).
- **Quartile rankings:** `{metric}_quartile_state` = well_above, above, below, well_below

#### Competitor Spend
- Lives on `competitor_spend` table (NOT districts) — flexible `fiscal_year` column (string: 'FY24', 'FY25', etc.)
- Different architecture from Fullmind's hardcoded FY columns on districts
- Per-vendor, per-district, per-FY totals
- **Source:** GovSpend PO data via ETL

#### Territory Planning
- `territory_plan` → `territory_plan_district` (per-district targets)
- Target categories: renewal, winback, expansion, new_business (Decimal)
- Service assignments via `territory_plan_district_services` with return_services vs new_services enum
- Plan membership tracked in materialized view as comma-separated plan_ids

#### Materialized View: `district_map_features`
- Pre-computes: Fullmind categories, vendor competitor categories, trend signals, locale signal, expenditure signal
- Query this for tile/map data; query `districts` table directly for detail panels and API responses
- **Refresh:** Manual (`REFRESH MATERIALIZED VIEW district_map_features`). Must refresh after any data load that affects map-visible data.
- **Definition:** `scripts/district-map-features-view.sql`

#### Infrastructure Reference
- **Connection pool:** max 2 (production) / 5 (dev), 10s idle timeout, 10s connection timeout
- **Prisma vs raw SQL:** Use Prisma for CRUD operations with type safety. Use raw SQL pool for PostGIS/geometry, performance-critical tile queries, and complex aggregations.
- **Key indexes:** state_abbrev, is_customer+has_open_pipeline, sales_executive, student_teacher_ratio, vacancy_pressure_signal, geometry (GIST), render_geometry (GIST)

## Design Decisions

- **Skill auto-triggers** on any DB query work (not manual invocation)
- **Data dictionary in repo** (`Docs/data-dictionary.md`) — versioned with code, human-readable for Sierra
- **Skill in user skills dir** (`~/.claude/skills/efficient-queries/`) — general process, references project dictionary
- **FY columns documented as patterns** (naming convention + which FYs exist), not exhaustive per-column lists
- **Known gaps flagged** with issue links rather than blocked on resolution

## Out of Scope

- `is_customer` → `account_status` redesign ([#8](https://github.com/SierraArcega/territory-plan/issues/8))
- Delta polarity normalization ([#9](https://github.com/SierraArcega/territory-plan/issues/9))
- Data-model-evolution skill ([#10](https://github.com/SierraArcega/territory-plan/issues/10))
