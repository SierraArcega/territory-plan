"""
Urban Institute SAIPE Poverty Data API Loader

Fetches school district poverty estimates from the Urban Institute's Education Data Portal API
and updates the districts table directly.
Uses SAIPE (Small Area Income and Poverty Estimates) data.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/saipe/{year}/

Note: As of Jan 2026, poverty data is stored directly on the districts table
(consolidated schema) rather than a separate district_education_data table.
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
    Update districts table with poverty data.

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

    # Create temp table for efficient bulk updates
    cur.execute("""
        CREATE TEMP TABLE poverty_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            children_poverty_count INTEGER,
            children_poverty_percent NUMERIC,
            median_household_income NUMERIC,
            saipe_data_year INTEGER
        )
    """)

    insert_temp_sql = """
        INSERT INTO poverty_updates (
            leaid, children_poverty_count, children_poverty_percent,
            median_household_income, saipe_data_year
        ) VALUES %s
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

    print(f"Loading {len(values)} poverty records into temp table...")

    for i in tqdm(range(0, len(values), batch_size), desc="Loading temp table"):
        batch = values[i:i+batch_size]
        try:
            execute_values(cur, insert_temp_sql, batch, template="(%s, %s, %s, %s, %s)")
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    # Bulk update districts from temp table
    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            children_poverty_count = u.children_poverty_count,
            children_poverty_percent = u.children_poverty_percent,
            median_household_income = u.median_household_income,
            saipe_data_year = u.saipe_data_year
        FROM poverty_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    # Drop temp table
    cur.execute("DROP TABLE poverty_updates")

    conn.commit()

    # Get count of records with poverty data
    cur.execute("""
        SELECT COUNT(*) FROM districts
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
