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


# ---------------------------------------------------------------------------
# Pass 1: School Title I + FRPL
# ---------------------------------------------------------------------------

def fetch_title1_all_states(
    year: int = 2022,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
    single_fips: Optional[str] = None,
) -> List[Dict]:
    """Fetch school Title I + FRPL data state-by-state from CCD directory."""
    url = f"{API_BASE_URL}/schools/ccd/directory/{year}/"
    all_records = []

    if single_fips:
        states = [s for s in STATES_50_DC if s["fips"] == single_fips]
    else:
        states = STATES_50_DC
    started = resume_from_fips is None

    for state in tqdm(states, desc=f"Title I {year}"):
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


# ---------------------------------------------------------------------------
# Pass 2: School Demographics (race/ethnicity)
# ---------------------------------------------------------------------------

def fetch_demographics_all_states(
    year: int = 2022,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
    single_fips: Optional[str] = None,
) -> List[Dict]:
    """Fetch school enrollment by race state-by-state."""
    url = f"{API_BASE_URL}/schools/ccd/enrollment/{year}/grade-99/race/"
    all_records = []

    if single_fips:
        states = [s for s in STATES_50_DC if s["fips"] == single_fips]
    else:
        states = STATES_50_DC
    started = resume_from_fips is None

    for state in tqdm(states, desc=f"Demographics {year}"):
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


# ---------------------------------------------------------------------------
# Pass 3: District Title I Revenue
# ---------------------------------------------------------------------------

def fetch_title1_revenue_all_states(
    year: int = 2020,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
    single_fips: Optional[str] = None,
) -> List[Dict]:
    """Fetch district Title I revenue from finance endpoint state-by-state."""
    url = f"{API_BASE_URL}/school-districts/ccd/finance/{year}/"
    all_records = []

    if single_fips:
        states = [s for s in STATES_50_DC if s["fips"] == single_fips]
    else:
        states = STATES_50_DC
    started = resume_from_fips is None

    for state in tqdm(states, desc=f"Title I Revenue {year}"):
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
    parser.add_argument("--fips", type=str, default=None, help="Run for a single state FIPS code only")
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

    # --fips = single state only; --start-fips = resume from that state onward
    single_fips = args.fips
    resume_fips = args.start_fips

    try:
        # Pass 1: Title I + FRPL
        if not args.no_title1:
            print("\n" + "=" * 60)
            print("Pass 1: School Title I + FRPL")
            print("=" * 60)
            records = fetch_title1_all_states(
                year=args.year,
                delay=args.delay,
                resume_from_fips=resume_fips,
                single_fips=single_fips,
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
                resume_from_fips=resume_fips,
                single_fips=single_fips,
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
                resume_from_fips=resume_fips,
                single_fips=single_fips,
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
