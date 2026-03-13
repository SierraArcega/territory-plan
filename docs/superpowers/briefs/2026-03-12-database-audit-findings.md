# Database Audit Findings: Opportunity Scheduler Pre-Ship Review

**Date:** 2026-03-12
**Auditor:** Claude (automated analysis)
**Spec:** `Docs/superpowers/specs/2026-03-12-opportunity-scheduler-design.md`

---

## 1. Blockers

### B1 — Dual-Write Conflict: Fullmind CSV Loader vs. Scheduler on Pipeline Columns

The Fullmind CSV loader (`scripts/etl/loaders/fullmind.py`, lines 232–256) does a full clear-and-rewrite of all pipeline columns on `districts`. The scheduler writes the same six columns hourly. If both run, the CSV loader will zero out and overwrite scheduler-computed values.

**Required action:** Remove pipeline column writes from `fullmind.py` before scheduler goes live, or add an env gate (`SCHEDULER_OWNS_PIPELINE=true`).

### B2 — `district_map_features` Materialized View Not Refreshed by Scheduler

The materialized view reads `d.fy26_open_pipeline` and `d.fy27_open_pipeline` from districts for tile rendering. The Fullmind loader calls `refresh_map_features()` after each run. The scheduler does NOT refresh the view — map will show stale category data.

**Required action:** Add `REFRESH MATERIALIZED VIEW district_map_features` after the pipeline aggregate UPDATE. Consider `CONCURRENTLY` (needs unique index on view).

### B3 — No FK on `opportunities.district_lea_id`

Intentional (not all opps match), but creates silent orphan risk if districts change. `resolved_district_leaid` on unmatched table also has no FK.

**Required action:** Document the decision. Consider soft FK on `resolved_district_leaid` since it's set by deliberate user action.

---

## 2. Recommendations

| # | Area | Recommendation |
|---|------|----------------|
| R1 | RLS | Update `rls-policies.sql` with new table policies. Tighten unmatched UPDATE with column-level GRANT |
| R2 | Stale table | Verify if `fullmind_data` table still exists in production |
| R3 | Indexes | Add composite index `(district_lea_id, school_yr, stage)` on opportunities |
| R4 | M-series | Decide whether M-series synthetic districts excluded from scheduler pipeline reset |
| R5 | Consistency | Wrap pipeline reset+recompute in a single transaction (eliminates zero-value window) |
| R6 | Docker | Add scheduler service with opt-in profile for devs without OS credentials |

---

## 3. Notes

- **N1:** Pipeline column types are correct — `DECIMAL(15,2)`, `Int?`, `Boolean?` all match scheduler output
- **N2:** No naming mismatches between Prisma `@map()` and fullmind.py column names
- **N3:** Materialized view only reads `fy26_open_pipeline` and `fy27_open_pipeline` (not weighted/count) — only those trigger stale map data
- **N4:** Full-table upsert at 5–20K rows is fine for PostgreSQL hourly
- **N5:** Explore API 30-second cache will mask fresh data briefly — acceptable
- **N6:** No triggers or functions fire on `districts` table updates
- **N7:** `unmatched_opportunities` (new) is separate from `unmatched_accounts` (existing Fullmind) — different tables, different concerns
