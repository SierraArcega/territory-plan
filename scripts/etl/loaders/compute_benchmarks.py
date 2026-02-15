"""
District Benchmarks & Trends Computation

Computes derived metrics on the districts and states tables:
1. State & national averages (enrollment-weighted)
2. District percentages and 3-year trends
3. Comparison deltas (vs state, vs national) and quartile flags

Runs after all data loaders and historical backfill.
No API calls — pure SQL against local data.

Usage:
    python3 compute_benchmarks.py                # all steps
    python3 compute_benchmarks.py --averages     # state/national averages only
    python3 compute_benchmarks.py --trends       # district trends only
    python3 compute_benchmarks.py --deltas       # deltas and quartiles only
"""

import os
import argparse
from typing import Dict

import psycopg2


def compute_state_averages(connection_string: str) -> int:
    """
    Compute enrollment-weighted state averages and update the states table.

    Also computes national averages and stores them in the US row (fips='00').

    Metrics computed:
    - avg_chronic_absenteeism_rate
    - avg_student_teacher_ratio
    - avg_swd_pct (spec_ed_students / enrollment * 100)
    - avg_ell_pct (ell_students / enrollment * 100)
    - avg_enrollment
    - avg_math_proficiency
    - avg_read_proficiency
    (avg_expenditure_per_pupil and avg_graduation_rate already computed by state_aggregates.py)

    Returns:
        Number of states updated (including US row)
    """
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Update per-state averages
    # Uses enrollment-weighted averages for rates, simple averages for counts
    cur.execute("""
        UPDATE states s SET
            avg_chronic_absenteeism_rate = agg.avg_absenteeism,
            avg_student_teacher_ratio = agg.avg_str,
            avg_swd_pct = agg.avg_swd,
            avg_ell_pct = agg.avg_ell,
            avg_enrollment = agg.avg_enroll,
            avg_math_proficiency = agg.avg_math,
            avg_read_proficiency = agg.avg_read,
            aggregates_updated_at = NOW(),
            updated_at = NOW()
        FROM (
            SELECT
                state_fips,
                -- Enrollment-weighted absenteeism rate
                CASE
                    WHEN SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(chronic_absenteeism_rate * enrollment) /
                         SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_absenteeism,
                -- Enrollment-weighted student-teacher ratio
                CASE
                    WHEN SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(student_teacher_ratio * enrollment) /
                         SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_str,
                -- SWD percentage: total spec_ed / total enrollment * 100
                CASE
                    WHEN SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(spec_ed_students)::numeric /
                         SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_swd,
                -- ELL percentage: total ell / total enrollment * 100
                CASE
                    WHEN SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(ell_students)::numeric /
                         SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_ell,
                -- Simple average enrollment
                ROUND(AVG(enrollment)) AS avg_enroll,
                -- Enrollment-weighted math proficiency
                CASE
                    WHEN SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(math_proficiency_pct * enrollment) /
                         SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_math,
                -- Enrollment-weighted reading proficiency
                CASE
                    WHEN SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(read_proficiency_pct * enrollment) /
                         SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_read
            FROM districts
            WHERE state_fips IS NOT NULL AND enrollment IS NOT NULL AND enrollment > 0
            GROUP BY state_fips
        ) agg
        WHERE s.fips = agg.state_fips
    """)
    state_count = cur.rowcount
    print(f"Updated averages for {state_count} states")

    # Compute national averages into the US row (fips='00')
    cur.execute("""
        UPDATE states SET
            avg_chronic_absenteeism_rate = nat.avg_absenteeism,
            avg_student_teacher_ratio = nat.avg_str,
            avg_swd_pct = nat.avg_swd,
            avg_ell_pct = nat.avg_ell,
            avg_enrollment = nat.avg_enroll,
            avg_math_proficiency = nat.avg_math,
            avg_read_proficiency = nat.avg_read,
            avg_expenditure_per_pupil = nat.avg_epp,
            avg_graduation_rate = nat.avg_grad,
            avg_poverty_rate = nat.avg_poverty,
            total_districts = nat.total_dist,
            total_enrollment = nat.total_enroll,
            aggregates_updated_at = NOW(),
            updated_at = NOW()
        FROM (
            SELECT
                CASE
                    WHEN SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(chronic_absenteeism_rate * enrollment) /
                         SUM(CASE WHEN chronic_absenteeism_rate IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_absenteeism,
                CASE
                    WHEN SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(student_teacher_ratio * enrollment) /
                         SUM(CASE WHEN student_teacher_ratio IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_str,
                CASE
                    WHEN SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(spec_ed_students)::numeric /
                         SUM(CASE WHEN spec_ed_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_swd,
                CASE
                    WHEN SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(ell_students)::numeric /
                         SUM(CASE WHEN ell_students IS NOT NULL THEN enrollment ELSE 0 END) * 100)::numeric, 2)
                    ELSE NULL
                END AS avg_ell,
                ROUND(AVG(enrollment)) AS avg_enroll,
                CASE
                    WHEN SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(math_proficiency_pct * enrollment) /
                         SUM(CASE WHEN math_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_math,
                CASE
                    WHEN SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(read_proficiency_pct * enrollment) /
                         SUM(CASE WHEN read_proficiency_pct IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_read,
                CASE
                    WHEN SUM(CASE WHEN expenditure_per_pupil IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(expenditure_per_pupil * enrollment) /
                         SUM(CASE WHEN expenditure_per_pupil IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_epp,
                CASE
                    WHEN SUM(CASE WHEN graduation_rate_total IS NOT NULL THEN enrollment ELSE 0 END) > 0
                    THEN ROUND((SUM(graduation_rate_total * enrollment) /
                         SUM(CASE WHEN graduation_rate_total IS NOT NULL THEN enrollment ELSE 0 END))::numeric, 2)
                    ELSE NULL
                END AS avg_grad,
                ROUND(AVG(children_poverty_percent)::numeric, 2) AS avg_poverty,
                COUNT(*) AS total_dist,
                SUM(enrollment) AS total_enroll
            FROM districts
            WHERE enrollment IS NOT NULL AND enrollment > 0
        ) nat
        WHERE fips = '00'
    """)
    us_updated = cur.rowcount
    print(f"Updated US national averages: {us_updated} row")

    conn.commit()
    cur.close()
    conn.close()

    return state_count + us_updated


