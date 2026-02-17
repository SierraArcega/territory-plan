"""
State-by-State API Loader

Queries Urban Institute API one state at a time instead of all-at-once.
This avoids the timeouts/failures seen with full-nation queries (~17K districts).
Each state returns ~100-600 records, which the API handles reliably.

Supports: finance, absenteeism, assessments
Delegates to existing upsert functions for database writes.

Usage:
    python3 state_by_state_loader.py --finance --year 2020
    python3 state_by_state_loader.py --absenteeism --year 2017
    python3 state_by_state_loader.py --assessments --year 2018
    python3 state_by_state_loader.py --all --finance-year 2020 --absenteeism-year 2017 --assessments-year 2018
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from collections import defaultdict

import requests
from tqdm import tqdm

API_BASE_URL = "https://educationdata.urban.org/api/v1"


def clean_connection_string(conn_str: str) -> str:
    """Strip Supabase/Prisma-specific params that psycopg2 doesn't understand."""
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    PSYCOPG2_PARAMS = {
        "sslmode", "sslcert", "sslkey", "sslrootcert", "sslcrl",
        "connect_timeout", "application_name", "options",
        "keepalives", "keepalives_idle", "keepalives_interval", "keepalives_count",
    }
    parsed = urlparse(conn_str)
    params = parse_qs(parsed.query)
    clean_params = {k: v for k, v in params.items() if k in PSYCOPG2_PARAMS}
    clean_query = urlencode(clean_params, doseq=True)
    return urlunparse(parsed._replace(query=clean_query))

# Load state FIPS codes from seed file
STATES_SEED = Path(__file__).parent / "states_seed.json"
with open(STATES_SEED) as f:
    ALL_STATES = json.load(f)

# Only use 50 states + DC (skip territories for speed; they have minimal data)
STATES_50_DC = [s for s in ALL_STATES if int(s["fips"]) <= 56]


def _fetch_paginated(
    url: str,
    fips: str,
    page_size: int = 10000,
    delay: float = 0.3,
    timeout: int = 60,
    max_retries: int = 2,
) -> List[Dict]:
    """Generic paginated fetch with state FIPS filter and retries."""
    all_results = []
    page = 1

    while True:
        params = {"fips": int(fips), "page": page, "per_page": page_size}

        for attempt in range(max_retries + 1):
            try:
                response = requests.get(url, params=params, timeout=timeout)
                response.raise_for_status()
                data = response.json()
                break
            except requests.RequestException as e:
                if attempt < max_retries:
                    wait = 2 ** (attempt + 1)
                    print(f"    Retry {attempt+1} in {wait}s: {e}")
                    time.sleep(wait)
                else:
                    print(f"    Failed after {max_retries+1} attempts: {e}")
                    return all_results

        results = data.get("results", [])
        if not results:
            break

        all_results.extend(results)

        if not data.get("next"):
            break

        page += 1
        time.sleep(delay)

    return all_results


# ---------------------------------------------------------------------------
# Finance
# ---------------------------------------------------------------------------

