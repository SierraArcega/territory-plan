"""Single sync cycle: fetch from OpenSearch, compute, write to Supabase."""

import logging
from collections import defaultdict
from datetime import datetime, timezone

from sync.opensearch_client import get_client
from sync.queries import fetch_opportunities, fetch_sessions, fetch_district_mappings
from sync.compute import build_opportunity_record
from sync.supabase_writer import (
    get_connection,
    upsert_opportunities,
    upsert_unmatched,
    update_district_pipeline_aggregates,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def run_sync():
    """Execute one full sync cycle."""
    now = datetime.now(timezone.utc)
    logger.info(f"=== Starting sync cycle at {now.isoformat()} ===")

    # Phase 1: Fetch opportunities
    os_client = get_client()
    opp_hits = fetch_opportunities(os_client)
    if not opp_hits:
        logger.info("No opportunities found, skipping cycle")
        return

    # Phase 2: Fetch sessions
    opp_ids = [h["_source"]["id"] for h in opp_hits]
    session_hits = fetch_sessions(os_client, opp_ids)

    # Group sessions by opportunity ID
    sessions_by_opp = defaultdict(list)
    for sh in session_hits:
        src = sh["_source"]
        sessions_by_opp[src["opportunityId"]].append(src)

    # Phase 3: District mappings
    account_ids = set()
    for h in opp_hits:
        for acc in (h["_source"].get("accounts") or []):
            if acc.get("id"):
                account_ids.add(acc["id"])
    district_mapping = fetch_district_mappings(os_client, list(account_ids))

    # Check for manual resolutions from unmatched_opportunities
    conn = get_connection()
    try:
        manual_resolutions = _load_manual_resolutions(conn)

        # Phase 4: Compute metrics and build records
        matched_records = []
        unmatched_records = []

        for h in opp_hits:
            opp = h["_source"]
            opp_sessions = sessions_by_opp.get(opp["id"], [])
            record = build_opportunity_record(opp, opp_sessions, district_mapping, now=now)

            # Check if unmatched but manually resolved
            if record["district_lea_id"] is None and opp["id"] in manual_resolutions:
                record["district_lea_id"] = manual_resolutions[opp["id"]]

            if record["district_lea_id"] is not None:
                matched_records.append(record)
            else:
                # Build unmatched record
                accounts = opp.get("accounts") or []
                first_acc = accounts[0] if accounts else {}
                unmatched_records.append({
                    "id": opp["id"],
                    "name": opp.get("name"),
                    "stage": opp.get("stage"),
                    "school_yr": opp.get("school_yr"),
                    "account_name": first_acc.get("name"),
                    "account_lms_id": first_acc.get("id"),
                    "account_type": first_acc.get("type"),
                    "state": opp.get("state"),
                    "net_booking_amount": record["net_booking_amount"],
                    "reason": "No NCES/LEAID mapping found for account",
                    "synced_at": now,
                })
                # Still upsert to opportunities (with null district)
                matched_records.append(record)

        # Phase 5: Write to Supabase
        upsert_opportunities(conn, matched_records)
        if unmatched_records:
            upsert_unmatched(conn, unmatched_records)
        update_district_pipeline_aggregates(conn)

        logger.info(
            f"=== Sync complete: {len(matched_records)} opps, "
            f"{len(unmatched_records)} unmatched ==="
        )
    finally:
        conn.close()


def _load_manual_resolutions(conn):
    """Load manually resolved opportunity -> district mappings."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, resolved_district_leaid FROM unmatched_opportunities "
            "WHERE resolved = true AND resolved_district_leaid IS NOT NULL"
        )
        return {row[0]: row[1] for row in cur.fetchall()}


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    run_sync()
