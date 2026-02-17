"""
State-by-State SPED/ELL/Enrollment Refresh

Fetches spec_ed_students, ell_students, and enrollment from the Urban Institute
CCD directory API one state at a time, avoiding timeouts from bulk fetching.

Updates the districts table and recomputes derived fields:
  - sped_expenditure_per_student
  - sped_student_teacher_ratio

Usage:
    python3 refresh_sped_ell.py                    # all states, year 2022
    python3 refresh_sped_ell.py --state 06         # just California
    python3 refresh_sped_ell.py --year 2021        # different year
"""

import os
import sys
import time
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import requests
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from tqdm import tqdm


API_BASE_URL = "https://educationdata.urban.org/api/v1"

# All valid state FIPS codes (50 states + DC)
STATE_FIPS = [
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
    "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
    "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
    "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
    "56",
]

# State names for logging
STATE_NAMES = {
    "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas",
    "06": "California", "08": "Colorado", "09": "Connecticut", "10": "Delaware",
    "11": "DC", "12": "Florida", "13": "Georgia", "15": "Hawaii",
    "16": "Idaho", "17": "Illinois", "18": "Indiana", "19": "Iowa",
    "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine",
    "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
    "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska",
    "32": "Nevada", "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico",
    "36": "New York", "37": "North Carolina", "38": "North Dakota", "39": "Ohio",
    "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island",
    "45": "South Carolina", "46": "South Dakota", "47": "Tennessee", "48": "Texas",
    "49": "Utah", "50": "Vermont", "51": "Virginia", "53": "Washington",
    "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
}


def clean_int(value) -> Optional[int]:
    """Convert API value to int, treating -1/-2 as NULL (Urban Institute missing data markers)."""
    if value is None:
        return None
    try:
        val = int(value)
        if val in (-1, -2):
            return None
        return val
    except (ValueError, TypeError):
        return None


