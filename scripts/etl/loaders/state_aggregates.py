"""
State Aggregates Loader

Seeds state reference data and computes aggregate metrics from district data.
State aggregates are denormalized for fast queries and refreshed after ETL runs.
"""

import json
import os
from pathlib import Path
from typing import Dict


def seed_states(connection_string: str) -> int:
    """
    Seed the states table with reference data (FIPS codes, abbreviations, names).

    Uses INSERT ... ON CONFLICT to safely run multiple times without duplicates.

    Args:
        connection_string: PostgreSQL connection string

    Returns:
        Number of states inserted/updated
    """
    import psycopg2

    # Load seed data from JSON file (stored alongside this loader)
    seed_file = Path(__file__).parent / "states_seed.json"
    with open(seed_file, "r") as f:
        states = json.load(f)

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Insert states, updating name if already exists (in case of corrections)
    insert_sql = """
        INSERT INTO states (fips, abbrev, name, created_at, updated_at)
        VALUES (%s, %s, %s, NOW(), NOW())
        ON CONFLICT (fips) DO UPDATE SET
            abbrev = EXCLUDED.abbrev,
            name = EXCLUDED.name,
            updated_at = NOW()
    """

    count = 0
    for state in states:
        cur.execute(insert_sql, (state["fips"], state["abbrev"], state["name"]))
        count += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"Seeded {count} states")
    return count