def compute_district_trends(connection_string: str) -> int:
    """
    Compute derived percentages and 3-year trends on the districts table.

    Derived percentages:
    - swd_pct = spec_ed_students / enrollment * 100
    - ell_pct = ell_students / enrollment * 100

    3-year trends (from district_data_history):
    - swd_trend_3yr: % change in spec_ed_students count
    - ell_trend_3yr: % change in ell_students count
    - absenteeism_trend_3yr: point change in chronic_absenteeism_rate
    - graduation_trend_3yr: point change in graduation_rate
    - student_teacher_ratio_trend_3yr: point change in student-teacher ratio
    - math_proficiency_trend_3yr: point change in math_proficiency
    - read_proficiency_trend_3yr: point change in read_proficiency
    - expenditure_pp_trend_3yr: % change in expenditure_pp

    Returns:
        Number of districts updated
    """
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Step 1: Compute derived percentages from current district data
    cur.execute("""
        UPDATE districts SET
            swd_pct = CASE
                WHEN spec_ed_students IS NOT NULL AND enrollment IS NOT NULL AND enrollment > 0
                THEN ROUND((spec_ed_students::numeric / enrollment * 100), 2)
                ELSE NULL
            END,
            ell_pct = CASE
                WHEN ell_students IS NOT NULL AND enrollment IS NOT NULL AND enrollment > 0
                THEN ROUND((ell_students::numeric / enrollment * 100), 2)
                ELSE NULL
            END
        WHERE enrollment IS NOT NULL AND enrollment > 0
    """)
    pct_count = cur.rowcount
    print(f"Computed swd_pct/ell_pct for {pct_count} districts")

    # Step 2: Find year range for trends from ccd_directory history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'ccd_directory'
    """)
    row = cur.fetchone()
    if not row or row[0] is None:
        print("No CCD directory history found. Skipping trends.")
        conn.commit()
        cur.close()
        conn.close()
        return pct_count

    min_year, max_year = row
    base_year = max(min_year, max_year - 3)
    print(f"Computing trends: {base_year} → {max_year}")

    # Step 3: Compute SWD and ELL trends (% change in count)
    cur.execute("""
        WITH base AS (
            SELECT leaid, spec_ed_students, ell_students,
                   enrollment, teachers_fte
            FROM district_data_history
            WHERE source = 'ccd_directory' AND year = %s
        ),
        latest AS (
            SELECT leaid, spec_ed_students, ell_students,
                   enrollment, teachers_fte
            FROM district_data_history
            WHERE source = 'ccd_directory' AND year = %s
        ),
        trends AS (
            SELECT
                l.leaid,
                -- SWD trend: % change in count
                CASE
                    WHEN b.spec_ed_students IS NOT NULL AND b.spec_ed_students > 0
                         AND l.spec_ed_students IS NOT NULL
                    THEN ROUND(((l.spec_ed_students - b.spec_ed_students)::numeric
                         / b.spec_ed_students) * 100, 2)
                    ELSE NULL
                END AS swd_trend,
                -- ELL trend: % change in count
                CASE
                    WHEN b.ell_students IS NOT NULL AND b.ell_students > 0
                         AND l.ell_students IS NOT NULL
                    THEN ROUND(((l.ell_students - b.ell_students)::numeric
                         / b.ell_students) * 100, 2)
                    ELSE NULL
                END AS ell_trend,
                -- Student-teacher ratio trend: point change
                CASE
                    WHEN b.enrollment IS NOT NULL AND b.teachers_fte IS NOT NULL
                         AND b.teachers_fte > 0
                         AND l.enrollment IS NOT NULL AND l.teachers_fte IS NOT NULL
                         AND l.teachers_fte > 0
                    THEN ROUND((l.enrollment::numeric / l.teachers_fte)
                         - (b.enrollment::numeric / b.teachers_fte), 2)
                    ELSE NULL
                END AS str_trend
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
        )
        UPDATE districts d SET
            swd_trend_3yr = t.swd_trend,
            ell_trend_3yr = t.ell_trend,
            student_teacher_ratio_trend_3yr = t.str_trend
        FROM trends t
        WHERE d.leaid = t.leaid
    """, (base_year, max_year))
    swd_ell_count = cur.rowcount
    print(f"Computed SWD/ELL/STR trends for {swd_ell_count} districts")

    # Step 4: Graduation trend (point change) from edfacts_grad history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'edfacts_grad' AND graduation_rate IS NOT NULL
    """)
    grad_row = cur.fetchone()
    if grad_row and grad_row[0] is not None:
        grad_base = max(grad_row[0], grad_row[1] - 3)
        cur.execute("""
            WITH base AS (
                SELECT leaid, graduation_rate FROM district_data_history
                WHERE source = 'edfacts_grad' AND year = %s
            ),
            latest AS (
                SELECT leaid, graduation_rate FROM district_data_history
                WHERE source = 'edfacts_grad' AND year = %s
            )
            UPDATE districts d SET
                graduation_trend_3yr = ROUND((l.graduation_rate - b.graduation_rate)::numeric, 2)
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
            WHERE d.leaid = l.leaid
              AND l.graduation_rate IS NOT NULL
              AND b.graduation_rate IS NOT NULL
        """, (grad_base, grad_row[1]))
        print(f"Computed graduation trends for {cur.rowcount} districts")

    # Step 5: Assessment trends (point change) from edfacts_assess history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'edfacts_assess' AND (math_proficiency IS NOT NULL OR read_proficiency IS NOT NULL)
    """)
    assess_row = cur.fetchone()
    if assess_row and assess_row[0] is not None:
        assess_base = max(assess_row[0], assess_row[1] - 3)
        cur.execute("""
            WITH base AS (
                SELECT leaid, math_proficiency, read_proficiency FROM district_data_history
                WHERE source = 'edfacts_assess' AND year = %s
            ),
            latest AS (
                SELECT leaid, math_proficiency, read_proficiency FROM district_data_history
                WHERE source = 'edfacts_assess' AND year = %s
            )
            UPDATE districts d SET
                math_proficiency_trend_3yr = CASE
                    WHEN l.math_proficiency IS NOT NULL AND b.math_proficiency IS NOT NULL
                    THEN ROUND((l.math_proficiency - b.math_proficiency)::numeric, 2)
                    ELSE NULL
                END,
                read_proficiency_trend_3yr = CASE
                    WHEN l.read_proficiency IS NOT NULL AND b.read_proficiency IS NOT NULL
                    THEN ROUND((l.read_proficiency - b.read_proficiency)::numeric, 2)
                    ELSE NULL
                END
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
            WHERE d.leaid = l.leaid
        """, (assess_base, assess_row[1]))
        print(f"Computed assessment trends for {cur.rowcount} districts")

    # Step 6: Expenditure per pupil trend (% change) from ccd_finance history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'ccd_finance' AND expenditure_pp IS NOT NULL
    """)
    fin_row = cur.fetchone()
    if fin_row and fin_row[0] is not None:
        fin_base = max(fin_row[0], fin_row[1] - 3)
        cur.execute("""
            WITH base AS (
                SELECT leaid, expenditure_pp FROM district_data_history
                WHERE source = 'ccd_finance' AND year = %s
            ),
            latest AS (
                SELECT leaid, expenditure_pp FROM district_data_history
                WHERE source = 'ccd_finance' AND year = %s
            )
            UPDATE districts d SET
                expenditure_pp_trend_3yr = CASE
                    WHEN b.expenditure_pp IS NOT NULL AND b.expenditure_pp > 0
                         AND l.expenditure_pp IS NOT NULL
                    THEN ROUND(((l.expenditure_pp - b.expenditure_pp) / b.expenditure_pp * 100)::numeric, 2)
                    ELSE NULL
                END
            FROM latest l
            JOIN base b ON l.leaid = b.leaid
            WHERE d.leaid = l.leaid
        """, (fin_base, fin_row[1]))
        print(f"Computed expenditure trends for {cur.rowcount} districts")

    # Step 7: Absenteeism trend (point change) from crdc_absenteeism history
    cur.execute("""
        SELECT MIN(year), MAX(year) FROM district_data_history
        WHERE source = 'crdc_absenteeism' AND chronic_absenteeism_rate IS NOT NULL
    """)
    abs_row = cur.fetchone()
    if abs_row and abs_row[0] is not None and abs_row[0] != abs_row[1]:
        # Use two most recent available years (biennial data)
        cur.execute("""
            SELECT DISTINCT year FROM district_data_history
            WHERE source = 'crdc_absenteeism' AND chronic_absenteeism_rate IS NOT NULL
            ORDER BY year DESC LIMIT 2
        """)
        abs_years = [r[0] for r in cur.fetchall()]
        if len(abs_years) == 2:
            cur.execute("""
                WITH base AS (
                    SELECT leaid, chronic_absenteeism_rate FROM district_data_history
                    WHERE source = 'crdc_absenteeism' AND year = %s
                ),
                latest AS (
                    SELECT leaid, chronic_absenteeism_rate FROM district_data_history
                    WHERE source = 'crdc_absenteeism' AND year = %s
                )
                UPDATE districts d SET
                    absenteeism_trend_3yr = ROUND(
                        (l.chronic_absenteeism_rate - b.chronic_absenteeism_rate)::numeric, 2
                    )
                FROM latest l
                JOIN base b ON l.leaid = b.leaid
                WHERE d.leaid = l.leaid
                  AND l.chronic_absenteeism_rate IS NOT NULL
                  AND b.chronic_absenteeism_rate IS NOT NULL
            """, (abs_years[1], abs_years[0]))  # [1]=older, [0]=newer
            print(f"Computed absenteeism trends for {cur.rowcount} districts ({abs_years[1]}→{abs_years[0]})")

    conn.commit()
    cur.close()
    conn.close()
    return pct_count


