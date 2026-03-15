# Title I School Data Enrichment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich school and district data with Title I status, FRPL counts, demographics, and Title I revenue from the Urban Institute API, and surface it in the district detail panel and explore table.

**Architecture:** New ETL loader (`urban_institute_title1.py`) follows the state-by-state pattern. Schema adds nullable fields to existing School and District models. Existing schools-by-district API endpoint gets Title I fields added to its response. Explore table gets three new filterable columns.

**Tech Stack:** Python (ETL), PostgreSQL/Prisma (schema), Next.js API routes, React/TanStack Query (frontend), TailwindCSS

**Spec:** `docs/superpowers/specs/2026-03-13-title-i-enrichment-design.md`

---

## File Structure

### New files
- `scripts/etl/loaders/urban_institute_title1.py` — Title I enrichment ETL loader (3 API passes + aggregation)

### Modified files
- `prisma/schema.prisma` — Add Title I, FRPL, demographics fields to School; Title I aggregates to District
- `scripts/etl/run_etl.py` — Add `run_title1_etl()` function and `--title1` CLI flag
- `src/app/api/schools/by-district/[leaid]/route.ts` — Add Title I/FRPL fields to response, add summary object (Note: spec proposed a new `/api/districts/[leaid]/schools` endpoint, but we reuse the existing endpoint to avoid redundancy and keep the existing `useSchoolsByDistrict` hook working without URL changes)
- `src/features/shared/types/api-types.ts` — Add Title I fields to `SchoolListItem`, add `SchoolsSummary` type
- `src/features/map/components/panels/district/CharterSchools.tsx` — Replaced by `SchoolsCard.tsx` showing all schools with Title I column
- `src/features/map/components/panels/district/DistrictInfoTab.tsx` — Use new SchoolsCard instead of CharterSchools

**Note:** `src/features/map/components/panels/district/tabs/SchoolsTab.tsx` also renders schools using `useSchoolsByDistrict`. It will automatically benefit from the new Title I fields in the API response but does not display them. Consider updating or deprecating `SchoolsTab` in a follow-up once `SchoolsCard` is proven.
- `src/features/map/components/explore/columns/districtColumns.ts` — Add Title I Schools, FRPL Rate, Title I Revenue columns
- `src/features/explore/lib/filters.ts` — Add Title I field mappings to `DISTRICT_FIELD_MAP`

---

## Chunk 1: Schema & Migration

### Task 1: Add Title I fields to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:882-922` (School model)
- Modify: `prisma/schema.prisma` (District model, after existing fields ~line 240)

- [ ] **Step 1: Add Title I, FRPL, and demographics fields to School model**

In `prisma/schema.prisma`, add after the `directoryDataYear` field (line 902) and before the CRM fields section:

```prisma
  // ===== Title I Data =====
  // Source: Urban Institute API (CCD directory endpoint)
  titleIStatus       Int?  @map("title_i_status")
  titleIEligible     Int?  @map("title_i_eligible")
  titleISchoolwide   Int?  @map("title_i_schoolwide")
  titleIDataYear     Int?  @map("title_i_data_year")

  // ===== Free/Reduced Price Lunch =====
  // Source: Urban Institute API (CCD directory endpoint)
  freeLunch          Int?  @map("free_lunch")
  reducedPriceLunch  Int?  @map("reduced_price_lunch")
  frplTotal          Int?  @map("frpl_total")

  // ===== Demographics =====
  // Source: Urban Institute API (CCD enrollment/race endpoint, grade-99 totals)
  enrollmentWhite           Int? @map("enrollment_white")
  enrollmentBlack           Int? @map("enrollment_black")
  enrollmentHispanic        Int? @map("enrollment_hispanic")
  enrollmentAsian           Int? @map("enrollment_asian")
  enrollmentAmericanIndian  Int? @map("enrollment_american_indian")
  enrollmentPacificIslander Int? @map("enrollment_pacific_islander")
  enrollmentTwoOrMore       Int? @map("enrollment_two_or_more")
  demographicsDataYear      Int? @map("demographics_data_year")
```

- [ ] **Step 2: Add Title I aggregate fields to District model**

In `prisma/schema.prisma`, add after the existing demographics section on the District model (after `enrollmentTwoOrMore` around line 145) or in a new section before the Relations block:

```prisma
  // ===== Title I Aggregates =====
  // Source: Computed from schools table + Urban Institute finance endpoint
  titleISchoolCount      Int?     @map("title_i_school_count")
  titleISchoolwideCount  Int?     @map("title_i_schoolwide_count")
  totalSchoolCount       Int?     @map("total_school_count")
  frplTotalCount         Int?     @map("frpl_total_count")
  frplRate               Decimal? @map("frpl_rate") @db.Decimal(5, 2)
  titleIRevenue          Decimal? @map("title_i_revenue") @db.Decimal(15, 2)
```

