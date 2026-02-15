#!/usr/bin/env python3
"""
ETL Pipeline Orchestrator

Runs the complete ETL pipeline:
1. Load NCES EDGE boundaries into PostGIS
2. Fetch Urban Institute enrollment data
3. Load Fullmind CSV data with matching

Usage:
    python run_etl.py --all
    python run_etl.py --boundaries --shapefile /path/to/shapefile.shp
    python run_etl.py --fullmind /path/to/fullmind.csv
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))

from loaders.nces_edge import download_nces_edge, find_shapefile, load_nces_edge_to_postgis
from loaders.urban_institute import fetch_district_directory, update_district_enrollment
from loaders.urban_institute_finance import fetch_finance_data, upsert_finance_data
from loaders.urban_institute_poverty import fetch_poverty_data, upsert_poverty_data
from loaders.urban_institute_demographics import (
    fetch_demographics_data, upsert_demographics_data,
    fetch_grade_enrollment_data, upsert_grade_enrollment,
)
from loaders.urban_institute_graduation import fetch_graduation_data, upsert_graduation_data, fetch_graduation_data_by_state
from loaders.urban_institute_staff import fetch_staff_data, upsert_staff_data
from loaders.urban_institute_assessments import fetch_assessment_data, upsert_assessment_data
from loaders.urban_institute_absenteeism import fetch_absenteeism_data, upsert_absenteeism_data
from loaders.census_county_income import fetch_county_income, update_district_income
from loaders.state_aggregates import seed_states, refresh_state_aggregates, get_state_summary, compute_staffing_ratios
from loaders.historical_backfill import (
    backfill_enrollment_history,
    backfill_finance_history,
    backfill_poverty_history,
    backfill_ell_history,
    backfill_absenteeism_history,
    compute_trend_signals,
)
from loaders.compute_benchmarks import compute_all_benchmarks, compute_state_averages, compute_district_trends, compute_deltas_and_quartiles
from loaders.urban_institute_schools import (
    fetch_school_directory,
    fetch_school_enrollment,
    upsert_schools,
    upsert_enrollment_history,
    update_district_charter_aggregates,
    ensure_districts_for_schools,
)
from loaders.fullmind import (
    load_fullmind_csv,
    get_valid_leaids,
    categorize_records,
    update_districts_with_fullmind_data,
    insert_unmatched_accounts,
    generate_match_report,
)
from loaders.district_links import (
    load_district_links_csv,
    get_valid_leaids as get_valid_leaids_links,
    categorize_records as categorize_links,
    update_district_links,
    generate_report as generate_links_report,
)


def verify_database_connection(connection_string: str) -> bool:
    """Verify database connection and PostGIS extension."""
    import psycopg2

    try:
        conn = psycopg2.connect(connection_string)
        cur = conn.cursor()

        # Check PostGIS
        cur.execute("SELECT PostGIS_Version()")
        postgis_version = cur.fetchone()[0]
        print(f"PostGIS version: {postgis_version}")

        # Check tables exist
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('districts', 'fullmind_data', 'unmatched_accounts')
        """)
        tables = [row[0] for row in cur.fetchall()]
        print(f"Found tables: {tables}")

        cur.close()
        conn.close()
        return True

    except Exception as e:
        print(f"Database connection error: {e}")
        return False


def run_boundaries_etl(
    connection_string: str,
    shapefile_path: Path = None,
    download_dir: str = "./data",
) -> int:
    """
    Run NCES EDGE boundaries ETL.

    Returns number of districts loaded.
    """
    print("\n" + "="*60)
    print("STEP 1: Loading NCES EDGE Boundaries")
    print("="*60)

    if shapefile_path and shapefile_path.exists():
        print(f"Using provided shapefile: {shapefile_path}")
    else:
        print("Downloading NCES EDGE shapefile...")
        extract_path = download_nces_edge(download_dir)
        shapefile_path = find_shapefile(extract_path)
        if not shapefile_path:
            raise FileNotFoundError(f"No .shp file found in {extract_path}")
        print(f"Found shapefile: {shapefile_path}")

    count = load_nces_edge_to_postgis(shapefile_path, connection_string)
    print(f"\nLoaded {count} district boundaries")
    return count


def run_enrollment_etl(
    connection_string: str,
    year: int = 2023,
) -> int:
    """
    Run Urban Institute enrollment ETL.

    Returns number of districts updated.
    """
    print("\n" + "="*60)
    print("STEP 2: Fetching Urban Institute Enrollment Data")
    print("="*60)

    records = fetch_district_directory(year=year)

    if not records:
        print("Warning: No enrollment records fetched")
        return 0

    count = update_district_enrollment(connection_string, records, year=year)
    print(f"\nUpdated {count} districts with enrollment data")
    return count


