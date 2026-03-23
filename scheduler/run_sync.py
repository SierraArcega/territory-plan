"""Single sync cycle: fetch from OpenSearch, compute, write to Supabase."""

import logging
from collections import defaultdict
from datetime import datetime, timezone

from sync.opensearch_client import get_client
from sync.queries import (
    fetch_opportunities,
    fetch_opportunities_by_ids,
    fetch_changed_sessions,
    fetch_sessions,
    fetch_district_mappings,
)
from sync.compute import build_opportunity_record, _to_decimal
from sync.normalize import normalize_state
from sync.supabase_writer import (
    get_connection,
    upsert_opportunities,
    upsert_sessions,
    upsert_unmatched,
    remove_matched_from_unmatched,
    update_district_pipeline_aggregates,
    refresh_map_features,
    get_last_synced_at,
    set_last_synced_at,
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

    # Check for incremental sync
    conn = get_connection()
    last_synced = get_last_synced_at(conn)
    if last_synced:
        logger.info(f"Incremental sync from {last_synced.isoformat()}")
    else:
        logger.info("Full sync (first run)")

    # Phase 1: Fetch opportunities
    os_client = get_client()
    opp_hits = fetch_opportunities(os_client, since=last_synced)
    if not opp_hits:
        logger.info("No new/updated opportunities, skipping cycle")
        set_last_synced_at(conn, now)
        conn.close()
        return {"status": "success", "opps_synced": 0, "sessions_stored": 0, "unmatched_count": None, "error": None}

    # Phase 2a: Find opps with changed sessions (session changed but opp didn't)
    opp_ids = set(h["_source"]["id"] for h in opp_hits)
    if last_synced:
        changed_session_hits = fetch_changed_sessions(os_client, last_synced)
        extra_opp_ids = set()
        for sh in changed_session_hits:
            oid = sh["_source"].get("opportunityId")
            if not oid:
                continue
            if oid not in opp_ids:
                extra_opp_ids.add(oid)
        if extra_opp_ids:
            logger.info(f"Found {len(extra_opp_ids)} additional opps via changed sessions")
            extra_opp_hits = fetch_opportunities_by_ids(os_client, list(extra_opp_ids))
            opp_hits.extend(extra_opp_hits)
            opp_ids.update(extra_opp_ids)

    # Phase 2b: Fetch ALL sessions for affected opps (need full set for accurate metrics)
    session_hits = fetch_sessions(os_client, list(opp_ids))

    # Group sessions by opportunity ID (preserve _id for storage)
    sessions_by_opp = defaultdict(list)
    for sh in session_hits:
        src = sh["_source"]
        src["_id"] = sh["_id"]
        sessions_by_opp[src["opportunityId"]].append(src)

    # Phase 3: District mappings
    account_ids = set()
    for h in opp_hits:
        for acc in (h["_source"].get("accounts") or []):
            if acc.get("id"):
                account_ids.add(acc["id"])
    district_mapping = fetch_district_mappings(os_client, list(account_ids))

    try:
        # Check for manual resolutions from unmatched_opportunities
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
                    "state": normalize_state(opp.get("state")),
                    "net_booking_amount": record["net_booking_amount"],
                    "reason": "Needs Review",
                    "synced_at": now,
                })
                # Still upsert to opportunities (with null district)
                matched_records.append(record)

        # Phase 5: Write to Supabase
        upsert_opportunities(conn, matched_records)
        if unmatched_records:
            upsert_unmatched(conn, unmatched_records)

        # Build session records for storage
        session_records_by_opp = {}
        for opp_id, opp_sessions in sessions_by_opp.items():
            session_records_by_opp[opp_id] = [
                {
                    "id": s["_id"],
                    "opportunity_id": s["opportunityId"],
                    "service_type": s.get("serviceType"),
                    "session_price": _to_decimal(s.get("sessionPrice")),
                    "educator_price": _to_decimal(s.get("educatorPrice")),
                    "educator_approved_price": _to_decimal(s.get("educatorApprovedPrice")),
                    "start_time": s.get("startTime"),
                    "synced_at": now,
                }
                for s in opp_sessions
            ]
        total_sessions = sum(len(v) for v in session_records_by_opp.values())
        upsert_sessions(conn, session_records_by_opp)

        # Clean up: remove opps from unmatched that now have a district match
        newly_matched_ids = [
            r["id"] for r in matched_records if r.get("district_lea_id") is not None
        ]
        remove_matched_from_unmatched(conn, newly_matched_ids)

        update_district_pipeline_aggregates(conn)
        refresh_map_features(conn)
        set_last_synced_at(conn, now)

        logger.info(
            f"=== Sync complete: {len(matched_records)} opps, "
            f"{total_sessions} sessions, "
            f"{len(unmatched_records)} unmatched ==="
        )
        return {
            "status": "success",
            "opps_synced": len(matched_records),
            "sessions_stored": total_sessions,
            "unmatched_count": len(unmatched_records),
            "error": None,
        }
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