- [ ] **Step 3: Generate and apply Prisma migration**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan
npx prisma migrate dev --name add_title1_frpl_demographics
```

Expected: Migration created successfully, schema synced.

- [ ] **Step 4: Verify migration**

Run:
```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add Title I, FRPL, demographics fields to School and District models"
```

---

## Chunk 2: ETL Loader

### Task 2: Create the Title I enrichment ETL loader

**Files:**
- Create: `scripts/etl/loaders/urban_institute_title1.py`

Reference files for patterns:
- `scripts/etl/loaders/state_by_state_loader.py` — `_fetch_paginated()`, state iteration, `STATES_50_DC`, `clean_connection_string()`
- `scripts/etl/loaders/urban_institute_poverty.py` — temp table + bulk UPDATE pattern

- [ ] **Step 1: Create the loader file with imports and helpers**

Create `scripts/etl/loaders/urban_institute_title1.py`:

```python
"""
Urban Institute Title I / FRPL / Demographics Enrichment Loader

Enriches existing school rows with Title I status, FRPL counts, and race/ethnicity
demographics. Also fetches district-level Title I revenue and computes district-level
Title I aggregates.

Runs state-by-state (by FIPS code) to avoid API timeouts.
Requires schools to already be loaded via urban_institute_schools.py.

API Docs: https://educationdata.urban.org/documentation/
Endpoints:
  1. /schools/ccd/directory/{year}/ — Title I + FRPL
  2. /schools/ccd/enrollment/{year}/grade-99/race/ — Demographics
  3. /school-districts/ccd/finance/{year}/ — Title I revenue
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import requests
from tqdm import tqdm
from dotenv import load_dotenv

API_BASE_URL = "https://educationdata.urban.org/api/v1"

# Load state FIPS codes from seed file
STATES_SEED = Path(__file__).parent / "states_seed.json"
with open(STATES_SEED) as f:
    ALL_STATES = json.load(f)

STATES_50_DC = [s for s in ALL_STATES if int(s["fips"]) <= 56]


def clean_connection_string(conn_str: str) -> str:
    """Strip Supabase/Prisma-specific params that psycopg2 doesn't understand."""
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    PSYCOPG2_PARAMS = {
        "sslmode", "sslcert", "sslkey", "sslrootcert", "sslcrl",
        "connect_timeout", "application_name", "options",
        "keepalives", "keepalives_idle", "keepalives_interval", "keepalives_count",
    }
    parsed = urlparse(conn_str)
    params = parse_qs(parsed.query)
    clean_params = {k: v for k, v in params.items() if k in PSYCOPG2_PARAMS}
    clean_query = urlencode(clean_params, doseq=True)
    return urlunparse(parsed._replace(query=clean_query))


def _safe_int(val) -> Optional[int]:
    """Convert API value to int, treating negatives (sentinel values) as NULL."""
    if val is None:
        return None
    try:
        v = int(val)
        return v if v >= 0 else None
    except (ValueError, TypeError):
        return None


def _safe_float(val) -> Optional[float]:
    """Convert API value to float, treating negatives as NULL."""
    if val is None:
        return None
    try:
        v = float(val)
        return v if v >= 0 else None
    except (ValueError, TypeError):
        return None


def _fetch_paginated(
    url: str,
    fips: str,
    extra_params: Optional[Dict] = None,
    page_size: int = 10000,
    delay: float = 0.3,
    timeout: int = 60,
    max_retries: int = 2,
) -> List[Dict]:
    """Generic paginated fetch with state FIPS filter and retries."""
    all_results = []
    page = 1

    while True:
        params = {"fips": int(fips), "page": page, "per_page": page_size}
        if extra_params:
            params.update(extra_params)

        for attempt in range(max_retries + 1):
            try:
                response = requests.get(url, params=params, timeout=timeout)
                response.raise_for_status()
                data = response.json()
                break
            except requests.RequestException as e:
                if attempt < max_retries:
                    wait = 2 ** (attempt + 1)
                    print(f"    Retry {attempt+1} in {wait}s: {e}")
                    time.sleep(wait)
                else:
                    print(f"    Failed after {max_retries+1} attempts: {e}")
                    return all_results

        results = data.get("results", [])
        if not results:
            break

        all_results.extend(results)

        if not data.get("next"):
            break

        page += 1
        time.sleep(delay)

    return all_results
```

- [ ] **Step 2: Add Pass 1 — School Title I + FRPL fetch and upsert**

Append to `urban_institute_title1.py`:

```python
# ---------------------------------------------------------------------------
# Pass 1: School Title I + FRPL
# ---------------------------------------------------------------------------

def fetch_title1_all_states(
    year: int = 2022,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
) -> List[Dict]:
    """Fetch school Title I + FRPL data state-by-state from CCD directory."""
    url = f"{API_BASE_URL}/schools/ccd/directory/{year}/"
    all_records = []
    started = resume_from_fips is None

    for state in tqdm(STATES_50_DC, desc=f"Title I {year}"):
        fips = state["fips"]
        if not started:
            if fips == resume_from_fips:
                started = True
            else:
                continue

        results = _fetch_paginated(url, fips, delay=delay)

        for record in results:
            ncessch = record.get("ncessch")
            if not ncessch:
                continue

            # Use API's combined field, fall back to sum
            frpl_combined = _safe_int(record.get("free_or_reduced_price_lunch"))
            free = _safe_int(record.get("free_lunch"))
            reduced = _safe_int(record.get("reduced_price_lunch"))
            if frpl_combined is None and free is not None and reduced is not None:
                frpl_combined = free + reduced

            all_records.append({
                "ncessch": str(ncessch).zfill(12),
                "title_i_status": _safe_int(record.get("title_i_status")),
                "title_i_eligible": _safe_int(record.get("title_i_eligible")),
                "title_i_schoolwide": _safe_int(record.get("title_i_schoolwide")),
                "free_lunch": free,
                "reduced_price_lunch": reduced,
                "frpl_total": frpl_combined,
            })

        tqdm.write(f"  {state['abbrev']}: {len(results)} schools")

    print(f"Total Title I records: {len(all_records)}")
    return all_records