def run_finance_etl(
    connection_string: str,
    year: int = 2022,
) -> dict:
    """
    Run Urban Institute finance data ETL.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Urban Institute Finance Data")
    print("="*60)

    records = fetch_finance_data(year=year)

    if not records:
        print("Warning: No finance records fetched")
        return {"updated": 0, "failed": 0}

    result = upsert_finance_data(connection_string, records, year=year)
    print(f"\nFinance data: {result}")
    return result


def run_poverty_etl(
    connection_string: str,
    year: int = 2022,
) -> dict:
    """
    Run Urban Institute SAIPE poverty data ETL.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Urban Institute SAIPE Poverty Data")
    print("="*60)

    records = fetch_poverty_data(year=year)

    if not records:
        print("Warning: No poverty records fetched")
        return {"updated": 0, "failed": 0}

    result = upsert_poverty_data(connection_string, records, year=year)
    print(f"\nPoverty data: {result}")
    return result


def run_demographics_etl(
    connection_string: str,
    year: int = 2022,
) -> dict:
    """
    Run Urban Institute demographics (enrollment by race) ETL.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Urban Institute Demographics Data")
    print("="*60)

    records = fetch_demographics_data(year=year)

    if not records:
        print("Warning: No demographics records fetched")
        return {"updated": 0, "failed": 0}

    result = upsert_demographics_data(connection_string, records, year=year)
    print(f"\nDemographics data: {result}")
    return result


def run_graduation_etl(
    connection_string: str,
    year: int = 2022,
) -> dict:
    """
    Run Urban Institute graduation rates ETL.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Urban Institute Graduation Rates Data")
    print("="*60)

    records = fetch_graduation_data(year=year)

    if not records:
        print("Warning: No graduation records fetched")
        return {"updated": 0, "failed": 0}

    result = upsert_graduation_data(connection_string, records, year=year)
    print(f"\nGraduation data: {result}")
    return result


def run_graduation_by_state_etl(
    connection_string: str,
    year: int = 2019,
    start_fips: str = None,
) -> dict:
    """
    Run Urban Institute graduation rates ETL state-by-state for reliability.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Urban Institute Graduation Rates (State by State)")
    print("="*60)

    result = fetch_graduation_data_by_state(
        connection_string,
        year=year,
        start_fips=start_fips,
    )
    print(f"\nGraduation data (state-by-state): {result['updated']} updated, {result['failed']} failed")
    return result


def run_staff_etl(
    connection_string: str,
    year: int = 2021,
) -> dict:
    """
    Run Urban Institute staff FTE data ETL.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Urban Institute Staff FTE Data")
    print("="*60)

    records = fetch_staff_data(year=year)

    if not records:
        print("Warning: No staff records fetched")
        return {"updated": 0, "failed": 0}

    result = upsert_staff_data(connection_string, records, year=year)
    print(f"\nStaff data: {result}")
    return result


def run_county_income_etl(
    connection_string: str,
    year: int = 2022,
) -> dict:
    """
    Run Census county median household income ETL.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Census County Median Household Income")
    print("="*60)

    records = fetch_county_income(year=year)

    if not records:
        print("Warning: No county income records fetched")
        return {"matched_counties": 0, "districts_updated": 0}

    result = update_district_income(connection_string, records, year=year)
    print(f"\nCounty income data: {result}")
    return result


def run_fullmind_etl(
    connection_string: str,
    csv_path: Path,
    output_dir: str = "./reports",
) -> dict:
    """
    Run Fullmind CSV ETL.

    Returns match summary dict.
    """
    print("\n" + "="*60)
    print("STEP 3: Loading Fullmind Data")
    print("="*60)

    if not csv_path.exists():
        raise FileNotFoundError(f"Fullmind CSV not found: {csv_path}")

    print(f"Loading from: {csv_path}")

    # Parse CSV
    records = load_fullmind_csv(csv_path)

    # Get valid LEAIDs
    valid_leaids = get_valid_leaids(connection_string)
    print(f"Found {len(valid_leaids)} valid district LEAIDs in database")

    # Categorize
    matched, unmatched = categorize_records(records, valid_leaids)

    # Update districts with Fullmind data
    update_districts_with_fullmind_data(connection_string, matched)
    insert_unmatched_accounts(connection_string, unmatched)

    # Generate report
    output_path = Path(output_dir)
    summary = generate_match_report(matched, unmatched, output_path)

    return summary


def run_charter_schools_etl(
    connection_string: str,
    year: int = 2023,
    start_year: int = 2019,
) -> dict:
    """
    Run charter schools ETL: directory + 5-year enrollment history + district aggregates.

    Returns summary dict.
    """
    print("\n" + "="*60)
    print("Fetching Charter School Data (Urban Institute)")
    print("="*60)

    # Fetch school directory for latest year
    records = fetch_school_directory(year=year, charter_only=True)
    school_count = 0
    if records:
        # Create stub districts for any missing LEAIDs first
        new_districts = ensure_districts_for_schools(connection_string, records, year=year)
        if new_districts:
            print(f"Created {new_districts} new district records for charter LEAIDs")

        school_count = upsert_schools(connection_string, records)
        print(f"Upserted {school_count} charter school directory records")
    else:
        print("Warning: No charter school directory records fetched")

    # Fetch and upsert enrollment history for each year
    enrollment_total = 0
    for y in range(start_year, year + 1):
        enrollment_records = fetch_school_enrollment(year=y, charter_only=True)
        if enrollment_records:
            count = upsert_enrollment_history(connection_string, enrollment_records)
            enrollment_total += count
            print(f"Upserted {count} enrollment records for year {y}")
        else:
            print(f"No enrollment records fetched for year {y}")

    # Update district-level charter aggregates
    districts_updated = update_district_charter_aggregates(connection_string)

    return {
        "schools": school_count,
        "enrollment_records": enrollment_total,
        "districts_updated": districts_updated,
    }


def run_assessments_etl(
    connection_string: str,
    year: int = 2021,
) -> dict:
    """
    Run Urban Institute EdFacts assessment proficiency ETL.

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching Urban Institute EdFacts Assessment Data")
    print("="*60)

    records = fetch_assessment_data(year=year)

    if not records:
        print("Warning: No assessment records fetched")
        return {"updated": 0, "failed": 0}

    result = upsert_assessment_data(connection_string, records, year=year)
    print(f"\nAssessment data: {result}")
    return result


