"""
Historical Backfill Module

Pulls multi-year data from existing endpoints and writes to district_data_history table.
Enables trend analysis: enrollment growth, staffing decline, budget changes over time.

After backfill, computes trend signals on the districts table:
- enrollment_trend_3yr: % change in enrollment over 3 years
- staffing_trend_3yr: % change in FTE over 3 years
- vacancy_pressure_signal: enrollment_trend minus staffing_trend (positive = growing gap)
"""

import os
import time
from typing import Dict, List, Optional
import requests
from tqdm import tqdm


API_BASE_URL = "https://educationdata.urban.org/api/v1"


def _fetch_paginated(url: str, delay: float = 0.5) -> List[Dict]:
    """Fetch all pages from a paginated Urban Institute API endpoint."""
    all_results = []
    page = 1

    while True:
        params = {"page": page, "per_page": 10000}
        try:
            response = requests.get(url, params=params, timeout=120)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"  Error fetching page {page}: {e}")
            break

        results = data.get("results", [])
        if not results:
            break

        all_results.extend(results)

        if not data.get("next"):
            break

        page += 1
        time.sleep(delay)

    return all_results


def backfill_enrollment_history(
    connection_string: str,
    years: List[int],
    delay: float = 0.5,
) -> int:
    """
    Backfill enrollment + staffing data from CCD directory for multiple years.

    Source: ccd_directory — contains enrollment, teachers_fte, staff_total_fte, spec_ed_students.

    Args:
        connection_string: PostgreSQL connection string
        years: List of years to backfill
        delay: Delay between API calls

    Returns:
        Total records written
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    total_written = 0

    for year in years:
        print(f"\nBackfilling CCD directory data for {year}...")
        url = f"{API_BASE_URL}/school-districts/ccd/directory/{year}/"
        results = _fetch_paginated(url, delay=delay)
        print(f"  Fetched {len(results)} records")

        batch = []
        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            leaid_str = str(leaid).zfill(7)
            enrollment = record.get("enrollment")
            teachers_fte = record.get("teachers_total_fte")
            staff_total_fte = record.get("staff_total_fte")
            spec_ed = record.get("spec_ed_students")

            # Clean invalid values
            if enrollment is not None and enrollment < 0:
                enrollment = None
            if teachers_fte is not None and teachers_fte < 0:
                teachers_fte = None
            if staff_total_fte is not None and staff_total_fte < 0:
                staff_total_fte = None
            if spec_ed is not None and spec_ed < 0:
                spec_ed = None

            if enrollment is not None or teachers_fte is not None:
                batch.append((leaid_str, year, 'ccd_directory', enrollment, teachers_fte, staff_total_fte, spec_ed))

        if batch:
            from psycopg2.extras import execute_values
            execute_values(
                cur,
                """
                INSERT INTO district_data_history (leaid, year, source, enrollment, teachers_fte, staff_total_fte, spec_ed_students)
                VALUES %s
                ON CONFLICT (leaid, year, source) DO UPDATE SET
                    enrollment = EXCLUDED.enrollment,
                    teachers_fte = EXCLUDED.teachers_fte,
                    staff_total_fte = EXCLUDED.staff_total_fte,
                    spec_ed_students = EXCLUDED.spec_ed_students
                """,
                batch,
                template="(%s, %s, %s, %s, %s, %s, %s)"
            )
            conn.commit()
            total_written += len(batch)
            print(f"  Wrote {len(batch)} history records for {year}")

    cur.close()
    conn.close()
    return total_written


def backfill_ell_history(
    connection_string: str,
    years: List[int],
    delay: float = 0.5,
) -> int:
    """
    Backfill ELL student counts from CCD directory for multiple years.

    Fetches state-by-state to avoid timeouts. Updates ell_students column
    on existing ccd_directory rows in district_data_history.

    Args:
        connection_string: PostgreSQL connection string
        years: List of years to backfill
        delay: Delay between API calls

    Returns:
        Total records written
    """
    import psycopg2
    from psycopg2.extras import execute_values

    # All state FIPS codes
    STATES = [
        "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
        "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
        "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
        "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
        "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
        "56",
    ]

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    total_written = 0

    for year in years:
        print(f"\nBackfilling ELL data for {year} (state by state)...")
        year_written = 0

        for fips in STATES:
            url = f"{API_BASE_URL}/school-districts/ccd/directory/{year}/"
            results = _fetch_paginated(f"{url}?fips={int(fips)}", delay=delay)

            batch = []
            for record in results:
                leaid = record.get("leaid")
                if not leaid:
                    continue

                leaid_str = str(leaid).zfill(7)
                ell = record.get("english_language_learners")

                # Clean invalid values (Urban Institute uses -1/-2 for missing)
                if ell is not None and ell < 0:
                    ell = None

                if ell is not None:
                    batch.append((leaid_str, year, 'ccd_directory', ell))

            if batch:
                # Update existing ccd_directory rows with ell_students
                execute_values(
                    cur,
                    """
                    INSERT INTO district_data_history (leaid, year, source, ell_students)
                    VALUES %s
                    ON CONFLICT (leaid, year, source) DO UPDATE SET
                        ell_students = EXCLUDED.ell_students
                    """,
                    batch,
                    template="(%s, %s, %s, %s)"
                )
                conn.commit()
                year_written += len(batch)

            time.sleep(delay)

        total_written += year_written
        print(f"  Wrote {year_written} ELL history records for {year}")

    cur.close()
    conn.close()
    return total_written


def backfill_absenteeism_history(
    connection_string: str,
    years: List[int] = None,
    delay: float = 0.5,
) -> int:
    """
    Backfill chronic absenteeism rates from CRDC for available years.

    CRDC data is biennial: available years are 2011, 2013, 2015, 2017, 2020.
    Fetches school-level data state-by-state, aggregates to district level,
    and writes to district_data_history.

    Args:
        connection_string: PostgreSQL connection string
        years: List of CRDC years (defaults to all available)
        delay: Delay between API calls

    Returns:
        Total records written
    """
    import psycopg2
    from psycopg2.extras import execute_values
    from collections import defaultdict

    AVAILABLE_YEARS = [2011, 2013, 2015, 2017, 2020]
    if years is None:
        years = AVAILABLE_YEARS
    else:
        # Filter to only valid CRDC years
        years = [y for y in years if y in AVAILABLE_YEARS]
        if not years:
            print("No valid CRDC years provided. Available: 2011, 2013, 2015, 2017, 2020")
            return 0

    STATES = [
        "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
        "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
        "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
        "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
        "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
        "56",
    ]

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    total_written = 0

    for year in years:
        print(f"\nBackfilling CRDC absenteeism data for {year} (state by state)...")
        # Accumulate school-level data by district
        district_absent = defaultdict(int)
        district_enrollment = defaultdict(int)

        for fips in STATES:
            url = f"{API_BASE_URL}/schools/crdc/chronic-absenteeism/{year}/"
            results = _fetch_paginated(f"{url}?fips={int(fips)}", delay=delay)

            for record in results:
                leaid = record.get("leaid")
                if not leaid:
                    continue

                # Only total records (not disaggregated)
                is_total = (
                    record.get("sex") == 99 and
                    record.get("race") == 99 and
                    record.get("disability") == 99
                )
                if not is_total:
                    continue

                leaid_str = str(leaid).zfill(7)
                chronic_absent = record.get("chronic_absent")
                enrollment = record.get("enrollment_crdc")

                if chronic_absent is not None and chronic_absent >= 0:
                    district_absent[leaid_str] += chronic_absent
                if enrollment is not None and enrollment >= 0:
                    district_enrollment[leaid_str] += enrollment

            time.sleep(delay)

        # Compute rates and write to history
        batch = []
        for leaid in district_absent:
            absent_count = district_absent[leaid]
            enrollment = district_enrollment.get(leaid, 0)
            rate = None
            if enrollment > 0:
                rate = round((absent_count / enrollment) * 100, 2)
            if rate is not None:
                batch.append((leaid, year, 'crdc_absenteeism', rate))

        if batch:
            execute_values(
                cur,
                """
                INSERT INTO district_data_history (leaid, year, source, chronic_absenteeism_rate)
                VALUES %s
                ON CONFLICT (leaid, year, source) DO UPDATE SET
                    chronic_absenteeism_rate = EXCLUDED.chronic_absenteeism_rate
                """,
                batch,
                template="(%s, %s, %s, %s)"
            )
            conn.commit()
            total_written += len(batch)
            print(f"  Wrote {len(batch)} absenteeism history records for {year}")

    cur.close()
    conn.close()
    return total_written


def backfill_finance_history(
    connection_string: str,
    years: List[int],
    delay: float = 0.5,
) -> int:
    """
    Backfill finance data from CCD finance for multiple years.

    Source: ccd_finance — contains revenue, expenditure, sped expenditure.
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    total_written = 0

    for year in years:
        print(f"\nBackfilling CCD finance data for {year}...")
        url = f"{API_BASE_URL}/school-districts/ccd/finance/{year}/"
        results = _fetch_paginated(url, delay=delay)
        print(f"  Fetched {len(results)} records")

        batch = []
        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            leaid_str = str(leaid).zfill(7)

            def clean(val):
                return val if val is not None and val >= 0 else None

            rev_total = clean(record.get("rev_total"))
            exp_total = clean(record.get("exp_total"))
            enrollment = clean(record.get("enrollment_fall_responsible"))
            exp_pp = None
            if exp_total and enrollment and enrollment > 0:
                exp_pp = round(exp_total / enrollment, 2)

            if rev_total is not None or exp_total is not None:
                batch.append((
                    leaid_str, year, 'ccd_finance',
                    rev_total, exp_total, exp_pp,
                    clean(record.get("rev_fed_total")),
                    clean(record.get("rev_state_total")),
                    clean(record.get("rev_local_total")),
                    clean(record.get("exp_sped_current")),
                ))

        if batch:
            from psycopg2.extras import execute_values
            execute_values(
                cur,
                """
                INSERT INTO district_data_history
                    (leaid, year, source, total_revenue, total_expenditure, expenditure_pp,
                     federal_revenue, state_revenue, local_revenue, sped_expenditure)
                VALUES %s
                ON CONFLICT (leaid, year, source) DO UPDATE SET
                    total_revenue = EXCLUDED.total_revenue,
                    total_expenditure = EXCLUDED.total_expenditure,
                    expenditure_pp = EXCLUDED.expenditure_pp,
                    federal_revenue = EXCLUDED.federal_revenue,
                    state_revenue = EXCLUDED.state_revenue,
                    local_revenue = EXCLUDED.local_revenue,
                    sped_expenditure = EXCLUDED.sped_expenditure
                """,
                batch,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            conn.commit()
            total_written += len(batch)
            print(f"  Wrote {len(batch)} finance history records for {year}")

    cur.close()
    conn.close()
    return total_written


def backfill_poverty_history(
    connection_string: str,
    years: List[int],
    delay: float = 0.5,
) -> int:
    """
    Backfill poverty data from SAIPE for multiple years.

    Source: saipe
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    total_written = 0

    for year in years:
        print(f"\nBackfilling SAIPE poverty data for {year}...")
        url = f"{API_BASE_URL}/school-districts/saipe/{year}/"
        results = _fetch_paginated(url, delay=delay)
        print(f"  Fetched {len(results)} records")

        batch = []
        for record in results:
            leaid = record.get("leaid")
            if not leaid:
                continue

            leaid_str = str(leaid).zfill(7)
            poverty_pct = record.get("est_population_5_17_poverty_pct")

            if poverty_pct is not None and poverty_pct >= 0:
                batch.append((leaid_str, year, 'saipe', poverty_pct))

        if batch:
            from psycopg2.extras import execute_values
            execute_values(
                cur,
                """
                INSERT INTO district_data_history (leaid, year, source, poverty_pct)
                VALUES %s
                ON CONFLICT (leaid, year, source) DO UPDATE SET
                    poverty_pct = EXCLUDED.poverty_pct
                """,
                batch,
                template="(%s, %s, %s, %s)"
            )
            conn.commit()
            total_written += len(batch)
            print(f"  Wrote {len(batch)} poverty history records for {year}")

    cur.close()
    conn.close()
    return total_written


def compute_trend_signals(connection_string: str) -> int:
    """
    Compute 3-year trend signals on the districts table from district_data_history.

    Computes:
    - enrollment_trend_3yr: % change in enrollment over most recent 3 years available
    - staffing_trend_3yr: % change in teachers_fte over most recent 3 years
    - vacancy_pressure_signal: enrollment_trend - staffing_trend (positive = growing gap)

    Returns:
        Number of districts updated
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Find latest and earliest years in history for ccd_directory
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'ccd_directory'
    """)
    row = cur.fetchone()
    if not row or row[0] is None:
        print("No historical directory data found. Skipping trend computation.")
        cur.close()
        conn.close()
        return 0

    min_year, max_year = row
    # Use 3-year span: compare max_year to (max_year - 3), or earliest available
    base_year = max(min_year, max_year - 3)
    print(f"Computing trends: {base_year} → {max_year}")

    # Compute trends using a CTE joining base year and latest year
    cur.execute("""
        WITH base AS (
            SELECT leaid, enrollment, teachers_fte
            FROM district_data_history
            WHERE source = 'ccd_directory' AND year = %s
        ),
        latest AS (
            SELECT leaid, enrollment, teachers_fte
            FROM district_data_history
            WHERE source = 'ccd_directory' AND year = %s
        ),
        trends AS (
            SELECT
                l.leaid,
                CASE
                    WHEN b.enrollment IS NOT NULL AND b.enrollment > 0 AND l.enrollment IS NOT NULL
                    THEN ROUND(((l.enrollment - b.enrollment)::numeric / b.enrollment) * 100, 2)
                    ELSE NULL
                END AS enrollment_trend,
                CASE
                    WHEN b.teachers_fte IS NOT NULL AND b.teachers_fte > 0 AND l.teachers_fte IS NOT NULL
                    THEN ROUND(((l.teachers_fte - b.teachers_fte) / b.teachers_fte) * 100, 2)
                    ELSE NULL
                END AS staffing_trend
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
        )
        UPDATE districts d SET
            enrollment_trend_3yr = t.enrollment_trend,
            staffing_trend_3yr = t.staffing_trend,
            vacancy_pressure_signal = CASE
                WHEN t.enrollment_trend IS NOT NULL AND t.staffing_trend IS NOT NULL
                THEN t.enrollment_trend - t.staffing_trend
                ELSE NULL
            END
        FROM trends t
        WHERE d.leaid = t.leaid
    """, (base_year, max_year))

    updated_count = cur.rowcount
    conn.commit()

    # Print summary stats
    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE vacancy_pressure_signal > 0) as pressure_positive,
            COUNT(*) FILTER (WHERE vacancy_pressure_signal IS NOT NULL) as total_with_signal,
            AVG(vacancy_pressure_signal) FILTER (WHERE vacancy_pressure_signal IS NOT NULL) as avg_signal
        FROM districts
    """)
    stats = cur.fetchone()
    if stats:
        print(f"Districts with vacancy pressure signal: {stats[1]}")
        print(f"  Positive pressure (enrollment > staffing growth): {stats[0]}")
        print(f"  Average signal: {stats[2]:.2f}" if stats[2] else "  Average signal: N/A")

    cur.close()
    conn.close()

    print(f"Computed trend signals for {updated_count} districts")
    return updated_count


