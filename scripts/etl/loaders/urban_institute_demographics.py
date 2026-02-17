"""
Urban Institute Demographics Data API Loader

Fetches school district enrollment by race/ethnicity from the Urban Institute's
Education Data Portal API and updates the districts table directly.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/ccd/enrollment/{year}/grade-99/race/

Note: As of Jan 2026, demographics data is stored directly on the districts table
(consolidated schema) rather than a separate district_enrollment_demographics table.
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
    fips: Optional[str] = None,
    page_size: int = 10000,
    delay: float = 0.5,
) -> Dict[str, Dict]:
    """
    Fetch district enrollment by race data from Urban Institute API.

    Args:
        year: Academic year
        grade: Grade level (99 = total)
        fips: State FIPS code to filter by (e.g., "06" for California)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        Dict mapping leaid to enrollment by race
    """
    all_records: Dict[str, Dict] = {}
    page = 1

    state_label = f" (fips={fips})" if fips else ""
    print(f"Fetching demographics data for year {year}, grade {grade}{state_label}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/ccd/enrollment/{year}/grade-{grade}/race/"
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
    Update districts table with demographics data.

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

    # Create temp table for efficient bulk updates
    cur.execute("""
        CREATE TEMP TABLE demographics_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            enrollment_white INTEGER,
            enrollment_black INTEGER,
            enrollment_hispanic INTEGER,
            enrollment_asian INTEGER,
            enrollment_american_indian INTEGER,
            enrollment_pacific_islander INTEGER,
            enrollment_two_or_more INTEGER,
            total_enrollment INTEGER,
            demographics_data_year INTEGER
        )
    """)

    insert_temp_sql = """
        INSERT INTO demographics_updates (
            leaid, enrollment_white, enrollment_black, enrollment_hispanic,
            enrollment_asian, enrollment_american_indian, enrollment_pacific_islander,
            enrollment_two_or_more, total_enrollment, demographics_data_year
        ) VALUES %s
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

    print(f"Loading {len(values)} demographics records into temp table...")

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
            enrollment_white = u.enrollment_white,
            enrollment_black = u.enrollment_black,
            enrollment_hispanic = u.enrollment_hispanic,
            enrollment_asian = u.enrollment_asian,
            enrollment_american_indian = u.enrollment_american_indian,
            enrollment_pacific_islander = u.enrollment_pacific_islander,
            enrollment_two_or_more = u.enrollment_two_or_more,
            total_enrollment = u.total_enrollment,
            demographics_data_year = u.demographics_data_year
        FROM demographics_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    # Drop temp table
    cur.execute("DROP TABLE demographics_updates")

    conn.commit()

    # Get count of records with demographics data
    cur.execute("""
        SELECT COUNT(*) FROM districts
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


# Grade codes from the API for grade-level enrollment
GRADE_CODES = {
    -1: "PK",  # Pre-K
    0: "K",    # Kindergarten
    1: "01", 2: "02", 3: "03", 4: "04", 5: "05", 6: "06",
    7: "07", 8: "08", 9: "09", 10: "10", 11: "11", 12: "12",
    13: "UG",  # Ungraded
}


def fetch_grade_enrollment_data(
    year: int = 2022,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district enrollment by grade level from Urban Institute API.

    Fetches grade-specific enrollment (K-12 plus PK and UG) for each district.

    Args:
        year: Academic year
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of (leaid, year, grade, enrollment) records
    """
    all_records = []

    for grade_code, grade_label in GRADE_CODES.items():
        print(f"Fetching enrollment for grade {grade_label} ({grade_code}), year {year}...")
        page = 1

        while True:
            url = f"{API_BASE_URL}/school-districts/ccd/enrollment/{year}/grade-{grade_code}/"
            params = {
                "page": page,
                "per_page": page_size,
            }

            try:
                response = requests.get(url, params=params, timeout=120)
                response.raise_for_status()
                data = response.json()
            except requests.RequestException as e:
                print(f"  Error fetching page {page}: {e}")
                break

            results = data.get("results", [])
            if not results:
                break

            for record in results:
                leaid = record.get("leaid")
                enrollment = record.get("enrollment")
                race = record.get("race")

                # Only use total (race=99) or if race is not disaggregated
                if race is not None and race != 99:
                    continue

                if leaid and enrollment is not None and enrollment >= 0:
                    all_records.append({
                        "leaid": str(leaid).zfill(7),
                        "year": year,
                        "grade": grade_label,
                        "enrollment": int(enrollment),
                    })

            next_url = data.get("next")
            if not next_url:
                break

            page += 1
            time.sleep(delay)

    print(f"Total grade enrollment records: {len(all_records)}")
    return all_records


def upsert_grade_enrollment(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 1000,
) -> dict:
    """
    Upsert grade-level enrollment into district_grade_enrollment table.

    Args:
        connection_string: PostgreSQL connection string
        records: List of grade enrollment records
        batch_size: Records per batch

    Returns:
        Dict with counts
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Filter to valid leaids
    cur.execute("SELECT leaid FROM districts")
    valid_leaids = {row[0] for row in cur.fetchall()}

    values = [
        (r["leaid"], r["year"], r["grade"], r["enrollment"])
        for r in records
        if r["leaid"] in valid_leaids
    ]

    upsert_sql = """
        INSERT INTO district_grade_enrollment (leaid, year, grade, enrollment)
        VALUES %s
        ON CONFLICT (leaid, year, grade) DO UPDATE SET
            enrollment = EXCLUDED.enrollment
    """

    upserted_count = 0
    failed_count = 0

    print(f"Upserting {len(values)} grade enrollment records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Upserting grade enrollment"):
        batch = values[i:i+batch_size]
        try:
            execute_values(cur, upsert_sql, batch, template="(%s, %s, %s, %s)")
            upserted_count += len(batch)
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    conn.commit()

    cur.execute("SELECT COUNT(*) FROM district_grade_enrollment")
    total_records = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Upserted {upserted_count} grade enrollment records (total in table: {total_records})")

    return {
        "upserted": upserted_count,
        "failed": failed_count,
        "total_records": total_records,
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