def run_absenteeism_etl(
    connection_string: str,
    year: int = 2020,
) -> dict:
    """
    Run CRDC chronic absenteeism ETL (school-level, aggregated to district).

    Returns dict with update counts.
    """
    print("\n" + "="*60)
    print("Fetching CRDC Chronic Absenteeism Data")
    print("="*60)

    records = fetch_absenteeism_data(year=year)

    if not records:
        print("Warning: No absenteeism records fetched")
        return {"updated": 0, "failed": 0}

    result = upsert_absenteeism_data(connection_string, records, year=year)
    print(f"\nAbsenteeism data: {result}")
    return result


def run_all_schools_etl(
    connection_string: str,
    year: int = 2023,
    start_year: int = 2019,
) -> dict:
    """
    Run ALL schools ETL (not just charter). ~100K records.

    Returns summary dict.
    """
    print("\n" + "="*60)
    print("Fetching ALL School Data (Urban Institute)")
    print("="*60)

    # Fetch all schools (charter_only=False)
    records = fetch_school_directory(year=year, charter_only=False)
    school_count = 0
    if records:
        new_districts = ensure_districts_for_schools(connection_string, records, year=year)
        if new_districts:
            print(f"Created {new_districts} new district records for school LEAIDs")

        school_count = upsert_schools(connection_string, records)
        print(f"Upserted {school_count} school directory records")
    else:
        print("Warning: No school directory records fetched")

    # Fetch enrollment history for all schools
    enrollment_total = 0
    for y in range(start_year, year + 1):
        enrollment_records = fetch_school_enrollment(year=y, charter_only=False)
        if enrollment_records:
            count = upsert_enrollment_history(connection_string, enrollment_records)
            enrollment_total += count
            print(f"Upserted {count} enrollment records for year {y}")
        else:
            print(f"No enrollment records fetched for year {y}")

    # Update charter aggregates
    districts_updated = update_district_charter_aggregates(connection_string)

    return {
        "schools": school_count,
        "enrollment_records": enrollment_total,
        "districts_updated": districts_updated,
    }


def run_schools_by_state_etl(
    connection_string: str,
    year: int = 2023,
    start_fips: str = None,
    directory_only: bool = False,
) -> dict:
    """
    Run ALL schools ETL state-by-state for reliability and progress tracking.

    Iterates through each state, fetching all schools (not just charter)
    and upserting them. Supports resuming from a specific state FIPS code.

    Returns summary dict with per-state counts.
    """
    # All state FIPS codes in order
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

    print("\n" + "="*60)
    print("Fetching ALL Schools - State by State (Urban Institute)")
    print("="*60)

    # If resuming, skip states before start_fips
    if start_fips:
        start_fips = start_fips.zfill(2)
        states_to_process = [(f, n) for f, n in STATES if f >= start_fips]
        print(f"Resuming from FIPS {start_fips}, {len(states_to_process)} states remaining")
    else:
        states_to_process = STATES

    total_schools = 0
    total_enrollment = 0
    state_results = {}

    for i, (fips, state_name) in enumerate(states_to_process, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(states_to_process)}] {state_name} (FIPS {fips})")
        print(f"{'='*60}")

        # Fetch directory for this state
        records = fetch_school_directory(year=year, charter_only=False, fips=fips)
        school_count = 0

        if records:
            # Ensure districts exist for any new LEAIDs
            new_districts = ensure_districts_for_schools(connection_string, records, year=year)
            if new_districts:
                print(f"  Created {new_districts} new district records")

            school_count = upsert_schools(connection_string, records)
            print(f"  Upserted {school_count} schools")
        else:
            print(f"  No school records found")

        # Fetch enrollment for latest year only (for speed)
        enrollment_count = 0
        if not directory_only:
            enrollment_records = fetch_school_enrollment(year=year, charter_only=False, fips=fips)
            if enrollment_records:
                enrollment_count = upsert_enrollment_history(connection_string, enrollment_records)
                print(f"  Upserted {enrollment_count} enrollment records")

        total_schools += school_count
        total_enrollment += enrollment_count
        state_results[state_name] = {"schools": school_count, "enrollment": enrollment_count}

        print(f"  Running total: {total_schools:,} schools, {total_enrollment:,} enrollment records")

    # Update charter aggregates at the end
    print(f"\nUpdating district charter aggregates...")
    districts_updated = update_district_charter_aggregates(connection_string)

    # Print summary
    print(f"\n{'='*60}")
    print(f"STATE-BY-STATE SUMMARY")
    print(f"{'='*60}")
    for state_name, counts in state_results.items():
        print(f"  {state_name:20s}: {counts['schools']:>6,} schools, {counts['enrollment']:>6,} enrollment")
    print(f"\n  TOTAL: {total_schools:,} schools, {total_enrollment:,} enrollment records")
    print(f"  Districts updated with charter aggregates: {districts_updated}")

    return {
        "total_schools": total_schools,
        "total_enrollment": total_enrollment,
        "districts_updated": districts_updated,
        "state_results": state_results,
    }


