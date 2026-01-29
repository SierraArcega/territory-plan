"""
Census Bureau SAIPE County Median Household Income Loader

Fetches county-level median household income from Census Bureau SAIPE API
and maps it to school districts via county name.

API Docs: https://www.census.gov/data/developers/data-sets/Poverty-Statistics.html
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


# Census Bureau API base URL
CENSUS_API_BASE = "https://api.census.gov/data/timeseries/poverty/saipe"

# State FIPS codes
STATE_FIPS = [
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
    "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
    "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
    "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
    "56", "72"  # includes Puerto Rico
]


def fetch_county_income(
    year: int = 2022,
    delay: float = 0.3,
) -> List[Dict]:
    """
    Fetch county median household income from Census SAIPE API.

    Args:
        year: Data year (e.g., 2022)
        delay: Delay between requests in seconds

    Returns:
        List of county income records
    """
    all_records = []

    print(f"Fetching county median household income for year {year}...")

    for state_fips in tqdm(STATE_FIPS, desc="Fetching states"):
        url = f"{CENSUS_API_BASE}"
        params = {
            "get": "NAME,SAEMHI_PT,COUNTY",
            "for": "county:*",
            "in": f"state:{state_fips}",
            "time": str(year),
        }

        try:
            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"Error fetching state {state_fips}: {e}")
            continue

        if len(data) < 2:
            continue

        headers = data[0]
        for row in data[1:]:
            record = dict(zip(headers, row))
            county_name = record.get("NAME", "")
            income = record.get("SAEMHI_PT")

            if income and income != "null":
                all_records.append({
                    "state_fips": state_fips,
                    "county_name": county_name,
                    "median_household_income": float(income),
                    "year": year,
                })

        time.sleep(delay)

    print(f"Total county income records fetched: {len(all_records)}")
    return all_records


def update_district_income(
    connection_string: str,
    records: List[Dict],
    year: int,
    batch_size: int = 500,
) -> dict:
    """
    Update district_education_data with median household income from county data.

    Args:
        connection_string: PostgreSQL connection string
        records: List of county income records
        year: Year the data is from
        batch_size: Records per batch update

    Returns:
        Dict with update statistics
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    updated_count = 0
    matched_counties = 0

    print(f"Updating district median household income from {len(records)} counties...")

    for record in tqdm(records, desc="Updating districts"):
        state_fips = record["state_fips"]
        county_name = record["county_name"]
        income = record["median_household_income"]

        # Update all districts in this county
        # First, insert into district_education_data if not exists
        cur.execute("""
            INSERT INTO district_education_data (leaid, median_household_income, saipe_data_year, created_at, updated_at)
            SELECT d.leaid, %s, %s, NOW(), NOW()
            FROM districts d
            WHERE d.state_fips = %s AND d.county_name = %s
            AND d.leaid NOT IN (SELECT leaid FROM district_education_data)
        """, (income, year, state_fips, county_name))
        inserted = cur.rowcount

        # Then update existing records
        cur.execute("""
            UPDATE district_education_data
            SET median_household_income = %s,
                saipe_data_year = %s,
                updated_at = NOW()
            FROM districts d
            WHERE district_education_data.leaid = d.leaid
            AND d.state_fips = %s
            AND d.county_name = %s
        """, (income, year, state_fips, county_name))
        updated = cur.rowcount

        if inserted > 0 or updated > 0:
            matched_counties += 1
            updated_count += inserted + updated

    conn.commit()

    # Get count of districts with income data
    cur.execute("""
        SELECT COUNT(*) FROM district_education_data
        WHERE median_household_income IS NOT NULL
    """)
    total_with_income = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"Districts with median household income: {total_with_income}")

    return {
        "matched_counties": matched_counties,
        "districts_updated": updated_count,
        "total_with_data": total_with_income,
    }


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Fetch Census county median household income")
    parser.add_argument("--year", type=int, default=2022, help="Data year")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    records = fetch_county_income(year=args.year, delay=args.delay)

    if records:
        result = update_district_income(
            connection_string,
            records,
            year=args.year
        )
        print(f"County income import complete: {result}")
    else:
        print("No records fetched")


if __name__ == "__main__":
    main()
