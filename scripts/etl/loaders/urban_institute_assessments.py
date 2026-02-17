"""
Urban Institute EdFacts Assessment Proficiency Data Loader

Fetches district-level assessment proficiency data (math and reading)
from the Urban Institute's Education Data Portal API.
Low proficiency districts need more instructional support and staff.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/edfacts/assessments/{year}/grade-99/

Grade 99 = all grades aggregated.
Years available: 2009-2018, 2021
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_assessment_data(
    year: int = 2021,
    page_size: int = 10000,
    delay: float = 0.5,
) -> Dict[str, Dict]:
    """
    Fetch district assessment proficiency data from Urban Institute EdFacts API.

    Uses grade-99 (all grades combined) for district-level aggregation.

    Args:
        year: Academic year (available: 2009-2018, 2021)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        Dict mapping leaid to assessment data {math, reading, year}
    """
    all_records: Dict[str, Dict] = {}
    page = 1

    print(f"Fetching assessment data for year {year} (grade-99 = all grades)...")

    while True:
        url = f"{API_BASE_URL}/school-districts/edfacts/assessments/{year}/grade-99/"
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

            # We want aggregate records (race=99, sex=99, disability=99)
            is_total = (
                record.get("race") == 99 and
                record.get("sex") == 99
            )
            if not is_total:
                continue

            leaid_str = str(leaid).zfill(7)
            math_prof = record.get("math_test_pct_prof_midpt")
            read_prof = record.get("read_test_pct_prof_midpt")

            # Urban Institute uses -1, -2 for missing/suppressed
            if math_prof is not None and math_prof < 0:
                math_prof = None
            if read_prof is not None and read_prof < 0:
                read_prof = None

            if math_prof is not None or read_prof is not None:
                existing = all_records.get(leaid_str, {})
                all_records[leaid_str] = {
                    "leaid": leaid_str,
                    "year": year,
                    "math": math_prof if math_prof is not None else existing.get("math"),
                    "reading": read_prof if read_prof is not None else existing.get("reading"),
                }

        print(f"Page {page}: {len(results)} records, {len(all_records)} unique districts")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total districts with assessment data: {len(all_records)}")
    return all_records


def upsert_assessment_data(
    connection_string: str,
    records: Dict[str, Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Update districts table with assessment proficiency data.

    Args:
        connection_string: PostgreSQL connection string
        records: Dict mapping leaid to assessment data
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Dict with counts of updated and failed records
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Create temp table
    cur.execute("""
        CREATE TEMP TABLE assessment_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            math_proficiency_pct NUMERIC,
            read_proficiency_pct NUMERIC,
            assessment_data_year INTEGER
        )
    """)

    insert_temp_sql = """
        INSERT INTO assessment_updates (
            leaid, math_proficiency_pct, read_proficiency_pct, assessment_data_year
        ) VALUES %s
    """

    values = [
        (
            r["leaid"],
            r.get("math"),
            r.get("reading"),
            year,
        )
        for r in records.values()
        if r.get("math") is not None or r.get("reading") is not None
    ]

    updated_count = 0
    failed_count = 0

    print(f"Loading {len(values)} assessment records into temp table...")

    for i in tqdm(range(0, len(values), batch_size), desc="Loading temp table"):
        batch = values[i:i+batch_size]
        try:
            execute_values(cur, insert_temp_sql, batch, template="(%s, %s, %s, %s)")
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    # Bulk update
    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            math_proficiency_pct = u.math_proficiency_pct,
            read_proficiency_pct = u.read_proficiency_pct,
            assessment_data_year = u.assessment_data_year
        FROM assessment_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    cur.execute("DROP TABLE assessment_updates")
    conn.commit()

    # Stats
    cur.execute("""
        SELECT COUNT(*) FROM districts
        WHERE math_proficiency_pct IS NOT NULL OR read_proficiency_pct IS NOT NULL
    """)
    total_with_data = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with assessment data: {total_with_data}")

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

    parser = argparse.ArgumentParser(description="Fetch Urban Institute EdFacts assessment data")
    parser.add_argument("--year", type=int, default=2021, help="Academic year (available: 2009-2018, 2021)")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    started_at = datetime.now().isoformat()

    try:
        records = fetch_assessment_data(year=args.year, delay=args.delay)

        if records:
            result = upsert_assessment_data(
                connection_string,
                records,
                year=args.year
            )
            print(f"Assessment data import complete: {result}")

            log_refresh(
                connection_string,
                data_source="urban_institute_assessments",
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
                data_source="urban_institute_assessments",
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
            data_source="urban_institute_assessments",
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
