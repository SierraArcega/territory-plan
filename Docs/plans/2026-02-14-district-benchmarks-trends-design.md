# District Benchmarks & Trends Design

## Goal

Enrich districts and states with trend data and benchmark comparisons so users can understand how districts are performing relative to their state and the country. Metrics cover enrollment composition (SWD, ELL), absenteeism, graduation rates, student-teacher ratios, assessment proficiency, and per-pupil expenditure. Data supports display, filtering/sorting, and scoring/prioritization.

## Approach

Flat denormalized columns on `districts` and `states` tables, computed in the ETL pipeline. Consistent with the existing pattern for `enrollmentTrend3yr`, `staffingTrend3yr`, and `vacancyPressureSignal`.

---

## Schema Changes

### `State` table — 7 new columns

| Column | Type | Description |
|--------|------|-------------|
| `avgChronicAbsenteeismRate` | Decimal(5,2) | Enrollment-weighted avg absenteeism rate |
| `avgStudentTeacherRatio` | Decimal(8,2) | Enrollment-weighted avg student-teacher ratio |
| `avgSwdPct` | Decimal(5,2) | Avg % students with disabilities |
| `avgEllPct` | Decimal(5,2) | Avg % English language learners |
| `avgEnrollment` | Int | Avg district enrollment |
| `avgMathProficiency` | Decimal(5,2) | Enrollment-weighted avg math proficiency |
| `avgReadProficiency` | Decimal(5,2) | Enrollment-weighted avg reading proficiency |

A `US` row (abbreviation = 'US') holds national averages using the same columns. `avgExpenditurePerPupil` already exists — no change needed.

### `DistrictDataHistory` table — 2 new columns

| Column | Type | Description |
|--------|------|-------------|
| `ell_students` | Int | ELL count for that year |
| `chronic_absenteeism_rate` | Decimal(5,2) | Absenteeism rate for that year |

All other metrics needed for trends (enrollment, spec_ed_students, teachers_fte, graduation_rate, math_proficiency, read_proficiency, expenditure_pp) already exist in this table.

### `District` table — 39 new columns

**Derived percentages (2):**

| Column | Type | Formula |
|--------|------|---------|
| `swdPct` | Decimal(5,2) | `spec_ed_students / enrollment * 100` |
| `ellPct` | Decimal(5,2) | `ell_students / enrollment * 100` |

**3-year trends (8):**

| Column | Type | Description |
|--------|------|-------------|
| `swdTrend3yr` | Decimal(8,2) | % change in SWD count over 3 years |
| `ellTrend3yr` | Decimal(8,2) | % change in ELL count over 3 years |
| `absenteeismTrend3yr` | Decimal(8,2) | Point change in absenteeism rate |
| `graduationTrend3yr` | Decimal(8,2) | Point change in graduation rate |
| `studentTeacherRatioTrend3yr` | Decimal(8,2) | Change in student-teacher ratio |
| `mathProficiencyTrend3yr` | Decimal(8,2) | Point change in math proficiency |
| `readProficiencyTrend3yr` | Decimal(8,2) | Point change in reading proficiency |
| `expenditurePpTrend3yr` | Decimal(8,2) | % change in per-pupil expenditure |

**State comparison deltas (8):**

| Column | Type |
|--------|------|
| `absenteeismVsState` | Decimal(8,2) |
| `graduationVsState` | Decimal(8,2) |
| `studentTeacherRatioVsState` | Decimal(8,2) |
| `swdPctVsState` | Decimal(8,2) |
| `ellPctVsState` | Decimal(8,2) |
| `mathProficiencyVsState` | Decimal(8,2) |
| `readProficiencyVsState` | Decimal(8,2) |
| `expenditurePpVsState` | Decimal(8,2) |

Positive value = district is above the state average.

**National comparison deltas (8):**

Same 8 metrics with `VsNational` suffix, compared against the `US` row.

**4-tier quartile flags within state (8):**

| Column | Type | Values |
|--------|------|--------|
| `absenteeismQuartileState` | String | `well_above`, `above`, `below`, `well_below` |
| `graduationQuartileState` | String | same |
| `studentTeacherRatioQuartileState` | String | same |
| `swdPctQuartileState` | String | same |
| `ellPctQuartileState` | String | same |
| `mathProficiencyQuartileState` | String | same |
| `readProficiencyQuartileState` | String | same |
| `expenditurePpQuartileState` | String | same |

Districts ranked within state. Top 25% = `well_above`, 25-50% = `above`, 50-75% = `below`, bottom 25% = `well_below`. For metrics where higher is worse (absenteeism, student-teacher ratio), labels are inverted so `well_above` always means "notably high."

**Column name suffix (5):** `absenteeismVsNational`, `graduationVsNational`, `studentTeacherRatioVsNational`, `swdPctVsNational`, `ellPctVsNational`, `mathProficiencyVsNational`, `readProficiencyVsNational`, `expenditurePpVsNational`

---

## ETL Pipeline

### Phase 1: Extend `historical_backfill.py`

Add ELL and absenteeism history to the existing backfill process:
- Fetch ELL counts from CCD directory endpoint — **state-by-state**, by year
- Fetch chronic absenteeism from CRDC endpoint — **state-by-state**, by year (biennial: 2011, 2013, 2015, 2017, 2020)
- Upsert into `district_data_history`

All Urban Institute API calls iterate by state to avoid timeouts and stay within the 10K page limit.

### Phase 2: New `compute_benchmarks.py` in `scripts/etl/loaders/`

Runs after all data loaders and history backfill. Three steps:

**Step 1 — State & national averages:**
- Query all districts grouped by state
- Compute enrollment-weighted averages for each metric
- Upsert into `states` table (including `US` row for national)

**Step 2 — District trends:**
- Query `district_data_history` for current year vs 3 years prior
- Calculate % change (SWD, ELL, expenditure) and point change (absenteeism, graduation, ratio, math, reading)
- Compute `swdPct` and `ellPct` from current counts
- Bulk update `districts` table

**Step 3 — Deltas & quartiles:**
- Join districts to their state averages and the `US` row
- Calculate all `_vs_state` and `_vs_national` deltas
- Rank districts within state, assign quartile flags
- Bulk update `districts` table

Wired into `run_etl.py` as the final step. Follows existing ETL conventions: temp tables for bulk updates, `log_refresh()`, `DIRECT_URL` connection.

### Absenteeism trend note

Absenteeism data is biennial (not annual). The 3-year trend uses the two most recent available data points rather than strictly 3 calendar years apart.

---

## Migration Strategy

1. Update `schema.prisma` with all new columns (nullable)
2. `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script` to generate SQL
3. Review generated SQL, add `INSERT INTO states` for the `US` row
4. `prisma db execute --file migration.sql`
5. `prisma migrate resolve --applied <name>`
6. `prisma generate`

No breaking changes — all columns nullable, populated by ETL on first run.

---

## Scope Boundaries

**In scope:** Schema changes, history backfill extension, `compute_benchmarks.py`, migration, ETL integration.

**Not in scope:** UI changes, new API endpoints, composite scoring signals, percentile ranks beyond quartiles.
