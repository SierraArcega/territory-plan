"""
State Assessments Seed Loader

Seeds the state_assessments table with reference data about state testing programs.
Run manually or as part of ETL setup. Safe to re-run (uses upsert).

Usage:
    python3 scripts/etl/loaders/seed_state_assessments.py
"""

import json
import os
from pathlib import Path


def _load_fips_lookup() -> dict:
    """Build abbreviation-to-FIPS lookup from existing states_seed.json."""
    seed_file = Path(__file__).parent / "states_seed.json"
    with open(seed_file, "r") as f:
        states = json.load(f)
    return {s["abbrev"]: s["fips"] for s in states}


def seed_state_assessments(connection_string: str) -> int:
    """
    Seed the state_assessments table from JSON file.

    Uses INSERT ... ON CONFLICT (state_fips, name) DO UPDATE for idempotency.

    Args:
        connection_string: PostgreSQL connection string

    Returns:
        Number of assessments inserted/updated
    """
    import psycopg2

    fips_lookup = _load_fips_lookup()

    seed_file = Path(__file__).parent / "state_assessments_seed.json"
    with open(seed_file, "r") as f:
        assessments = json.load(f)

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    upsert_sql = """
        INSERT INTO state_assessments (state_fips, name, subjects, grades, testing_window, vendor, notes, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (state_fips, name) DO UPDATE SET
            subjects = EXCLUDED.subjects,
            grades = EXCLUDED.grades,
            testing_window = EXCLUDED.testing_window,
            vendor = EXCLUDED.vendor,
            notes = EXCLUDED.notes,
            updated_at = NOW()
    """

    count = 0
    skipped = 0
    for a in assessments:
        state_abbrev = a["state"]
        fips = fips_lookup.get(state_abbrev)
        if not fips:
            print(f"  WARNING: Unknown state abbreviation '{state_abbrev}', skipping")
            skipped += 1
            continue

        cur.execute(upsert_sql, (
            fips,
            a["name"],
            a["subjects"],
            a["grades"],
            a["testing_window"],
            a.get("vendor"),
            a.get("notes"),
        ))
        count += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"Seeded {count} state assessments ({skipped} skipped)")
    return count


def main():
    """CLI entry point."""
    from dotenv import load_dotenv
    load_dotenv()

    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DATABASE_URL or DIRECT_URL not set")

    # Strip Supabase-specific params
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    seed_state_assessments(connection_string)


if __name__ == "__main__":
    main()
