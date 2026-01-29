"""
Urban Institute Demographics Data API Loader

Fetches school district enrollment by race/ethnicity from the Urban Institute's
Education Data Portal API.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/ccd/enrollment/{year}/grade-99/race/
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"

# Race code mapping from API
RACE_CODES = {
    1: "white",
    2: "black",
    3: "hispanic",
    4: "asian",
    5: "american_indian",
    6: "pacific_islander",
    7: "two_or_more",
    99: "total",
}


def fetch_demographics_data(
    year: int = 2022,
    grade: int = 99,  # 99 = total enrollment
    page_size: int = 10000,
    delay: float = 0.5,
) -> Dict[str, Dict]:
    """
    Fetch district enrollment by race data from Urban Institute API.

    Args:
        year: Academic year
        grade: Grade level (99 = total)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        Dict mapping leaid to enrollment by race
    """
    all_records: Dict[str, Dict] = {}
    page = 1

    print(f"Fetching demographics data for year {year}, grade {grade}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/ccd/enrollment/{year}/grade-{grade}/race/"
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
            race_code = record.get("race")
            enrollment = record.get("enrollment")

            if leaid and race_code is not None:
                leaid_str = str(leaid).zfill(7)
                race_name = RACE_CODES.get(race_code)

                if race_name:
                    if leaid_str not in all_records:
                        all_records[leaid_str] = {"leaid": leaid_str, "year": year}
                    all_records[leaid_str][race_name] = enrollment

        print(f"Page {page}: {len(results)} records, {len(all_records)} unique districts")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total districts with demographics: {len(all_records)}")
    return all_records


def upsert_demographics_data(
    connection_string: str,
    records: Dict[str, Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Upsert demographics data into district_enrollment_demographics table.

    Args:
        connection_string: PostgreSQL connection string
        records: Dict mapping leaid to demographics data
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Dict with counts of updated and failed records
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    upsert_sql = """
        INSERT INTO district_enrollment_demographics (
            leaid, enrollment_white, enrollment_black, enrollment_hispanic,
            enrollment_asian, enrollment_american_indian, enrollment_pacific_islander,
            enrollment_two_or_more, total_enrollment, demographics_data_year,
            created_at, updated_at
        )
        SELECT v.leaid, v.white::integer, v.black::integer, v.hispanic::integer,
               v.asian::integer, v.american_indian::integer, v.pacific_islander::integer,
               v.two_or_more::integer, v.total::integer, v.year::integer, NOW(), NOW()
        FROM (VALUES %s) AS v(
            leaid, white, black, hispanic, asian, american_indian,
            pacific_islander, two_or_more, total, year
        )
        WHERE v.leaid IN (SELECT leaid FROM districts)
        ON CONFLICT (leaid) DO UPDATE SET
            enrollment_white = EXCLUDED.enrollment_white,
            enrollment_black = EXCLUDED.enrollment_black,
            enrollment_hispanic = EXCLUDED.enrollment_hispanic,
            enrollment_asian = EXCLUDED.enrollment_asian,
            enrollment_american_indian = EXCLUDED.enrollment_american_indian,
            enrollment_pacific_islander = EXCLUDED.enrollment_pacific_islander,
            enrollment_two_or_more = EXCLUDED.enrollment_two_or_more,
            total_enrollment = EXCLUDED.total_enrollment,
            demographics_data_year = EXCLUDED.demographics_data_year,
            updated_at = NOW()
    """

    # Prepare values
    values = [
        (
            r["leaid"],
            r.get("white"),
            r.get("black"),
            r.get("hispanic"),
            r.get("asian"),
            r.get("american_indian"),
            r.get("pacific_islander"),
            r.get("two_or_more"),
            r.get("total"),
            year,
        )
        for r in records.values()
    ]

    updated_count = 0
    failed_count = 0

    print(f"Upserting {len(values)} demographics records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Upserting demographics"):
        batch = values[i:i+batch_size]
        try:
            execute_values(
                cur, upsert_sql, batch,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            updated_count += cur.rowcount
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    conn.commit()

    # Get count of records with demographics data
    cur.execute("""
        SELECT COUNT(*) FROM district_enrollment_demographics
        WHERE total_enrollment IS NOT NULL
    """)
    total_with_demographics = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with demographics data: {total_with_demographics}")

    return {
        "updated": updated_count,
        "failed": failed_count,
        "total_with_data": total_with_demographics,
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

    parser = argparse.ArgumentParser(description="Fetch Urban Institute demographics data")
    parser.add_argument("--year", type=int, default=2022, help="Academic year")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    started_at = datetime.now().isoformat()

    try:
        records = fetch_demographics_data(year=args.year, delay=args.delay)

        if records:
            result = upsert_demographics_data(
                connection_string,
                records,
                year=args.year
            )
            print(f"Demographics data import complete: {result}")

            log_refresh(
                connection_string,
                data_source="urban_institute_demographics",
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
                data_source="urban_institute_demographics",
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
            data_source="urban_institute_demographics",
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