def upsert_title1_data(
    connection_string: str,
    records: List[Dict],
    year: int,
    batch_size: int = 1000,
) -> int:
    """Update existing school rows with Title I + FRPL data via temp table."""
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        CREATE TEMP TABLE title1_updates (
            ncessch VARCHAR(12) PRIMARY KEY,
            title_i_status INTEGER,
            title_i_eligible INTEGER,
            title_i_schoolwide INTEGER,
            free_lunch INTEGER,
            reduced_price_lunch INTEGER,
            frpl_total INTEGER
        )
    """)

    insert_sql = """
        INSERT INTO title1_updates (
            ncessch, title_i_status, title_i_eligible, title_i_schoolwide,
            free_lunch, reduced_price_lunch, frpl_total
        ) VALUES %s
    """

    values = [
        (
            r["ncessch"],
            r.get("title_i_status"),
            r.get("title_i_eligible"),
            r.get("title_i_schoolwide"),
            r.get("free_lunch"),
            r.get("reduced_price_lunch"),
            r.get("frpl_total"),
        )
        for r in records
    ]

    print(f"Loading {len(values)} Title I records into temp table...")
    for i in tqdm(range(0, len(values), batch_size), desc="Loading"):
        batch = values[i:i + batch_size]
        execute_values(cur, insert_sql, batch, template="(%s, %s, %s, %s, %s, %s, %s)")

    cur.execute("""
        UPDATE schools s SET
            title_i_status = u.title_i_status,
            title_i_eligible = u.title_i_eligible,
            title_i_schoolwide = u.title_i_schoolwide,
            free_lunch = u.free_lunch,
            reduced_price_lunch = u.reduced_price_lunch,
            frpl_total = u.frpl_total,
            title_i_data_year = %s,
            updated_at = NOW()
        FROM title1_updates u
        WHERE s.ncessch = u.ncessch
    """, (year,))
    updated = cur.rowcount
    print(f"Updated {updated} school rows with Title I data")

    cur.execute("DROP TABLE title1_updates")
    conn.commit()
    cur.close()
    conn.close()
    return updated
```

- [ ] **Step 3: Add Pass 2 — School demographics fetch and upsert**

Append to `urban_institute_title1.py`:

```python
# ---------------------------------------------------------------------------
# Pass 2: School Demographics (race/ethnicity)
# ---------------------------------------------------------------------------

def fetch_demographics_all_states(
    year: int = 2022,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
) -> List[Dict]:
    """Fetch school enrollment by race state-by-state."""
    url = f"{API_BASE_URL}/schools/ccd/enrollment/{year}/grade-99/race/"
    all_records = []
    started = resume_from_fips is None

    for state in tqdm(STATES_50_DC, desc=f"Demographics {year}"):
        fips = state["fips"]
        if not started:
            if fips == resume_from_fips:
                started = True
            else:
                continue

        results = _fetch_paginated(url, fips, delay=delay)

        # Aggregate race rows per school (API returns one row per race)
        schools: Dict[str, Dict] = {}
        for record in results:
            ncessch = record.get("ncessch")
            race = record.get("race")
            enrollment = _safe_int(record.get("enrollment"))
            if not ncessch or race is None:
                continue

            ncessch_str = str(ncessch).zfill(12)
            if ncessch_str not in schools:
                schools[ncessch_str] = {"ncessch": ncessch_str}

            # NCES race codes: 1=White, 2=Black, 3=Hispanic, 4=Asian,
            # 5=American Indian, 6=Pacific Islander, 7=Two or More, 99=Total
            race_map = {
                1: "enrollment_white",
                2: "enrollment_black",
                3: "enrollment_hispanic",
                4: "enrollment_asian",
                5: "enrollment_american_indian",
                6: "enrollment_pacific_islander",
                7: "enrollment_two_or_more",
            }
            if race in race_map:
                schools[ncessch_str][race_map[race]] = enrollment

        all_records.extend(schools.values())
        tqdm.write(f"  {state['abbrev']}: {len(schools)} schools with demographics")

    print(f"Total demographics records: {len(all_records)}")
    return all_records


def upsert_demographics_data(
    connection_string: str,
    records: List[Dict],
    year: int,
    batch_size: int = 1000,
) -> int:
    """Update existing school rows with demographics data via temp table."""
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        CREATE TEMP TABLE demo_updates (
            ncessch VARCHAR(12) PRIMARY KEY,
            enrollment_white INTEGER,
            enrollment_black INTEGER,
            enrollment_hispanic INTEGER,
            enrollment_asian INTEGER,
            enrollment_american_indian INTEGER,
            enrollment_pacific_islander INTEGER,
            enrollment_two_or_more INTEGER
        )
    """)

    insert_sql = """
        INSERT INTO demo_updates (
            ncessch, enrollment_white, enrollment_black, enrollment_hispanic,
            enrollment_asian, enrollment_american_indian, enrollment_pacific_islander,
            enrollment_two_or_more
        ) VALUES %s
    """

    values = [
        (
            r["ncessch"],
            r.get("enrollment_white"),
            r.get("enrollment_black"),
            r.get("enrollment_hispanic"),
            r.get("enrollment_asian"),
            r.get("enrollment_american_indian"),
            r.get("enrollment_pacific_islander"),
            r.get("enrollment_two_or_more"),
        )
        for r in records
    ]

    print(f"Loading {len(values)} demographics records into temp table...")
    for i in tqdm(range(0, len(values), batch_size), desc="Loading"):
        batch = values[i:i + batch_size]
        execute_values(cur, insert_sql, batch, template="(%s, %s, %s, %s, %s, %s, %s, %s)")

    cur.execute("""
        UPDATE schools s SET
            enrollment_white = u.enrollment_white,
            enrollment_black = u.enrollment_black,
            enrollment_hispanic = u.enrollment_hispanic,
            enrollment_asian = u.enrollment_asian,
            enrollment_american_indian = u.enrollment_american_indian,
            enrollment_pacific_islander = u.enrollment_pacific_islander,
            enrollment_two_or_more = u.enrollment_two_or_more,
            demographics_data_year = %s,
            updated_at = NOW()
        FROM demo_updates u
        WHERE s.ncessch = u.ncessch
    """, (year,))
    updated = cur.rowcount
    print(f"Updated {updated} school rows with demographics data")

    cur.execute("DROP TABLE demo_updates")
    conn.commit()
    cur.close()
    conn.close()
    return updated
