# District Benchmarks & Trends Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 39 trend/benchmark columns to districts, 7 to states, and 2 to history table, computed via ETL pipeline.

**Architecture:** Flat denormalized columns on existing tables. New `compute_benchmarks.py` ETL script runs after all loaders. Historical backfill extended for ELL and absenteeism. All Urban Institute API calls iterate state-by-state.

**Tech Stack:** Python 3 (psycopg2, requests), PostgreSQL, Prisma ORM, Next.js (Prisma client regen)

---

### Task 1: Update Prisma Schema — State Model

**Files:**
- Modify: `prisma/schema.prisma:318-353` (State model)

**Step 1: Add new columns to State model**

Add these lines after `avgPovertyRate` (line 335) and before `territoryOwner` (line 338):

```prisma
  avgChronicAbsenteeismRate Decimal? @map("avg_chronic_absenteeism_rate") @db.Decimal(5, 2)
  avgStudentTeacherRatio    Decimal? @map("avg_student_teacher_ratio") @db.Decimal(8, 2)
  avgSwdPct                 Decimal? @map("avg_swd_pct") @db.Decimal(5, 2)
  avgEllPct                 Decimal? @map("avg_ell_pct") @db.Decimal(5, 2)
  avgEnrollment             Int?     @map("avg_enrollment")
  avgMathProficiency        Decimal? @map("avg_math_proficiency") @db.Decimal(5, 2)
  avgReadProficiency        Decimal? @map("avg_read_proficiency") @db.Decimal(5, 2)
```

**Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add benchmark avg columns to State model

- avgChronicAbsenteeismRate, avgStudentTeacherRatio
- avgSwdPct, avgEllPct, avgEnrollment
- avgMathProficiency, avgReadProficiency"
```

---

### Task 2: Update Prisma Schema — DistrictDataHistory Model

**Files:**
- Modify: `prisma/schema.prisma:796-832` (DistrictDataHistory model)

**Step 1: Add new columns to DistrictDataHistory model**

Add these lines after `specEdStudents` (line 806) and before the Finance comment (line 808):

```prisma
  ellStudents     Int?     @map("ell_students")
  chronicAbsenteeismRate Decimal? @map("chronic_absenteeism_rate") @db.Decimal(5, 2)
```

**Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add ell_students and chronic_absenteeism_rate to history table"
```

---

### Task 3: Update Prisma Schema — District Model (Trends & Benchmarks)

**Files:**
- Modify: `prisma/schema.prisma:190-194` (after existing trend signals, before Relations)

**Step 1: Add all 39 new columns to District model**

Add these lines after `vacancyPressureSignal` (line 193) and before the Relations section (line 195):

```prisma
  // ===== Derived Percentages (computed post-ETL) =====
  swdPct   Decimal? @map("swd_pct") @db.Decimal(5, 2)
  ellPct   Decimal? @map("ell_pct") @db.Decimal(5, 2)

  // ===== 3-Year Trends (computed from district_data_history) =====
  swdTrend3yr                  Decimal? @map("swd_trend_3yr") @db.Decimal(8, 2)
  ellTrend3yr                  Decimal? @map("ell_trend_3yr") @db.Decimal(8, 2)
  absenteeismTrend3yr          Decimal? @map("absenteeism_trend_3yr") @db.Decimal(8, 2)
  graduationTrend3yr           Decimal? @map("graduation_trend_3yr") @db.Decimal(8, 2)
  studentTeacherRatioTrend3yr  Decimal? @map("student_teacher_ratio_trend_3yr") @db.Decimal(8, 2)
  mathProficiencyTrend3yr      Decimal? @map("math_proficiency_trend_3yr") @db.Decimal(8, 2)
  readProficiencyTrend3yr      Decimal? @map("read_proficiency_trend_3yr") @db.Decimal(8, 2)
  expenditurePpTrend3yr        Decimal? @map("expenditure_pp_trend_3yr") @db.Decimal(8, 2)

  // ===== State Comparison Deltas (district value minus state avg) =====
  absenteeismVsState           Decimal? @map("absenteeism_vs_state") @db.Decimal(8, 2)
  graduationVsState            Decimal? @map("graduation_vs_state") @db.Decimal(8, 2)
  studentTeacherRatioVsState   Decimal? @map("student_teacher_ratio_vs_state") @db.Decimal(8, 2)
  swdPctVsState                Decimal? @map("swd_pct_vs_state") @db.Decimal(8, 2)
  ellPctVsState                Decimal? @map("ell_pct_vs_state") @db.Decimal(8, 2)
  mathProficiencyVsState       Decimal? @map("math_proficiency_vs_state") @db.Decimal(8, 2)
  readProficiencyVsState       Decimal? @map("read_proficiency_vs_state") @db.Decimal(8, 2)
  expenditurePpVsState         Decimal? @map("expenditure_pp_vs_state") @db.Decimal(8, 2)

  // ===== National Comparison Deltas (district value minus national avg) =====
  absenteeismVsNational          Decimal? @map("absenteeism_vs_national") @db.Decimal(8, 2)
  graduationVsNational           Decimal? @map("graduation_vs_national") @db.Decimal(8, 2)
  studentTeacherRatioVsNational  Decimal? @map("student_teacher_ratio_vs_national") @db.Decimal(8, 2)
  swdPctVsNational               Decimal? @map("swd_pct_vs_national") @db.Decimal(8, 2)
  ellPctVsNational               Decimal? @map("ell_pct_vs_national") @db.Decimal(8, 2)
  mathProficiencyVsNational      Decimal? @map("math_proficiency_vs_national") @db.Decimal(8, 2)
  readProficiencyVsNational      Decimal? @map("read_proficiency_vs_national") @db.Decimal(8, 2)
  expenditurePpVsNational        Decimal? @map("expenditure_pp_vs_national") @db.Decimal(8, 2)

  // ===== Within-State Quartile Flags =====
  // Values: well_above, above, below, well_below (4-tier by quartile rank)
  absenteeismQuartileState          String? @map("absenteeism_quartile_state") @db.VarChar(15)
  graduationQuartileState           String? @map("graduation_quartile_state") @db.VarChar(15)
  studentTeacherRatioQuartileState  String? @map("student_teacher_ratio_quartile_state") @db.VarChar(15)
  swdPctQuartileState               String? @map("swd_pct_quartile_state") @db.VarChar(15)
  ellPctQuartileState               String? @map("ell_pct_quartile_state") @db.VarChar(15)
  mathProficiencyQuartileState      String? @map("math_proficiency_quartile_state") @db.VarChar(15)
  readProficiencyQuartileState      String? @map("read_proficiency_quartile_state") @db.VarChar(15)
  expenditurePpQuartileState        String? @map("expenditure_pp_quartile_state") @db.VarChar(15)
```

**Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add 39 benchmark/trend columns to District model

- 2 derived percentages (swdPct, ellPct)
- 8 three-year trends (SWD, ELL, absenteeism, graduation, ratio, math, reading, expenditure)
- 8 state comparison deltas
- 8 national comparison deltas
- 8 within-state quartile flags
- 5 additional state averages on State model (from prior commit)"
```

---

### Task 4: Generate and Apply Database Migration

**Files:**
- Create: `prisma/migrations/<timestamp>_add_benchmarks_trends/migration.sql`

**Step 1: Generate migration SQL**

```bash
cd territory-plan
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/add_benchmarks_trends.sql
```

**Step 2: Review the generated SQL**

Read and verify the generated SQL file. It should contain ~48 ALTER TABLE statements (39 district + 7 state + 2 history columns). No DROP or destructive statements.

**Step 3: Add US national row to the migration SQL**

Append to the end of the generated migration file:

```sql
-- Seed the US national row for national benchmark averages
INSERT INTO states (fips, abbrev, name, created_at, updated_at)
VALUES ('00', 'US', 'United States', NOW(), NOW())
ON CONFLICT (fips) DO NOTHING;
```

**Step 4: Apply the migration**

```bash
npx prisma db execute --file prisma/migrations/add_benchmarks_trends.sql
```

**Step 5: Resolve migration state**

```bash
npx prisma migrate resolve --applied add_benchmarks_trends
```

**Step 6: Regenerate Prisma client**

```bash
npx prisma generate
```

**Step 7: Verify the US row exists**

```bash
cd scripts/etl && python3 -c "
import os, psycopg2
from dotenv import load_dotenv
load_dotenv()
conn_str = os.environ.get('DIRECT_URL', os.environ.get('DATABASE_URL', '')).split('?')[0]
conn = psycopg2.connect(conn_str)
cur = conn.cursor()
cur.execute(\"SELECT fips, abbrev, name FROM states WHERE abbrev = 'US'\")
print(cur.fetchone())
cur.close(); conn.close()
"
```

Expected: `('00', 'US', 'United States')`

**Step 8: Commit**

```bash
git add prisma/
git commit -m "migration: add 48 benchmark/trend columns and seed US national row

- 39 new District columns (trends, deltas, quartiles)
- 7 new State columns (benchmark averages)
- 2 new DistrictDataHistory columns (ell_students, chronic_absenteeism_rate)
- US row in states table for national averages"
```

---

### Task 5: Extend Historical Backfill — ELL History

**Files:**
- Modify: `scripts/etl/loaders/historical_backfill.py`

**Step 1: Add `backfill_ell_history()` function**

Add after `backfill_enrollment_history()` (after line 130). This function fetches ELL student counts from the CCD directory endpoint state-by-state and writes them to `district_data_history`.

```python
def backfill_ell_history(
    connection_string: str,
    years: List[int],
    delay: float = 0.5,
) -> int:
    """
    Backfill ELL student counts from CCD directory for multiple years.

    Fetches state-by-state to avoid timeouts. Updates ell_students column
    on existing ccd_directory rows in district_data_history.

    Args:
        connection_string: PostgreSQL connection string
        years: List of years to backfill
        delay: Delay between API calls

    Returns:
        Total records written
    """
    import psycopg2
    from psycopg2.extras import execute_values

    # All state FIPS codes
    STATES = [
        "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
        "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
        "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
        "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
        "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
        "56",
    ]

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    total_written = 0

    for year in years:
        print(f"\nBackfilling ELL data for {year} (state by state)...")
        year_written = 0

        for fips in STATES:
            url = f"{API_BASE_URL}/school-districts/ccd/directory/{year}/"
            params = {"fips": int(fips)}
            results = _fetch_paginated(f"{url}?fips={int(fips)}", delay=delay)

            batch = []
            for record in results:
                leaid = record.get("leaid")
                if not leaid:
                    continue

                leaid_str = str(leaid).zfill(7)
                ell = record.get("english_language_learners")

                # Clean invalid values (Urban Institute uses -1/-2 for missing)
                if ell is not None and ell < 0:
                    ell = None

                if ell is not None:
                    batch.append((leaid_str, year, 'ccd_directory', ell))

            if batch:
                # Update existing ccd_directory rows with ell_students
                execute_values(
                    cur,
                    """
                    INSERT INTO district_data_history (leaid, year, source, ell_students)
                    VALUES %s
                    ON CONFLICT (leaid, year, source) DO UPDATE SET
                        ell_students = EXCLUDED.ell_students
                    """,
                    batch,
                    template="(%s, %s, %s, %s)"
                )
                conn.commit()
                year_written += len(batch)

            time.sleep(delay)

        total_written += year_written
        print(f"  Wrote {year_written} ELL history records for {year}")

    cur.close()
    conn.close()
    return total_written
```

**Step 2: Commit**

```bash
git add scripts/etl/loaders/historical_backfill.py
git commit -m "etl: add ELL historical backfill (state-by-state)

- New backfill_ell_history() fetches english_language_learners from CCD directory
- Iterates state-by-state to avoid timeouts
- Upserts ell_students into district_data_history"
```

---

### Task 6: Extend Historical Backfill — Absenteeism History

**Files:**
- Modify: `scripts/etl/loaders/historical_backfill.py`

**Step 1: Add `backfill_absenteeism_history()` function**

Add after `backfill_ell_history()`. This function fetches school-level CRDC data state-by-state, aggregates to district level, and writes to history table.

```python
def backfill_absenteeism_history(
    connection_string: str,
    years: List[int] = None,
    delay: float = 0.5,
) -> int:
    """
    Backfill chronic absenteeism rates from CRDC for available years.

    CRDC data is biennial: available years are 2011, 2013, 2015, 2017, 2020.
    Fetches school-level data state-by-state, aggregates to district level,
    and writes to district_data_history.

    Args:
        connection_string: PostgreSQL connection string
        years: List of CRDC years (defaults to all available)
        delay: Delay between API calls

    Returns:
        Total records written
    """
    import psycopg2
    from psycopg2.extras import execute_values
    from collections import defaultdict

    AVAILABLE_YEARS = [2011, 2013, 2015, 2017, 2020]
    if years is None:
        years = AVAILABLE_YEARS
    else:
        # Filter to only valid CRDC years
        years = [y for y in years if y in AVAILABLE_YEARS]
        if not years:
            print("No valid CRDC years provided. Available: 2011, 2013, 2015, 2017, 2020")
            return 0

    STATES = [
        "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
        "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
        "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
        "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
        "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
        "56",
    ]

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    total_written = 0

    for year in years:
        print(f"\nBackfilling CRDC absenteeism data for {year} (state by state)...")
        # Accumulate school-level data by district
        district_absent = defaultdict(int)
        district_enrollment = defaultdict(int)

        for fips in STATES:
            url = f"{API_BASE_URL}/schools/crdc/chronic-absenteeism/{year}/"
            results = _fetch_paginated(f"{url}?fips={int(fips)}", delay=delay)

            for record in results:
                leaid = record.get("leaid")
                if not leaid:
                    continue

                # Only total records (not disaggregated)
                is_total = (
                    record.get("sex") == 99 and
                    record.get("race") == 99 and
                    record.get("disability") == 99
                )
                if not is_total:
                    continue

                leaid_str = str(leaid).zfill(7)
                chronic_absent = record.get("chronic_absent")
                enrollment = record.get("enrollment_crdc")

                if chronic_absent is not None and chronic_absent >= 0:
                    district_absent[leaid_str] += chronic_absent
                if enrollment is not None and enrollment >= 0:
                    district_enrollment[leaid_str] += enrollment

            time.sleep(delay)

        # Compute rates and write to history
        batch = []
        for leaid in district_absent:
            absent_count = district_absent[leaid]
            enrollment = district_enrollment.get(leaid, 0)
            rate = None
            if enrollment > 0:
                rate = round((absent_count / enrollment) * 100, 2)
            if rate is not None:
                batch.append((leaid, year, 'crdc_absenteeism', rate))

        if batch:
            execute_values(
                cur,
                """
                INSERT INTO district_data_history (leaid, year, source, chronic_absenteeism_rate)
                VALUES %s
                ON CONFLICT (leaid, year, source) DO UPDATE SET
                    chronic_absenteeism_rate = EXCLUDED.chronic_absenteeism_rate
                """,
                batch,
                template="(%s, %s, %s, %s)"
            )
            conn.commit()
            total_written += len(batch)
            print(f"  Wrote {len(batch)} absenteeism history records for {year}")

    cur.close()
    conn.close()
    return total_written
```

**Step 2: Commit**

```bash
git add scripts/etl/loaders/historical_backfill.py
git commit -m "etl: add absenteeism historical backfill (state-by-state CRDC)

- New backfill_absenteeism_history() fetches school-level CRDC data
- Iterates state-by-state, aggregates to district level
- Handles biennial data (2011, 2013, 2015, 2017, 2020)
- Upserts chronic_absenteeism_rate into district_data_history"
```

---

### Task 7: Create compute_benchmarks.py — State & National Averages

**Files:**
- Create: `scripts/etl/loaders/compute_benchmarks.py`

**Step 1: Create the file with Step 1 (state/national averages)**

```python
"""
District Benchmarks & Trends Computation

Computes derived metrics on the districts and states tables:
1. State & national averages (enrollment-weighted)
2. District percentages and 3-year trends
3. Comparison deltas (vs state, vs national) and quartile flags

Runs after all data loaders and historical backfill.
No API calls — pure SQL against local data.

Usage:
    python3 compute_benchmarks.py                # all steps
    python3 compute_benchmarks.py --averages     # state/national averages only
    python3 compute_benchmarks.py --trends       # district trends only
    python3 compute_benchmarks.py --deltas       # deltas and quartiles only
"""

import os
import argparse
from typing import Dict

import psycopg2


def compute_state_averages(connection_string: str) -> int:
    """
    Compute enrollment-weighted state averages and update the states table.

    Also computes national averages and stores them in the US row (fips='00').

    Metrics computed:
    - avg_chronic_absenteeism_rate
    - avg_student_teacher_ratio
    - avg_swd_pct (spec_ed_students / enrollment * 100)
    - avg_ell_pct (ell_students / enrollment * 100)
    - avg_enrollment
    - avg_math_proficiency
    - avg_read_proficiency
    (avg_expenditure_per_pupil and avg_graduation_rate already computed by state_aggregates.py)

    Returns:
        Number of states updated (including US row)
    """
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Update per-state averages
    # Uses enrollment-weighted averages for rates, simple averages for counts
    cur.execute("""
        UPDATE states s SET
            avg_chronic_absenteeism_rate = agg.avg_absenteeism,
            avg_student_teacher_ratio = agg.avg_str,
            avg_swd_pct = agg.avg_swd,
            avg_ell_pct = agg.avg_ell,
            avg_enrollment = agg.avg_enroll,
            avg_math_proficiency = agg.avg_math,
            avg_read_proficiency = agg.avg_read,
            aggregates_updated_at = NOW(),
            updated_at = NOW()
        FROM (
            SELECT
                state_fips,
                -- Enrollment-weighted absenteeism rate
                CASE
                    WHEN SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(chronic_absenteeism_rate * enrollment) /
                         SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_absenteeism,
                -- Enrollment-weighted student-teacher ratio
                CASE
                    WHEN SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(student_teacher_ratio * enrollment) /
                         SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_str,
                -- SWD percentage: total spec_ed / total enrollment * 100
                CASE
                    WHEN SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(spec_ed_students)::numeric /
                         SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_swd,
                -- ELL percentage: total ell / total enrollment * 100
                CASE
                    WHEN SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(ell_students)::numeric /
                         SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_ell,
                -- Simple average enrollment
                ROUND(AVG(enrollment)) AS avg_enroll,
                -- Enrollment-weighted math proficiency
                CASE
                    WHEN SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(math_proficiency_pct * enrollment) /
                         SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_math,
                -- Enrollment-weighted reading proficiency
                CASE
                    WHEN SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(read_proficiency_pct * enrollment) /
                         SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_read
            FROM districts
            WHERE state_fips IS NOT NULL AND enrollment IS NOT NULL AND enrollment > 0
            GROUP BY state_fips
        ) agg
        WHERE s.fips = agg.state_fips
    """)
    state_count = cur.rowcount
    print(f"Updated averages for {state_count} states")

    # Compute national averages into the US row (fips='00')
    cur.execute("""
        UPDATE states SET
            avg_chronic_absenteeism_rate = nat.avg_absenteeism,
            avg_student_teacher_ratio = nat.avg_str,
            avg_swd_pct = nat.avg_swd,
            avg_ell_pct = nat.avg_ell,
            avg_enrollment = nat.avg_enroll,
            avg_math_proficiency = nat.avg_math,
            avg_read_proficiency = nat.avg_read,
            avg_expenditure_per_pupil = nat.avg_epp,
            avg_graduation_rate = nat.avg_grad,
            avg_poverty_rate = nat.avg_poverty,
            total_districts = nat.total_dist,
            total_enrollment = nat.total_enroll,
            aggregates_updated_at = NOW(),
            updated_at = NOW()
        FROM (
            SELECT
                CASE
                    WHEN SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(chronic_absenteeism_rate * enrollment) /
                         SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_absenteeism,
                CASE
                    WHEN SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(student_teacher_ratio * enrollment) /
                         SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_str,
                CASE
                    WHEN SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(spec_ed_students)::numeric /
                         SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_swd,
                CASE
                    WHEN SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(ell_students)::numeric /
                         SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_ell,
                ROUND(AVG(enrollment)) AS avg_enroll,
                CASE
                    WHEN SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(math_proficiency_pct * enrollment) /
                         SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_math,
                CASE
                    WHEN SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(read_proficiency_pct * enrollment) /
                         SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_read,
                CASE
                    WHEN SUM(CASE WHEN expenditure_per_pupil IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(expenditure_per_pupil * enrollment) /
                         SUM(CASE WHEN expenditure_per_pupil IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_epp,
                CASE
                    WHEN SUM(CASE WHEN graduation_rate_total IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(graduation_rate_total * enrollment) /
                         SUM(CASE WHEN graduation_rate_total IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_grad,
                ROUND(AVG(children_poverty_percent)::numeric, 2) AS avg_poverty,
                COUNT(*) AS total_dist,
                SUM(enrollment) AS total_enroll
            FROM districts
            WHERE enrollment IS NOT NULL AND enrollment > 0
        ) nat
        WHERE fips = '00'
    """)
    us_updated = cur.rowcount
    print(f"Updated US national averages: {us_updated} row")

    conn.commit()
    cur.close()
    conn.close()

    return state_count + us_updated
```

**Step 2: Commit**

```bash
git add scripts/etl/loaders/compute_benchmarks.py
git commit -m "etl: add compute_benchmarks.py — state & national averages

- Enrollment-weighted averages for 7 benchmark metrics per state
- National averages computed into US row (fips='00')
- Covers absenteeism, student-teacher ratio, SWD%, ELL%, math, reading proficiency"
```

---

### Task 8: compute_benchmarks.py — District Trends

**Files:**
- Modify: `scripts/etl/loaders/compute_benchmarks.py`

**Step 1: Add `compute_district_trends()` function**

```python
def compute_district_trends(connection_string: str) -> int:
    """
    Compute derived percentages and 3-year trends on the districts table.

    Derived percentages:
    - swd_pct = spec_ed_students / enrollment * 100
    - ell_pct = ell_students / enrollment * 100

    3-year trends (from district_data_history):
    - swd_trend_3yr: % change in spec_ed_students count
    - ell_trend_3yr: % change in ell_students count
    - absenteeism_trend_3yr: point change in chronic_absenteeism_rate
    - graduation_trend_3yr: point change in graduation_rate
    - student_teacher_ratio_trend_3yr: point change in student-teacher ratio
    - math_proficiency_trend_3yr: point change in math_proficiency
    - read_proficiency_trend_3yr: point change in read_proficiency
    - expenditure_pp_trend_3yr: % change in expenditure_pp

    Returns:
        Number of districts updated
    """
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Step 1: Compute derived percentages from current district data
    cur.execute("""
        UPDATE districts SET
            swd_pct = CASE
                WHEN spec_ed_students IS NOT NULL AND enrollment IS NOT NULL AND enrollment > 0
                THEN ROUND((spec_ed_students::numeric / enrollment * 100), 2)
                ELSE NULL
            END,
            ell_pct = CASE
                WHEN ell_students IS NOT NULL AND enrollment IS NOT NULL AND enrollment > 0
                THEN ROUND((ell_students::numeric / enrollment * 100), 2)
                ELSE NULL
            END
        WHERE enrollment IS NOT NULL AND enrollment > 0
    """)
    pct_count = cur.rowcount
    print(f"Computed swd_pct/ell_pct for {pct_count} districts")

    # Step 2: Find year range for trends from ccd_directory history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'ccd_directory'
    """)
    row = cur.fetchone()
    if not row or row[0] is None:
        print("No CCD directory history found. Skipping trends.")
        conn.commit()
        cur.close()
        conn.close()
        return pct_count

    min_year, max_year = row
    base_year = max(min_year, max_year - 3)
    print(f"Computing trends: {base_year} → {max_year}")

    # Step 3: Compute SWD and ELL trends (% change in count)
    cur.execute("""
        WITH base AS (
            SELECT leaid, spec_ed_students, ell_students,
                   enrollment, teachers_fte
            FROM district_data_history
            WHERE source = 'ccd_directory' AND year = %s
        ),
        latest AS (
            SELECT leaid, spec_ed_students, ell_students,
                   enrollment, teachers_fte
            FROM district_data_history
            WHERE source = 'ccd_directory' AND year = %s
        ),
        trends AS (
            SELECT
                l.leaid,
                -- SWD trend: % change in count
                CASE
                    WHEN b.spec_ed_students IS NOT NULL AND b.spec_ed_students > 0
                         AND l.spec_ed_students IS NOT NULL
                    THEN ROUND(((l.spec_ed_students - b.spec_ed_students)::numeric
                         / b.spec_ed_students) * 100, 2)
                    ELSE NULL
                END AS swd_trend,
                -- ELL trend: % change in count
                CASE
                    WHEN b.ell_students IS NOT NULL AND b.ell_students > 0
                         AND l.ell_students IS NOT NULL
                    THEN ROUND(((l.ell_students - b.ell_students)::numeric
                         / b.ell_students) * 100, 2)
                    ELSE NULL
                END AS ell_trend,
                -- Student-teacher ratio trend: point change
                CASE
                    WHEN b.enrollment IS NOT NULL AND b.teachers_fte IS NOT NULL
                         AND b.teachers_fte > 0
                         AND l.enrollment IS NOT NULL AND l.teachers_fte IS NOT NULL
                         AND l.teachers_fte > 0
                    THEN ROUND((l.enrollment::numeric / l.teachers_fte)
                         - (b.enrollment::numeric / b.teachers_fte), 2)
                    ELSE NULL
                END AS str_trend
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
        )
        UPDATE districts d SET
            swd_trend_3yr = t.swd_trend,
            ell_trend_3yr = t.ell_trend,
            student_teacher_ratio_trend_3yr = t.str_trend
        FROM trends t
        WHERE d.leaid = t.leaid
    """, (base_year, max_year))
    swd_ell_count = cur.rowcount
    print(f"Computed SWD/ELL/STR trends for {swd_ell_count} districts")

    # Step 4: Graduation trend (point change) from edfacts_grad history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'edfacts_grad' AND graduation_rate IS NOT NULL
    """)
    grad_row = cur.fetchone()
    if grad_row and grad_row[0] is not None:
        grad_base = max(grad_row[0], grad_row[1] - 3)
        cur.execute("""
            WITH base AS (
                SELECT leaid, graduation_rate FROM district_data_history
                WHERE source = 'edfacts_grad' AND year = %s
            ),
            latest AS (
                SELECT leaid, graduation_rate FROM district_data_history
                WHERE source = 'edfacts_grad' AND year = %s
            )
            UPDATE districts d SET
                graduation_trend_3yr = ROUND((l.graduation_rate - b.graduation_rate)::numeric, 2)
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
            WHERE d.leaid = l.leaid
              AND l.graduation_rate IS NOT NULL
              AND b.graduation_rate IS NOT NULL
        """, (grad_base, grad_row[1]))
        print(f"Computed graduation trends for {cur.rowcount} districts")

    # Step 5: Assessment trends (point change) from edfacts_assess history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'edfacts_assess' AND (math_proficiency IS NOT NULL OR read_proficiency IS NOT NULL)
    """)
    assess_row = cur.fetchone()
    if assess_row and assess_row[0] is not None:
        assess_base = max(assess_row[0], assess_row[1] - 3)
        cur.execute("""
            WITH base AS (
                SELECT leaid, math_proficiency, read_proficiency FROM district_data_history
                WHERE source = 'edfacts_assess' AND year = %s
            ),
            latest AS (
                SELECT leaid, math_proficiency, read_proficiency FROM district_data_history
                WHERE source = 'edfacts_assess' AND year = %s
            )
            UPDATE districts d SET
                math_proficiency_trend_3yr = CASE
                    WHEN l.math_proficiency IS NOT NULL AND b.math_proficiency IS NOT NULL
                    THEN ROUND((l.math_proficiency - b.math_proficiency)::numeric, 2)
                    ELSE NULL
                END,
                read_proficiency_trend_3yr = CASE
                    WHEN l.read_proficiency IS NOT NULL AND b.read_proficiency IS NOT NULL
                    THEN ROUND((l.read_proficiency - b.read_proficiency)::numeric, 2)
                    ELSE NULL
                END
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
            WHERE d.leaid = l.leaid
        """, (assess_base, assess_row[1]))
        print(f"Computed assessment trends for {cur.rowcount} districts")

    # Step 6: Expenditure per pupil trend (% change) from ccd_finance history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'ccd_finance' AND expenditure_pp IS NOT NULL
    """)
    fin_row = cur.fetchone()
    if fin_row and fin_row[0] is not None:
        fin_base = max(fin_row[0], fin_row[1] - 3)
        cur.execute("""
            WITH base AS (
                SELECT leaid, expenditure_pp FROM district_data_history
                WHERE source = 'ccd_finance' AND year = %s
            ),
            latest AS (
                SELECT leaid, expenditure_pp FROM district_data_history
                WHERE source = 'ccd_finance' AND year = %s
            )
            UPDATE districts d SET
                expenditure_pp_trend_3yr = CASE
                    WHEN b.expenditure_pp IS NOT NULL AND b.expenditure_pp > 0
                         AND l.expenditure_pp IS NOT NULL
                    THEN ROUND(((l.expenditure_pp - b.expenditure_pp) / b.expenditure_pp * 100)::numeric, 2)
                    ELSE NULL
                END
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
            WHERE d.leaid = l.leaid
        """, (fin_base, fin_row[1]))
        print(f"Computed expenditure trends for {cur.rowcount} districts")

    # Step 7: Absenteeism trend (point change) from crdc_absenteeism history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'crdc_absenteeism' AND chronic_absenteeism_rate IS NOT NULL
    """)
    abs_row = cur.fetchone()
    if abs_row and abs_row[0] is not None and abs_row[0] != abs_row[1]:
        # Use two most recent available years (biennial data)
        cur.execute("""
            SELECT DISTINCT year FROM district_data_history
            WHERE source = 'crdc_absenteeism' AND chronic_absenteeism_rate IS NOT NULL
            ORDER BY year DESC LIMIT 2
        """)
        abs_years = [r[0] for r in cur.fetchall()]
        if len(abs_years) == 2:
            cur.execute("""
                WITH base AS (
                    SELECT leaid, chronic_absenteeism_rate FROM district_data_history
                    WHERE source = 'crdc_absenteeism' AND year = %s
                ),
                latest AS (
                    SELECT leaid, chronic_absenteeism_rate FROM district_data_history
                    WHERE source = 'crdc_absenteeism' AND year = %s
                )
                UPDATE districts d SET
                    absenteeism_trend_3yr = ROUND(
                        (l.chronic_absenteeism_rate - b.chronic_absenteeism_rate)::numeric, 2
                    )
                FROM latest l
                JOIN base b ON l.leaid = b.leaid
                WHERE d.leaid = l.leaid
                  AND l.chronic_absenteeism_rate IS NOT NULL
                  AND b.chronic_absenteeism_rate IS NOT NULL
            """, (abs_years[1], abs_years[0]))  # [1]=older, [0]=newer
            print(f"Computed absenteeism trends for {cur.rowcount} districts ({abs_years[1]}→{abs_years[0]})")

    conn.commit()
    cur.close()
    conn.close()
    return pct_count
```

**Step 2: Commit**

```bash
git add scripts/etl/loaders/compute_benchmarks.py
git commit -m "etl: add district trend computation to compute_benchmarks.py

- Derived percentages: swd_pct, ell_pct
- 3-year trends: SWD, ELL, student-teacher ratio, graduation, math, reading, expenditure
- Absenteeism trend uses two most recent CRDC years (biennial data)
- All computed from district_data_history, no API calls"
```

---

### Task 9: compute_benchmarks.py — Deltas & Quartiles

**Files:**
- Modify: `scripts/etl/loaders/compute_benchmarks.py`

**Step 1: Add `compute_deltas_and_quartiles()` function**

```python
def compute_deltas_and_quartiles(connection_string: str) -> int:
    """
    Compute comparison deltas (vs state, vs national) and quartile flags.

    Deltas: district value minus benchmark average (positive = above avg)

    Quartile flags (within state):
    - well_above: top 25% (Q4)
    - above: 25-50% (Q3)
    - below: 50-75% (Q2)
    - well_below: bottom 25% (Q1)

    Returns:
        Number of districts updated
    """
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Step 1: Compute state deltas
    cur.execute("""
        UPDATE districts d SET
            absenteeism_vs_state = ROUND((d.chronic_absenteeism_rate - s.avg_chronic_absenteeism_rate)::numeric, 2),
            graduation_vs_state = ROUND((d.graduation_rate_total - s.avg_graduation_rate)::numeric, 2),
            student_teacher_ratio_vs_state = ROUND((d.student_teacher_ratio - s.avg_student_teacher_ratio)::numeric, 2),
            swd_pct_vs_state = ROUND((d.swd_pct - s.avg_swd_pct)::numeric, 2),
            ell_pct_vs_state = ROUND((d.ell_pct - s.avg_ell_pct)::numeric, 2),
            math_proficiency_vs_state = ROUND((d.math_proficiency_pct - s.avg_math_proficiency)::numeric, 2),
            read_proficiency_vs_state = ROUND((d.read_proficiency_pct - s.avg_read_proficiency)::numeric, 2),
            expenditure_pp_vs_state = ROUND((d.expenditure_per_pupil - s.avg_expenditure_per_pupil)::numeric, 2)
        FROM states s
        WHERE d.state_fips = s.fips
          AND s.fips != '00'
    """)
    state_delta_count = cur.rowcount
    print(f"Computed state deltas for {state_delta_count} districts")

    # Step 2: Compute national deltas (vs US row)
    cur.execute("""
        UPDATE districts d SET
            absenteeism_vs_national = ROUND((d.chronic_absenteeism_rate - us.avg_chronic_absenteeism_rate)::numeric, 2),
            graduation_vs_national = ROUND((d.graduation_rate_total - us.avg_graduation_rate)::numeric, 2),
            student_teacher_ratio_vs_national = ROUND((d.student_teacher_ratio - us.avg_student_teacher_ratio)::numeric, 2),
            swd_pct_vs_national = ROUND((d.swd_pct - us.avg_swd_pct)::numeric, 2),
            ell_pct_vs_national = ROUND((d.ell_pct - us.avg_ell_pct)::numeric, 2),
            math_proficiency_vs_national = ROUND((d.math_proficiency_pct - us.avg_math_proficiency)::numeric, 2),
            read_proficiency_vs_national = ROUND((d.read_proficiency_pct - us.avg_read_proficiency)::numeric, 2),
            expenditure_pp_vs_national = ROUND((d.expenditure_per_pupil - us.avg_expenditure_per_pupil)::numeric, 2)
        FROM states us
        WHERE us.fips = '00'
    """)
    national_delta_count = cur.rowcount
    print(f"Computed national deltas for {national_delta_count} districts")

    # Step 3: Compute within-state quartile flags
    # Uses NTILE(4) to divide districts into 4 equal groups within each state
    # For each metric, assigns: well_above (Q4), above (Q3), below (Q2), well_below (Q1)
    METRICS = [
        # (metric_column, quartile_column, higher_is_better)
        ("chronic_absenteeism_rate", "absenteeism_quartile_state", False),
        ("graduation_rate_total", "graduation_quartile_state", True),
        ("student_teacher_ratio", "student_teacher_ratio_quartile_state", False),
        ("swd_pct", "swd_pct_quartile_state", False),  # Higher SWD% = more need, labeled "above"
        ("ell_pct", "ell_pct_quartile_state", False),   # Same logic
        ("math_proficiency_pct", "math_proficiency_quartile_state", True),
        ("read_proficiency_pct", "read_proficiency_quartile_state", True),
        ("expenditure_per_pupil", "expenditure_pp_quartile_state", False),  # Higher spend labeled "above"
    ]

    for metric_col, quartile_col, higher_is_better in METRICS:
        # NTILE(4) assigns 1 to lowest group, 4 to highest
        # For higher_is_better metrics: Q4=well_above, Q1=well_below
        # For lower_is_better metrics: Q4=well_above (high value), Q1=well_below (low value)
        # This way "well_above" always means "notably high" regardless of metric direction
        cur.execute(f"""
            WITH ranked AS (
                SELECT leaid,
                    NTILE(4) OVER (
                        PARTITION BY state_fips
                        ORDER BY {metric_col} ASC NULLS LAST
                    ) AS quartile
                FROM districts
                WHERE {metric_col} IS NOT NULL
                  AND state_fips IS NOT NULL
            )
            UPDATE districts d SET
                {quartile_col} = CASE r.quartile
                    WHEN 4 THEN 'well_above'
                    WHEN 3 THEN 'above'
                    WHEN 2 THEN 'below'
                    WHEN 1 THEN 'well_below'
                END
            FROM ranked r
            WHERE d.leaid = r.leaid
        """)
        print(f"  {quartile_col}: {cur.rowcount} districts ranked")

    conn.commit()
    cur.close()
    conn.close()
    return state_delta_count
```

**Step 2: Commit**

```bash
git add scripts/etl/loaders/compute_benchmarks.py
git commit -m "etl: add deltas and quartile computation to compute_benchmarks.py

- State deltas: 8 metrics (district value - state avg)
- National deltas: 8 metrics (district value - US avg)
- Quartile flags: NTILE(4) within state for 8 metrics
- Values: well_above/above/below/well_below"
```

---

### Task 10: compute_benchmarks.py — CLI & Main Function

**Files:**
- Modify: `scripts/etl/loaders/compute_benchmarks.py`

**Step 1: Add CLI main function and `compute_all_benchmarks()` convenience function**

```python
def compute_all_benchmarks(connection_string: str) -> Dict:
    """
    Run all benchmark computation steps in order.

    Returns:
        Summary dict with counts from each step
    """
    print("\n" + "=" * 60)
    print("Computing District Benchmarks & Trends")
    print("=" * 60)

    print("\n--- Step 1: State & National Averages ---")
    avg_count = compute_state_averages(connection_string)

    print("\n--- Step 2: District Trends ---")
    trend_count = compute_district_trends(connection_string)

    print("\n--- Step 3: Deltas & Quartiles ---")
    delta_count = compute_deltas_and_quartiles(connection_string)

    # Log to data_refresh_logs
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO data_refresh_logs (
            data_source, records_updated, records_failed,
            status, started_at, completed_at
        ) VALUES ('compute_benchmarks', %s, 0, 'success', NOW(), NOW())
    """, (trend_count + delta_count,))
    conn.commit()
    cur.close()
    conn.close()

    return {
        "state_averages": avg_count,
        "district_trends": trend_count,
        "deltas_and_quartiles": delta_count,
    }