def fetch_finance_all_states(
    year: int = 2020,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
) -> List[Dict]:
    """Fetch finance data state-by-state."""
    url = f"{API_BASE_URL}/school-districts/ccd/finance/{year}/"
    all_records = []
    started = resume_from_fips is None

    for state in tqdm(STATES_50_DC, desc=f"Finance {year}"):
        fips = state["fips"]
        if not started:
            if fips == resume_from_fips:
                started = True
            else:
                continue

        results = _fetch_paginated(url, fips, delay=delay)

        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            exp_total = record.get("exp_total")
            enrollment = record.get("enrollment_fall_responsible")
            exp_per_pupil = None
            if exp_total and enrollment and exp_total > 0 and enrollment > 0:
                exp_per_pupil = exp_total / enrollment

            # ESSER components
            rev_arp_esser = record.get("rev_arp_esser")
            rev_cares = record.get("rev_cares_act_relief_esser")
            rev_crrsa = record.get("rev_crrsa_esser_ii")
            esser_parts = [v for v in [rev_arp_esser, rev_cares, rev_crrsa] if v is not None and v >= 0]
            esser_funding_total = sum(esser_parts) if esser_parts else None

            # Tech spending
            tech_supplies = record.get("exp_tech_supplies_services")
            tech_equip = record.get("exp_tech_equipment")
            tech_parts = [v for v in [tech_supplies, tech_equip] if v is not None and v >= 0]
            tech_spending = sum(tech_parts) if tech_parts else None

            all_records.append({
                "leaid": str(leaid).zfill(7),
                "total_revenue": record.get("rev_total"),
                "federal_revenue": record.get("rev_fed_total"),
                "state_revenue": record.get("rev_state_total"),
                "local_revenue": record.get("rev_local_total"),
                "total_expenditure": exp_total,
                "expenditure_per_pupil": exp_per_pupil,
                "salaries_total": record.get("salaries_total"),
                "salaries_instruction": record.get("salaries_instruction"),
                "salaries_teachers_regular": record.get("salaries_teachers_regular_prog"),
                "salaries_teachers_special_ed": record.get("salaries_teachers_sped"),
                "salaries_teachers_vocational": record.get("salaries_teachers_vocational"),
                "salaries_teachers_other": record.get("salaries_teachers_other_ed"),
                "salaries_support_admin": record.get("salaries_supp_sch_admin"),
                "salaries_support_instructional": record.get("salaries_supp_instruc_staff"),
                "benefits_total": record.get("benefits_employee_total"),
                "sped_expenditure_total": record.get("exp_sped_current"),
                "sped_expenditure_instruction": record.get("exp_sped_instruction"),
                "sped_expenditure_support": record.get("exp_sped_pupil_support_services"),
                "esser_funding_total": esser_funding_total,
                "esser_spending_total": record.get("exp_cares_act_outlay"),
                "esser_spending_instruction": record.get("exp_cares_act_instruction"),
                "payments_to_charter_schools": record.get("payments_charter_schools"),
                "payments_to_private_schools": record.get("payments_private_schools"),
                "tech_spending": tech_spending,
                "capital_outlay_total": record.get("exp_capital_outlay_total"),
                "debt_outstanding": record.get("debt_longterm_outstand_end_fy"),
                "year": year,
            })

        tqdm.write(f"  {state['abbrev']} ({fips}): {len(results)} records")

    print(f"\nTotal finance records: {len(all_records)}")
    return all_records


# ---------------------------------------------------------------------------
# Absenteeism
# ---------------------------------------------------------------------------

def fetch_absenteeism_all_states(
    year: int = 2017,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
) -> Dict[str, Dict]:
    """Fetch chronic absenteeism data state-by-state, aggregated to district."""
    # Filter at API level: sex=99, race=99, disability=99, lep=99, homeless=99 = true totals
    url = f"{API_BASE_URL}/schools/crdc/chronic-absenteeism/{year}/?sex=99&race=99&disability=99&lep=99&homeless=99"
    district_absent = defaultdict(int)
    started = resume_from_fips is None

    for state in tqdm(STATES_50_DC, desc=f"Absenteeism {year}"):
        fips = state["fips"]
        if not started:
            if fips == resume_from_fips:
                started = True
            else:
                continue

        results = _fetch_paginated(url, fips, delay=delay)
        state_count = 0

        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            leaid_str = str(leaid).zfill(7)
            chronic_absent = record.get("students_chronically_absent")

            if chronic_absent is not None and chronic_absent >= 0:
                district_absent[leaid_str] += chronic_absent
                state_count += 1

        tqdm.write(f"  {state['abbrev']} ({fips}): {len(results)} school records, {state_count} valid")

    # Build records (rate will be computed in DB using district enrollment)
    all_records = {}
    for leaid, absent_count in district_absent.items():
        all_records[leaid] = {
            "leaid": leaid,
            "year": year,
            "chronic_absenteeism_count": absent_count,
            "chronic_absenteeism_rate": None,  # computed in upsert from district enrollment
        }

    print(f"\nTotal districts with absenteeism data: {len(all_records)}")
    return all_records


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------