def run_education_data_by_state_etl(
    connection_string: str,
    year: int = 2022,
    enrollment_year: int = 2023,
    start_fips: str = None,
) -> dict:
    """
    Run ALL education data ETLs state-by-state for reliability and completeness.

    For each state, fetches and upserts:
    - District directory/enrollment
    - Finance data
    - Poverty (SAIPE) data
    - Demographics (enrollment by race) data
    - Staff FTE data
    - Graduation rates

    Returns summary dict with per-state counts.
    """
    # All state FIPS codes in order
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

    print("\n" + "="*60)
    print("Education Data ETL - State by State")
    print(f"  Directory/Enrollment year: {enrollment_year}")
    print(f"  Finance/Poverty/Demographics/Staff year: {year}")
    print("="*60)

    if start_fips:
        start_fips = start_fips.zfill(2)
        states_to_process = [(f, n) for f, n in STATES if f >= start_fips]
        print(f"Resuming from FIPS {start_fips}, {len(states_to_process)} states remaining")
    else:
        states_to_process = STATES

    state_results = {}

    for i, (fips, state_name) in enumerate(states_to_process, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(states_to_process)}] {state_name} (FIPS {fips})")
        print(f"{'='*60}")

        state_counts = {}

        # 1. District directory/enrollment
        try:
            records = fetch_district_directory(year=enrollment_year, fips=fips)
            if records:
                count = update_district_enrollment(connection_string, records, year=enrollment_year)
                state_counts["enrollment"] = count
                print(f"  Enrollment: {count} districts updated")
            else:
                state_counts["enrollment"] = 0
                print(f"  Enrollment: no records")
        except Exception as e:
            state_counts["enrollment"] = 0
            print(f"  Enrollment ERROR: {e}")

        # 2. Finance
        try:
            records = fetch_finance_data(year=year, fips=fips)
            if records:
                result = upsert_finance_data(connection_string, records, year=year)
                state_counts["finance"] = result.get("updated", 0)
                print(f"  Finance: {result.get('updated', 0)} updated")
            else:
                state_counts["finance"] = 0
                print(f"  Finance: no records")
        except Exception as e:
            state_counts["finance"] = 0
            print(f"  Finance ERROR: {e}")

        # 3. Poverty (SAIPE)
        try:
            records = fetch_poverty_data(year=year, fips=fips)
            if records:
                result = upsert_poverty_data(connection_string, records, year=year)
                state_counts["poverty"] = result.get("updated", 0)
                print(f"  Poverty: {result.get('updated', 0)} updated")
            else:
                state_counts["poverty"] = 0
                print(f"  Poverty: no records")
        except Exception as e:
            state_counts["poverty"] = 0
            print(f"  Poverty ERROR: {e}")

        # 4. Demographics (enrollment by race)
        try:
            records = fetch_demographics_data(year=year, fips=fips)
            if records:
                result = upsert_demographics_data(connection_string, records, year=year)
                state_counts["demographics"] = result.get("updated", 0)
                print(f"  Demographics: {result.get('updated', 0)} updated")
            else:
                state_counts["demographics"] = 0
                print(f"  Demographics: no records")
        except Exception as e:
            state_counts["demographics"] = 0
            print(f"  Demographics ERROR: {e}")

        # 5. Staff FTE
        try:
            records = fetch_staff_data(year=year, fips=fips)
            if records:
                result = upsert_staff_data(connection_string, records, year=year)
                state_counts["staff"] = result.get("updated", 0)
                print(f"  Staff: {result.get('updated', 0)} updated")
            else:
                state_counts["staff"] = 0
                print(f"  Staff: no records")
        except Exception as e:
            state_counts["staff"] = 0
            print(f"  Staff ERROR: {e}")

        # 6. Graduation rates
        try:
            records = fetch_graduation_data(year=year, fips=fips)
            if records:
                result = upsert_graduation_data(connection_string, records, year=year)
                state_counts["graduation"] = result.get("updated", 0)
                print(f"  Graduation: {result.get('updated', 0)} updated")
            else:
                state_counts["graduation"] = 0
                print(f"  Graduation: no records")
        except Exception as e:
            state_counts["graduation"] = 0
            print(f"  Graduation ERROR: {e}")

        state_results[state_name] = state_counts

    # Print summary
    print(f"\n{'='*60}")
    print(f"EDUCATION DATA STATE-BY-STATE SUMMARY")
    print(f"{'='*60}")
    print(f"{'State':20s} {'Enroll':>7s} {'Finance':>8s} {'Poverty':>8s} {'Demog':>7s} {'Staff':>7s} {'Grad':>6s}")
    print(f"{'-'*20} {'-'*7} {'-'*8} {'-'*8} {'-'*7} {'-'*7} {'-'*6}")
    totals = {"enrollment": 0, "finance": 0, "poverty": 0, "demographics": 0, "staff": 0, "graduation": 0}
    for state_name, counts in state_results.items():
        print(f"  {state_name:20s} {counts.get('enrollment',0):>5,} {counts.get('finance',0):>6,} {counts.get('poverty',0):>6,} {counts.get('demographics',0):>5,} {counts.get('staff',0):>5,} {counts.get('graduation',0):>4,}")
        for k in totals:
            totals[k] += counts.get(k, 0)
    print(f"{'-'*20} {'-'*7} {'-'*8} {'-'*8} {'-'*7} {'-'*7} {'-'*6}")
    print(f"  {'TOTAL':20s} {totals['enrollment']:>5,} {totals['finance']:>6,} {totals['poverty']:>6,} {totals['demographics']:>5,} {totals['staff']:>5,} {totals['graduation']:>4,}")

    return {
        "totals": totals,
        "state_results": state_results,
    }