```

- [ ] **Step 4: Add Pass 3 — District Title I revenue fetch and upsert**

Append to `urban_institute_title1.py`:

```python
# ---------------------------------------------------------------------------
# Pass 3: District Title I Revenue
# ---------------------------------------------------------------------------

def fetch_title1_revenue_all_states(
    year: int = 2020,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
) -> List[Dict]:
    """Fetch district Title I revenue from finance endpoint state-by-state."""
    url = f"{API_BASE_URL}/school-districts/ccd/finance/{year}/"
    all_records = []
    started = resume_from_fips is None

    for state in tqdm(STATES_50_DC, desc=f"Title I Revenue {year}"):
        fips = state["fips"]
        if not started:
            if fips == resume_from_fips:
                started = True
            else:
                continue

        results = _fetch_paginated(url, fips, delay=delay)

        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            revenue = _safe_float(record.get("rev_fed_state_title_i"))
            if revenue is not None:
                all_records.append({
                    "leaid": str(leaid).zfill(7),
                    "title_i_revenue": revenue,
                })

        tqdm.write(f"  {state['abbrev']}: {len(results)} districts")

    print(f"Total Title I revenue records: {len(all_records)}")
    return all_records


def upsert_title1_revenue(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 1000,
) -> int:
    """Update existing district rows with Title I revenue via temp table."""
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        CREATE TEMP TABLE revenue_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            title_i_revenue NUMERIC
        )
    """)

    insert_sql = """
        INSERT INTO revenue_updates (leaid, title_i_revenue)
        VALUES %s
    """

    values = [(r["leaid"], r["title_i_revenue"]) for r in records]

    print(f"Loading {len(values)} revenue records into temp table...")
    for i in tqdm(range(0, len(values), batch_size), desc="Loading"):
        batch = values[i:i + batch_size]
        execute_values(cur, insert_sql, batch, template="(%s, %s)")

    cur.execute("""
        UPDATE districts d SET
            title_i_revenue = u.title_i_revenue,
            updated_at = NOW()
        FROM revenue_updates u
        WHERE d.leaid = u.leaid
    """)
    updated = cur.rowcount
    print(f"Updated {updated} district rows with Title I revenue")

    cur.execute("DROP TABLE revenue_updates")
    conn.commit()
    cur.close()
    conn.close()
    return updated
```

- [ ] **Step 5: Add aggregation step and CLI main**

Append to `urban_institute_title1.py`:

```python
# ---------------------------------------------------------------------------
# Step 4: District-Level Title I Aggregation
# ---------------------------------------------------------------------------

def aggregate_district_title1(connection_string: str) -> int:
    """Compute district-level Title I aggregates from school data."""
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    print("Computing district Title I aggregates...")

    cur.execute("""
        UPDATE districts d SET
            title_i_school_count = agg.t1_count,
            title_i_schoolwide_count = agg.t1_sw_count,
            total_school_count = agg.total_count,
            frpl_total_count = agg.frpl_sum,
            frpl_rate = CASE
                WHEN agg.enrollment_sum > 0 AND agg.frpl_sum IS NOT NULL
                THEN ROUND((agg.frpl_sum::numeric / agg.enrollment_sum) * 100, 2)
                ELSE NULL
            END,
            updated_at = NOW()
        FROM (
            SELECT
                leaid,
                COUNT(*) FILTER (WHERE title_i_eligible = 1) as t1_count,
                COUNT(*) FILTER (WHERE title_i_schoolwide = 1) as t1_sw_count,
                COUNT(*) as total_count,
                SUM(frpl_total) as frpl_sum,
                SUM(enrollment) as enrollment_sum
            FROM schools
            WHERE school_status = 1 OR school_status IS NULL
            GROUP BY leaid
        ) agg
        WHERE d.leaid = agg.leaid
    """)

    updated = cur.rowcount
    print(f"Updated {updated} districts with Title I aggregates")

    conn.commit()
    cur.close()
    conn.close()
    return updated


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def log_refresh(
    connection_string: str,
    data_source: str,
    data_year: int,
    records_updated: int,
    records_failed: int,
    status: str,
    error_message: Optional[str] = None,
    started_at: Optional[str] = None,
):
    """Log the data refresh to the data_refresh_logs table."""
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO data_refresh_logs (
            data_source, data_year, records_updated, records_failed,
            status, error_message, started_at, completed_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
    """, (
        data_source, data_year, records_updated, records_failed,
        status, error_message, started_at or datetime.now().isoformat(),
    ))
    conn.commit()
    cur.close()
    conn.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Enrich schools with Title I, FRPL, and demographics data"
    )
    parser.add_argument("--year", type=int, default=2022, help="Data year (default: 2022)")
    parser.add_argument("--finance-year", type=int, default=None,
                        help="Finance data year for Title I revenue (default: same as --year)")
    parser.add_argument("--fips", type=str, default=None, help="Single state FIPS code")
    parser.add_argument("--start-fips", type=str, default=None, help="Resume from this FIPS code")
    parser.add_argument("--no-title1", action="store_true", help="Skip Title I + FRPL pass")
    parser.add_argument("--no-demographics", action="store_true", help="Skip demographics pass")
    parser.add_argument("--no-revenue", action="store_true", help="Skip Title I revenue pass")
    parser.add_argument("--no-aggregate", action="store_true", help="Skip district aggregation")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between API calls")
    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    connection_string = clean_connection_string(connection_string)
    finance_year = args.finance_year or args.year
    started_at = datetime.now().isoformat()
    total_updated = 0
    total_failed = 0

    try:
        # Pass 1: Title I + FRPL
        if not args.no_title1:
            print("\n" + "=" * 60)
            print("Pass 1: School Title I + FRPL")
            print("=" * 60)
            records = fetch_title1_all_states(
                year=args.year,
                delay=args.delay,
                resume_from_fips=args.start_fips or args.fips,
            )
            if records:
                updated = upsert_title1_data(connection_string, records, args.year)
                total_updated += updated

        # Pass 2: Demographics
        if not args.no_demographics:
            print("\n" + "=" * 60)
            print("Pass 2: School Demographics")
            print("=" * 60)
            records = fetch_demographics_all_states(
                year=args.year,
                delay=args.delay,
                resume_from_fips=args.start_fips or args.fips,
            )
            if records:
                updated = upsert_demographics_data(connection_string, records, args.year)
                total_updated += updated

        # Pass 3: Title I Revenue
        if not args.no_revenue:
            print("\n" + "=" * 60)
            print("Pass 3: District Title I Revenue")
            print("=" * 60)
            records = fetch_title1_revenue_all_states(
                year=finance_year,
                delay=args.delay,
                resume_from_fips=args.start_fips or args.fips,
            )
            if records:
                updated = upsert_title1_revenue(connection_string, records)
                total_updated += updated

        # Step 4: Aggregation
        if not args.no_aggregate:
            print("\n" + "=" * 60)
            print("Step 4: District Title I Aggregation")
            print("=" * 60)
            aggregate_district_title1(connection_string)

        log_refresh(
            connection_string,
            data_source="urban_institute_title1",
            data_year=args.year,
            records_updated=total_updated,
            records_failed=total_failed,
            status="success",
            started_at=started_at,
        )

        print(f"\nDone. Total records updated: {total_updated}")

    except Exception as e:
        print(f"\nError: {e}")
        log_refresh(
            connection_string,
            data_source="urban_institute_title1",
            data_year=args.year,
            records_updated=total_updated,
            records_failed=total_failed,
            status="failed",
            error_message=str(e),
            started_at=started_at,
        )
        raise


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Commit**