def fetch_state_data(
    fips: str,
    year: int = 2022,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district directory data for a single state from Urban Institute API.

    Args:
        fips: Two-digit state FIPS code
        year: Academic year
        delay: Delay between paginated requests

    Returns:
        List of district records with leaid, spec_ed_students, ell_students, enrollment
    """
    records = []
    page = 1

    while True:
        url = f"{API_BASE_URL}/school-districts/ccd/directory/{year}/"
        params = {
            "fips": int(fips),
            "page": page,
            "per_page": 10000,
        }

        try:
            response = requests.get(url, params=params, timeout=120)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"  Error fetching {STATE_NAMES.get(fips, fips)} page {page}: {e}")
            raise

        results = data.get("results", [])
        if not results:
            break

        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            spec_ed = clean_int(record.get("spec_ed_students"))
            ell = clean_int(record.get("english_language_learners"))
            enrollment = clean_int(record.get("enrollment"))

            records.append({
                "leaid": str(leaid).zfill(7),
                "spec_ed_students": spec_ed,
                "ell_students": ell,
                "enrollment": enrollment,
            })

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    return records


def upsert_state_data(
    cur,
    records: List[Dict],
    year: int,
    sped_ell_only: bool = False,
) -> int:
    """
    Bulk update districts table for one state's worth of records.

    Args:
        sped_ell_only: If True, only update spec_ed_students and ell_students (skip enrollment).

    Returns:
        Number of rows updated
    """
    if not records:
        return 0

    # Create temp table
    cur.execute("""
        CREATE TEMP TABLE IF NOT EXISTS tmp_sped_ell (
            leaid VARCHAR(7),
            spec_ed_students INTEGER,
            ell_students INTEGER,
            enrollment INTEGER
        ) ON COMMIT DELETE ROWS
    """)
    cur.execute("TRUNCATE tmp_sped_ell")

    # Bulk insert into temp table
    values = [
        (r["leaid"], r["spec_ed_students"], r["ell_students"], r["enrollment"])
        for r in records
    ]
    execute_values(
        cur,
        "INSERT INTO tmp_sped_ell (leaid, spec_ed_students, ell_students, enrollment) VALUES %s",
        values,
        template="(%s, %s, %s, %s)",
    )

    if sped_ell_only:
        # Only update SPED and ELL columns, leave enrollment untouched
        # Use COALESCE to avoid overwriting non-null with null
        cur.execute("""
            UPDATE districts d
            SET spec_ed_students = COALESCE(t.spec_ed_students, d.spec_ed_students),
                ell_students = COALESCE(t.ell_students, d.ell_students),
                updated_at = NOW()
            FROM tmp_sped_ell t
            WHERE d.leaid = t.leaid
              AND (t.spec_ed_students IS NOT NULL
                   OR t.ell_students IS NOT NULL)
        """)
    else:
        cur.execute("""
            UPDATE districts d
            SET spec_ed_students = COALESCE(t.spec_ed_students, d.spec_ed_students),
                ell_students = COALESCE(t.ell_students, d.ell_students),
                enrollment = COALESCE(t.enrollment, d.enrollment),
                urban_institute_year = %s,
                updated_at = NOW()
            FROM tmp_sped_ell t
            WHERE d.leaid = t.leaid
              AND (t.spec_ed_students IS NOT NULL
                   OR t.ell_students IS NOT NULL
                   OR t.enrollment IS NOT NULL)
        """, (year,))

    return cur.rowcount


def recompute_derived_fields(cur) -> None:
    """Recompute fields that depend on spec_ed_students."""
    # sped_expenditure_per_student
    cur.execute("""
        UPDATE districts
        SET sped_expenditure_per_student = sped_expenditure_total / spec_ed_students
        WHERE sped_expenditure_total IS NOT NULL
          AND spec_ed_students IS NOT NULL
          AND spec_ed_students > 0
    """)
    sped_exp_count = cur.rowcount

    # sped_student_teacher_ratio
    cur.execute("""
        UPDATE districts
        SET sped_student_teacher_ratio = spec_ed_students::float / teachers_fte
        WHERE spec_ed_students IS NOT NULL
          AND teachers_fte IS NOT NULL
          AND teachers_fte > 0
    """)
    sped_ratio_count = cur.rowcount

    print(f"  Recomputed sped_expenditure_per_student for {sped_exp_count} districts")
    print(f"  Recomputed sped_student_teacher_ratio for {sped_ratio_count} districts")


def log_refresh(cur, year: int, total_updated: int, total_failed: int, errors: List[str]) -> None:
    """Log refresh to data_refresh_logs table."""
    status = "success" if total_failed == 0 else "partial"
    error_message = "; ".join(errors) if errors else None

    cur.execute("""
        INSERT INTO data_refresh_logs (
            data_source, data_year, records_updated, records_failed,
            status, error_message, started_at, completed_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
    """, ("ccd_directory_sped_ell", year, total_updated, total_failed, status, error_message))


def get_connection_string() -> str:
    """Get database connection string, preferring DIRECT_URL."""
    conn_str = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not conn_str:
        raise ValueError("DIRECT_URL or DATABASE_URL environment variable not set")
    # Strip Supabase-specific params that psycopg2 doesn't understand
    if "pgbouncer=true" in conn_str:
        conn_str = conn_str.replace("&pgbouncer=true", "").replace("?pgbouncer=true&", "?").replace("?pgbouncer=true", "")
    return conn_str


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="State-by-state refresh of spec_ed_students, ell_students, and enrollment")
    parser.add_argument("--year", type=int, default=2022, help="Data year (default: 2022)")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls in seconds (default: 0.5)")
    parser.add_argument("--state", type=str, default=None, help="Single state FIPS code to refresh (e.g., 06 for California)")
    parser.add_argument("--sped-ell-only", action="store_true", help="Only update spec_ed_students and ell_students (skip enrollment)")
    args = parser.parse_args()

    conn_str = get_connection_string()
    conn = psycopg2.connect(conn_str)
    conn.autocommit = False

    states = [args.state.zfill(2)] if args.state else STATE_FIPS
    if args.state and args.state.zfill(2) not in STATE_FIPS:
        print(f"Error: Invalid FIPS code '{args.state}'. Valid codes: {', '.join(STATE_FIPS)}")
        sys.exit(1)

    total_updated = 0
    total_fetched = 0
    failed_states = []
    errors = []

    print(f"Refreshing spec_ed_students, ell_students, enrollment for year {args.year}")
    print(f"States to process: {len(states)}")
    print()

    cur = conn.cursor()

    for fips in tqdm(states, desc="States", unit="state"):
        state_name = STATE_NAMES.get(fips, fips)
        try:
            records = fetch_state_data(fips, year=args.year, delay=args.delay)
            total_fetched += len(records)

            updated = upsert_state_data(cur, records, args.year, sped_ell_only=args.sped_ell_only)
            conn.commit()

            total_updated += updated
            tqdm.write(f"  {state_name} ({fips}): fetched {len(records)}, updated {updated}")

        except Exception as e:
            conn.rollback()
            failed_states.append(fips)
            errors.append(f"{state_name}: {str(e)[:200]}")
            tqdm.write(f"  {state_name} ({fips}): FAILED - {e}")

        time.sleep(args.delay)

    # Recompute derived fields
    print("\nRecomputing derived fields...")
    try:
        recompute_derived_fields(cur)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"  Error recomputing derived fields: {e}")
        errors.append(f"Recompute: {str(e)[:200]}")

    # Log refresh
    try:
        log_refresh(cur, args.year, total_updated, len(failed_states), errors)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"  Error logging refresh: {e}")

    cur.close()
    conn.close()

    # Summary
    print(f"\n{'='*60}")
    print(f"Refresh complete")
    print(f"  Year: {args.year}")
    print(f"  Districts fetched: {total_fetched}")
    print(f"  Districts updated: {total_updated}")
    print(f"  States succeeded: {len(states) - len(failed_states)}/{len(states)}")
    if failed_states:
        print(f"  Failed states: {', '.join(STATE_NAMES.get(f, f) for f in failed_states)}")
        print(f"  Re-run with: python3 refresh_sped_ell.py --state <FIPS>")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
