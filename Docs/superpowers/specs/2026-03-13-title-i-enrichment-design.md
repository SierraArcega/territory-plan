# Title I School Data Enrichment

**Date:** 2026-03-13
**Status:** Draft

## Summary

Enrich existing school and district data with Title I program status, Free/Reduced Price Lunch (FRPL) counts, race/ethnicity demographics, and Title I federal revenue from the Urban Institute Education Data Portal API. Surface this data in the district detail panel (school-level table) and the explore table (district-level aggregates).

## Motivation

Territory planning reps need to understand Title I status and FRPL rates to identify districts with federal funding and high-need student populations. This data is freely available from the same Urban Institute API we already use for poverty, finance, and staffing data.

## Data Source

**API:** Urban Institute Education Data Portal (`https://educationdata.urban.org/api/v1`)
- No API key required
- Must query state-by-state (by FIPS code) to avoid API timeouts
- Negative integer sentinel values from the API (`-1`, `-2`, `-3`, `-9`) indicate missing/suppressed data and must be treated as NULL
- Join key: `ncessch` (12-digit NCES school ID) for schools, `leaid` (7-digit) for districts

**Endpoints used:**
1. `/schools/ccd/directory/{year}/?fips={fips}` — Title I status, FRPL counts
2. `/schools/ccd/enrollment/{year}/grade-99/race/?fips={fips}` — Race/ethnicity breakdowns
3. `/school-districts/ccd/finance/{year}/?fips={fips}` — Title I federal revenue (`rev_fed_state_title_i`)

## Schema Changes

### School model — new fields

```prisma
// ===== Title I Data =====
// Source: Urban Institute API (CCD directory endpoint)
titleIStatus       Int?  @map("title_i_status")       // NCES code: 1-6
titleIEligible     Int?  @map("title_i_eligible")      // 0 or 1
titleISchoolwide   Int?  @map("title_i_schoolwide")    // 0 or 1
titleIDataYear     Int?  @map("title_i_data_year")

// ===== Free/Reduced Price Lunch =====
// Source: Urban Institute API (CCD directory endpoint)
freeLunch          Int?  @map("free_lunch")            // count
reducedPriceLunch  Int?  @map("reduced_price_lunch")   // count
frplTotal          Int?  @map("frpl_total")            // from API field free_or_reduced_price_lunch; falls back to free_lunch + reduced_price_lunch

// ===== Demographics =====
// Source: Urban Institute API (CCD enrollment/race endpoint, grade-99 totals)
enrollmentWhite           Int? @map("enrollment_white")
enrollmentBlack           Int? @map("enrollment_black")
enrollmentHispanic        Int? @map("enrollment_hispanic")
enrollmentAsian           Int? @map("enrollment_asian")
enrollmentAmericanIndian  Int? @map("enrollment_american_indian")   // American Indian/Alaska Native
enrollmentPacificIslander Int? @map("enrollment_pacific_islander")  // Native Hawaiian/Pacific Islander
enrollmentTwoOrMore       Int? @map("enrollment_two_or_more")
demographicsDataYear      Int? @map("demographics_data_year")
```

**Title I Status codes (NCES CCD):**
- 1 = Title I eligible school, no program
- 2 = Title I eligible, Targeted Assistance program
- 3 = Title I eligible, school not participating
- 4 = Title I eligible, status unknown
- 5 = Title I eligible, Schoolwide program
- 6 = Not Title I eligible

**Display label mapping:**
- 1 → "Eligible (No Program)"
- 2 → "Targeted"
- 3 → "Eligible (Not Participating)"
- 4 → "Eligible (Unknown)"
- 5 → "Schoolwide"
- 6 → "Not Eligible"
- null → "—"

### District model — new fields

```prisma
// ===== Title I Aggregates =====
// Source: Computed from schools table + Urban Institute finance endpoint
titleISchoolCount      Int?     @map("title_i_school_count")      // schools where title_i_eligible=1
titleISchoolwideCount  Int?     @map("title_i_schoolwide_count")  // schools where title_i_schoolwide=1
totalSchoolCount       Int?     @map("total_school_count")        // open schools counted from schools table (distinct from numberOfSchools which comes from district directory API)
frplTotalCount         Int?     @map("frpl_total_count")          // sum of frpl_total across schools
frplRate               Decimal? @map("frpl_rate") @db.Decimal(5, 2) // stored as 0-100 (e.g. 68.20), computed as (frpl_total_count / SUM(school enrollment)) * 100
titleIRevenue          Decimal? @map("title_i_revenue") @db.Decimal(15, 2) // rev_fed_state_title_i from finance endpoint
```

### Prisma migration

Single migration adding all nullable fields to schools and districts. No defaults needed. Run migration before ETL.

## ETL Loader

### New file: `scripts/etl/loaders/urban_institute_title1.py`

Follows the `state_by_state_loader.py` pattern — iterates over 50 states + DC using FIPS codes from `states_seed.json`.

**Note on endpoint overlap:** Pass 1 hits the same CCD directory endpoint as the existing `urban_institute_schools.py` loader. This is intentional — the existing loader handles school creation/upsert and directory fields, while this loader only enriches existing rows with Title I/FRPL data. The separation keeps both loaders focused and independently runnable.

**Three API passes (each skippable independently):**

1. **School Title I + FRPL** (`--title1`, on by default) — `/schools/ccd/directory/{year}/?fips={fips}` per state. Extracts `title_i_status`, `title_i_eligible`, `title_i_schoolwide`, `free_lunch`, `reduced_price_lunch`, `free_or_reduced_price_lunch`. For `frplTotal`: uses API field `free_or_reduced_price_lunch` when available, falls back to `free_lunch + reduced_price_lunch`. Negative sentinel values (< 0) are treated as NULL. Updates existing school rows by `ncessch` — does not insert new schools. Sets `title_i_data_year`.