```bash
git add scripts/etl/loaders/urban_institute_title1.py
git commit -m "feat(etl): add Title I / FRPL / demographics enrichment loader"
```

### Task 3: Integrate into run_etl.py

**Files:**
- Modify: `scripts/etl/run_etl.py`

- [ ] **Step 1: Add import at top of run_etl.py**

Add after the existing `urban_institute_schools` import (around line 48):

```python
from loaders.urban_institute_title1 import (
    fetch_title1_all_states, upsert_title1_data,
    fetch_demographics_all_states, upsert_demographics_data,
    fetch_title1_revenue_all_states, upsert_title1_revenue,
    aggregate_district_title1,
)
```

- [ ] **Step 2: Add run_title1_etl function**

Add after `run_schools_by_state_etl` (around line 600):

```python
def run_title1_etl(
    connection_string: str,
    year: int = 2022,
    finance_year: int = None,
    start_fips: str = None,
    skip_title1: bool = False,
    skip_demographics: bool = False,
    skip_revenue: bool = False,
) -> dict:
    """
    Run Title I / FRPL / Demographics enrichment ETL.
    Requires schools to already be loaded.
    """
    print("\n" + "=" * 60)
    print("Title I / FRPL / Demographics Enrichment")
    print("=" * 60)

    finance_year = finance_year or year
    results = {"title1": 0, "demographics": 0, "revenue": 0, "aggregated": 0}

    if not skip_title1:
        records = fetch_title1_all_states(year=year, resume_from_fips=start_fips)
        if records:
            results["title1"] = upsert_title1_data(connection_string, records, year)

    if not skip_demographics:
        records = fetch_demographics_all_states(year=year, resume_from_fips=start_fips)
        if records:
            results["demographics"] = upsert_demographics_data(connection_string, records, year)

    if not skip_revenue:
        records = fetch_title1_revenue_all_states(year=finance_year, resume_from_fips=start_fips)
        if records:
            results["revenue"] = upsert_title1_revenue(connection_string, records)

    results["aggregated"] = aggregate_district_title1(connection_string)

    print(f"Title I ETL complete: {results}")
    return results
```

