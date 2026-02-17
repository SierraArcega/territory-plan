"""
Bulk CSV Loader for Urban Institute Data

Loads data from CSV files downloaded from the Urban Institute Data Explorer
(https://educationdata.urban.org/data-explorer/) instead of hitting the API.

This is much faster and more reliable than the paginated API.

Usage:
    python3 csv_bulk_loader.py --finance /path/to/finance.csv
    python3 csv_bulk_loader.py --absenteeism /path/to/absenteeism.csv
    python3 csv_bulk_loader.py --assessments /path/to/assessments.csv
    python3 csv_bulk_loader.py --all --finance-csv /path/to/finance.csv --absenteeism-csv /path/to/absenteeism.csv --assessments-csv /path/to/assessments.csv

CSV Downloads:
    Finance:      School Districts → CCD → Finance → 2020
    Absenteeism:  Schools → CRDC → Chronic Absenteeism → 2020
    Assessments:  School Districts → EdFacts → Assessments → 2018 → Grade 99
"""

import os
import csv
import argparse
from typing import Dict, List, Optional
from collections import defaultdict
from tqdm import tqdm


def _clean_val(val):
    """Clean a value from CSV - returns None for missing/negative sentinel values."""
    if val is None or val == '' or val == 'NA' or val == '.':
        return None
    try:
        num = float(val)
        if num < 0:  # Urban Institute uses -1, -2 for missing/suppressed
            return None
        return num
    except (ValueError, TypeError):
        return None


def _clean_int(val):
    """Clean an integer value from CSV."""
    result = _clean_val(val)
    if result is not None:
        return int(result)
    return None


