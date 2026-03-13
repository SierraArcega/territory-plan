# Teammate Brief: Database Audit for Opportunity Data

**Date:** 2026-03-12
**Workstream:** Database schema audit before adding opportunity tables
**Spec Reference:** `Docs/superpowers/specs/2026-03-12-opportunity-scheduler-design.md`

---

## What We Need

We're adding two new tables (`opportunities`, `unmatched_opportunities`) and a scheduler that will recompute pipeline aggregate columns on the existing `districts` table. Before we do this, we need someone to audit the current database schema and flag anything we should address or be aware of.

## Context

- **Database:** PostgreSQL 15 with PostGIS, hosted on Supabase (production) and Docker locally
- **ORM:** Prisma 5.22 — schema at `prisma/schema.prisma`
- **Existing ETL:** Python scripts in `scripts/etl/` write directly via psycopg2 (bypassing Prisma)
- **Current pipeline data:** The Fullmind CSV loader (`scripts/etl/loaders/fullmind.py`) currently populates `fy26_open_pipeline*` and `fy27_open_pipeline*` columns on the `districts` table from a CSV. The new scheduler will take over these columns, computing them from live OpenSearch data.

## Audit Checklist

### 1. Schema Consistency
- [ ] Are there naming inconsistencies between Prisma model fields and raw SQL table columns?
- [ ] Are there orphaned columns on `districts` that the new opportunity data will supersede?
- [ ] Do the existing pipeline columns (`fy26_open_pipeline`, `fy26_open_pipeline_weighted`, `fy26_open_pipeline_opp_count`, `fy27_*` equivalents, `has_open_pipeline`) have the right types and defaults for what the scheduler will write?

### 2. Foreign Key / Referential Integrity
- [ ] Should `opportunities.district_lea_id` have a FK constraint to `districts.leaid`? Or should it remain soft (no FK) since not all opps will match a district?
- [ ] Should `unmatched_opportunities.resolved_district_leaid` have a FK to `districts.leaid`?
- [ ] Are there any existing FK relationships we need to be aware of?

### 3. Index Strategy
- [ ] The spec proposes indexes on `school_yr`, `district_nces_id`, `district_lea_id`, `stage` for the opportunities table. Are these sufficient for the query patterns?
- [ ] Expected queries: aggregate by district + school_yr, filter by stage prefix, join to districts on lea_id
- [ ] Are the existing indexes on `districts` sufficient for the pipeline aggregate UPDATE that joins on `leaid`?

### 4. Data Migration Concerns
- [ ] The scheduler will reset and recompute `fy26_open_pipeline*` / `fy27_open_pipeline*` / `has_open_pipeline` every hour. The Fullmind loader currently sets these from CSV. We need a plan to stop the CSV loader from overwriting scheduler values (or deprecate those CSV columns).
- [ ] Are there any materialized views (`district_map_features`) that depend on these pipeline columns? If so, they'll need to be refreshed after scheduler writes.
- [ ] Any triggers or functions that fire on districts table updates we should know about?

### 5. Performance
- [ ] The scheduler does a full-table upsert of all opportunities each cycle. With an estimated volume of ~5,000-20,000 opportunities, is the upsert approach OK or should we consider incremental sync?
- [ ] The pipeline aggregate UPDATE resets ALL districts then recomputes. Is this OK for the table size (~15,000 districts)?

### 6. RLS / Security
- [ ] Review the proposed RLS policies (in spec). The scheduler writes via `SUPABASE_DB_URL` (service role / direct connection, bypasses RLS). Is this the right approach?
- [ ] Should the `opportunities` table have any write policies for authenticated users, or is it strictly read-only from the app?

### 7. Dual-Write Window
- [ ] During the transition, both the Fullmind CSV loader and the scheduler could write to the same pipeline columns. Document a migration plan: when to disable the CSV pipeline columns and rely solely on the scheduler.

## Key Files to Review

| File | What to look at |
|------|----------------|
| `prisma/schema.prisma` | Full data model, especially `District` model (pipeline fields at lines 71-80) |
| `scripts/etl/loaders/fullmind.py` | Current CSV loader that populates pipeline columns |
| `supabase/rls-policies.sql` | Existing RLS policies |
| `docker-compose.yml` | Current database setup |
| `src/app/api/tiles/[z]/[x]/[y]/route.ts` | Tile route — reads from `district_map_features` materialized view |
| `Docs/superpowers/specs/2026-03-12-opportunity-scheduler-design.md` | Full spec for what's being added |

## Deliverable

A short document (or PR comment) with:
1. **Blockers** — things that MUST be addressed before the scheduler ships
2. **Recommendations** — things that SHOULD be addressed but aren't blockers
3. **Notes** — things to keep in mind during implementation

Drop your findings in `Docs/superpowers/briefs/2026-03-12-database-audit-findings.md`.
