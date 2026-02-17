"""
Urban Institute Education Data API - School Loader

Fetches school directory and enrollment data from the Urban Institute's
Education Data Portal API. Supports charter-only (default) or all schools mode.
Upserts into schools and school_enrollment_history tables,
and updates district-level charter aggregates.

API Docs: https://educationdata.urban.org/documentation/
"""

import os
import sys
import time
import argparse
from typing import Dict, List, Optional
import requests
from tqdm import tqdm
from dotenv import load_dotenv


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_school_directory(
    year: int = 2023,
    charter_only: bool = True,
    fips: Optional[str] = None,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch school directory data from Urban Institute API.

    The API uses pagination - we need to fetch all pages.

    Args:
        year: Academic year (fall semester year, e.g., 2023 for 2023-24)
        charter_only: If True, only fetch charter schools (charter=1)
        fips: State FIPS code to filter by (e.g., "06" for California)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of school directory records mapped to database columns
    """
    all_records = []
    page = 1

    filter_label = "charter schools" if charter_only else "all schools"
    state_label = f" (fips={fips})" if fips else ""
    print(f"Fetching school directory for year {year} ({filter_label}){state_label}...")

    while True:
        url = f"{API_BASE_URL}/schools/ccd/directory/{year}/"
        params = {
            "page": page,
            "per_page": page_size,
        }

        if charter_only:
            params["charter"] = 1

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

        # Extract and map fields to database columns
        for record in results:
            ncessch = record.get("ncessch")
            if ncessch:
                all_records.append({
                    "ncessch": str(ncessch).zfill(12),
                    "leaid": str(record.get("leaid", "")).zfill(7),
                    "school_name": record.get("school_name"),
                    "charter": record.get("charter"),
                    "school_level": record.get("school_level"),
                    "school_type": record.get("school_type"),
                    "lograde": record.get("lograde"),
                    "higrade": record.get("higrade"),
                    "school_status": record.get("school_status"),
                    "latitude": record.get("latitude"),
                    "longitude": record.get("longitude"),
                    "street_address": record.get("street_mailing"),
                    "city": record.get("city_mailing"),
                    "state_abbrev": record.get("state_mailing") or record.get("state_location"),
                    "zip": record.get("zip_mailing"),
                    "county_name": record.get("county_name"),
                    "phone": record.get("phone"),
                    "urban_centric_locale": record.get("urban_centric_locale"),
                    "enrollment": record.get("enrollment"),
                })

        print(f"Page {page}: {len(results)} records, total: {len(all_records)}")

        # Check if there are more pages
        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total school directory records fetched: {len(all_records)}")
    return all_records


def fetch_school_enrollment(
    year: int = 2023,
    charter_only: bool = True,
    fips: Optional[str] = None,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch school-level enrollment data from Urban Institute API.

    Uses grade-99 (total enrollment) for each school.

    Args:
        year: Academic year (fall semester year, e.g., 2023 for 2023-24)
        charter_only: If True, only fetch charter schools (charter=1)
        fips: State FIPS code to filter by (e.g., "06" for California)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of enrollment records with ncessch, year, and enrollment
    """
    all_records = []
    page = 1

    filter_label = "charter schools" if charter_only else "all schools"
    state_label = f" (fips={fips})" if fips else ""
    print(f"Fetching school enrollment for year {year} ({filter_label}){state_label}...")

    while True:
        url = f"{API_BASE_URL}/schools/ccd/enrollment/{year}/grade-99/"
        params = {
            "page": page,
            "per_page": page_size,
        }

        if charter_only:
            params["charter"] = 1

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

        # Extract relevant fields
        for record in results:
            ncessch = record.get("ncessch")
            enrollment = record.get("enrollment")

            if ncessch and enrollment is not None:
                all_records.append({
                    "ncessch": str(ncessch).zfill(12),
                    "year": year,
                    "enrollment": int(enrollment) if enrollment else None,
                })

        print(f"Page {page}: {len(results)} records, total: {len(all_records)}")

        # Check if there are more pages
        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total enrollment records fetched: {len(all_records)}")
    return all_records


def upsert_schools(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 1000,
) -> int:
    """
    Upsert school directory records into the schools table.

    Uses INSERT ... ON CONFLICT (ncessch) DO UPDATE to handle duplicates.

    Args:
        connection_string: PostgreSQL connection string
        records: List of school directory records
        batch_size: Records per batch upsert

    Returns:
        Number of records upserted
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Get valid leaids from districts table to avoid FK violations
    cur.execute("SELECT leaid FROM districts")
    valid_leaids = {row[0] for row in cur.fetchall()}
    original_count = len(records)
    records = [r for r in records if r["leaid"] in valid_leaids]
    skipped = original_count - len(records)
    if skipped > 0:
        print(f"Skipped {skipped} schools with no matching district (of {original_count} total)")

    if not records:
        print("No valid school records to upsert")
        cur.close()
        conn.close()
        return 0

    upsert_sql = """
        INSERT INTO schools (
            ncessch, leaid, school_name, charter, school_level, school_type,
            lograde, higrade, school_status, latitude, longitude,
            street_address, city, state_abbrev, zip, county_name,
            phone, urban_centric_locale, enrollment, updated_at
        )
        VALUES %s
        ON CONFLICT (ncessch) DO UPDATE SET
            leaid = EXCLUDED.leaid,
            school_name = EXCLUDED.school_name,
            charter = EXCLUDED.charter,
            school_level = EXCLUDED.school_level,
            school_type = EXCLUDED.school_type,
            lograde = EXCLUDED.lograde,
            higrade = EXCLUDED.higrade,
            school_status = EXCLUDED.school_status,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            street_address = EXCLUDED.street_address,
            city = EXCLUDED.city,
            state_abbrev = EXCLUDED.state_abbrev,
            zip = EXCLUDED.zip,
            county_name = EXCLUDED.county_name,
            phone = EXCLUDED.phone,
            urban_centric_locale = EXCLUDED.urban_centric_locale,
            enrollment = EXCLUDED.enrollment,
            updated_at = NOW()
    """

    template = (
        "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())"
    )

    # Prepare values
    values = [
        (
            r["ncessch"],
            r["leaid"],
            r.get("school_name"),
            r.get("charter"),
            r.get("school_level"),
            r.get("school_type"),
            r.get("lograde"),
            r.get("higrade"),
            r.get("school_status"),
            r.get("latitude"),
            r.get("longitude"),
            r.get("street_address"),
            r.get("city"),
            r.get("state_abbrev"),
            r.get("zip"),
            r.get("county_name"),
            r.get("phone"),
            r.get("urban_centric_locale"),
            r.get("enrollment"),
        )
        for r in records
    ]

    upserted_count = 0

    print(f"Upserting {len(values)} school records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Upserting schools"):
        batch = values[i:i + batch_size]
        execute_values(cur, upsert_sql, batch, template=template)
        upserted_count += cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    print(f"Upserted {upserted_count} school records")
    return upserted_count


def upsert_enrollment_history(
    connection_string: str,
    records: List[Dict],
    batch_size: int = 1000,
) -> int:
    """
    Upsert school enrollment history records.

    Uses INSERT ... ON CONFLICT (ncessch, year) DO UPDATE to handle duplicates.

    Args:
        connection_string: PostgreSQL connection string
        records: List of enrollment records with ncessch, year, enrollment
        batch_size: Records per batch upsert

    Returns:
        Number of records upserted
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Get valid ncessch IDs from schools table to avoid FK violations
    cur.execute("SELECT ncessch FROM schools")
    valid_ncessch = {row[0] for row in cur.fetchall()}

    upsert_sql = """
        INSERT INTO school_enrollment_history (ncessch, year, enrollment)
        VALUES %s
        ON CONFLICT (ncessch, year) DO UPDATE SET
            enrollment = EXCLUDED.enrollment
    """

    template = "(%s, %s, %s)"

    # Prepare values, filtering to valid schools only
    values = [
        (
            r["ncessch"],
            r["year"],
            r["enrollment"],
        )
        for r in records
        if r["enrollment"] is not None and r["ncessch"] in valid_ncessch
    ]

    upserted_count = 0

    print(f"Upserting {len(values)} enrollment history records...")

    for i in tqdm(range(0, len(values), batch_size), desc="Upserting enrollment"):
        batch = values[i:i + batch_size]
        execute_values(cur, upsert_sql, batch, template=template)
        upserted_count += cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    print(f"Upserted {upserted_count} enrollment history records")
    return upserted_count


def ensure_districts_for_schools(
    connection_string: str,
    school_records: List[Dict],
    year: int = 2023,
    delay: float = 0.5,
) -> int:
    """
    Create stub district records for charter school LEAIDs that don't exist
    in the districts table. Fetches district info from the Urban Institute
    district directory API.

    Args:
        connection_string: PostgreSQL connection string
        school_records: List of school directory records (with leaid, state_abbrev)
        year: Year for district directory API
        delay: Delay between API requests

    Returns:
        Number of new districts created
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Find which LEAIDs are missing
    cur.execute("SELECT leaid FROM districts")
    existing_leaids = {row[0] for row in cur.fetchall()}

    school_leaids = {r["leaid"] for r in school_records}
    missing_leaids = school_leaids - existing_leaids

    if not missing_leaids:
        print("All school LEAIDs already exist in districts table")
        cur.close()
        conn.close()
        return 0

    print(f"Found {len(missing_leaids)} missing district LEAIDs, fetching from Urban Institute...")

    # Fetch the full district directory to get names and state info
    all_districts = []
    page = 1

    while True:
        url = f"{API_BASE_URL}/school-districts/ccd/directory/{year}/"
        params = {
            "page": page,
            "per_page": 10000,
        }

        try:
            response = requests.get(url, params=params, timeout=120)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"Error fetching district directory page {page}: {e}")
            break

        results = data.get("results", [])
        if not results:
            break

        for record in results:
            leaid = str(record.get("leaid", "")).zfill(7)
            if leaid in missing_leaids:
                all_districts.append({
                    "leaid": leaid,
                    "name": record.get("lea_name", f"District {leaid}"),
                    "state_fips": str(record.get("fips", "")).zfill(2),
                    "state_abbrev": record.get("state_location"),
                    "phone": record.get("phone"),
                    "street_location": record.get("street_location"),
                    "city_location": record.get("city_location"),
                    "state_location": record.get("state_location"),
                    "zip_location": record.get("zip_location"),
                    "county_name": record.get("county_name"),
                    "urban_centric_locale": record.get("urban_centric_locale"),
                    "number_of_schools": record.get("number_of_schools"),
                    "enrollment": record.get("enrollment"),
                })

        print(f"District directory page {page}: {len(results)} records, matched {len(all_districts)} missing so far")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    # For any LEAIDs still not found in the district directory, create stubs from school data
    found_leaids = {d["leaid"] for d in all_districts}
    still_missing = missing_leaids - found_leaids

    if still_missing:
        print(f"{len(still_missing)} LEAIDs not found in district directory, creating stubs from school data")
        # Build state abbrev -> fips lookup
        ABBREV_TO_FIPS = {
            "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
            "CO": "08", "CT": "09", "DE": "10", "DC": "11", "FL": "12",
            "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18",
            "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23",
            "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
            "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33",
            "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38",
            "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44",
            "SC": "45", "SD": "46", "TN": "47", "TX": "48", "UT": "49",
            "VT": "50", "VA": "51", "WA": "53", "WV": "54", "WI": "55",
            "WY": "56", "AS": "60", "GU": "66", "MP": "69", "PR": "72",
            "VI": "78",
        }

        # Group school records by leaid for stub creation
        schools_by_leaid = {}
        for s in school_records:
            if s["leaid"] in still_missing:
                schools_by_leaid.setdefault(s["leaid"], []).append(s)

        for leaid, schools in schools_by_leaid.items():
            first_school = schools[0]
            state_abbrev = first_school.get("state_abbrev", "")
            all_districts.append({
                "leaid": leaid,
                "name": f"Charter LEA {leaid}",
                "state_fips": ABBREV_TO_FIPS.get(state_abbrev, leaid[:2]),
                "state_abbrev": state_abbrev,
                "phone": None,
                "street_location": None,
                "city_location": first_school.get("city"),
                "state_location": state_abbrev,
                "zip_location": None,
                "county_name": first_school.get("county_name"),
                "urban_centric_locale": None,
                "number_of_schools": len(schools),
                "enrollment": sum(s.get("enrollment") or 0 for s in schools) or None,
            })

    if not all_districts:
        print("No district records to insert")
        cur.close()
        conn.close()
        return 0

    # Insert stub districts
    insert_sql = """
        INSERT INTO districts (
            leaid, name, state_fips, state_abbrev,
            phone, street_location, city_location, state_location,
            zip_location, county_name, urban_centric_locale,
            number_of_schools, enrollment, updated_at
        )
        VALUES %s
        ON CONFLICT (leaid) DO NOTHING
    """

    template = "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())"

    values = [
        (
            d["leaid"],
            d["name"],
            d["state_fips"],
            d.get("state_abbrev"),
            d.get("phone"),
            d.get("street_location"),
            d.get("city_location"),
            d.get("state_location"),
            d.get("zip_location"),
            d.get("county_name"),
            d.get("urban_centric_locale"),
            d.get("number_of_schools"),
            d.get("enrollment"),
        )
        for d in all_districts
    ]

    execute_values(cur, insert_sql, values, template=template)
    inserted = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    print(f"Created {inserted} new stub district records for charter school LEAIDs")
    return inserted


def update_district_charter_aggregates(connection_string: str) -> int:
    """
    Update districts table with charter school aggregate counts.

    Computes charter_school_count and charter_enrollment from the schools
    table and updates the districts table accordingly.

    Args:
        connection_string: PostgreSQL connection string

    Returns:
        Number of districts updated
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    print("Updating district charter school aggregates...")

    cur.execute("""
        UPDATE districts d SET
            charter_school_count = s.cnt,
            charter_enrollment = s.total_enrollment
        FROM (
            SELECT leaid, COUNT(*) as cnt, SUM(enrollment) as total_enrollment
            FROM schools WHERE charter = 1 AND school_status = 1
            GROUP BY leaid
        ) s
        WHERE d.leaid = s.leaid;
    """)

    updated_count = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    print(f"Updated {updated_count} districts with charter aggregates")
    return updated_count


def main():
    """CLI entry point."""
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Fetch Urban Institute charter school data"
    )
    parser.add_argument(
        "--year", type=int, default=2023,
        help="Academic year (default: 2023)"
    )
    parser.add_argument(
        "--start-year", type=int, default=None,
        help="Start year for enrollment history range"
    )
    parser.add_argument(
        "--end-year", type=int, default=None,
        help="End year for enrollment history range"
    )
    parser.add_argument(
        "--charter-only", action="store_true", default=True,
        help="Only fetch charter schools (default: True)"
    )
    parser.add_argument(
        "--no-charter-only", action="store_false", dest="charter_only",
        help="Fetch all schools, not just charters"
    )
    parser.add_argument(
        "--directory-only", action="store_true", default=False,
        help="Only fetch directory data (skip enrollment)"
    )
    parser.add_argument(
        "--enrollment-only", action="store_true", default=False,
        help="Only fetch enrollment data (skip directory)"
    )
    parser.add_argument(
        "--fips", type=str, default=None,
        help="State FIPS code to filter by (e.g., 06 for California)"
    )
    parser.add_argument(
        "--delay", type=float, default=0.5,
        help="Delay between API calls in seconds (default: 0.5)"
    )

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    # Determine year range for enrollment history
    start_year = args.start_year or args.year
    end_year = args.end_year or args.year

    # Fetch and upsert school directory
    if not args.enrollment_only:
        records = fetch_school_directory(
            year=args.year,
            charter_only=args.charter_only,
            fips=args.fips,
            delay=args.delay,
        )

        if records:
            count = upsert_schools(connection_string, records)
            print(f"Upserted {count} school directory records")
        else:
            print("No directory records fetched")

    # Fetch and upsert enrollment history
    if not args.directory_only:
        for year in range(start_year, end_year + 1):
            enrollment_records = fetch_school_enrollment(
                year=year,
                charter_only=args.charter_only,
                fips=args.fips,
                delay=args.delay,
            )

            if enrollment_records:
                count = upsert_enrollment_history(connection_string, enrollment_records)
                print(f"Upserted {count} enrollment records for year {year}")
            else:
                print(f"No enrollment records fetched for year {year}")

    # Update district-level charter aggregates
    updated = update_district_charter_aggregates(connection_string)
    print(f"Updated {updated} districts with charter aggregates")

    print("Done.")


if __name__ == "__main__":
    main()
