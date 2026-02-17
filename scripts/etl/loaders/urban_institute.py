"""
Urban Institute Education Data API Loader

Fetches enrollment data from the Urban Institute's Education Data Portal API.
Updates districts table with enrollment numbers.

API Docs: https://educationdata.urban.org/documentation/
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Urban Institute Education Data API base URL
API_BASE_URL = "https://educationdata.urban.org/api/v1"


def fetch_enrollment_data(
    year: int = 2023,
    grade: str = "99",  # 99 = Total
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district enrollment data from Urban Institute API.

    The API uses pagination - we need to fetch all pages.

    Args:
        year: Academic year (fall semester year, e.g., 2023 for 2023-24)
        grade: Grade level (99 = total enrollment)
        page_size: Results per page (max 10000)
        delay: Delay between requests in seconds

    Returns:
        List of enrollment records with leaid and enrollment
    """
    all_records = []
    page = 1

    print(f"Fetching enrollment data for year {year}...")

    while True:
        url = f"{API_BASE_URL}/schools/ccd/directory/{year}/"
        params = {
            "grade": grade,
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

        # Extract relevant fields
        for record in results:
            leaid = record.get("leaid")
            enrollment = record.get("enrollment")

            if leaid and enrollment is not None:
                all_records.append({
                    "leaid": str(leaid).zfill(7),
                    "enrollment": int(enrollment) if enrollment else None,
                })

        print(f"Page {page}: fetched {len(results)} records, total so far: {len(all_records)}")

        # Check if there are more pages
        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    print(f"Total enrollment records fetched: {len(all_records)}")
    return all_records


def fetch_district_directory(
    year: int = 2023,
    fips: Optional[str] = None,
    page_size: int = 10000,
    delay: float = 0.5,
) -> List[Dict]:
    """
    Fetch district directory data (includes enrollment and other details).

    Uses the school-districts endpoint for district-level aggregates.

    Args:
        year: Academic year
        fips: State FIPS code to filter by (e.g., "06" for California)
        page_size: Results per page
        delay: Delay between requests

    Returns:
        List of district records
    """
    all_records = []
    page = 1

    state_label = f" (fips={fips})" if fips else ""
    print(f"Fetching district directory for year {year}{state_label}...")

    while True:
        # Use district-level endpoint
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
                all_records.append({
                    "leaid": str(leaid).zfill(7),
                    "enrollment": record.get("enrollment"),
                    "lea_name": record.get("lea_name"),
                    "state_fips": str(record.get("fips", "")).zfill(2),
                    "urban_centric_locale": record.get("urban_centric_locale"),
                    # Contact info
                    "phone": record.get("phone"),
                    "street_location": record.get("street_location"),
                    "city_location": record.get("city_location"),
                    "state_location": record.get("state_location"),
                    "zip_location": record.get("zip_location"),
                    # Geographic context
                    "county_name": record.get("county_name"),
                    # Additional characteristics
                    "number_of_schools": record.get("number_of_schools"),
                    "spec_ed_students": record.get("spec_ed_students"),
                    "ell_students": record.get("english_language_learners"),
                })

        print(f"Page {page}: {len(results)} records, total: {len(all_records)}")

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        time.sleep(delay)

    return all_records


def update_district_enrollment(
    connection_string: str,
    records: List[Dict],
    year: int,
    batch_size: int = 1000,
) -> int:
    """
    Update districts table with enrollment data.

    Args:
        connection_string: PostgreSQL connection string
        records: List of enrollment records
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Number of districts updated
    """
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    update_sql = """
        UPDATE districts
        SET enrollment = data.enrollment::integer,
            urban_institute_year = data.year::integer,
            phone = data.phone,
            street_location = data.street_location,
            city_location = data.city_location,
            state_location = data.state_location,
            zip_location = data.zip_location,
            county_name = data.county_name,
            urban_centric_locale = data.urban_centric_locale::integer,
            number_of_schools = data.number_of_schools::integer,
            spec_ed_students = data.spec_ed_students::integer,
            ell_students = data.ell_students::integer,
            updated_at = NOW()
        FROM (VALUES %s) AS data(
            leaid, enrollment, year, phone, street_location, city_location,
            state_location, zip_location, county_name, urban_centric_locale,
            number_of_schools, spec_ed_students, ell_students
        )
        WHERE districts.leaid = data.leaid
    """

    # Prepare values
    values = [
        (
            r["leaid"],
            r["enrollment"],
            year,
            r.get("phone"),
            r.get("street_location"),
            r.get("city_location"),
            r.get("state_location"),
            r.get("zip_location"),
            r.get("county_name"),
            r.get("urban_centric_locale"),
            r.get("number_of_schools"),
            r.get("spec_ed_students"),
            r.get("ell_students"),
        )
        for r in records
        if r["enrollment"] is not None
    ]

    updated_count = 0

    print(f"Updating {len(values)} districts with enrollment data...")

    for i in tqdm(range(0, len(values), batch_size), desc="Updating"):
        batch = values[i:i+batch_size]
        execute_values(cur, update_sql, batch, template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)")
        updated_count += cur.rowcount

    conn.commit()

    # Get count of matched updates
    cur.execute("SELECT COUNT(*) FROM districts WHERE enrollment IS NOT NULL")
    total_with_enrollment = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with enrollment data: {total_with_enrollment}")
    return total_with_enrollment


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Fetch Urban Institute enrollment data")
    parser.add_argument("--year", type=int, default=2023, help="Academic year")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    # Fetch district directory (includes enrollment)
    records = fetch_district_directory(year=args.year, delay=args.delay)

    if records:
        count = update_district_enrollment(
            connection_string,
            records,
            year=args.year
        )
        print(f"Updated {count} districts with enrollment data")
    else:
        print("No records fetched")


if __name__ == "__main__":
    main()