def load_finance_csv(
    connection_string: str,
    csv_path: str,
) -> dict:
    """
    Load finance data from a bulk CSV download.

    Populates: sped expenditure, ESSER funding, outsourcing signals,
    tech spending, capital outlay, debt, plus all existing finance fields.

    Args:
        connection_string: PostgreSQL connection string
        csv_path: Path to finance CSV from Urban Institute Data Explorer

    Returns:
        Dict with counts
    """
    import psycopg2
    from psycopg2.extras import execute_values

    print(f"Reading finance CSV: {csv_path}")

    records = []
    year = None

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)

        for row in reader:
            leaid = row.get('leaid')
            if not leaid:
                continue

            leaid_str = str(int(float(leaid))).zfill(7) if leaid else None
            if not leaid_str or len(leaid_str) != 7:
                continue

            if year is None:
                year = _clean_int(row.get('year'))

            exp_total = _clean_val(row.get('exp_total'))
            enrollment = _clean_val(row.get('enrollment_fall_responsible'))
            exp_per_pupil = None
            if exp_total and enrollment and enrollment > 0:
                exp_per_pupil = round(exp_total / enrollment, 2)

            # ESSER components
            rev_arp = _clean_val(row.get('rev_arp_esser'))
            rev_cares = _clean_val(row.get('rev_cares_act_relief_esser'))
            rev_crrsa = _clean_val(row.get('rev_crrsa_esser_ii'))
            esser_parts = [v for v in [rev_arp, rev_cares, rev_crrsa] if v is not None]
            esser_funding = sum(esser_parts) if esser_parts else None

            # Tech spending
            tech_supplies = _clean_val(row.get('exp_tech_supplies_services'))
            tech_equip = _clean_val(row.get('exp_tech_equipment'))
            tech_parts = [v for v in [tech_supplies, tech_equip] if v is not None]
            tech_spending = sum(tech_parts) if tech_parts else None

            rev_total = _clean_val(row.get('rev_total'))
            salaries_total = _clean_val(row.get('salaries_total'))

            if rev_total is not None or salaries_total is not None:
                records.append((
                    leaid_str,
                    # Revenue
                    rev_total,
                    _clean_val(row.get('rev_fed_total')),
                    _clean_val(row.get('rev_state_total')),
                    _clean_val(row.get('rev_local_total')),
                    # Expenditure
                    exp_total,
                    exp_per_pupil,
                    year,
                    # Salaries
                    salaries_total,
                    _clean_val(row.get('salaries_instruction')),
                    _clean_val(row.get('salaries_teachers_regular_prog')),
                    _clean_val(row.get('salaries_teachers_sped')),
                    _clean_val(row.get('salaries_teachers_vocational')),
                    _clean_val(row.get('salaries_teachers_other_ed')),
                    _clean_val(row.get('salaries_supp_sch_admin')),
                    _clean_val(row.get('salaries_supp_instruc_staff')),
                    _clean_val(row.get('benefits_employee_total')),
                    # SpEd finance (NEW)
                    _clean_val(row.get('exp_sped_current')),
                    _clean_val(row.get('exp_sped_instruction')),
                    _clean_val(row.get('exp_sped_pupil_support_services')),
                    # ESSER (NEW)
                    esser_funding,
                    _clean_val(row.get('exp_cares_act_outlay')),
                    _clean_val(row.get('exp_cares_act_instruction')),
                    # Outsourcing (NEW)
                    _clean_val(row.get('payments_charter_schools')),
                    _clean_val(row.get('payments_private_schools')),
                    # Tech & capital (NEW)
                    tech_spending,
                    _clean_val(row.get('exp_capital_outlay_total')),
                    _clean_val(row.get('debt_longterm_outstand_end_fy')),
                ))

    print(f"Parsed {len(records)} finance records from CSV (year: {year})")

    if not records:
        print("No valid records found in CSV")
        return {"updated": 0, "failed": 0}

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        CREATE TEMP TABLE finance_csv_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            total_revenue NUMERIC, federal_revenue NUMERIC, state_revenue NUMERIC, local_revenue NUMERIC,
            total_expenditure NUMERIC, expenditure_per_pupil NUMERIC, finance_data_year INTEGER,
            salaries_total NUMERIC, salaries_instruction NUMERIC,
            salaries_teachers_regular NUMERIC, salaries_teachers_special_ed NUMERIC,
            salaries_teachers_vocational NUMERIC, salaries_teachers_other NUMERIC,
            salaries_support_admin NUMERIC, salaries_support_instructional NUMERIC, benefits_total NUMERIC,
            sped_expenditure_total NUMERIC, sped_expenditure_instruction NUMERIC, sped_expenditure_support NUMERIC,
            esser_funding_total NUMERIC, esser_spending_total NUMERIC, esser_spending_instruction NUMERIC,
            payments_to_charter_schools NUMERIC, payments_to_private_schools NUMERIC,
            tech_spending NUMERIC, capital_outlay_total NUMERIC, debt_outstanding NUMERIC
        )
    """)

    insert_sql = """
        INSERT INTO finance_csv_updates VALUES %s
        ON CONFLICT (leaid) DO NOTHING
    """
    template = "(%s" + ", %s" * 27 + ")"

    print("Loading into temp table...")
    for i in tqdm(range(0, len(records), 1000), desc="Loading"):
        batch = records[i:i+1000]
        execute_values(cur, insert_sql, batch, template=template)

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
            benefits_total = u.benefits_total,
            sped_expenditure_total = u.sped_expenditure_total,
            sped_expenditure_instruction = u.sped_expenditure_instruction,
            sped_expenditure_support = u.sped_expenditure_support,
            esser_funding_total = u.esser_funding_total,
            esser_spending_total = u.esser_spending_total,
            esser_spending_instruction = u.esser_spending_instruction,
            payments_to_charter_schools = u.payments_to_charter_schools,
            payments_to_private_schools = u.payments_to_private_schools,
            tech_spending = u.tech_spending,
            capital_outlay_total = u.capital_outlay_total,
            debt_outstanding = u.debt_outstanding
        FROM finance_csv_updates u
        WHERE d.leaid = u.leaid
    """)
    updated = cur.rowcount
    print(f"Updated {updated} districts with finance data")

    # Compute sped per student
    cur.execute("""
        UPDATE districts SET
            sped_expenditure_per_student = sped_expenditure_total / spec_ed_students
        WHERE sped_expenditure_total IS NOT NULL
          AND spec_ed_students IS NOT NULL
          AND spec_ed_students > 0
    """)
    sped_computed = cur.rowcount
    print(f"Computed sped_expenditure_per_student for {sped_computed} districts")

    cur.execute("DROP TABLE finance_csv_updates")
    conn.commit()
    cur.close()
    conn.close()

    return {"updated": updated, "sped_per_student": sped_computed}