def fetch_assessments_all_states(
    year: int = 2018,
    delay: float = 0.3,
    resume_from_fips: Optional[str] = None,
) -> Dict[str, Dict]:
    """Fetch assessment proficiency data state-by-state."""
    url = f"{API_BASE_URL}/school-districts/edfacts/assessments/{year}/grade-99/"
    all_records: Dict[str, Dict] = {}
    started = resume_from_fips is None

    for state in tqdm(STATES_50_DC, desc=f"Assessments {year}"):
        fips = state["fips"]
        if not started:
            if fips == resume_from_fips:
                started = True
            else:
                continue

        results = _fetch_paginated(url, fips, delay=delay)
        state_count = 0

        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            is_total = record.get("race") == 99 and record.get("sex") == 99
            if not is_total:
                continue

            leaid_str = str(leaid).zfill(7)
            math_prof = record.get("math_test_pct_prof_midpt")
            read_prof = record.get("read_test_pct_prof_midpt")

            if math_prof is not None and math_prof < 0:
                math_prof = None
            if read_prof is not None and read_prof < 0:
                read_prof = None

            if math_prof is not None or read_prof is not None:
                existing = all_records.get(leaid_str, {})
                all_records[leaid_str] = {
                    "leaid": leaid_str,
                    "year": year,
                    "math": math_prof if math_prof is not None else existing.get("math"),
                    "reading": read_prof if read_prof is not None else existing.get("reading"),
                }
                state_count += 1

        tqdm.write(f"  {state['abbrev']} ({fips}): {len(results)} records, {state_count} valid")

    print(f"\nTotal districts with assessment data: {len(all_records)}")
    return all_records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse
    from dotenv import load_dotenv

    # Import upsert functions from existing loaders
    from urban_institute_finance import upsert_finance_data, log_refresh as log_finance
    from urban_institute_absenteeism import upsert_absenteeism_data, log_refresh as log_absenteeism
    from urban_institute_assessments import upsert_assessment_data, log_refresh as log_assessments

    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Load Urban Institute data state-by-state (avoids API timeouts)"
    )
    parser.add_argument("--finance", action="store_true", help="Load finance data")
    parser.add_argument("--absenteeism", action="store_true", help="Load chronic absenteeism data")
    parser.add_argument("--assessments", action="store_true", help="Load assessment proficiency data")
    parser.add_argument("--all", action="store_true", help="Load all datasets")
    parser.add_argument("--finance-year", type=int, default=2020, help="Finance data year")
    parser.add_argument("--absenteeism-year", type=int, default=2017, help="Absenteeism year (2011,2013,2015,2017,2020)")
    parser.add_argument("--assessments-year", type=int, default=2018, help="Assessments year (2009-2018, 2021)")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between API calls (seconds)")
    parser.add_argument("--resume-from", type=str, default=None, help="Resume from state FIPS code (e.g. '25' for MA)")

    args = parser.parse_args()

    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL environment variable not set")

    connection_string = clean_connection_string(connection_string)
    print(f"DB connection: ...{connection_string[-40:]}")

    do_finance = args.finance or args.all
    do_absenteeism = args.absenteeism or args.all
    do_assessments = args.assessments or args.all

    if not any([do_finance, do_absenteeism, do_assessments]):
        parser.print_help()
        print("\nSpecify --finance, --absenteeism, --assessments, or --all")
        sys.exit(1)

    # --- Finance ---
    if do_finance:
        print(f"\n{'='*60}")
        print(f"FINANCE DATA (year {args.finance_year}) - State by State")
        print(f"{'='*60}")
        started = datetime.now().isoformat()
        try:
            records = fetch_finance_all_states(
                year=args.finance_year,
                delay=args.delay,
                resume_from_fips=args.resume_from,
            )
            if records:
                result = upsert_finance_data(connection_string, records, year=args.finance_year)
                print(f"Finance import complete: {result}")
                log_finance(
                    connection_string, "urban_institute_finance",
                    args.finance_year, result["updated"], result["failed"],
                    "success" if result["failed"] == 0 else "partial",
                    started_at=started,
                )
            else:
                print("No finance records fetched")
        except Exception as e:
            print(f"Finance error: {e}")
            raise

    # --- Absenteeism ---
    if do_absenteeism:
        print(f"\n{'='*60}")
        print(f"ABSENTEEISM DATA (year {args.absenteeism_year}) - State by State")
        print(f"{'='*60}")
        started = datetime.now().isoformat()
        try:
            records = fetch_absenteeism_all_states(
                year=args.absenteeism_year,
                delay=args.delay,
                resume_from_fips=args.resume_from,
            )
            if records:
                result = upsert_absenteeism_data(connection_string, records, year=args.absenteeism_year)
                print(f"Absenteeism import complete: {result}")
                log_absenteeism(
                    connection_string, "urban_institute_absenteeism",
                    args.absenteeism_year, result["updated"], result["failed"],
                    "success" if result["failed"] == 0 else "partial",
                    started_at=started,
                )
            else:
                print("No absenteeism records fetched")
        except Exception as e:
            print(f"Absenteeism error: {e}")
            raise

    # --- Assessments ---
    if do_assessments:
        print(f"\n{'='*60}")
        print(f"ASSESSMENTS DATA (year {args.assessments_year}) - State by State")
        print(f"{'='*60}")
        started = datetime.now().isoformat()
        try:
            records = fetch_assessments_all_states(
                year=args.assessments_year,
                delay=args.delay,
                resume_from_fips=args.resume_from,
            )
            if records:
                result = upsert_assessment_data(connection_string, records, year=args.assessments_year)
                print(f"Assessments import complete: {result}")
                log_assessments(
                    connection_string, "urban_institute_assessments",
                    args.assessments_year, result["updated"], result["failed"],
                    "success" if result["failed"] == 0 else "partial",
                    started_at=started,
                )
            else:
                print("No assessment records fetched")
        except Exception as e:
            print(f"Assessments error: {e}")
            raise

    print(f"\n{'='*60}")
    print("DONE")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