def main():
    """CLI entry point."""
    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description="Compute district benchmarks & trends")
    parser.add_argument("--averages", action="store_true", help="Compute state/national averages only")
    parser.add_argument("--trends", action="store_true", help="Compute district trends only")
    parser.add_argument("--deltas", action="store_true", help="Compute deltas and quartiles only")
    parser.add_argument("--all", action="store_true", help="Run all steps (default if no flags)")
    args = parser.parse_args()

    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DIRECT_URL or DATABASE_URL not set")

    # Strip Supabase-specific params
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    run_all = args.all or not (args.averages or args.trends or args.deltas)

    if run_all:
        result = compute_all_benchmarks(connection_string)
        print(f"\nBenchmark computation complete: {result}")
    else:
        if args.averages:
            compute_state_averages(connection_string)
        if args.trends:
            compute_district_trends(connection_string)
        if args.deltas:
            compute_deltas_and_quartiles(connection_string)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add scripts/etl/loaders/compute_benchmarks.py
git commit -m "etl: add CLI and compute_all_benchmarks() to compute_benchmarks.py

- compute_all_benchmarks() runs all 3 steps in order
- Logs to data_refresh_logs on completion
- CLI supports --averages, --trends, --deltas, or --all flags"
```

---

### Task 11: Wire into run_etl.py

**Files:**
- Modify: `scripts/etl/run_etl.py`

**Step 1: Add imports**

Add after the existing `historical_backfill` imports (line 43):

```python
from loaders.compute_benchmarks import compute_all_benchmarks, compute_state_averages, compute_district_trends, compute_deltas_and_quartiles
```

Also add to the `historical_backfill` import (line 39-44):

```python
from loaders.historical_backfill import (
    backfill_enrollment_history,
    backfill_finance_history,
    backfill_poverty_history,
    backfill_ell_history,
    backfill_absenteeism_history,
    compute_trend_signals,
)
```

**Step 2: Add run_benchmarks function**

Add after `run_compute_ratios()` (after line 844):

```python
def run_benchmarks(connection_string: str) -> dict:
    """
    Run benchmark computation (state averages, district trends, deltas & quartiles).
    No API calls — pure SQL against local data.

    Returns summary dict.
    """
    print("\n" + "=" * 60)
    print("Computing District Benchmarks & Trends")
    print("=" * 60)

    return compute_all_benchmarks(connection_string)