def load_absenteeism_csv(
    connection_string: str,
    csv_path: str,
) -> dict:
    """
    Load chronic absenteeism data from a bulk CSV download.

    This is school-level data that gets aggregated up to district level.

    Args:
        connection_string: PostgreSQL connection string
        csv_path: Path to absenteeism CSV from Urban Institute Data Explorer

    Returns:
        Dict with counts
    """
    import psycopg2
    from psycopg2.extras import execute_values

    print(f"Reading absenteeism CSV: {csv_path}")

    district_absent = defaultdict(int)
    district_enrollment = defaultdict(int)
    year = None
    row_count = 0

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)

        for row in reader:
            row_count += 1
            if row_count % 500000 == 0:
                print(f"  Read {row_count:,} rows...")

            leaid = row.get('leaid')
            if not leaid:
                continue

            # Only aggregate totals (sex=99, race=99, disability=99)
            sex = _clean_int(row.get('sex'))
            race = _clean_int(row.get('race'))
            disability = _clean_int(row.get('disability'))

            if sex != 99 or race != 99 or disability != 99:
                continue

            if year is None:
                year = _clean_int(row.get('year'))

            leaid_str = str(int(float(leaid))).zfill(7)
            chronic_absent = _clean_int(row.get('chronic_absent'))
            enrollment = _clean_int(row.get('enrollment_crdc'))

            if chronic_absent is not None:
                district_absent[leaid_str] += chronic_absent
            if enrollment is not None:
                district_enrollment[leaid_str] += enrollment

    print(f"Read {row_count:,} total rows, aggregated to {len(district_absent)} districts (year: {year})")

    if not district_absent:
        print("No valid absenteeism records found")
        return {"updated": 0}

    # Build district-level records
    records = []
    for leaid in district_absent:
        absent_count = district_absent[leaid]
        enrollment = district_enrollment.get(leaid, 0)
        rate = round((absent_count / enrollment) * 100, 2) if enrollment > 0 else None
        records.append((leaid, absent_count, rate, year))

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        CREATE TEMP TABLE absenteeism_csv_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            chronic_absenteeism_count INTEGER,
            chronic_absenteeism_rate NUMERIC,
            absenteeism_data_year INTEGER
        )
    """)

    insert_sql = "INSERT INTO absenteeism_csv_updates VALUES %s ON CONFLICT (leaid) DO NOTHING"
    execute_values(cur, insert_sql, records, template="(%s, %s, %s, %s)")

    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            chronic_absenteeism_count = u.chronic_absenteeism_count,
            chronic_absenteeism_rate = u.chronic_absenteeism_rate,
            absenteeism_data_year = u.absenteeism_data_year
        FROM absenteeism_csv_updates u
        WHERE d.leaid = u.leaid
    """)
    updated = cur.rowcount
    print(f"Updated {updated} districts with absenteeism data")

    cur.execute("DROP TABLE absenteeism_csv_updates")
    conn.commit()
    cur.close()
    conn.close()

    return {"updated": updated, "districts_aggregated": len(records)}


