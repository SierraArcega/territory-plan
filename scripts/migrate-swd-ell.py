#!/usr/bin/env python3
"""
Migrate SWD (Special Education) and ELL (English Language Learner) data
from Docker database to Supabase.

This script:
1. Connects to the local Docker PostGIS database
2. Extracts spec_ed_students and ell_students for all districts
3. Updates the Supabase districts table with this data
"""

import psycopg2
from psycopg2.extras import execute_values

# Connection strings
# Docker runs on port 5434 (mapped from container's 5432)
DOCKER_CONN = "postgresql://territory:territory_dev@localhost:5434/territory_plan"

# Supabase direct connection (not pooler, to allow bulk updates)
SUPABASE_CONN = "postgresql://postgres.nroilqjlzvvjekntjngq:!Koozy1234Fullmind!@aws-0-us-west-2.pooler.supabase.com:5432/postgres"


def migrate_swd_ell():
    """Extract SWD/ELL from Docker and update Supabase."""

    # Step 1: Connect to Docker and extract the data
    print("Connecting to Docker database...")
    docker_conn = psycopg2.connect(DOCKER_CONN)
    docker_cur = docker_conn.cursor()

    # Get all districts with SWD or ELL data
    docker_cur.execute("""
        SELECT leaid, spec_ed_students, ell_students
        FROM districts
        WHERE spec_ed_students IS NOT NULL
           OR ell_students IS NOT NULL
    """)

    records = docker_cur.fetchall()
    print(f"Found {len(records)} districts with SWD/ELL data in Docker")

    # Count how many have each type
    swd_count = sum(1 for r in records if r[1] is not None)
    ell_count = sum(1 for r in records if r[2] is not None)
    print(f"  - {swd_count} with SWD data")
    print(f"  - {ell_count} with ELL data")

    docker_cur.close()
    docker_conn.close()

    # Step 2: Connect to Supabase and update
    print("\nConnecting to Supabase...")
    supa_conn = psycopg2.connect(SUPABASE_CONN)
    supa_cur = supa_conn.cursor()

    # Create a temporary table to hold the data for bulk update
    print("Creating temp table for bulk update...")
    supa_cur.execute("""
        CREATE TEMP TABLE swd_ell_import (
            leaid VARCHAR(7) PRIMARY KEY,
            spec_ed_students INTEGER,
            ell_students INTEGER
        )
    """)

    # Insert all records into temp table
    print("Loading data into temp table...")
    insert_sql = """
        INSERT INTO swd_ell_import (leaid, spec_ed_students, ell_students)
        VALUES %s
    """
    execute_values(supa_cur, insert_sql, records, page_size=1000)

    # Update districts from temp table
    print("Updating districts table...")
    supa_cur.execute("""
        UPDATE districts d SET
            spec_ed_students = i.spec_ed_students,
            ell_students = i.ell_students
        FROM swd_ell_import i
        WHERE d.leaid = i.leaid
    """)
    updated = supa_cur.rowcount
    print(f"Updated {updated} districts")

    # Clean up temp table
    supa_cur.execute("DROP TABLE swd_ell_import")

    # Commit the transaction
    supa_conn.commit()
    supa_cur.close()
    supa_conn.close()

    print("\nMigration complete!")
    return updated


if __name__ == "__main__":
    migrate_swd_ell()