- [ ] **Step 3: Add --title1 CLI argument**

In the argparse section (around line 1090), add:

```python
    parser.add_argument("--title1", action="store_true",
                        help="Run Title I / FRPL / Demographics enrichment ETL")
```

- [ ] **Step 4: Add execution block**

In the main execution section, add handling for the `--title1` flag (follow the pattern of other `args.*` blocks):

```python
    if args.title1:
        run_title1_etl(
            connection_string,
            year=args.year,
            start_fips=args.start_fips,
        )
```

- [ ] **Step 5: Commit**

```bash
git add scripts/etl/run_etl.py
git commit -m "feat(etl): integrate Title I enrichment loader into run_etl.py"
```

---

## Chunk 3: API & Types

### Task 4: Update SchoolListItem type and schools-by-district API

**Files:**
- Modify: `src/features/shared/types/api-types.ts:703-714`
- Modify: `src/app/api/schools/by-district/[leaid]/route.ts`

- [ ] **Step 1: Add Title I fields to SchoolListItem type**

In `src/features/shared/types/api-types.ts`, update the `SchoolListItem` interface (around line 703):

```typescript
export interface SchoolListItem {
  ncessch: string;
  leaid: string;
  schoolName: string;
  charter: number;
  schoolLevel: number | null;
  enrollment: number | null;
  lograde: string | null;
  higrade: string | null;
  schoolStatus: number | null;
  // Title I
  titleIStatus: number | null;
  titleIEligible: number | null;
  titleISchoolwide: number | null;
  // FRPL
  freeLunch: number | null;
  reducedPriceLunch: number | null;
  frplTotal: number | null;
  // Existing
  enrollmentHistory?: { year: number; enrollment: number | null }[];
}

export interface SchoolsSummary {
  totalSchools: number;
  titleISchools: number;
  titleISchoolwide: number;
  frplTotal: number;
  frplRate: number | null;
}
```

- [ ] **Step 2: Update schools-by-district API to include Title I fields and summary**

Replace the content of `src/app/api/schools/by-district/[leaid]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;
    const url = request.nextUrl;
    const includeAll = url.searchParams.get("includeAll") === "true";

    const where: Record<string, unknown> = { leaid };
    if (!includeAll) {
      where.OR = [{ schoolStatus: 1 }, { schoolStatus: null }];
    }

    const schools = await prisma.school.findMany({
      where,
      include: {
        enrollmentHistory: {
          orderBy: { year: "asc" },
        },
      },
      orderBy: { schoolName: "asc" },
    });

    const schoolList = schools.map((s) => ({
      ncessch: s.ncessch,
      leaid: s.leaid,
      schoolName: s.schoolName,
      charter: s.charter,
      schoolLevel: s.schoolLevel,
      enrollment: s.enrollment,
      lograde: s.lograde,
      higrade: s.higrade,
      schoolStatus: s.schoolStatus,
      titleIStatus: s.titleIStatus,
      titleIEligible: s.titleIEligible,
      titleISchoolwide: s.titleISchoolwide,
      freeLunch: s.freeLunch,
      reducedPriceLunch: s.reducedPriceLunch,
      frplTotal: s.frplTotal,
      enrollmentHistory: s.enrollmentHistory.map((eh) => ({
        year: eh.year,
        enrollment: eh.enrollment,
      })),
    }));

    const totalSchools = schoolList.length;
    const titleISchools = schoolList.filter((s) => s.titleIEligible === 1).length;
    const titleISchoolwide = schoolList.filter((s) => s.titleISchoolwide === 1).length;
    const frplTotal = schoolList.reduce((sum, s) => sum + (s.frplTotal || 0), 0);
    const enrollmentTotal = schoolList.reduce((sum, s) => sum + (s.enrollment || 0), 0);

    return NextResponse.json({
      schools: schoolList,
      total: totalSchools,
      summary: {
        totalSchools,
        titleISchools,
        titleISchoolwide,
        frplTotal,
        frplRate: enrollmentTotal > 0 ? Math.round((frplTotal / enrollmentTotal) * 1000) / 10 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching schools by district:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools for district" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/types/api-types.ts src/app/api/schools/by-district/\[leaid\]/route.ts
git commit -m "feat(api): add Title I and FRPL fields to schools-by-district endpoint"
```