2. **School demographics** (`--demographics`, on by default) — `/schools/ccd/enrollment/{year}/grade-99/race/?fips={fips}` per state. Extracts race/ethnicity enrollment counts. Negative sentinel values (< 0) are treated as NULL. Updates existing school rows by `ncessch`. Sets `demographics_data_year`.

3. **District Title I revenue** (`--revenue`, on by default) — `/school-districts/ccd/finance/{year}/?fips={fips}` per state. Extracts `rev_fed_state_title_i`. Updates existing district rows by `leaid`.

**Then one aggregation step:**

4. **District Title I aggregation** — SQL that computes from schools table:
   - `title_i_school_count` = COUNT where `title_i_eligible = 1` and (`school_status = 1` or `school_status IS NULL`)
   - `title_i_schoolwide_count` = COUNT where `title_i_schoolwide = 1` and (`school_status = 1` or `school_status IS NULL`)
   - `total_school_count` = COUNT where `school_status = 1` or `school_status IS NULL`
   - `frpl_total_count` = SUM of `frpl_total` where `school_status = 1` or `school_status IS NULL`
   - `frpl_rate` = (`frpl_total_count` / SUM of school `enrollment`) * 100, stored as 0-100 (e.g. 68.20). Uses sum of school enrollments as denominator (not district-level `enrollment` field, which can diverge). NULL if denominator is 0 or NULL.

**Database writes:** Uses temp table + bulk UPDATE pattern (same as `urban_institute_poverty.py`). Each state's data is fetched, buffered, and batch-upserted. The loader verifies school/district rows exist before attempting updates (UPDATE only, no INSERT).

**CLI:**
```
python3 urban_institute_title1.py --year 2022
python3 urban_institute_title1.py --year 2022 --fips 06          # just California
python3 urban_institute_title1.py --year 2022 --no-demographics  # skip demographics pass
python3 urban_institute_title1.py --year 2022 --no-revenue       # skip revenue pass
python3 urban_institute_title1.py --year 2022 --no-title1        # skip Title I pass (demographics + revenue only)
```

**Estimated runtime:** ~153 API calls (51 states x 3 passes) at 0.3s delay ≈ 1-2 minutes plus database write time.

**Dependencies:** Requires schools to already be loaded (`urban_institute_schools.py --no-charter-only`).

**Logging:** Uses the existing `data_refresh_logs` table with `data_source = 'urban_institute_title1'`.

### `run_etl.py` integration

New function `run_title1_etl()` and CLI flag `--title1`:

```
python3 run_etl.py --title1 --year 2022
python3 run_etl.py --title1 --year 2022 --start-fips 25  # resume from Massachusetts
```

Supports `--start-fips` for resuming interrupted runs (same as existing loaders). Execution order in `--all` mode: schools (all) → title1 → other loaders. The school loader must complete before title1 runs.

## Frontend: District Detail Panel

### Schools table

When viewing a district's detail panel, a new "Schools" section shows a sortable table:

| School Name | Level | Grades | Enrollment | Title I | FRPL | FRPL % |
|---|---|---|---|---|---|---|
| Lincoln Elementary | Primary | PK-5 | 412 | Schoolwide | 287 | 69.7% |
| Washington Middle | Middle | 6-8 | 603 | Targeted | 198 | 32.8% |
| Jefferson High | High | 9-12 | 1,204 | Not Eligible | 241 | 20.0% |

- **Title I** column: human-readable label from display label mapping above
- **FRPL %**: computed client-side as `frplTotal / enrollment * 100`
- Sortable by any column
- Compact rows to handle large districts (50+ schools)
- Defaults to open schools only (`school_status = 1` or NULL)

### District-level Title I summary

In the district summary section, a new line:

> **Title I:** 12 of 15 schools (8 schoolwide) · $2.4M Title I revenue · 68% FRPL rate

Where FRPL rate uses the precomputed `frplRate` field from the district.

## Frontend: Explore Table

New filterable/sortable columns in the district explore table:

| Column | Display | Filter | Sort |
|---|---|---|---|
| Title I Schools | "12 of 15" | min/max count or % | Yes |
| FRPL Rate | "68.2%" | range slider (uses stored `frplRate`) | Yes |
| Title I Revenue | "$2.4M" | min/max | Yes |

All three columns sort/filter server-side using the stored district-level fields.

## API

### New endpoint: `GET /api/districts/[leaid]/schools`

Returns open schools (`school_status = 1` or NULL) for a district with Title I and FRPL fields. Lightweight — no geometry, no demographics (demographics stored for future use).

**Query params:**
- `includeAll=true` — include closed schools (default: open only)

**Response shape:**
```json
{
  "schools": [
    {
      "ncessch": "060000000001",
      "schoolName": "Lincoln Elementary",
      "schoolLevel": 1,
      "lograde": "PK",
      "higrade": "05",
      "enrollment": 412,
      "titleIStatus": 5,
      "titleIEligible": 1,
      "titleISchoolwide": 1,
      "freeLunch": 245,
      "reducedPriceLunch": 42,
      "frplTotal": 287,
      "charter": 0
    }
  ],
  "summary": {
    "totalSchools": 15,
    "titleISchools": 12,
    "titleISchoolwide": 8,
    "frplTotal": 4231,
    "frplRate": 68.2
  }
}
```

## Out of Scope

- School map pins (future follow-up)
- School-level demographics display in the UI (data is captured for future use)
- Historical Title I trend data
- CRDC discipline/harassment data
