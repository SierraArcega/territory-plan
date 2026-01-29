"""
Urban Institute Staff FTE Data API Loader

Fetches school district staff counts (FTE) from the Urban Institute's
Education Data Portal API using CCD directory data.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/ccd/directory/{year}/
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_staff_data(
    year: int = 2021,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district staff FTE data from Urban Institute CCD directory API.

    Args:
        year: Academic year
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of staff records with leaid and FTE counts
    """
    all_records = []
    page = 1

    print(f"Fetching staff FTE data for year {year}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/ccd/directory/{year}/"
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
            if leaid:
                # Combine LEA and school admin FTE
                lea_admin = record.get("lea_administrators_fte") or 0
                school_admin = record.get("school_administrators_fte") or 0
                admin_total = lea_admin + school_admin if (lea_admin >= 0 and school_admin >= 0) else None

                all_records.append({
                    "leaid": str(leaid).zfill(7),
                    "teachers_fte": record.get("teachers_total_fte"),
                    "teachers_elementary_fte": record.get("teachers_elementary_fte"),
                    "teachers_secondary_fte": record.get("teachers_secondary_fte"),
                    "admin_fte": admin_total,
                    "guidance_counselors_fte": record.get("guidance_counselors_total_fte"),
                    "instructional_aides_fte": record.get("instructional_aides_fte"),
                    "support_staff_fte": record.get("support_staff_students_fte"),
                    "staff_total_fte": record.get("staff_total_fte"),
                    "year": year,
                })

        print(f"Page {page}: {len(results)} records, total: {len(all_records)}")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total staff records fetched: {len(all_records)}")
    return all_records


def upsert_staff_data(
    connection_string: str,
    records: List[Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Upsert staff FTE data into district_education_data table.

    Args:
        connection_string: PostgreSQL connection string
        records: List of staff records
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Dict with counts of updated and failed records
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Filter records with valid data
    def is_valid(val):
        return val is not None and val >= 0

    def clean_val(val):
        return val if is_valid(val) else None

    valid_records = [
        {
            "leaid": r["leaid"],
            "year": r["year"],
            "teachers_fte": clean_val(r.get("teachers_fte")),
            "teachers_elementary_fte": clean_val(r.get("teachers_elementary_fte")),
            "teachers_secondary_fte": clean_val(r.get("teachers_secondary_fte")),
            "admin_fte": clean_val(r.get("admin_fte")),
            "guidance_counselors_fte": clean_val(r.get("guidance_counselors_fte")),
            "instructional_aides_fte": clean_val(r.get("instructional_aides_fte")),
            "support_staff_fte": clean_val(r.get("support_staff_fte")),
            "staff_total_fte": clean_val(r.get("staff_total_fte")),
        }
        for r in records
        if is_valid(r.get("staff_total_fte")) or is_valid(r.get("teachers_fte"))
    ]

    # Update existing records (staff data supplements finance data)
    update_sql = """
        UPDATE district_education_data
        SET teachers_fte = v.teachers_fte::numeric,
            teachers_elementary_fte = v.teachers_elementary_fte::numeric,
            teachers_secondary_fte = v.teachers_secondary_fte::numeric,
            admin_fte = v.admin_fte::numeric,
            guidance_counselors_fte = v.guidance_counselors_fte::numeric,
            instructional_aides_fte = v.instructional_aides_fte::numeric,
            support_staff_fte = v.support_staff_fte::numeric,
            staff_total_fte = v.staff_total_fte::numeric,
            staff_data_year = v.staff_data_year::integer,
            updated_at = NOW()
        FROM (VALUES %s) AS v(
            leaid, teachers_fte, teachers_elementary_fte, teachers_secondary_fte,
            admin_fte, guidance_counselors_fte, instructional_aides_fte,
            support_staff_fte, staff_total_fte, staff_data_year
        )
        WHERE district_education_data.leaid = v.leaid
    """

    values = [
        (
            r["leaid"],
            r.get("teachers_fte"),
            r.get("teachers_elementary_fte"),
            r.get("teachers_secondary_fte"),
            r.get("admin_fte"),
            r.get("guidance_counselors_fte"),
            r.get("instructional_aides_fte"),
            r.get("support_staff_fte"),
            r.get("staff_total_fte"),
            year,
        )
        for r in valid_records
    ]

    updated_count = 0
    failed_count = 0

    print(f"Updating {len(values)} staff records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Updating staff data"):
        batch = values[i:i+batch_size]
        try:
            execute_values(
                cur, update_sql, batch,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            updated_count += cur.rowcount
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    conn.commit()

    # Get count of records with staff data
    cur.execute("""
        SELECT COUNT(*) FROM district_education_data
        WHERE staff_total_fte IS NOT NULL
    """)
    total_with_staff = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with staff data: {total_with_staff}")

    return {
        "updated": updated_count,
        "failed": failed_count,
        "total_with_data": total_with_staff,
    }


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Fetch Urban Institute staff FTE data")
    parser.add_argument("--year", type=int, default=2021, help="Academic year")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    records = fetch_staff_data(year=args.year, delay=args.delay)

    if records:
        result = upsert_staff_data(
            connection_string,
            records,
            year=args.year
        )
        print(f"Staff data import complete: {result}")
    else:
        print("No records fetched")


if __name__ == "__main__":
    main()
