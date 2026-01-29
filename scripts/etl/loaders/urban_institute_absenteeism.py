"""
Urban Institute Chronic Absenteeism Data Loader

Fetches school-level chronic absenteeism data from CRDC and aggregates to district level.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /schools/crdc/chronic-absenteeism/{year}/
"""

import os
import time
from typing import Dict, List
from collections import defaultdict
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_chronic_absenteeism_data(
    year: int = 2017,
    page_size: int = 10000,
    delay: float = 0.5,
) -> Dict[str, Dict]:
    """
    Fetch school-level chronic absenteeism data and aggregate to district level.

    CRDC data is only available for 2011, 2013, 2015, 2017 (biennial).

    Args:
        year: Academic year (2011, 2013, 2015, or 2017)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        Dict mapping leaid to aggregated absenteeism data
    """
    # Aggregate by district: sum students_chronically_absent for total records
    district_data: Dict[str, Dict] = defaultdict(lambda: {
        "students_chronically_absent": 0,
        "school_count": 0,
    })

    page = 1
    total_records = 0

    print(f"Fetching chronic absenteeism data for year {year}...")
    print("Note: This is school-level data that will be aggregated to district level.")

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
            students_absent = record.get("students_chronically_absent")

            # Only count "total" records (all disaggregation = 99)
            is_total = (
                record.get("race") == 99 and
                record.get("sex") == 99 and
                record.get("disability") == 99 and
                record.get("lep") == 99 and
                record.get("homeless") == 99
            )

            if leaid and students_absent is not None and students_absent >= 0 and is_total:
                leaid_str = str(leaid).zfill(7)
                district_data[leaid_str]["students_chronically_absent"] += students_absent
                district_data[leaid_str]["school_count"] += 1
                total_records += 1

        print(f"Page {page}: {len(results)} records, {len(district_data)} districts")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    # Convert to final format with leaid and year
    result = {}
    for leaid, data in district_data.items():
        if data["students_chronically_absent"] > 0:
            result[leaid] = {
                "leaid": leaid,
                "year": year,
                "students_chronically_absent": data["students_chronically_absent"],
                "school_count": data["school_count"],
            }

    print(f"Total 'total' records processed: {total_records}")
    print(f"Districts with chronic absenteeism data: {len(result)}")
    return result


def upsert_absenteeism_data(
    connection_string: str,
    records: Dict[str, Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Upsert chronic absenteeism data into district_education_data table.

    Calculates absenteeism rate as: students_chronically_absent / total_enrollment

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

    # Update existing records with absenteeism count
    # Rate will be calculated using enrollment from districts table
    update_sql = """
        UPDATE district_education_data
        SET chronic_absenteeism_count = v.absent_count::integer,
            chronic_absenteeism_rate = CASE
                WHEN d.enrollment > 0
                THEN ROUND((v.absent_count::numeric / d.enrollment::numeric) * 100, 1)
                ELSE NULL
            END,
            absenteeism_data_year = v.year::integer,
            updated_at = NOW()
        FROM (VALUES %s) AS v(leaid, absent_count, year)
        JOIN districts d ON d.leaid = v.leaid
        WHERE district_education_data.leaid = v.leaid
    """

    # Prepare values
    values = [
        (
            r["leaid"],
            r["students_chronically_absent"],
            year,
        )
        for r in records.values()
    ]

    updated_count = 0
    failed_count = 0

    print(f"Updating {len(values)} absenteeism records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Updating absenteeism data"):
        batch = values[i:i+batch_size]
        try:
            execute_values(cur, update_sql, batch, template="(%s, %s, %s)")
            updated_count += cur.rowcount
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    conn.commit()

    # Get count of records with absenteeism data
    cur.execute("""
        SELECT COUNT(*) FROM district_education_data
        WHERE chronic_absenteeism_count IS NOT NULL
    """)
    total_with_data = cur.fetchone()[0]

    # Get average rate
    cur.execute("""
        SELECT ROUND(AVG(chronic_absenteeism_rate), 1)
        FROM district_education_data
        WHERE chronic_absenteeism_rate IS NOT NULL
    """)
    avg_rate = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with absenteeism data: {total_with_data}")
    print(f"Average chronic absenteeism rate: {avg_rate}%")

    return {
        "updated": updated_count,
        "failed": failed_count,
        "total_with_data": total_with_data,
    }


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Fetch Urban Institute chronic absenteeism data")
    parser.add_argument("--year", type=int, default=2017,
                        help="Academic year (CRDC available: 2011, 2013, 2015, 2017)")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    records = fetch_chronic_absenteeism_data(year=args.year, delay=args.delay)

    if records:
        result = upsert_absenteeism_data(
            connection_string,
            records,
            year=args.year
        )
        print(f"Absenteeism data import complete: {result}")
    else:
        print("No records fetched")


if __name__ == "__main__":
    main()