def load_assessments_csv(
    connection_string: str,
    csv_path: str,
) -> dict:
    """
    Load assessment proficiency data from a bulk CSV download.

    Args:
        connection_string: PostgreSQL connection string
        csv_path: Path to assessments CSV from Urban Institute Data Explorer

    Returns:
        Dict with counts
    """
    import psycopg2
    from psycopg2.extras import execute_values

    print(f"Reading assessments CSV: {csv_path}")

    records = {}
    year = None

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)

        for row in reader:
            leaid = row.get('leaid')
            if not leaid:
                continue

            # Only use totals (race=99, sex=99)
            race = _clean_int(row.get('race'))
            sex = _clean_int(row.get('sex'))
            if race != 99 or sex != 99:
                continue

            if year is None:
                year = _clean_int(row.get('year'))

            leaid_str = str(int(float(leaid))).zfill(7)
            math_prof = _clean_val(row.get('math_test_pct_prof_midpt'))
            read_prof = _clean_val(row.get('read_test_pct_prof_midpt'))

            if math_prof is not None or read_prof is not None:
                existing = records.get(leaid_str, {})
                records[leaid_str] = {
                    "math": math_prof if math_prof is not None else existing.get("math"),
                    "reading": read_prof if read_prof is not None else existing.get("reading"),
                }

    print(f"Parsed {len(records)} district assessment records (year: {year})")

    if not records:
        print("No valid assessment records found")
        return {"updated": 0}

    values = [
        (leaid, r.get("math"), r.get("reading"), year)
        for leaid, r in records.items()
    ]

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        CREATE TEMP TABLE assessment_csv_updates (
            leaid VARCHAR(7) PRIMARY KEY,
            math_proficiency_pct NUMERIC,
            read_proficiency_pct NUMERIC,
            assessment_data_year INTEGER
        )
    """)

    insert_sql = "INSERT INTO assessment_csv_updates VALUES %s ON CONFLICT (leaid) DO NOTHING"
    execute_values(cur, insert_sql, values, template="(%s, %s, %s, %s)")

    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            math_proficiency_pct = u.math_proficiency_pct,
            read_proficiency_pct = u.read_proficiency_pct,
            assessment_data_year = u.assessment_data_year
        FROM assessment_csv_updates u
        WHERE d.leaid = u.leaid
    """)
    updated = cur.rowcount
    print(f"Updated {updated} districts with assessment data")

    cur.execute("DROP TABLE assessment_csv_updates")
    conn.commit()
    cur.close()
    conn.close()

    return {"updated": updated}


def main():
    """CLI entry point."""
    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Load Urban Institute bulk CSV downloads into database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Download CSVs from: https://educationdata.urban.org/data-explorer/

Examples:
    python3 csv_bulk_loader.py --finance ~/Downloads/finance_2020.csv
    python3 csv_bulk_loader.py --absenteeism ~/Downloads/absenteeism_2020.csv
    python3 csv_bulk_loader.py --assessments ~/Downloads/assessments_2018.csv
    python3 csv_bulk_loader.py --finance ~/Downloads/finance.csv --absenteeism ~/Downloads/absent.csv --assessments ~/Downloads/assess.csv
        """
    )
    parser.add_argument("--finance", type=str, help="Path to finance CSV")
    parser.add_argument("--absenteeism", type=str, help="Path to absenteeism CSV")
    parser.add_argument("--assessments", type=str, help="Path to assessments CSV")

    args = parser.parse_args()

    if not any([args.finance, args.absenteeism, args.assessments]):
        parser.print_help()
        return

    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL or DIRECT_URL not set")

    # Strip Supabase params
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    if args.finance:
        result = load_finance_csv(connection_string, args.finance)
        print(f"\nFinance CSV result: {result}")

    if args.absenteeism:
        result = load_absenteeism_csv(connection_string, args.absenteeism)
        print(f"\nAbsenteeism CSV result: {result}")

    if args.assessments:
        result = load_assessments_csv(connection_string, args.assessments)
        print(f"\nAssessments CSV result: {result}")

    print("\nDone! Run 'python3 run_etl.py --stats-only' to verify.")


if __name__ == "__main__":
    main()
