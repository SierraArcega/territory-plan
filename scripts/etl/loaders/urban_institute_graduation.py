"""
Urban Institute Graduation Rates Data API Loader

Fetches school district graduation rates from the Urban Institute's
Education Data Portal API and updates the districts table directly.
Uses EdFacts data.

API Docs: https://educationdata.urban.org/documentation/
Endpoint: /school-districts/edfacts/grad-rates/{year}/

Note: As of Jan 2026, graduation data is stored directly on the districts table
(consolidated schema) rather than a separate district_education_data table.
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_graduation_data(
    year: int = 2019,
    page_size: int = 10000,
    delay: float = 0.5,
    fips: Optional[str] = None,
) -> Dict[str, Dict]:
    """
    Fetch district graduation rate data from Urban Institute EdFacts API.

    The API disaggregates by race, disability, econ_disadvantaged, etc.
    We want records where all disaggregation fields = 99 (total).

    Args:
        year: Academic year (max available is 2019)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds
        fips: Optional state FIPS code to filter by (e.g., "06" for California)

    Returns:
        Dict mapping leaid to graduation rates
    """
    all_records: Dict[str, Dict] = {}
    page = 1

    fips_label = f" for state FIPS {fips}" if fips else ""
    print(f"Fetching graduation data for year {year}{fips_label}...")

    while True:
        url = f"{API_BASE_URL}/school-districts/edfacts/grad-rates/{year}/"
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
            grad_rate = record.get("grad_rate_midpt")

            # Check if this is a "total" record (all disaggregation fields = 99)
            is_total = (
                record.get("race") == 99 and
                record.get("disability") == 99 and
                record.get("econ_disadvantaged") == 99 and
                record.get("homeless") == 99 and
                record.get("foster_care") == 99 and
                record.get("lep") == 99
            )

            if leaid and grad_rate is not None and is_total:
                leaid_str = str(leaid).zfill(7)
                all_records[leaid_str] = {
                    "leaid": leaid_str,
                    "year": year,
                    "total": grad_rate,
                }

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
    Update districts table with graduation data.

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

    # Create temp table for efficient bulk updates
    cur.execute("""
        CREATE TEMP TABLE graduation_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            graduation_rate_total NUMERIC,
            graduation_data_year INTEGER
        )
    """)

    insert_temp_sql = """
        INSERT INTO graduation_updates (
            leaid, graduation_rate_total, graduation_data_year
        ) VALUES %s
    """

    # Prepare values
    values = [
        (
            r["leaid"],
            r.get("total"),
            year,
        )
        for r in records.values()
        if r.get("total") is not None
    ]

    updated_count = 0
    failed_count = 0

    print(f"Loading {len(values)} graduation records into temp table...")

    for i in tqdm(range(0, len(values), batch_size), desc="Loading temp table"):
        batch = values[i:i+batch_size]
        try:
            execute_values(cur, insert_temp_sql, batch, template="(%s, %s, %s)")
        except Exception as e:
            print(f"Error in batch {i//batch_size}: {e}")
            failed_count += len(batch)
            conn.rollback()
            continue

    # Bulk update districts from temp table
    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            graduation_rate_total = u.graduation_rate_total,
            graduation_data_year = u.graduation_data_year
        FROM graduation_updates u
        WHERE d.leaid = u.leaid
    """)
    updated_count = cur.rowcount
    print(f"Updated {updated_count} district records")

    # Drop temp table
    cur.execute("DROP TABLE graduation_updates")

    conn.commit()

    # Get count of records with graduation data
    cur.execute("""
        SELECT COUNT(*) FROM districts
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


def fetch_graduation_data_by_state(
    connection_string: str,
    year: int = 2019,
    start_fips: Optional[str] = None,
    delay: float = 0.5,
) -> dict:
    """
    Fetch and upsert graduation data state-by-state for reliability.

    Iterates through all 51 FIPS codes, fetching graduation data per state
    and upserting immediately. Supports resuming from a specific FIPS code.

    Args:
        connection_string: PostgreSQL connection string
        year: Academic year (max available is 2019)
        start_fips: Resume from this FIPS code (e.g., "06" for California)
        delay: Delay between API requests

    Returns:
        Summary dict with per-state counts.
    """
    STATES = [
        ("01", "Alabama"), ("02", "Alaska"), ("04", "Arizona"), ("05", "Arkansas"),
        ("06", "California"), ("08", "Colorado"), ("09", "Connecticut"), ("10", "Delaware"),
        ("11", "DC"), ("12", "Florida"), ("13", "Georgia"), ("15", "Hawaii"),
        ("16", "Idaho"), ("17", "Illinois"), ("18", "Indiana"), ("19", "Iowa"),
        ("20", "Kansas"), ("21", "Kentucky"), ("22", "Louisiana"), ("23", "Maine"),
        ("24", "Maryland"), ("25", "Massachusetts"), ("26", "Michigan"), ("27", "Minnesota"),
        ("28", "Mississippi"), ("29", "Missouri"), ("30", "Montana"), ("31", "Nebraska"),
        ("32", "Nevada"), ("33", "New Hampshire"), ("34", "New Jersey"), ("35", "New Mexico"),
        ("36", "New York"), ("37", "North Carolina"), ("38", "North Dakota"), ("39", "Ohio"),
        ("40", "Oklahoma"), ("41", "Oregon"), ("42", "Pennsylvania"), ("44", "Rhode Island"),
        ("45", "South Carolina"), ("46", "South Dakota"), ("47", "Tennessee"), ("48", "Texas"),
        ("49", "Utah"), ("50", "Vermont"), ("51", "Virginia"), ("53", "Washington"),
        ("54", "West Virginia"), ("55", "Wisconsin"), ("56", "Wyoming"),
    ]

    print("\n" + "=" * 60)
    print("Fetching Graduation Rates - State by State")
    print("=" * 60)

    if start_fips:
        start_fips = start_fips.zfill(2)
        states_to_process = [(f, n) for f, n in STATES if f >= start_fips]
        print(f"Resuming from FIPS {start_fips}, {len(states_to_process)} states remaining")
    else:
        states_to_process = STATES

    total_updated = 0
    total_failed = 0
    state_results = {}

    for i, (fips, state_name) in enumerate(states_to_process, 1):
        print(f"\n[{i}/{len(states_to_process)}] {state_name} (FIPS {fips})")

        records = fetch_graduation_data(year=year, delay=delay, fips=fips)
        count = len(records)

        if records:
            result = upsert_graduation_data(connection_string, records, year=year)
            total_updated += result["updated"]
            total_failed += result["failed"]
            state_results[state_name] = result["updated"]
            print(f"  Updated {result['updated']} districts")
        else:
            state_results[state_name] = 0
            print(f"  No graduation records found")

        print(f"  Running total: {total_updated:,} updated")

    # Print summary
    print(f"\n{'=' * 60}")
    print(f"STATE-BY-STATE GRADUATION SUMMARY")
    print(f"{'=' * 60}")
    for state_name, count in state_results.items():
        if count > 0:
            print(f"  {state_name:20s}: {count:>6,} districts")
    print(f"\n  TOTAL: {total_updated:,} updated, {total_failed:,} failed")

    return {
        "updated": total_updated,
        "failed": total_failed,
        "state_results": state_results,
    }


def main():
    """CLI entry point."""
    import argparse
    from datetime import datetime
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Fetch Urban Institute graduation rate data")
    parser.add_argument("--year", type=int, default=2019, help="Academic year (max available: 2019)")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")
    parser.add_argument("--by-state", action="store_true", help="Fetch data state-by-state (more reliable)")
    parser.add_argument("--start-fips", type=str, default=None, help="Resume state-by-state from this FIPS code")

    args = parser.parse_args()

    # Prefer DIRECT_URL for Python scripts (no pgbouncer)
    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DIRECT_URL or DATABASE_URL environment variable not set")

    # Strip Supabase-specific query params that psycopg2 doesn't understand
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params_str = connection_string.split("?")[1]
        valid_params = [p for p in params_str.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    started_at = datetime.now().isoformat()

    try:
        if args.by_state:
            result = fetch_graduation_data_by_state(
                connection_string,
                year=args.year,
                start_fips=args.start_fips,
                delay=args.delay,
            )
            print(f"Graduation data (state-by-state) complete: {result['updated']} updated, {result['failed']} failed")

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
