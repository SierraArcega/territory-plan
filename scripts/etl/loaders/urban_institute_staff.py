"""
Urban Institute Staff FTE Data API Loader

Fetches school district staff counts (FTE) from the Urban Institute's
Education Data Portal API and updates the districts table directly.
Uses CCD directory data.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/ccd/directory/{year}/

Note: As of Jan 2026, staff data is stored directly on the districts table
(consolidated schema) rather than a separate district_education_data table.
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
    fips: Optional[str] = None,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district staff FTE data from Urban Institute CCD directory API.

    Args:
        year: Academic year
        fips: State FIPS code to filter by (e.g., "06" for California)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of staff records with leaid and FTE counts
    """
    all_records = []
    page = 1

    state_label = f" (fips={fips})" if fips else ""
    print(f"Fetching staff FTE data for year {year}{state_label}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/ccd/directory/{year}/"
        params = {
            "page": page,
            "per_page": page_size,
        }

        if fips:
            params["fips"] = int(fips)

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
    Update districts table with staff FTE data.

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

    # Create temp table for efficient bulk updates
    cur.execute("""
        CREATE TEMP TABLE staff_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            teachers_fte NUMERIC,
            teachers_elementary_fte NUMERIC,
            teachers_secondary_fte NUMERIC,
            admin_fte NUMERIC,
            guidance_counselors_fte NUMERIC,
            instructional_aides_fte NUMERIC,
            support_staff_fte NUMERIC,
            staff_total_fte NUMERIC,
            staff_data_year INTEGER
        )
    """)

    insert_temp_sql = """
        INSERT INTO staff_updates (
            leaid, teachers_fte, teachers_elementary_fte, teachers_secondary_fte,
            admin_fte, guidance_counselors_fte, instructional_aides_fte,
            support_staff_fte, staff_total_fte, staff_data_year
        ) VALUES %s
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

    print(f"Loading {len(values)} staff records into temp table...")

    for i in tqdm(range(0, len(values), batch_size), desc="Loading temp table"):
        batch = values[i:i+batch_size]
        try:
            execute_values(
                cur, insert_temp_sql, batch,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    # Bulk update districts from temp table
    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            teachers_fte = u.teachers_fte,
            teachers_elementary_fte = u.teachers_elementary_fte,
            teachers_secondary_fte = u.teachers_secondary_fte,
            admin_fte = u.admin_fte,
            guidance_counselors_fte = u.guidance_counselors_fte,
            instructional_aides_fte = u.instructional_aides_fte,
            support_staff_fte = u.support_staff_fte,
            staff_total_fte = u.staff_total_fte,
            staff_data_year = u.staff_data_year
        FROM staff_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    # Drop temp table
    cur.execute("DROP TABLE staff_updates")

    conn.commit()

    # Get count of records with staff data
    cur.execute("""
        SELECT COUNT(*) FROM districts
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
