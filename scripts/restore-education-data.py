#!/usr/bin/env python3
"""
Restore education data from Docker backup into Supabase districts table.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

load_dotenv()

def parse_value(val, is_numeric=False):
    """Parse a PostgreSQL COPY value."""
    if val == '\\N' or val == '':
        return None
    if is_numeric:
        return float(val) if val else None
    return val

def load_education_data(sql_file: Path, connection_string: str):
    """Load education data from SQL COPY file into districts table."""

    # Read and parse the data
    records = []
    with open(sql_file, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip COPY statement and ending marker
            if line.startswith('COPY') or line == '\\.' or not line:
                continue

            parts = line.split('\t')
            if len(parts) < 35:
                continue

            record = {
                'leaid': parts[0],
                'total_revenue': parse_value(parts[1], True),
                'federal_revenue': parse_value(parts[2], True),
                'state_revenue': parse_value(parts[3], True),
                'local_revenue': parse_value(parts[4], True),
                'total_expenditure': parse_value(parts[5], True),
                'expenditure_per_pupil': parse_value(parts[6], True),
                'finance_data_year': int(parts[7]) if parts[7] and parts[7] != '\\N' else None,
                'salaries_total': parse_value(parts[16], True),
                'salaries_instruction': parse_value(parts[17], True),
                'salaries_teachers_regular': parse_value(parts[18], True),
                'salaries_teachers_special_ed': parse_value(parts[19], True),
                'salaries_teachers_vocational': parse_value(parts[20], True),
                'salaries_teachers_other': parse_value(parts[21], True),
                'salaries_support_admin': parse_value(parts[22], True),
                'salaries_support_instructional': parse_value(parts[23], True),
                'benefits_total': parse_value(parts[24], True),
            }
            records.append(record)

    print(f"Parsed {len(records)} education records")

    # Filter records with finance data
    records_with_finance = [r for r in records if r['finance_data_year'] is not None]
    print(f"Records with finance data: {len(records_with_finance)}")

    # Connect and update
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Create temp table
    cur.execute("""
        CREATE TEMP TABLE education_restore (
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

    # Insert into temp table
    insert_sql = """
        INSERT INTO education_restore (
            leaid, total_revenue, federal_revenue, state_revenue, local_revenue,
            total_expenditure, expenditure_per_pupil, finance_data_year,
            salaries_total, salaries_instruction, salaries_teachers_regular,
            salaries_teachers_special_ed, salaries_teachers_vocational, salaries_teachers_other,
            salaries_support_admin, salaries_support_instructional, benefits_total
        ) VALUES %s
    """

    values = [
        (
            r['leaid'], r['total_revenue'], r['federal_revenue'], r['state_revenue'],
            r['local_revenue'], r['total_expenditure'], r['expenditure_per_pupil'],
            r['finance_data_year'], r['salaries_total'], r['salaries_instruction'],
            r['salaries_teachers_regular'], r['salaries_teachers_special_ed'],
            r['salaries_teachers_vocational'], r['salaries_teachers_other'],
            r['salaries_support_admin'], r['salaries_support_instructional'],
            r['benefits_total']
        )
        for r in records_with_finance
    ]

    print(f"Loading {len(values)} records into temp table...")
    batch_size = 1000
    for i in tqdm(range(0, len(values), batch_size)):
        batch = values[i:i+batch_size]
        execute_values(cur, insert_sql, batch)

    # Update districts from temp table
    print("Updating districts table...")
    cur.execute("""
        UPDATE districts d SET
            total_revenue = e.total_revenue,
            federal_revenue = e.federal_revenue,
            state_revenue = e.state_revenue,
            local_revenue = e.local_revenue,
            total_expenditure = e.total_expenditure,
            expenditure_per_pupil = e.expenditure_per_pupil,
            finance_data_year = e.finance_data_year,
            salaries_total = e.salaries_total,
            salaries_instruction = e.salaries_instruction,
            salaries_teachers_regular = e.salaries_teachers_regular,
            salaries_teachers_special_ed = e.salaries_teachers_special_ed,
            salaries_teachers_vocational = e.salaries_teachers_vocational,
            salaries_teachers_other = e.salaries_teachers_other,
            salaries_support_admin = e.salaries_support_admin,
            salaries_support_instructional = e.salaries_support_instructional,
            benefits_total = e.benefits_total
        FROM education_restore e
        WHERE d.leaid = e.leaid
    """)
    updated = cur.rowcount
    print(f"Updated {updated} districts with finance/salary data")

    # Drop temp table
    cur.execute("DROP TABLE education_restore")

    conn.commit()
    cur.close()
    conn.close()

    return updated


if __name__ == "__main__":
    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        print("Error: DIRECT_URL or DATABASE_URL not set")
        sys.exit(1)

    # Strip problematic params
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    sql_file = Path("/tmp/education_data.sql")
    if not sql_file.exists():
        print(f"Error: {sql_file} not found")
        sys.exit(1)

    load_education_data(sql_file, connection_string)
    print("Done!")
