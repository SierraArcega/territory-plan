"""
Urban Institute Finance Data API Loader

Fetches school district finance data from the Urban Institute's Education Data Portal API
and updates the districts table directly.
Includes revenue sources (federal/state/local) and per-pupil expenditure.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/ccd/finance/{year}/

Note: As of Jan 2026, finance data is stored directly on the districts table
(consolidated schema) rather than a separate district_education_data table.
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_finance_data(
    year: int = 2022,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district finance data from Urban Institute API.

    Args:
        year: Fiscal year (e.g., 2022 for FY2022 data)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of finance records with leaid and financial metrics
    """
    all_records = []
    page = 1

    print(f"Fetching finance data for year {year}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/ccd/finance/{year}/"
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
                # Calculate per-pupil expenditure from total and enrollment
                exp_total = record.get("exp_total")
                enrollment = record.get("enrollment_fall_responsible")
                exp_per_pupil = None
                if exp_total and enrollment and exp_total > 0 and enrollment > 0:
                    exp_per_pupil = exp_total / enrollment

                all_records.append({
                    "leaid": str(leaid).zfill(7),
                    # Revenue sources
                    "total_revenue": record.get("rev_total"),
                    "federal_revenue": record.get("rev_fed_total"),
                    "state_revenue": record.get("rev_state_total"),
                    "local_revenue": record.get("rev_local_total"),
                    # Expenditure
                    "total_expenditure": exp_total,
                    "expenditure_per_pupil": exp_per_pupil,
                    # Salaries
                    "salaries_total": record.get("salaries_total"),
                    "salaries_instruction": record.get("salaries_instruction"),
                    "salaries_teachers_regular": record.get("salaries_teachers_regular_prog"),
                    "salaries_teachers_special_ed": record.get("salaries_teachers_sped"),
                    "salaries_teachers_vocational": record.get("salaries_teachers_vocational"),
                    "salaries_teachers_other": record.get("salaries_teachers_other_ed"),
                    "salaries_support_admin": record.get("salaries_supp_sch_admin"),
                    "salaries_support_instructional": record.get("salaries_supp_instruc_staff"),
                    "benefits_total": record.get("benefits_employee_total"),
                    "year": year,
                })

        print(f"Page {page}: {len(results)} records, total: {len(all_records)}")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total finance records fetched: {len(all_records)}")
    return all_records


def upsert_finance_data(
    connection_string: str,
    records: List[Dict],
    year: int,
    batch_size: int = 1000,
) -> dict:
    """
    Update districts table with finance data.

    Args:
        connection_string: PostgreSQL connection string
        records: List of finance records
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Dict with counts of updated and failed records
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Filter records with valid data (Urban Institute uses -1, -2 for missing/not applicable)
    def is_valid(val):
        return val is not None and val >= 0

    def clean_val(val):
        return val if is_valid(val) else None

    valid_records = [
        {
            "leaid": r["leaid"],
            "year": r["year"],
            # Revenue
            "total_revenue": clean_val(r.get("total_revenue")),
            "federal_revenue": clean_val(r.get("federal_revenue")),
            "state_revenue": clean_val(r.get("state_revenue")),
            "local_revenue": clean_val(r.get("local_revenue")),
            "total_expenditure": clean_val(r.get("total_expenditure")),
            "expenditure_per_pupil": clean_val(r.get("expenditure_per_pupil")),
            # Salaries
            "salaries_total": clean_val(r.get("salaries_total")),
            "salaries_instruction": clean_val(r.get("salaries_instruction")),
            "salaries_teachers_regular": clean_val(r.get("salaries_teachers_regular")),
            "salaries_teachers_special_ed": clean_val(r.get("salaries_teachers_special_ed")),
            "salaries_teachers_vocational": clean_val(r.get("salaries_teachers_vocational")),
            "salaries_teachers_other": clean_val(r.get("salaries_teachers_other")),
            "salaries_support_admin": clean_val(r.get("salaries_support_admin")),
            "salaries_support_instructional": clean_val(r.get("salaries_support_instructional")),
            "benefits_total": clean_val(r.get("benefits_total")),
        }
        for r in records
        if is_valid(r.get("total_revenue")) or is_valid(r.get("salaries_total"))
    ]

    # Create temp table for efficient bulk updates
    cur.execute("""
        CREATE TEMP TABLE finance_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            total_revenue NUMERIC,
            federal_revenue NUMERIC,
            state_revenue NUMERIC,
            local_revenue NUMERIC,
            total_expenditure NUMERIC,
            expenditure_per_pupil NUMERIC,
            finance_data_year INTEGER,
            salaries_total NUMERIC,
            salaries_instruction NUMERIC,
            salaries_teachers_regular NUMERIC,
            salaries_teachers_special_ed NUMERIC,
            salaries_teachers_vocational NUMERIC,
            salaries_teachers_other NUMERIC,
            salaries_support_admin NUMERIC,
            salaries_support_instructional NUMERIC,
            benefits_total NUMERIC
        )
    """)

    insert_temp_sql = """
        INSERT INTO finance_updates (
            leaid, total_revenue, federal_revenue, state_revenue, local_revenue,
            total_expenditure, expenditure_per_pupil, finance_data_year,
            salaries_total, salaries_instruction, salaries_teachers_regular,
            salaries_teachers_special_ed, salaries_teachers_vocational, salaries_teachers_other,
            salaries_support_admin, salaries_support_instructional, benefits_total
        ) VALUES %s
    """

    # Prepare values
    values = [
        (
            r["leaid"],
            r.get("total_revenue"),
            r.get("federal_revenue"),
            r.get("state_revenue"),
            r.get("local_revenue"),
            r.get("total_expenditure"),
            r.get("expenditure_per_pupil"),
            year,
            r.get("salaries_total"),
            r.get("salaries_instruction"),
            r.get("salaries_teachers_regular"),
            r.get("salaries_teachers_special_ed"),
            r.get("salaries_teachers_vocational"),
            r.get("salaries_teachers_other"),
            r.get("salaries_support_admin"),
            r.get("salaries_support_instructional"),
            r.get("benefits_total"),
        )
        for r in valid_records
    ]

    updated_count = 0
    failed_count = 0

    print(f"Loading {len(values)} finance records into temp table...")

    for i in tqdm(range(0, len(values), batch_size), desc="Loading temp table"):
        batch = values[i:i+batch_size]
        try:
            execute_values(
                cur, insert_temp_sql, batch,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
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
            total_revenue = u.total_revenue,
            federal_revenue = u.federal_revenue,
            state_revenue = u.state_revenue,
            local_revenue = u.local_revenue,
            total_expenditure = u.total_expenditure,
            expenditure_per_pupil = u.expenditure_per_pupil,
            finance_data_year = u.finance_data_year,
            salaries_total = u.salaries_total,
            salaries_instruction = u.salaries_instruction,
            salaries_teachers_regular = u.salaries_teachers_regular,
            salaries_teachers_special_ed = u.salaries_teachers_special_ed,
            salaries_teachers_vocational = u.salaries_teachers_vocational,
            salaries_teachers_other = u.salaries_teachers_other,
            salaries_support_admin = u.salaries_support_admin,
            salaries_support_instructional = u.salaries_support_instructional,
            benefits_total = u.benefits_total
        FROM finance_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    # Drop temp table
    cur.execute("DROP TABLE finance_updates")

    conn.commit()

    # Get count of records with finance data
    cur.execute("""
        SELECT COUNT(*) FROM districts
        WHERE expenditure_per_pupil IS NOT NULL
    """)
    total_with_finance = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with finance data: {total_with_finance}")

    return {
        "updated": updated_count,
        "failed": failed_count,
        "total_with_data": total_with_finance,
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

    parser = argparse.ArgumentParser(description="Fetch Urban Institute finance data")
    parser.add_argument("--year", type=int, default=2022, help="Fiscal year")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    started_at = datetime.now().isoformat()

    try:
        records = fetch_finance_data(year=args.year, delay=args.delay)

        if records:
            result = upsert_finance_data(
                connection_string,
                records,
                year=args.year
            )
            print(f"Finance data import complete: {result}")

            log_refresh(
                connection_string,
                data_source="urban_institute_finance",
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
                data_source="urban_institute_finance",
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
            data_source="urban_institute_finance",
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
