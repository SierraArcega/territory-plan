"""
Urban Institute CRDC Chronic Absenteeism Data Loader

Fetches school-level chronic absenteeism data from the Urban Institute's
Education Data Portal API (CRDC source) and aggregates up to district level.
High absenteeism strongly correlates with staffing gaps and student disengagement,
indicating case management and counseling staffing needs.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /schools/crdc/chronic-absenteeism/{year}/

Years available: 2011, 2013, 2015, 2017, 2020
Note: This is school-level data that must be aggregated to district level.
"""

import os
import time
from typing import Dict, List, Optional
from collections import defaultdict
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_absenteeism_data(
    year: int = 2020,
    page_size: int = 10000,
    delay: float = 0.5,
) -> Dict[str, Dict]:
    """
    Fetch school-level chronic absenteeism data and aggregate to district level.

    The CRDC endpoint provides school-level data. We aggregate to districts by
    summing chronic_absent counts and total enrollment, then computing a rate.

    Args:
        year: CRDC survey year (available: 2011, 2013, 2015, 2017, 2020)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        Dict mapping leaid to aggregated absenteeism data
    """
    # Accumulate school-level data by district
    district_absent = defaultdict(int)
    district_enrollment = defaultdict(int)
    page = 1

    print(f"Fetching chronic absenteeism data for year {year}...")

    while True:
        url = f"{API_BASE_URL}/schools/crdc/chronic-absenteeism/{year}/"
        params = {
            "page": page,
            "per_page": page_size,
        }

        try:
            response = requests.get(url, params=params, timeout=120)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"Error fetching page {page}: {e}")
            break

        results = data.get("results", [])
        if not results:
            break

        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            # We want total records (sex=99, race=99, disability=99)
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

            # Urban Institute uses -1, -2 for missing/suppressed
            if chronic_absent is not None and chronic_absent >= 0:
                district_absent[leaid_str] += chronic_absent
            if enrollment is not None and enrollment >= 0:
                district_enrollment[leaid_str] += enrollment

        print(f"Page {page}: {len(results)} records, {len(district_absent)} districts so far")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    # Compute district-level rates
    all_records = {}
    for leaid in district_absent:
        absent_count = district_absent[leaid]
        enrollment = district_enrollment.get(leaid, 0)
        rate = None
        if enrollment > 0:
            rate = round((absent_count / enrollment) * 100, 2)

        all_records[leaid] = {
            "leaid": leaid,
            "year": year,
            "chronic_absenteeism_count": absent_count,
            "chronic_absenteeism_rate": rate,
        }

    print(f"Total districts with absenteeism data: {len(all_records)}")
    return all_records


def upsert_absenteeism_data(
    connection_string: str,
    records: Dict[str, Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Update districts table with chronic absenteeism data.

    Args:
        connection_string: PostgreSQL connection string
        records: Dict mapping leaid to absenteeism data
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Dict with counts of updated and failed records
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Create temp table (rate capped at NUMERIC(5,2) to match districts schema)
    cur.execute("""
        CREATE TEMP TABLE absenteeism_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            chronic_absenteeism_count INTEGER,
            chronic_absenteeism_rate NUMERIC(5,2),
            absenteeism_data_year INTEGER
        )
    """)

    insert_temp_sql = """
        INSERT INTO absenteeism_updates (
            leaid, chronic_absenteeism_count, chronic_absenteeism_rate, absenteeism_data_year
        ) VALUES %s
    """

    values = [
        (
            r["leaid"],
            r.get("chronic_absenteeism_count"),
            r.get("chronic_absenteeism_rate"),
            year,
        )
        for r in records.values()
    ]

    updated_count = 0
    failed_count = 0

    print(f"Loading {len(values)} absenteeism records into temp table...")

    for i in tqdm(range(0, len(values), batch_size), desc="Loading temp table"):
        batch = values[i:i+batch_size]
        try:
            execute_values(cur, insert_temp_sql, batch, template="(%s, %s, %s, %s)")
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    # If rates are missing, compute them from district enrollment before upserting
    # Use double precision to avoid numeric overflow, then cast
    cur.execute("""
        UPDATE absenteeism_updates u SET
            chronic_absenteeism_rate = ROUND(
                LEAST(u.chronic_absenteeism_count::DOUBLE PRECISION / d.enrollment * 100, 100)::NUMERIC,
                2
            )
        FROM districts d
        WHERE d.leaid = u.leaid
          AND u.chronic_absenteeism_rate IS NULL
          AND d.enrollment IS NOT NULL AND d.enrollment > 0
    """)
    computed = cur.rowcount
    print(f"Computed absenteeism rates for {computed} districts from enrollment data")

    # Bulk update
    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            chronic_absenteeism_count = u.chronic_absenteeism_count,
            chronic_absenteeism_rate = u.chronic_absenteeism_rate,
            absenteeism_data_year = u.absenteeism_data_year
        FROM absenteeism_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    cur.execute("DROP TABLE absenteeism_updates")
    conn.commit()

    # Stats
    cur.execute("""
        SELECT COUNT(*) FROM districts
        WHERE chronic_absenteeism_rate IS NOT NULL
    """)
    total_with_data = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with absenteeism data: {total_with_data}")

    return {
        "updated": updated_count,
        "failed": failed_count,
        "total_with_data": total_with_data,
    }


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
        data_source,
        data_year,
        records_updated,
        records_failed,
        status,
        error_message,
        started_at or "NOW()",
    ))

    conn.commit()
    cur.close()
    conn.close()


def main():
    """CLI entry point."""
    import argparse
    from datetime import datetime
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Fetch CRDC chronic absenteeism data")
    parser.add_argument("--year", type=int, default=2020, help="CRDC year (2011, 2013, 2015, 2017, 2020)")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    started_at = datetime.now().isoformat()

    try:
        records = fetch_absenteeism_data(year=args.year, delay=args.delay)

        if records:
            result = upsert_absenteeism_data(
                connection_string,
                records,
                year=args.year
            )
            print(f"Absenteeism data import complete: {result}")

            log_refresh(
                connection_string,
                data_source="urban_institute_absenteeism",
                data_year=args.year,
                records_updated=result["updated"],
                records_failed=result["failed"],
                status="success" if result["failed"] == 0 else "partial",
                started_at=started_at,
            )
        else:
            print("No records fetched")
            log_refresh(
                connection_string,
                data_source="urban_institute_absenteeism",
                data_year=args.year,
                records_updated=0,
                records_failed=0,
                status="failed",
                error_message="No records fetched from API",
                started_at=started_at,
            )

    except Exception as e:
        print(f"Error: {e}")
        log_refresh(
            connection_string,
            data_source="urban_institute_absenteeism",
            data_year=args.year,
            records_updated=0,
            records_failed=0,
            status="failed",
            error_message=str(e),
            started_at=started_at,
        )
        raise


if __name__ == "__main__":
    main()