def refresh_state_aggregates(connection_string: str) -> int:
    """
    Refresh denormalized aggregate metrics on the states table from district data.

    Computes:
    - Total districts, enrollment, schools per state
    - Customer and pipeline counts/values
    - Education averages (expenditure, graduation rate, poverty rate)

    Education averages are weighted by enrollment where appropriate.

    Args:
        connection_string: PostgreSQL connection string

    Returns:
        Number of states updated
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Compute aggregates from districts and update states table
    # Uses weighted averages for education metrics (weighted by enrollment)
    update_sql = """
        UPDATE states s SET
            total_districts = COALESCE(agg.total_districts, 0),
            total_enrollment = agg.total_enrollment,
            total_schools = agg.total_schools,
            total_customers = COALESCE(agg.total_customers, 0),
            total_with_pipeline = COALESCE(agg.total_with_pipeline, 0),
            total_pipeline_value = agg.total_pipeline_value,
            avg_expenditure_per_pupil = agg.avg_expenditure_per_pupil,
            avg_graduation_rate = agg.avg_graduation_rate,
            avg_poverty_rate = agg.avg_poverty_rate,
            aggregates_updated_at = NOW(),
            updated_at = NOW()
        FROM (
            SELECT
                state_fips,
                COUNT(*) as total_districts,
                SUM(enrollment) as total_enrollment,
                SUM(number_of_schools) as total_schools,
                COUNT(*) FILTER (WHERE is_customer = true) as total_customers,
                COUNT(*) FILTER (WHERE has_open_pipeline = true) as total_with_pipeline,
                SUM(fy26_open_pipeline) as total_pipeline_value,
                -- Weighted average: sum(value * weight) / sum(weight)
                -- Only include districts with both the metric and enrollment data
                CASE
                    WHEN SUM(CASE WHEN expenditure_per_pupil IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN SUM(expenditure_per_pupil * enrollment) /
                         SUM(CASE WHEN expenditure_per_pupil IS NOT NULL THEN enrollment ELSE 0 END)
                    ELSE NULL
                END as avg_expenditure_per_pupil,
                CASE
                    WHEN SUM(CASE WHEN graduation_rate_total IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN SUM(graduation_rate_total * enrollment) /
                         SUM(CASE WHEN graduation_rate_total IS NOT NULL THEN enrollment ELSE 0 END)
                    ELSE NULL
                END as avg_graduation_rate,
                -- Poverty rate: simple average (already a percentage)
                AVG(children_poverty_percent) as avg_poverty_rate
            FROM districts
            WHERE state_fips IS NOT NULL
            GROUP BY state_fips
        ) agg
        WHERE s.fips = agg.state_fips
    """

    cur.execute(update_sql)
    updated_count = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    print(f"Refreshed aggregates for {updated_count} states")
    return updated_count


def compute_staffing_ratios(connection_string: str) -> int:
    """
    Compute staffing ratios from enrollment and FTE data on the districts table.

    Computes:
    - student_teacher_ratio = enrollment / teachers_fte
    - student_staff_ratio = enrollment / staff_total_fte
    - sped_student_teacher_ratio = spec_ed_students / teachers_fte

    Args:
        connection_string: PostgreSQL connection string

    Returns:
        Number of districts updated
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    cur.execute("""
        UPDATE districts SET
            student_teacher_ratio = CASE
                WHEN enrollment IS NOT NULL AND teachers_fte IS NOT NULL AND teachers_fte > 0
                THEN ROUND(enrollment::numeric / teachers_fte, 2)
                ELSE NULL
            END,
            student_staff_ratio = CASE
                WHEN enrollment IS NOT NULL AND staff_total_fte IS NOT NULL AND staff_total_fte > 0
                THEN ROUND(enrollment::numeric / staff_total_fte, 2)
                ELSE NULL
            END,
            sped_student_teacher_ratio = CASE
                WHEN spec_ed_students IS NOT NULL AND teachers_fte IS NOT NULL AND teachers_fte > 0
                THEN ROUND(spec_ed_students::numeric / teachers_fte, 2)
                ELSE NULL
            END
        WHERE enrollment IS NOT NULL
          AND (teachers_fte IS NOT NULL OR staff_total_fte IS NOT NULL)
    """)
    updated_count = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    print(f"Computed staffing ratios for {updated_count} districts")
    return updated_count


def get_state_summary(connection_string: str) -> Dict:
    """
    Get summary statistics for states table.

    Returns:
        Dict with state statistics
    """
    import psycopg2

    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Total states
    cur.execute("SELECT COUNT(*) FROM states")
    total_states = cur.fetchone()[0]

    # States with aggregates
    cur.execute("SELECT COUNT(*) FROM states WHERE aggregates_updated_at IS NOT NULL")
    states_with_aggregates = cur.fetchone()[0]

    # States with territory owner
    cur.execute("SELECT COUNT(*) FROM states WHERE territory_owner IS NOT NULL")
    states_with_owner = cur.fetchone()[0]

    # Top states by enrollment
    cur.execute("""
        SELECT abbrev, total_enrollment, total_customers, total_pipeline_value
        FROM states
        WHERE total_enrollment IS NOT NULL
        ORDER BY total_enrollment DESC
        LIMIT 10
    """)
    top_states = cur.fetchall()

    cur.close()
    conn.close()

    return {
        "total_states": total_states,
        "states_with_aggregates": states_with_aggregates,
        "states_with_owner": states_with_owner,
        "top_states_by_enrollment": [
            {
                "abbrev": row[0],
                "enrollment": row[1],
                "customers": row[2],
                "pipeline": float(row[3]) if row[3] else 0
            }
            for row in top_states
        ]
    }


def main():
    """CLI entry point for testing."""
    import argparse
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="Manage state aggregates")
    parser.add_argument("--seed", action="store_true", help="Seed states table")
    parser.add_argument("--refresh", action="store_true", help="Refresh aggregates")
    parser.add_argument("--ratios", action="store_true", help="Compute staffing ratios")
    parser.add_argument("--summary", action="store_true", help="Print summary")

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

    if args.seed:
        seed_states(connection_string)

    if args.refresh:
        refresh_state_aggregates(connection_string)

    if args.ratios:
        compute_staffing_ratios(connection_string)

    if args.summary:
        summary = get_state_summary(connection_string)
        print("\nState Summary:")
        print(f"  Total states: {summary['total_states']}")
        print(f"  With aggregates: {summary['states_with_aggregates']}")
        print(f"  With territory owner: {summary['states_with_owner']}")
        print("\nTop 10 states by enrollment:")
        for state in summary["top_states_by_enrollment"]:
            print(f"  {state['abbrev']}: {state['enrollment']:,} students, "
                  f"{state['customers']} customers, ${state['pipeline']:,.0f} pipeline")


if __name__ == "__main__":
    main()
