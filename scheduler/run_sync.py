"""Single sync cycle: fetch from OpenSearch, compute, write to Supabase."""

import logging
from collections import defaultdict
from datetime import datetime, timezone

from sync.opensearch_client import get_client
from sync.queries import (
    fetch_opportunities,
    fetch_opportunities_by_ids,
    fetch_opportunities_for_school_yrs,  # NEW
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
    refresh_fullmind_financials,
    refresh_opportunity_actuals,
    get_last_synced_at,
    set_last_synced_at,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _process_opp_hits(opp_hits, sessions_by_opp, district_mapping, manual_resolutions, now):
    """Build records for each opp and classify into matched / unmatched.

    Manual resolutions in unmatched_opportunities are AUTHORITATIVE — they
    override whatever the natural resolver derived (NULL or any leaid).
    Without this, an upstream change that suddenly returns a leaid for a
    previously rep-curated opp would silently revert the rep's choice.

    This helper exists so that run_sync (hourly incremental) and
    run_current_fy_backfill (daily) cannot drift on this rule again — they
    used to duplicate ~30 lines of nearly-identical logic, and a previous
    fix patched only one copy. Single source of truth = single place to fix.

    Returns (matched_records, unmatched_records, healed_count).
    """
    matched_records = []
    unmatched_records = []
    healed_count = 0
    for h in opp_hits:
        opp = h["_source"]
        opp_sessions = sessions_by_opp.get(opp["id"], [])
        record, unmatched = _build_record_and_classify(
            opp, opp_sessions, district_mapping, now=now
        )
        # opp["id"] arrives from OpenSearch as int for numeric IDs; manual
        # resolutions are keyed by str (Postgres text column) — coerce so
        # the lookup matches.
        opp_id_str = str(opp["id"])
        if opp_id_str in manual_resolutions:
            record["district_lea_id"] = manual_resolutions[opp_id_str]
            unmatched = None
            healed_count += 1
        matched_records.append(record)
        if unmatched is not None:
            unmatched_records.append(unmatched)
    return matched_records, unmatched_records, healed_count


def _build_record_and_classify(opp, opp_sessions, district_mapping, now):
    """Build an opportunity record and classify the unmatched reason.

    Returns (record, unmatched_or_None). The `_match_status` signal that
    compute.build_opportunity_record() attaches is popped off the record
    before returning so it never reaches the opportunities table.

    If the opp's district resolved successfully, unmatched_or_None is None.
    Otherwise it's a dict ready to upsert into unmatched_opportunities,
    with a reason classified from _match_status:
      - 'name_mismatch' (bug b) -> 'Name/LEAID mismatch'
      - anything else           -> 'Needs Review'
    """
    record = build_opportunity_record(opp, opp_sessions, district_mapping, now=now)
    match_status = record.pop("_match_status", None)

    if record["district_lea_id"] is not None:
        return record, None

    if match_status == "name_mismatch":
        reason = "Name/LEAID mismatch"
    else:
        reason = "Needs Review"

    accounts = opp.get("accounts") or []
    first_acc = accounts[0] if accounts else {}
    unmatched = {
        "id": opp["id"],
        "name": opp.get("name"),
        "stage": opp.get("stage"),
        "school_yr": opp.get("school_yr"),
        "account_name": first_acc.get("name"),
        "account_lms_id": first_acc.get("id"),
        "account_type": first_acc.get("type"),
        "state": normalize_state(opp.get("state")),
        "net_booking_amount": record["net_booking_amount"],
        "reason": reason,
        "synced_at": now,
    }
    return record, unmatched


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
        # Phase 4: Compute metrics and build records (manual resolutions are
        # authoritative — see _process_opp_hits).
        manual_resolutions = _load_manual_resolutions(conn)
        matched_records, unmatched_records, healed_count = _process_opp_hits(
            opp_hits, sessions_by_opp, district_mapping, manual_resolutions, now
        )
        if healed_count:
            logger.info(f"Healed {healed_count} opps via manual resolutions")

        # Phase 5: Write to Supabase. upsert_opportunities returns the ids
        # whose POST-COALESCE leaid is non-NULL — that's the correct input
        # to remove_matched_from_unmatched (a Python-level filter on the
        # record value misses opps whose leaid was preserved by COALESCE).
        matched_ids = upsert_opportunities(conn, matched_records)
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
                    "type": s.get("type"),
                    "status": s.get("status"),
                    "service_name": s.get("serviceName"),
                    "synced_at": now,
                }
                for s in opp_sessions
            ]
        total_sessions = sum(len(v) for v in session_records_by_opp.values())
        upsert_sessions(conn, session_records_by_opp)

        # Clean up: remove opps from unmatched that now have a district match.
        remove_matched_from_unmatched(conn, matched_ids)

        update_district_pipeline_aggregates(conn)
        refresh_map_features(conn)
        refresh_fullmind_financials(conn)
        refresh_opportunity_actuals(conn)
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