---

## Chunk 4: Frontend — District Detail Panel

### Task 5: Create SchoolsCard component with Title I table

**Files:**
- Create: `src/features/map/components/panels/district/SchoolsCard.tsx`
- Modify: `src/features/map/components/panels/district/DistrictInfoTab.tsx`

- [ ] **Step 1: Create SchoolsCard component**

Create `src/features/map/components/panels/district/SchoolsCard.tsx`. This replaces the charter-only view with a full schools table showing Title I status:

```tsx
"use client";

import { useState } from "react";
import { useSchoolsByDistrict } from "@/lib/api";
import type { SchoolListItem, SchoolsSummary } from "@/features/shared/types/api-types";

const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Primary",
  2: "Middle",
  3: "High",
  4: "Other",
};

const TITLE_I_LABELS: Record<number, string> = {
  1: "Eligible (No Program)",
  2: "Targeted",
  3: "Eligible (Not Participating)",
  4: "Eligible (Unknown)",
  5: "Schoolwide",
  6: "Not Eligible",
};

type SortKey = "schoolName" | "enrollment" | "titleI" | "frpl" | "frplPct";
type SortDir = "asc" | "desc";

function sortSchools(schools: SchoolListItem[], key: SortKey, dir: SortDir) {
  return [...schools].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;

    switch (key) {
      case "schoolName":
        av = a.schoolName.toLowerCase();
        bv = b.schoolName.toLowerCase();
        return dir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
      case "enrollment":
        av = a.enrollment ?? -1;
        bv = b.enrollment ?? -1;
        break;
      case "titleI":
        av = a.titleIStatus ?? 99;
        bv = b.titleIStatus ?? 99;
        break;
      case "frpl":
        av = a.frplTotal ?? -1;
        bv = b.frplTotal ?? -1;
        break;
      case "frplPct":
        av = a.frplTotal && a.enrollment ? a.frplTotal / a.enrollment : -1;
        bv = b.frplTotal && b.enrollment ? b.frplTotal / b.enrollment : -1;
        break;
    }
    return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

interface SchoolsCardProps {
  leaid: string;
}

export default function SchoolsCard({ leaid }: SchoolsCardProps) {
  const { data, isLoading } = useSchoolsByDistrict(leaid);
  const [sortKey, setSortKey] = useState<SortKey>("schoolName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="px-3 py-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Schools
        </h3>
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-gray-100 rounded" />
          <div className="h-6 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const schools = data?.schools || [];
  const summary: SchoolsSummary | undefined = data?.summary;
  if (schools.length === 0) return null;

  const sorted = sortSchools(schools, sortKey, sortDir);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "schoolName" ? "asc" : "desc");
    }
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left mb-2"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Schools
          </h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
            {schools.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <>
          {/* Title I Summary */}
          {summary && summary.titleISchools > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              <span className="font-medium text-gray-700">Title I:</span>{" "}
              {summary.titleISchools} of {summary.totalSchools} schools
              {summary.titleISchoolwide > 0 && ` (${summary.titleISchoolwide} schoolwide)`}
              {summary.frplRate != null && ` · ${summary.frplRate}% FRPL`}
            </p>
          )}

          {/* Table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-1 pr-2 font-medium cursor-pointer hover:text-gray-600" onClick={() => toggleSort("schoolName")}>
                    Name{arrow("schoolName")}
                  </th>
                  <th className="pb-1 px-1 font-medium text-right cursor-pointer hover:text-gray-600 whitespace-nowrap" onClick={() => toggleSort("enrollment")}>
                    Enr{arrow("enrollment")}
                  </th>
                  <th className="pb-1 px-1 font-medium cursor-pointer hover:text-gray-600 whitespace-nowrap" onClick={() => toggleSort("titleI")}>
                    Title I{arrow("titleI")}
                  </th>
                  <th className="pb-1 pl-1 font-medium text-right cursor-pointer hover:text-gray-600 whitespace-nowrap" onClick={() => toggleSort("frplPct")}>
                    FRPL %{arrow("frplPct")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((school) => {
                  const frplPct =
                    school.frplTotal != null && school.enrollment
                      ? Math.round((school.frplTotal / school.enrollment) * 1000) / 10
                      : null;

                  return (
                    <tr key={school.ncessch} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-1.5 pr-2">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">
                          {school.schoolName}
                        </p>
                        <span className="text-gray-400">
                          {school.schoolLevel != null && SCHOOL_LEVEL_LABELS[school.schoolLevel]
                            ? SCHOOL_LEVEL_LABELS[school.schoolLevel]
                            : ""}
                          {school.lograde && school.higrade ? ` ${school.lograde}–${school.higrade}` : ""}
                        </span>
                      </td>
                      <td className="py-1.5 px-1 text-right text-gray-700 tabular-nums">
                        {school.enrollment?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-1.5 px-1">
                        <TitleIBadge status={school.titleIStatus} />
                      </td>
                      <td className="py-1.5 pl-1 text-right text-gray-700 tabular-nums">
                        {frplPct != null ? `${frplPct}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TitleIBadge({ status }: { status: number | null }) {
  if (status == null) return <span className="text-gray-300">—</span>;

  const label = TITLE_I_LABELS[status] ?? `Code ${status}`;
  const isEligible = status !== 6;

  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
        status === 5
          ? "bg-[#403770]/10 text-[#403770]"
          : status === 2
            ? "bg-[#5B8DB8]/10 text-[#5B8DB8]"
            : isEligible
              ? "bg-gray-100 text-gray-600"
              : "bg-gray-50 text-gray-400"
      }`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Update DistrictInfoTab to use SchoolsCard instead of CharterSchools**

In `src/features/map/components/panels/district/DistrictInfoTab.tsx`:

Replace the import:
```typescript
// Old:
import CharterSchools from "./CharterSchools";
// New:
import SchoolsCard from "./SchoolsCard";
```

Replace the usage:
```typescript
// Old:
      {/* Charter Schools */}
      <CharterSchools leaid={leaid} />
