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