def run_grade_enrollment_etl(
    connection_string: str,
    year: int = 2022,
) -> dict:
    """
    Run grade-level enrollment ETL.

    Returns dict with counts.
    """
    print("\n" + "="*60)
    print("Fetching Grade-Level Enrollment Data")
    print("="*60)

    records = fetch_grade_enrollment_data(year=year)

    if not records:
        print("Warning: No grade enrollment records fetched")
        return {"upserted": 0, "failed": 0}

    result = upsert_grade_enrollment(connection_string, records)
    print(f"\nGrade enrollment: {result}")
    return result


def run_historical_backfill(
    connection_string: str,
    years: str = "2019,2020,2021,2022,2023",
) -> dict:
    """
    Run historical data backfill for trend analysis.

    Fetches multi-year data and writes to district_data_history table,
    then computes trend signals.

    Returns summary dict.
    """
    print("\n" + "="*60)
    print("Running Historical Data Backfill")
    print("="*60)

    year_list = [int(y.strip()) for y in years.split(",")]

    enrollment_count = backfill_enrollment_history(connection_string, year_list)
    print(f"\nEnrollment/staffing history: {enrollment_count} records")

    finance_count = backfill_finance_history(connection_string, year_list)
    print(f"Finance history: {finance_count} records")

    poverty_count = backfill_poverty_history(connection_string, year_list)
    print(f"Poverty history: {poverty_count} records")

    ell_count = backfill_ell_history(connection_string, year_list)
    print(f"ELL history: {ell_count} records")

    absenteeism_count = backfill_absenteeism_history(connection_string)
    print(f"Absenteeism history: {absenteeism_count} records")

    print("\nComputing trend signals...")
    trend_count = compute_trend_signals(connection_string)

    return {
        "enrollment_history": enrollment_count,
        "finance_history": finance_count,
        "poverty_history": poverty_count,
        "ell_history": ell_count,
        "absenteeism_history": absenteeism_count,
        "trends_computed": trend_count,
    }


def run_compute_ratios(connection_string: str) -> int:
    """
    Run post-ETL staffing ratio computation.

    Returns number of districts updated.
    """
    print("\n" + "="*60)
    print("Computing Staffing Ratios")
    print("="*60)

    return compute_staffing_ratios(connection_string)


def run_benchmarks(connection_string: str) -> dict:
    """
    Run benchmark computation (state averages, district trends, deltas & quartiles).
    No API calls — pure SQL against local data.

    Returns summary dict.
    """

    return compute_all_benchmarks(connection_string)


def run_district_links_etl(
    connection_string: str,
    csv_path: Path,
    output_dir: str = "./reports",
) -> dict:
    """
    Run District Links CSV ETL.

    Returns match summary dict.
    """
    print("\n" + "="*60)
    print("Loading District Links Data")
    print("="*60)

    if not csv_path.exists():
        raise FileNotFoundError(f"District links CSV not found: {csv_path}")

    print(f"Loading from: {csv_path}")

    # Parse CSV
    records = load_district_links_csv(csv_path)

    # Get valid LEAIDs
    valid_leaids = get_valid_leaids_links(connection_string)
    print(f"Found {len(valid_leaids)} valid district LEAIDs in database")

    # Categorize
    matched, unmatched = categorize_links(records, valid_leaids)

    # Update districts with links
    update_district_links(connection_string, matched)

    # Generate report
    output_path = Path(output_dir)
    summary = generate_links_report(matched, unmatched, output_path)

    return summary