```

**Step 3: Update `run_historical_backfill()` function**

Modify the existing function (around line 796) to include ELL and absenteeism backfill:

After `poverty_count = backfill_poverty_history(...)` (line 820), add:

```python
    ell_count = backfill_ell_history(connection_string, year_list)
    print(f"ELL history: {ell_count} records")

    absenteeism_count = backfill_absenteeism_history(connection_string)
    print(f"Absenteeism history: {absenteeism_count} records")
```

Update the return dict to include the new counts.

**Step 4: Add CLI arguments**

In the argparser section (after line 1083), add:

```python
    parser.add_argument("--benchmarks", action="store_true",
                        help="Compute benchmarks (state averages, trends, deltas, quartiles)")
```

**Step 5: Wire into pipeline execution**

After the `compute_trends` block (around line 1258), add:

```python
    # Benchmark computation (state averages, trends, deltas, quartiles)
    if args.all or args.benchmarks:
        run_benchmarks(connection_string)
```

Also update the `any_step` check (line 1143-1151) to include `args.benchmarks`.

**Step 6: Commit**

```bash
git add scripts/etl/run_etl.py
git commit -m "etl: wire benchmarks into run_etl.py pipeline

- Import compute_benchmarks and new backfill functions
- Add --benchmarks CLI flag
- Add ELL and absenteeism backfill to --historical
- Benchmarks run after all other loaders via --all or --benchmarks"
```

---

### Task 12: Update states_seed.json for US Row

**Files:**
- Modify: `scripts/etl/loaders/states_seed.json`

**Step 1: Add US entry to seed data**

Add to the end of the JSON array (before the closing `]`):

```json
  {"fips": "00", "abbrev": "US", "name": "United States"}