def main():
    """CLI entry point."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Historical data backfill and trend computation")
    parser.add_argument("--enrollment", action="store_true", help="Backfill enrollment/staffing history")
    parser.add_argument("--finance", action="store_true", help="Backfill finance history")
    parser.add_argument("--poverty", action="store_true", help="Backfill poverty history")
    parser.add_argument("--all-sources", action="store_true", help="Backfill all sources")
    parser.add_argument("--trends", action="store_true", help="Compute trend signals only")
    parser.add_argument("--years", type=str, default="2019,2020,2021,2022,2023",
                        help="Comma-separated years to backfill (default: 2019-2023)")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls")

    args = parser.parse_args()

    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL or DIRECT_URL not set")

    # Strip Supabase-specific params
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    years = [int(y.strip()) for y in args.years.split(",")]

    if args.enrollment or args.all_sources:
        count = backfill_enrollment_history(connection_string, years, delay=args.delay)
        print(f"Total enrollment/staffing history records: {count}")

    if args.finance or args.all_sources:
        count = backfill_finance_history(connection_string, years, delay=args.delay)
        print(f"Total finance history records: {count}")

    if args.poverty or args.all_sources:
        count = backfill_poverty_history(connection_string, years, delay=args.delay)
        print(f"Total poverty history records: {count}")

    if args.trends or args.all_sources:
        compute_trend_signals(connection_string)


if __name__ == "__main__":
    main()
