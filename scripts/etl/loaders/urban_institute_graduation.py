"""
Urban Institute Graduation Rates Data API Loader

Fetches school district graduation rates from the Urban Institute's
Education Data Portal API using EdFacts data.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/edfacts/grad-rates/{year}/
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_graduation_data(
    year: int = 2022,
    page_size: int = 10000,
    delay: float = 0.5,
) -> Dict[str, Dict]:
    """
    Fetch district graduation rate data from Urban Institute EdFacts API.

    Args:
        year: Academic year
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        Dict mapping leaid to graduation rates by sex
    """
    all_records: Dict[str, Dict] = {}
    page = 1

    print(f"Fetching graduation data for year {year}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/edfacts/grad-rates/{year}/"
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
            sex = record.get("sex")  # 1=Male, 2=Female, 99=Total
            grad_rate = record.get("grad_rate_midpt")

            if leaid and sex is not None and grad_rate is not None:
                leaid_str = str(leaid).zfill(7)

                if leaid_str not in all_records:
                    all_records[leaid_str] = {"leaid": leaid_str, "year": year}

                if sex == 99:  # Total
                    all_records[leaid_str]["total"] = grad_rate
                elif sex == 1:  # Male
                    all_records[leaid_str]["male"] = grad_rate
                elif sex == 2:  # Female
                    all_records[leaid_str]["female"] = grad_rate

        print(f"Page {page}: {len(results)} records, {len(all_records)} unique districts")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total districts with graduation data: {len(all_records)}")
    return all_records


def upsert_graduation_data(
    connection_string: str,
    records: Dict[str, Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Upsert graduation data into district_education_data table.

    Args:
        connection_string: PostgreSQL connection string
        records: Dict mapping leaid to graduation rates
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Dict with counts of updated and failed records
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # First, insert records that don't exist yet
    insert_sql = """
        INSERT INTO district_education_data (
            leaid, graduation_rate_total, graduation_rate_male, graduation_rate_female,
            graduation_data_year, created_at, updated_at
        )
        SELECT v.leaid, v.rate_total::numeric, v.rate_male::numeric, v.rate_female::numeric,
               v.year::integer, NOW(), NOW()
        FROM (VALUES %s) AS v(leaid, rate_total, rate_male, rate_female, year)
        WHERE v.leaid IN (SELECT leaid FROM districts)
        AND v.leaid NOT IN (SELECT leaid FROM district_education_data)
    """

    # Then update existing records
    update_sql = """
        UPDATE district_education_data
        SET graduation_rate_total = v.rate_total::numeric,
            graduation_rate_male = v.rate_male::numeric,
            graduation_rate_female = v.rate_female::numeric,
            graduation_data_year = v.year::integer,
            updated_at = NOW()
        FROM (VALUES %s) AS v(leaid, rate_total, rate_male, rate_female, year)
        WHERE district_education_data.leaid = v.leaid
    """

    # Prepare values
    values = [
        (
            r["leaid"],
            r.get("total"),
            r.get("male"),
            r.get("female"),
            year,
        )
        for r in records.values()
        if r.get("total") is not None
    ]

    updated_count = 0
    failed_count = 0

    print(f"Upserting {len(values)} graduation records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Upserting graduation data"):
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

    # Get count of records with graduation data
    cur.execute("""
        SELECT COUNT(*) FROM district_education_data
        WHERE graduation_rate_total IS NOT NULL
    """)
    total_with_graduation = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with graduation data: {total_with_graduation}")

    return {
        "updated": updated_count,
        "failed": failed_count,
        "total_with_data": total_with_graduation,
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

    parser = argparse.ArgumentParser(description="Fetch Urban Institute graduation rate data")
    parser.add_argument("--year", type=int, default=2022, help="Academic year")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    started_at = datetime.now().isoformat()

    try:
        records = fetch_graduation_data(year=args.year, delay=args.delay)

        if records:
            result = upsert_graduation_data(
                connection_string,
                records,
                year=args.year
            )
            print(f"Graduation data import complete: {result}")

            log_refresh(
                connection_string,
                data_source="urban_institute_graduation",
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
                data_source="urban_institute_graduation",
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
            data_source="urban_institute_graduation",
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