```

This ensures `--seed-states` also creates the US row.

**Step 2: Commit**

```bash
git add scripts/etl/loaders/states_seed.json
git commit -m "data: add US national row to states seed data"
```

---

### Task 13: Test the Pipeline End-to-End

**Step 1: Run benchmarks computation only (no API calls)**

```bash
cd territory-plan/scripts/etl
python3 compute_benchmarks.py --all
```

Expected: State averages computed for ~51 states, district trends computed, deltas and quartiles assigned.

**Step 2: Verify data in database**

```bash
python3 -c "
import os, psycopg2
from dotenv import load_dotenv
load_dotenv()
conn_str = os.environ.get('DIRECT_URL', os.environ.get('DATABASE_URL', '')).split('?')[0]
conn = psycopg2.connect(conn_str)
cur = conn.cursor()

# Check state averages
cur.execute(\"\"\"
    SELECT abbrev, avg_chronic_absenteeism_rate, avg_student_teacher_ratio,
           avg_swd_pct, avg_ell_pct, avg_math_proficiency
    FROM states WHERE abbrev IN ('CA', 'TX', 'US') ORDER BY abbrev
\"\"\")
print('State averages:')
for row in cur.fetchall():
    print(f'  {row}')

# Check district benchmarks (sample)
cur.execute(\"\"\"
    SELECT name, state_abbrev, swd_pct, ell_pct,
           absenteeism_vs_state, graduation_vs_state,
           absenteeism_quartile_state, graduation_quartile_state
    FROM districts
    WHERE swd_pct IS NOT NULL AND absenteeism_quartile_state IS NOT NULL
    LIMIT 5
\"\"\")
print('\\nDistrict benchmarks (sample):')
for row in cur.fetchall():
    print(f'  {row}')

# Count coverage
cur.execute(\"\"\"
    SELECT
        COUNT(*) FILTER (WHERE swd_pct IS NOT NULL) as swd_pct,
        COUNT(*) FILTER (WHERE ell_pct IS NOT NULL) as ell_pct,
        COUNT(*) FILTER (WHERE absenteeism_vs_state IS NOT NULL) as vs_state,
        COUNT(*) FILTER (WHERE absenteeism_quartile_state IS NOT NULL) as quartiles,
        COUNT(*) FILTER (WHERE swd_trend_3yr IS NOT NULL) as swd_trends,
        COUNT(*) FILTER (WHERE math_proficiency_trend_3yr IS NOT NULL) as math_trends
    FROM districts
\"\"\")
print(f'\\nCoverage: {cur.fetchone()}')

cur.close(); conn.close()
"
```

**Step 3: Commit with verification results**

```bash
git add -A
git commit -m "verify: end-to-end benchmark pipeline test passed"
```

---

### Task 14: Push Branch and Create PR

**Step 1: Push the feature branch**

```bash
git push -u origin feature/district-benchmarks-trends
```

**Step 2: Create PR**

Use `gh pr create` with a summary of all changes.

---

## Execution Notes

- Tasks 1-3 are Prisma schema changes — do them together before the migration (Task 4)
- Task 4 (migration) must complete before any ETL work can run
- Tasks 5-6 (history backfill extensions) can be done in parallel with Tasks 7-10 (compute_benchmarks.py)
- Task 11 (wire into run_etl.py) depends on Tasks 5-10 being complete
- Task 13 (testing) depends on everything else
- The history backfill tasks (5-6) make API calls and may take a while. The compute tasks (7-10) are pure SQL and fast.
