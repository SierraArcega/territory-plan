"""
Urban Institute SAIPE Poverty Data API Loader

Fetches school district poverty estimates from the Urban Institute's Education Data Portal API.
Uses SAIPE (Small Area Income and Poverty Estimates) data.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/saipe/{year}/
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_poverty_data(
    year: int = 2022,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district poverty data from Urban Institute SAIPE API.

    Args:
        year: Data year (e.g., 2022)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of poverty records with leaid and poverty metrics
    """
    all_records = []
    page = 1

    print(f"Fetching SAIPE poverty data for year {year}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/saipe/{year}/"
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
                all_records.append({
                    "leaid": str(leaid).zfill(7),
                    "children_poverty_count": record.get("est_population_5_17_poverty"),
                    "children_poverty_percent": record.get("est_population_5_17_poverty_pct"),
                    "median_household_income": record.get("median_household_income"),
                    "year": year,
                })

        print(f"Page {page}: {len(results)} records, total: {len(all_records)}")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total poverty records fetched: {len(all_records)}")
    return all_records


def upsert_poverty_data(
    connection_string: str,
    records: List[Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Upsert poverty data into district_education_data table.

    Args:
        connection_string: PostgreSQL connection string
        records: List of poverty records
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
    valid_records = [
        r for r in records
        if r.get("children_poverty_count") is not None or r.get("children_poverty_percent") is not None
    ]

    # First, insert records that don't exist yet (for districts without finance data)
    insert_sql = """
        INSERT INTO district_education_data (
            leaid, children_poverty_count, children_poverty_percent,
            median_household_income, saipe_data_year, created_at, updated_at
        )
        SELECT v.leaid, v.poverty_count::integer, v.poverty_percent::numeric,
               v.median_income::numeric, v.year::integer, NOW(), NOW()
        FROM (VALUES %s) AS v(leaid, poverty_count, poverty_percent, median_income, year)
        WHERE v.leaid IN (SELECT leaid FROM districts)
        AND v.leaid NOT IN (SELECT leaid FROM district_education_data)
    """

    # Then update existing records
    update_sql = """
        UPDATE district_education_data
        SET children_poverty_count = v.poverty_count::integer,
            children_poverty_percent = v.poverty_percent::numeric,
            median_household_income = v.median_income::numeric,
            saipe_data_year = v.year::integer,
            updated_at = NOW()
        FROM (VALUES %s) AS v(leaid, poverty_count, poverty_percent, median_income, year)
        WHERE district_education_data.leaid = v.leaid
    """

    values = [
        (
            r["leaid"],
            r.get("children_poverty_count"),
            r.get("children_poverty_percent"),
            r.get("median_household_income"),
            year,
        )
        for r in valid_records
    ]

    updated_count = 0
    failed_count = 0

    print(f"Upserting {len(values)} poverty records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Upserting poverty data"):
        batch = values[i:i+batch_size]
        try:
            # First insert new records
            execute_values(cur, insert_sql, batch, template="(%s, %s, %s, %s, %s)")
            inserted = cur.rowcount

            # Then update existing records
            execute_values(cur, update_sql, batch, template="(%s, %s, %s, %s, %s)")
            updated = cur.rowcount

            updated_count += inserted + updated
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    conn.commit()

    # Get count of records with poverty data
    cur.execute("""
        SELECT COUNT(*) FROM district_education_data
        WHERE children_poverty_percent IS NOT NULL
    """)
    total_with_poverty = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with poverty data: {total_with_poverty}")

    return {
        "updated": updated_count,
        "failed": failed_count,
        "total_with_data": total_with_poverty,
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

    parser = argparse.ArgumentParser(description="Fetch Urban Institute SAIPE poverty data")
    parser.add_argument("--year", type=int, default=2022, help="Data year")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    started_at = datetime.now().isoformat()

    try:
        records = fetch_poverty_data(year=args.year, delay=args.delay)

        if records:
            result = upsert_poverty_data(
                connection_string,
                records,
                year=args.year
            )
            print(f"Poverty data import complete: {result}")

            log_refresh(
                connection_string,
                data_source="urban_institute_saipe",
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
                data_source="urban_institute_saipe",
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
            data_source="urban_institute_saipe",
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