def print_database_stats(connection_string: str):
    """Print summary statistics from database."""
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    print("\n" + "="*60)
    print("DATABASE STATISTICS")
    print("="*60)

    # Districts count
    cur.execute("SELECT COUNT(*) FROM districts")
    districts = cur.fetchone()[0]
    print(f"Total districts: {districts:,}")

    # Districts with geometry
    cur.execute("SELECT COUNT(*) FROM districts WHERE geometry IS NOT NULL")
    with_geom = cur.fetchone()[0]
    print(f"Districts with geometry: {with_geom:,}")

    # Districts with enrollment
    cur.execute("SELECT COUNT(*) FROM districts WHERE enrollment IS NOT NULL")
    with_enrollment = cur.fetchone()[0]
    print(f"Districts with enrollment: {with_enrollment:,}")

    # Fullmind/CRM data (now in districts table)
    cur.execute("SELECT COUNT(*) FROM districts WHERE account_name IS NOT NULL")
    fullmind = cur.fetchone()[0]
    print(f"Districts with Fullmind data: {fullmind:,}")

    # Customers
    cur.execute("SELECT COUNT(*) FROM districts WHERE is_customer = true")
    customers = cur.fetchone()[0]
    print(f"  - Customers: {customers:,}")

    # Pipeline
    cur.execute("SELECT COUNT(*) FROM districts WHERE has_open_pipeline = true")
    pipeline = cur.fetchone()[0]
    print(f"  - With open pipeline: {pipeline:,}")

    # Unmatched
    cur.execute("SELECT COUNT(*) FROM unmatched_accounts")
    unmatched = cur.fetchone()[0]
    print(f"Unmatched accounts: {unmatched:,}")

    # Education data stats (now in districts table)
    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE expenditure_per_pupil IS NOT NULL) as finance,
            COUNT(*) FILTER (WHERE children_poverty_percent IS NOT NULL) as poverty,
            COUNT(*) FILTER (WHERE graduation_rate_total IS NOT NULL) as graduation,
            COUNT(*) FILTER (WHERE total_enrollment IS NOT NULL) as demographics,
            COUNT(*) FILTER (WHERE math_proficiency_pct IS NOT NULL) as assessments,
            COUNT(*) FILTER (WHERE chronic_absenteeism_rate IS NOT NULL) as absenteeism,
            COUNT(*) FILTER (WHERE student_teacher_ratio IS NOT NULL) as ratios,
            COUNT(*) FILTER (WHERE sped_expenditure_total IS NOT NULL) as sped_finance,
            COUNT(*) FILTER (WHERE esser_funding_total IS NOT NULL) as esser,
            COUNT(*) FILTER (WHERE vacancy_pressure_signal IS NOT NULL) as trends
        FROM districts
    """)
    row = cur.fetchone()
    if row:
        print("\nEducation data coverage:")
        print(f"  Finance data: {row[0]:,}")
        print(f"  Poverty data: {row[1]:,}")
        print(f"  Graduation data: {row[2]:,}")
        print(f"  Demographics data: {row[3]:,}")
        print(f"  Assessment proficiency: {row[4]:,}")
        print(f"  Chronic absenteeism: {row[5]:,}")
        print(f"  Staffing ratios: {row[6]:,}")
        print(f"  SpEd finance: {row[7]:,}")
        print(f"  ESSER funding: {row[8]:,}")
        print(f"  Trend signals: {row[9]:,}")

    # Historical data stats
    try:
        cur.execute("SELECT COUNT(*), COUNT(DISTINCT leaid), COUNT(DISTINCT year) FROM district_data_history")
        hist_row = cur.fetchone()
        if hist_row and hist_row[0] > 0:
            print(f"\nHistorical data: {hist_row[0]:,} records, {hist_row[1]:,} districts, {hist_row[2]} years")
        cur.execute("SELECT COUNT(*) FROM district_grade_enrollment")
        grade_count = cur.fetchone()[0]
        if grade_count > 0:
            print(f"Grade enrollment records: {grade_count:,}")
    except Exception:
        pass

    # School stats
    try:
        cur.execute("SELECT COUNT(*) FROM schools")
        total_schools = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM schools WHERE charter = 1")
        charter_schools = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM school_enrollment_history")
        enrollment_history = cur.fetchone()[0]
        print(f"\nSchools: {total_schools:,} (charter: {charter_schools:,})")
        print(f"School enrollment history records: {enrollment_history:,}")
    except Exception:
        pass  # Table may not exist yet

    # State stats
    cur.execute("SELECT COUNT(*) FROM states WHERE aggregates_updated_at IS NOT NULL")
    states_with_data = cur.fetchone()[0]
    print(f"\nStates with aggregates: {states_with_data}")

    # Top states by enrollment
    print("\nTop 10 states by enrollment:")
    cur.execute("""
        SELECT abbrev, total_enrollment, total_customers
        FROM states
        WHERE total_enrollment IS NOT NULL
        ORDER BY total_enrollment DESC
        LIMIT 10
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]:,} students, {row[2]} customers")

    cur.close()
    conn.close()