def _derive_current_and_prior_school_yrs(now: datetime) -> list[str]:
    """e.g. now=2026-04-30 -> ['2024-25', '2025-26']. now=2025-09-01 -> ['2024-25', '2025-26']."""
    if now.month >= 7:
        current_start = now.year
    else:
        current_start = now.year - 1
    current = f"{current_start}-{str(current_start + 1)[-2:]}"
    prior_start = current_start - 1
    prior = f"{prior_start}-{str(prior_start + 1)[-2:]}"
    return [prior, current]


def run_current_fy_backfill():
    """Daily backfill: re-fetch all opps in current FY + prior FY unconditionally.

    Bypasses incremental's `since` filter to catch sessions that landed in
    OpenSearch without advancing `lastIndexedAt`. Reuses the same downstream
    pipeline as run_sync() — district resolution, manual-resolution merge,
    upsert, view refresh — but does NOT touch the last_synced_at watermark
    (so the next hourly incremental still picks up everything since the
    previous hourly run).

    Spec: Docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md
    """
    now = datetime.now(timezone.utc)
    school_yrs = _derive_current_and_prior_school_yrs(now)
    logger.info(f"=== Starting current-FY backfill at {now.isoformat()} for {school_yrs} ===")

    conn = get_connection()
    os_client = get_client()
    opp_hits = fetch_opportunities_for_school_yrs(os_client, school_yrs)
    if not opp_hits:
        logger.info("No opportunities returned, skipping backfill")
        conn.close()
        return {"status": "success", "opps_synced": 0, "sessions_stored": 0,
                "unmatched_count": None, "error": None}

    opp_ids = [h["_source"]["id"] for h in opp_hits]
    session_hits = fetch_sessions(os_client, opp_ids)

    sessions_by_opp = defaultdict(list)
    for sh in session_hits:
        src = sh["_source"]
        src["_id"] = sh["_id"]
        sessions_by_opp[src["opportunityId"]].append(src)

    account_ids = set()
    for h in opp_hits:
        for acc in (h["_source"].get("accounts") or []):
            if acc.get("id"):
                account_ids.add(acc["id"])
    district_mapping = fetch_district_mappings(os_client, list(account_ids))

    try:
        manual_resolutions = _load_manual_resolutions(conn)
        matched_records, unmatched_records, healed_count = _process_opp_hits(
            opp_hits, sessions_by_opp, district_mapping, manual_resolutions, now
        )
        if healed_count:
            logger.info(f"Healed {healed_count} opps via manual resolutions")

        matched_ids = upsert_opportunities(conn, matched_records)
        if unmatched_records:
            upsert_unmatched(conn, unmatched_records)

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
                    "type": s.get("type"),
                    "status": s.get("status"),
                    "service_name": s.get("serviceName"),
                    "synced_at": now,
                }
                for s in opp_sessions
            ]
        total_sessions = sum(len(v) for v in session_records_by_opp.values())
        upsert_sessions(conn, session_records_by_opp)

        remove_matched_from_unmatched(conn, matched_ids)

        update_district_pipeline_aggregates(conn)
        refresh_map_features(conn)
        refresh_fullmind_financials(conn)
        refresh_opportunity_actuals(conn)

        logger.info(
            f"=== Backfill complete: {len(matched_records)} opps, "
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
