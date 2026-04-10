"""Write opportunity data to Supabase PostgreSQL."""

import os
import logging
from decimal import Decimal
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import execute_values

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
    "service_types",
    "minimum_purchase_amount", "maximum_budget", "details_link",
    "stage_history", "start_date", "expiration",
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


SESSION_COLUMNS = [
    "id", "opportunity_id", "service_type",
    "session_price", "educator_price", "educator_approved_price",
    "start_time", "type", "status", "service_name", "synced_at",
]


def upsert_sessions(conn, sessions_by_opp):
    """Delete-and-replace sessions for each affected opportunity.

    Uses execute_values for batch inserts (~100x faster than individual INSERTs
    over a remote connection). Runs in a single transaction so a crash either
    leaves old sessions intact or has the complete new set.
    """
    if not sessions_by_opp:
        return

    cols_str = ", ".join(SESSION_COLUMNS)
    update_cols = [c for c in SESSION_COLUMNS if c != "id"]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    insert_sql = f"INSERT INTO sessions ({cols_str}) VALUES %s ON CONFLICT (id) DO UPDATE SET {update_set}"

    total = 0
    with conn.cursor() as cur:
        # Delete all sessions for affected opportunities in one query
        opp_ids = [str(oid) for oid in sessions_by_opp.keys()]
        cur.execute("DELETE FROM sessions WHERE opportunity_id = ANY(%s::text[])", (opp_ids,))

        # Flatten all sessions, deduplicating by id (first column)
        seen_ids = set()
        all_values = []
        for opp_sessions in sessions_by_opp.values():
            for session in opp_sessions:
                sid = session.get("id")
                if sid not in seen_ids:
                    seen_ids.add(sid)
                    all_values.append(tuple(session.get(c) for c in SESSION_COLUMNS))
        total = len(all_values)

        if all_values:
            execute_values(cur, insert_sql, all_values, page_size=1000)

    conn.commit()
    logger.info(f"Upserted {total} sessions across {len(sessions_by_opp)} opportunities")


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


def remove_matched_from_unmatched(conn, matched_ids):
    """Delete unmatched_opportunities rows for opps that now have a district match.

    Removes both unresolved (stale from earlier sync) and resolved (manual
    resolution already applied) records since they no longer need attention.
    """
    if not matched_ids:
        return
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM unmatched_opportunities WHERE id = ANY(%s::text[])",
            ([str(mid) for mid in matched_ids],),
        )
        deleted = cur.rowcount
    conn.commit()
    if deleted:
        logger.info(f"Removed {deleted} now-matched opps from unmatched_opportunities")


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

    # Step 2: Recompute from opportunities using per-FY subqueries
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
        ),
        combined AS (
            SELECT
                d.leaid,
                COALESCE(p26.opp_count, 0) AS fy26_count,
                COALESCE(p26.total_pipeline, 0) AS fy26_pipeline,
                COALESCE(p26.weighted_pipeline, 0) AS fy26_weighted,
                COALESCE(p27.opp_count, 0) AS fy27_count,
                COALESCE(p27.total_pipeline, 0) AS fy27_pipeline,
                COALESCE(p27.weighted_pipeline, 0) AS fy27_weighted
            FROM districts d
            LEFT JOIN pipeline p26 ON p26.district_lea_id = d.leaid AND p26.school_yr = '2025-26'
            LEFT JOIN pipeline p27 ON p27.district_lea_id = d.leaid AND p27.school_yr = '2026-27'
            WHERE p26.district_lea_id IS NOT NULL OR p27.district_lea_id IS NOT NULL
        )
        UPDATE districts SET
            fy26_open_pipeline_opp_count = c.fy26_count,
            fy26_open_pipeline = c.fy26_pipeline,
            fy26_open_pipeline_weighted = c.fy26_weighted,
            fy27_open_pipeline_opp_count = c.fy27_count,
            fy27_open_pipeline = c.fy27_pipeline,
            fy27_open_pipeline_weighted = c.fy27_weighted,
            has_open_pipeline = (c.fy26_count + c.fy27_count) > 0
        FROM combined c
        WHERE districts.leaid = c.leaid
    """

    with conn.cursor() as cur:
        cur.execute(reset_sql)
        cur.execute(update_sql)
    conn.commit()
    logger.info("Updated district pipeline aggregates")


def refresh_map_features(conn):
    """Refresh the materialized view so map tiles reflect updated pipeline data."""
    with conn.cursor() as cur:
        cur.execute("REFRESH MATERIALIZED VIEW district_map_features")
    conn.commit()
    logger.info("Refreshed district_map_features materialized view")


def refresh_fullmind_financials(conn):
    """Refresh Fullmind vendor_financials from opportunities + sessions."""
    logger.info("Refreshing Fullmind vendor_financials...")
    with conn.cursor() as cur:
        cur.execute("SELECT refresh_fullmind_financials()")
    conn.commit()
    logger.info("Refreshed Fullmind vendor_financials")


def refresh_opportunity_actuals(conn):
    """Refresh district_opportunity_actuals materialized view."""
    logger.info("Refreshing district_opportunity_actuals...")
    with conn.cursor() as cur:
        cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY district_opportunity_actuals")
    conn.commit()
    logger.info("Refreshed district_opportunity_actuals")


def get_last_synced_at(conn):
    """Read the last successful sync timestamp. Returns None on first run."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT value FROM sync_state WHERE key = 'last_synced_at'"
        )
        row = cur.fetchone()
        if row:
            return datetime.fromisoformat(row[0])
    return None


def set_last_synced_at(conn, ts):
    """Store the sync timestamp for next incremental run."""
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO sync_state (key, value)
               VALUES ('last_synced_at', %s)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            (ts.isoformat(),),
        )
    conn.commit()