def main():
    """Main entry point."""
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="ETL Pipeline for Territory Plan Builder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Run complete pipeline
    python run_etl.py --all --fullmind-csv /path/to/fullmind.csv

    # Run only boundaries (with existing shapefile)
    python run_etl.py --boundaries --shapefile /path/to/shapefile.shp

    # Run only Fullmind import
    python run_etl.py --fullmind /path/to/fullmind.csv

    # Skip Urban Institute (faster, uses existing enrollment data)
    python run_etl.py --boundaries --fullmind /path/to/fullmind.csv

    # Run education data ETL (finance + poverty)
    python run_etl.py --finance --poverty --year 2022

    # Run all education data ETL
    python run_etl.py --education-data --year 2022
        """
    )

    parser.add_argument("--all", action="store_true",
                        help="Run all ETL steps")
    parser.add_argument("--boundaries", action="store_true",
                        help="Run NCES EDGE boundaries ETL")
    parser.add_argument("--enrollment", action="store_true",
                        help="Run Urban Institute enrollment ETL")
    parser.add_argument("--finance", action="store_true",
                        help="Run Urban Institute finance data ETL")
    parser.add_argument("--poverty", action="store_true",
                        help="Run Urban Institute SAIPE poverty data ETL")
    parser.add_argument("--demographics", action="store_true",
                        help="Run Urban Institute demographics (enrollment by race) ETL")
    parser.add_argument("--graduation", action="store_true",
                        help="Run Urban Institute graduation rates ETL")
    parser.add_argument("--graduation-by-state", action="store_true",
                        help="Run graduation rates ETL state-by-state (reliable, resumable)")
    parser.add_argument("--staff", action="store_true",
                        help="Run Urban Institute staff FTE data ETL")
    parser.add_argument("--county-income", action="store_true",
                        help="Run Census county median household income ETL")
    parser.add_argument("--education-data", action="store_true",
                        help="Run all education data ETL (finance, poverty, demographics, graduation, staff)")
    parser.add_argument("--education-data-by-state", action="store_true",
                        help="Run all education data ETL state-by-state (reliable, resumable)")
    parser.add_argument("--assessments", action="store_true",
                        help="Run EdFacts assessment proficiency ETL")
    parser.add_argument("--absenteeism", action="store_true",
                        help="Run CRDC chronic absenteeism ETL")
    parser.add_argument("--charter-schools", action="store_true",
                        help="Run charter schools ETL (directory + 5-year enrollment history + district aggregates)")
    parser.add_argument("--all-schools", action="store_true",
                        help="Run ALL schools ETL (~100K records, not just charter)")
    parser.add_argument("--schools-by-state", action="store_true",
                        help="Run ALL schools ETL state-by-state (reliable, resumable)")
    parser.add_argument("--start-fips", type=str, default=None,
                        help="Resume state-by-state from this FIPS code (e.g., 06 for California)")
    parser.add_argument("--directory-only", action="store_true", default=False,
                        help="Skip enrollment history (faster, directory only)")
    parser.add_argument("--grade-enrollment", action="store_true",
                        help="Run grade-level enrollment ETL (K-12 by district)")
    parser.add_argument("--historical", action="store_true",
                        help="Run historical data backfill (multi-year) and compute trend signals")
    parser.add_argument("--historical-years", type=str, default="2019,2020,2021,2022,2023",
                        help="Comma-separated years for historical backfill (default: 2019-2023)")
    parser.add_argument("--compute-ratios", action="store_true",
                        help="Compute staffing ratios (student-teacher, student-staff, sped)")
    parser.add_argument("--compute-trends", action="store_true",
                        help="Compute trend signals from historical data (no new API calls)")
    parser.add_argument("--benchmarks", action="store_true",
                        help="Compute benchmarks (state averages, trends, deltas, quartiles)")
    parser.add_argument("--fullmind", type=str,
                        help="Run Fullmind CSV ETL with specified file")
    parser.add_argument("--district-links", type=str,
                        help="Run District Links CSV ETL with specified file (website & job board URLs)")
    parser.add_argument("--seed-states", action="store_true",
                        help="Seed states table with reference data (FIPS, abbreviations, names)")
    parser.add_argument("--refresh-states", action="store_true",
                        help="Refresh state aggregate metrics from district data")
    parser.add_argument("--shapefile", type=str,
                        help="Path to existing NCES shapefile (skips download)")
    parser.add_argument("--download-dir", default="./data",
                        help="Directory for downloads")
    parser.add_argument("--output-dir", default="./reports",
                        help="Directory for reports")
    parser.add_argument("--enrollment-year", type=int, default=2023,
                        help="Year for enrollment data")
    parser.add_argument("--year", type=int, default=2022,
                        help="Year for education data (finance, poverty, demographics, graduation)")
    parser.add_argument("--assessment-year", type=int, default=2021,
                        help="Year for EdFacts assessment data (available: 2009-2018, 2021)")
    parser.add_argument("--absenteeism-year", type=int, default=2020,
                        help="Year for CRDC absenteeism data (available: 2011, 2013, 2015, 2017, 2020)")
    parser.add_argument("--stats-only", action="store_true",
                        help="Only print database statistics")

    args = parser.parse_args()

    # Get connection string - prefer DIRECT_URL for Python scripts (no pgbouncer)
    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        print("Error: DIRECT_URL or DATABASE_URL environment variable not set")
        print("Set it in .env file or environment")
        sys.exit(1)

    # Strip Supabase-specific query params that psycopg2 doesn't understand
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1] if "?" in connection_string else ""
        # Keep only standard postgres params, remove pgbouncer, sslmode if causing issues
        valid_params = []
        for param in params.split("&"):
            if param and not param.startswith("pgbouncer"):
                valid_params.append(param)
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    # Verify database
    if not verify_database_connection(connection_string):
        print("\nFailed to connect to database. Make sure:")
        print("1. PostgreSQL is running (docker-compose up -d)")
        print("2. Migrations have been applied (npx prisma migrate deploy)")
        sys.exit(1)

    # Stats only mode
    if args.stats_only:
        print_database_stats(connection_string)
        sys.exit(0)

    # Check if any ETL step specified
    any_step = (
        args.all or args.boundaries or args.enrollment or args.fullmind or
        args.district_links or args.finance or args.poverty or args.demographics or
        args.graduation or args.graduation_by_state or args.staff or args.county_income or
        args.education_data or args.education_data_by_state or
        args.charter_schools or args.all_schools or args.schools_by_state or
        args.assessments or args.absenteeism or
        args.grade_enrollment or args.historical or args.compute_ratios or args.compute_trends or
        args.benchmarks or args.seed_states or args.refresh_states
    )
    if not any_step:
        print("No ETL steps specified. Use --all or specify individual steps.")
        print("Use --help for usage information.")
        sys.exit(1)

    # Run steps
    if args.all or args.boundaries:
        shapefile = Path(args.shapefile) if args.shapefile else None
        run_boundaries_etl(
            connection_string,
            shapefile_path=shapefile,
            download_dir=args.download_dir
        )

    if args.all or args.enrollment:
        run_enrollment_etl(
            connection_string,
            year=args.enrollment_year
        )

    # Education data ETL steps
    if args.all or args.education_data or args.finance:
        run_finance_etl(connection_string, year=args.year)

    if args.all or args.education_data or args.poverty:
        run_poverty_etl(connection_string, year=args.year)

    if args.all or args.education_data or args.demographics:
        run_demographics_etl(connection_string, year=args.year)

    if args.all or args.education_data or args.graduation:
        run_graduation_etl(connection_string, year=args.year)

    # State-by-state graduation ETL (recommended for reliability)
    if args.graduation_by_state:
        run_graduation_by_state_etl(
            connection_string,
            year=args.year,
            start_fips=args.start_fips,
        )

    if args.all or args.education_data or args.staff:
        run_staff_etl(connection_string, year=args.year)

    if args.all or args.education_data or args.county_income:
        run_county_income_etl(connection_string, year=args.year)

    # Assessment proficiency ETL
    if args.all or args.education_data or args.assessments:
        run_assessments_etl(connection_string, year=args.assessment_year)

    # Chronic absenteeism ETL
    if args.all or args.education_data or args.absenteeism:
        run_absenteeism_etl(connection_string, year=args.absenteeism_year)

    # Charter schools ETL
    if args.all or args.charter_schools:
        run_charter_schools_etl(
            connection_string,
            year=args.enrollment_year,
            start_year=2019,
        )

    # All schools ETL (expand beyond charter-only)
    if args.all_schools:
        run_all_schools_etl(
            connection_string,
            year=args.enrollment_year,
            start_year=2019,
        )

    # State-by-state education data ETL
    if args.education_data_by_state:
        run_education_data_by_state_etl(
            connection_string,
            year=args.year,
            enrollment_year=args.enrollment_year,
            start_fips=args.start_fips,
        )

    # State-by-state schools ETL (recommended for reliability)
    if args.schools_by_state:
        run_schools_by_state_etl(
            connection_string,
            year=args.enrollment_year,
            start_fips=args.start_fips,
            directory_only=args.directory_only,
        )

    # Grade-level enrollment ETL
    if args.all or args.grade_enrollment:
        run_grade_enrollment_etl(connection_string, year=args.year)

    # Historical backfill (multi-year data + trend computation)
    if args.historical:
        run_historical_backfill(connection_string, years=args.historical_years)

    # Compute-only steps (no API calls needed)
    if args.all or args.compute_ratios:
        run_compute_ratios(connection_string)

    if args.compute_trends:
        print("\n" + "="*60)
        print("Computing Trend Signals from Historical Data")
        print("="*60)
        compute_trend_signals(connection_string)

    # Benchmark computation (state averages, trends, deltas, quartiles)
    if args.all or args.benchmarks:
        run_benchmarks(connection_string)

    if args.all and not args.fullmind:
        print("\nWarning: --all specified but no --fullmind CSV path provided")
        print("Skipping Fullmind data import")
    elif args.fullmind:
        run_fullmind_etl(
            connection_string,
            csv_path=Path(args.fullmind),
            output_dir=args.output_dir
        )

    # District Links ETL
    if args.district_links:
        run_district_links_etl(
            connection_string,
            csv_path=Path(args.district_links),
            output_dir=args.output_dir
        )

    # State table management
    if args.seed_states or args.all:
        print("\n" + "="*60)
        print("Seeding States Table")
        print("="*60)
        seed_states(connection_string)

    if args.refresh_states or args.all:
        print("\n" + "="*60)
        print("Refreshing State Aggregates")
        print("="*60)
        refresh_state_aggregates(connection_string)

    # Print final stats
    print_database_stats(connection_string)

    print("\n" + "="*60)
    print("ETL COMPLETE")
    print("="*60)


if __name__ == "__main__":
    main()