def compute_deltas_and_quartiles(connection_string: str) -> int:
    """
    Compute comparison deltas (vs state, vs national) and quartile flags.

    Deltas: district value minus benchmark average (positive = above avg)

    Quartile flags (within state):
    - well_above: top 25% (Q4)
    - above: 25-50% (Q3)
    - below: 50-75% (Q2)
    - well_below: bottom 25% (Q1)

    Returns:
        Number of districts updated
    """
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()

    # Step 1: Compute state deltas
    cur.execute("""
        UPDATE districts d SET
            absenteeism_vs_state = ROUND((d.chronic_absenteeism_rate - s.avg_chronic_absenteeism_rate)::numeric, 2),
            graduation_vs_state = ROUND((d.graduation_rate_total - s.avg_graduation_rate)::numeric, 2),
            student_teacher_ratio_vs_state = ROUND((d.student_teacher_ratio - s.avg_student_teacher_ratio)::numeric, 2),
            swd_pct_vs_state = ROUND((d.swd_pct - s.avg_swd_pct)::numeric, 2),
            ell_pct_vs_state = ROUND((d.ell_pct - s.avg_ell_pct)::numeric, 2),
            math_proficiency_vs_state = ROUND((d.math_proficiency_pct - s.avg_math_proficiency)::numeric, 2),
            read_proficiency_vs_state = ROUND((d.read_proficiency_pct - s.avg_read_proficiency)::numeric, 2),
            expenditure_pp_vs_state = ROUND((d.expenditure_per_pupil - s.avg_expenditure_per_pupil)::numeric, 2)
        FROM states s
        WHERE d.state_fips = s.fips
          AND s.fips != '00'
    """)
    state_delta_count = cur.rowcount
    print(f"Computed state deltas for {state_delta_count} districts")

    # Step 2: Compute national deltas (vs US row)
    cur.execute("""
        UPDATE districts d SET
            absenteeism_vs_national = ROUND((d.chronic_absenteeism_rate - us.avg_chronic_absenteeism_rate)::numeric, 2),
            graduation_vs_national = ROUND((d.graduation_rate_total - us.avg_graduation_rate)::numeric, 2),
            student_teacher_ratio_vs_national = ROUND((d.student_teacher_ratio - us.avg_student_teacher_ratio)::numeric, 2),
            swd_pct_vs_national = ROUND((d.swd_pct - us.avg_swd_pct)::numeric, 2),
            ell_pct_vs_national = ROUND((d.ell_pct - us.avg_ell_pct)::numeric, 2),
            math_proficiency_vs_national = ROUND((d.math_proficiency_pct - us.avg_math_proficiency)::numeric, 2),
            read_proficiency_vs_national = ROUND((d.read_proficiency_pct - us.avg_read_proficiency)::numeric, 2),
            expenditure_pp_vs_national = ROUND((d.expenditure_per_pupil - us.avg_expenditure_per_pupil)::numeric, 2)
        FROM states us
        WHERE us.fips = '00'
    """)
    national_delta_count = cur.rowcount
    print(f"Computed national deltas for {national_delta_count} districts")

    # Step 3: Compute within-state quartile flags
    # Uses NTILE(4) to divide districts into 4 equal groups within each state
    # For each metric, assigns: well_above (Q4), above (Q3), below (Q2), well_below (Q1)
    METRICS = [
        # (metric_column, quartile_column, higher_is_better)
        ("chronic_absenteeism_rate", "absenteeism_quartile_state", False),
        ("graduation_rate_total", "graduation_quartile_state", True),
        ("student_teacher_ratio", "student_teacher_ratio_quartile_state", False),
        ("swd_pct", "swd_pct_quartile_state", False),  # Higher SWD% = more need, labeled "above"
        ("ell_pct", "ell_pct_quartile_state", False),   # Same logic
        ("math_proficiency_pct", "math_proficiency_quartile_state", True),
        ("read_proficiency_pct", "read_proficiency_quartile_state", True),
        ("expenditure_per_pupil", "expenditure_pp_quartile_state", False),  # Higher spend labeled "above"
    ]

    for metric_col, quartile_col, higher_is_better in METRICS:
        # NTILE(4) assigns 1 to lowest group, 4 to highest
        # For higher_is_better metrics: Q4=well_above, Q1=well_below
        # For lower_is_better metrics: Q4=well_above (high value), Q1=well_below (low value)
        # This way "well_above" always means "notably high" regardless of metric direction
        cur.execute(f"""
            WITH ranked AS (
                SELECT leaid,
                    NTILE(4) OVER (
                        PARTITION BY state_fips
                        ORDER BY {metric_col} ASC NULLS LAST
                    ) AS quartile
                FROM districts
                WHERE {metric_col} IS NOT NULL
                  AND state_fips IS NOT NULL
            )
            UPDATE districts d SET
                {quartile_col} = CASE r.quartile
                    WHEN 4 THEN 'well_above'
                    WHEN 3 THEN 'above'
                    WHEN 2 THEN 'below'
                    WHEN 1 THEN 'well_below'
                END
            FROM ranked r
            WHERE d.leaid = r.leaid
        """)
        print(f"  {quartile_col}: {cur.rowcount} districts ranked")

    conn.commit()
    cur.close()
    conn.close()
    return state_delta_count