// New:
      {/* Schools (Title I, FRPL) */}
      <SchoolsCard leaid={leaid} />
```

- [ ] **Step 3: Update useSchoolsByDistrict return type**

In `src/features/districts/lib/queries.ts`, update the query return type (around line 179):

```typescript
    queryFn: () =>
      fetchJson<{ schools: SchoolListItem[]; total: number; summary: SchoolsSummary }>(
        `${API_BASE}/schools/by-district/${leaid}`
      ),
```

And add `SchoolsSummary` to the imports from `api-types` (around line 6-17):

```typescript
import type {
  // ... existing imports
  SchoolsSummary,
} from "@/features/shared/types/api-types";
```

Note: `@/lib/api.ts` is a barrel re-export, so consumers like `SchoolsCard` import from `@/lib/api` while the type definition lives in `@/features/shared/types/api-types.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/panels/district/SchoolsCard.tsx \
        src/features/map/components/panels/district/DistrictInfoTab.tsx \
        src/features/districts/lib/queries.ts
git commit -m "feat(ui): add SchoolsCard with Title I table to district detail panel"
```

---

## Chunk 5: Explore Table Columns & Filters

### Task 6: Add Title I columns to explore table

**Files:**
- Modify: `src/features/map/components/explore/columns/districtColumns.ts`
- Modify: `src/features/explore/lib/filters.ts`

- [ ] **Step 1: Add Title I fields to DistrictRow interface**

In `districtColumns.ts`, add to the `DistrictRow` interface (after `charterEnrollment` around line 72):

```typescript
  titleISchoolCount: number | null;
  titleISchoolwideCount: number | null;
  totalSchoolCount: number | null;
  frplRate: number | null;
  titleIRevenue: number | null;
```

- [ ] **Step 2: Add Title I column definitions**

In `districtColumns.ts`, add to the `districtColumns` array. Find the Demographics group section and add a new "Title I" group after it:

```typescript
  // ---- Title I ----
  {
    key: "titleISchoolCount",
    label: "Title I Schools",
    group: "Title I",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "frplRate",
    label: "FRPL Rate",
    group: "Title I",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "titleIRevenue",
    label: "Title I Revenue",
    group: "Title I",
    isDefault: false,
    filterType: "number",
  },
```

- [ ] **Step 3: Add Title I fields to DISTRICT_FIELD_MAP**

In `src/features/explore/lib/filters.ts`, add to `DISTRICT_FIELD_MAP` after the charter entries (around line 81):

```typescript
  // Title I
  titleISchoolCount: "titleISchoolCount",
  titleISchoolwideCount: "titleISchoolwideCount",
  totalSchoolCount: "totalSchoolCount",
  frplRate: "frplRate",
  titleIRevenue: "titleIRevenue",
```

- [ ] **Step 4: Verify the explore API returns the new fields**

The explore API at `src/app/api/explore/[entity]/route.ts` uses `DISTRICT_FIELD_MAP` as the allow-list for filters and sorts. It selects all fields from the Prisma `district` model by default, so the new fields will automatically appear in the response once they're in the schema and field map. No changes needed to the explore route itself.

Run:
```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/explore/columns/districtColumns.ts \
        src/features/explore/lib/filters.ts
git commit -m "feat(explore): add Title I Schools, FRPL Rate, Title I Revenue columns"
```

---

## Chunk 6: Verification

### Task 7: End-to-end verification

- [ ] **Step 1: Run TypeScript compiler**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 3: Test ETL loader dry run (single state)**

```bash
cd scripts/etl
python3 -c "
from loaders.urban_institute_title1 import _fetch_paginated, _safe_int, API_BASE_URL
# Test fetching Title I data for one small state (DC, fips=11)
results = _fetch_paginated(f'{API_BASE_URL}/schools/ccd/directory/2022/', '11')
print(f'DC schools: {len(results)}')
if results:
    r = results[0]
    print(f'Sample: title_i_status={r.get(\"title_i_status\")}, free_lunch={r.get(\"free_lunch\")}')
"
```

Expected: Fetches DC schools with Title I fields populated.

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

Expected: No build errors, app loads.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from verification"
```
