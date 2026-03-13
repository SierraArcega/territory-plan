"""Write opportunity data to Supabase PostgreSQL."""

import os
import logging
from decimal import Decimal
import psycopg2

logger = logging.getLogger(__name__)

STAGE_WEIGHTS = {
    "0": Decimal("0.05"),
    "1": Decimal("0.10"),
    "2": Decimal("0.25"),
    "3": Decimal("0.50"),
    "4": Decimal("0.75"),
    "5": Decimal("0.90"),
}

OPPORTUNITY_COLUMNS = [
    "id", "name", "school_yr", "contract_type", "state",
    "sales_rep_name", "sales_rep_email",
    "district_name", "district_lms_id", "district_nces_id", "district_lea_id",
    "created_at", "close_date", "brand_ambassador", "stage", "net_booking_amount",
    "contract_through", "funding_through", "payment_type", "payment_terms", "lead_source",
    "invoiced", "credited",
    "completed_revenue", "completed_take",
    "scheduled_sessions", "scheduled_revenue", "scheduled_take",
    "total_revenue", "total_take", "average_take_rate",
    "synced_at",
]


def get_connection():
    return psycopg2.connect(os.environ["SUPABASE_DB_URL"])


def upsert_opportunities(conn, records):
    """Upsert opportunity records into the opportunities table."""
    if not records:
        return

    cols = OPPORTUNITY_COLUMNS
    placeholders = ", ".join(["%s"] * len(cols))
    update_cols = [c for c in cols if c != "id"]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = f"""
        INSERT INTO opportunities ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET {update_set}
    """

    with conn.cursor() as cur:
        for record in records:
            values = [record.get(c) for c in cols]
            cur.execute(sql, values)

    conn.commit()
    logger.info(f"Upserted {len(records)} opportunities")


def upsert_unmatched(conn, records):
    """Upsert unmatched opportunity records, preserving manual resolutions."""
    if not records:
        return

    cols = [
        "id", "name", "stage", "school_yr", "account_name", "account_lms_id",
        "account_type", "state", "net_booking_amount", "reason", "synced_at",
    ]
    placeholders = ", ".join(["%s"] * len(cols))
    update_cols = [c for c in cols if c != "id"]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = f"""
        INSERT INTO unmatched_opportunities ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET {update_set}
        WHERE unmatched_opportunities.resolved = false
    """

    with conn.cursor() as cur:
        for record in records:
            values = [record.get(c) for c in cols]
            cur.execute(sql, values)

    conn.commit()
    logger.info(f"Upserted {len(records)} unmatched opportunities")


def update_district_pipeline_aggregates(conn):
    """Recompute pipeline aggregates on districts table from synced opportunities."""

    weight_cases = "\n".join(
        f"WHEN stage LIKE '{prefix} %%' THEN {weight}" for prefix, weight in STAGE_WEIGHTS.items()
    )

    # Step 1: Reset all pipeline fields
    reset_sql = """
        UPDATE districts SET
            fy26_open_pipeline_opp_count = 0,
            fy26_open_pipeline = 0,
            fy26_open_pipeline_weighted = 0,
            fy27_open_pipeline_opp_count = 0,
            fy27_open_pipeline = 0,
            fy27_open_pipeline_weighted = 0,
            has_open_pipeline = false
    """

    # Step 2: Recompute from opportunities
    update_sql = f"""
        WITH pipeline AS (
            SELECT
                district_lea_id,
                school_yr,
                COUNT(*) AS opp_count,
                COALESCE(SUM(net_booking_amount), 0) AS total_pipeline,
                COALESCE(SUM(
                    net_booking_amount * CASE
                        {weight_cases}
                        ELSE 0
                    END
                ), 0) AS weighted_pipeline
            FROM opportunities
            WHERE district_lea_id IS NOT NULL
              AND stage LIKE ANY(ARRAY['0 %%', '1 %%', '2 %%', '3 %%', '4 %%', '5 %%'])
            GROUP BY district_lea_id, school_yr
        )
        UPDATE districts d SET
            fy26_open_pipeline_opp_count = COALESCE(p26.opp_count, 0),
            fy26_open_pipeline = COALESCE(p26.total_pipeline, 0),
            fy26_open_pipeline_weighted = COALESCE(p26.weighted_pipeline, 0),
            fy27_open_pipeline_opp_count = COALESCE(p27.opp_count, 0),
            fy27_open_pipeline = COALESCE(p27.total_pipeline, 0),
            fy27_open_pipeline_weighted = COALESCE(p27.weighted_pipeline, 0),
            has_open_pipeline = (COALESCE(p26.opp_count, 0) + COALESCE(p27.opp_count, 0)) > 0
        FROM (SELECT 1) AS dummy
        LEFT JOIN pipeline p26 ON p26.district_lea_id = d.leaid AND p26.school_yr = '2025-26'
        LEFT JOIN pipeline p27 ON p27.district_lea_id = d.leaid AND p27.school_yr = '2026-27'
    """

    with conn.cursor() as cur:
        cur.execute(reset_sql)
    with conn.cursor() as cur:
        cur.execute(update_sql)
    conn.commit()
    logger.info("Updated district pipeline aggregates")