def compute_all_benchmarks(connection_string: str) -> Dict:
    """
    Run all benchmark computation steps in order.

    Returns:
        Summary dict with counts from each step
    """
    print("\n" + "=" * 60)
    print("Computing District Benchmarks & Trends")
    print("=" * 60)

    print("\n--- Step 1: State & National Averages ---")
    avg_count = compute_state_averages(connection_string)

    print("\n--- Step 2: District Trends ---")
    trend_count = compute_district_trends(connection_string)

    print("\n--- Step 3: Deltas & Quartiles ---")
    delta_count = compute_deltas_and_quartiles(connection_string)

    # Log to data_refresh_logs
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO data_refresh_logs (
            data_source, records_updated, records_failed,
            status, started_at, completed_at
        ) VALUES ('compute_benchmarks', %s, 0, 'success', NOW(), NOW())
    """, (trend_count + delta_count,))
    conn.commit()
    cur.close()
    conn.close()

    return {
        "state_averages": avg_count,
        "district_trends": trend_count,
        "deltas_and_quartiles": delta_count,
    }


def main():
    """CLI entry point."""
    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description="Compute district benchmarks & trends")
    parser.add_argument("--averages", action="store_true", help="Compute state/national averages only")
    parser.add_argument("--trends", action="store_true", help="Compute district trends only")
    parser.add_argument("--deltas", action="store_true", help="Compute deltas and quartiles only")
    parser.add_argument("--all", action="store_true", help="Run all steps (default if no flags)")
    args = parser.parse_args()

    connection_string = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not connection_string:
        raise ValueError("DIRECT_URL or DATABASE_URL not set")

    # Strip Supabase-specific params
    if "?" in connection_string:
        base_url = connection_string.split("?")[0]
        params = connection_string.split("?")[1]
        valid_params = [p for p in params.split("&") if p and not p.startswith("pgbouncer")]
        connection_string = base_url + ("?" + "&".join(valid_params) if valid_params else "")

    run_all = args.all or not (args.averages or args.trends or args.deltas)

    if run_all:
        result = compute_all_benchmarks(connection_string)
        print(f"\nBenchmark computation complete: {result}")
    else:
        if args.averages:
            compute_state_averages(connection_string)
        if args.trends:
            compute_district_trends(connection_string)
        if args.deltas:
            compute_deltas_and_quartiles(connection_string)


if __name__ == "__main__":
    main()
