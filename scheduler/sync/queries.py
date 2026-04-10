"""OpenSearch query definitions for opportunities, sessions, and district lookups."""

import logging
from sync.opensearch_client import scroll_all

logger = logging.getLogger(__name__)

OPPORTUNITY_SOURCE_FIELDS = [
    "id", "name", "stage", "school_yr", "state", "close_date", "created_at",
    "payment_type", "contractType", "lead_source", "net_booking_amount",
    "sales_rep", "accounts", "invoices", "credit_memos",
    "referring_contact_name", "contracting_through", "funding_through", "payment_terms",
    "minimum_purchase_amount", "maximum_budget", "detailsLink",
    "stage_history", "start_date", "expiration",
]

SESSION_SOURCE_FIELDS = [
    "opportunityId", "sessionPrice", "educatorPrice", "educatorApprovedPrice",
    "startTime", "status", "doNotBill", "serviceType",
    "type", "serviceName",
]

SCHOOL_YEARS = ["2024-25", "2025-26", "2026-27", "2027-28"]


def fetch_opportunities(client, since=None):
    """Fetch opportunities from school year 2024-25 onward.

    Args:
        since: Optional datetime. If provided, only fetch records updated after this time.
    """
    logger.info("Fetching opportunities%s...", f" updated since {since.isoformat()}" if since else "")
    filters = [{"terms": {"school_yr.keyword": SCHOOL_YEARS}}]
    if since is not None:
        filters.append({"range": {"updated_at": {"gte": since.isoformat()}}})
    query = {"bool": {"filter": filters}}
    hits = scroll_all(client, "clj-prod-opportunities", query, OPPORTUNITY_SOURCE_FIELDS)
    logger.info(f"Fetched {len(hits)} opportunities")
    return hits


def fetch_opportunities_by_ids(client, opp_ids):
    """Fetch specific opportunities by ID."""
    if not opp_ids:
        return []
    logger.info(f"Fetching {len(opp_ids)} opportunities by ID...")
    query = {"bool": {"filter": [{"terms": {"id": opp_ids}}]}}
    hits = scroll_all(client, "clj-prod-opportunities", query, OPPORTUNITY_SOURCE_FIELDS)
    logger.info(f"Fetched {len(hits)} opportunities by ID")
    return hits


def fetch_changed_sessions(client, since):
    """Fetch all sessions updated since a given timestamp."""
    logger.info(f"Fetching sessions updated since {since.isoformat()}...")
    query = {
        "bool": {
            "filter": [{"range": {"lastIndexedAt": {"gte": since.isoformat()}}}],
            "must_not": [
                {"term": {"status": "cancelled"}},
                {"term": {"doNotBill": True}},
            ],
        }
    }
    hits = scroll_all(client, "clj-prod-sessions-v2", query, ["opportunityId"])
    logger.info(f"Fetched {len(hits)} changed sessions")
    return hits


def fetch_sessions(client, opportunity_ids):
    """Fetch sessions for given opportunity IDs, excluding cancelled and doNotBill."""
    logger.info(f"Fetching sessions for {len(opportunity_ids)} opportunities...")
    all_hits = []
    batch_size = 1000
    for i in range(0, len(opportunity_ids), batch_size):
        batch = opportunity_ids[i : i + batch_size]
        query = {
            "bool": {
                "filter": [{"terms": {"opportunityId": batch}}],
                "must_not": [
                    {"term": {"status": "cancelled"}},
                    {"term": {"doNotBill": True}},
                ],
            }
        }
        hits = scroll_all(client, "clj-prod-sessions-v2", query, SESSION_SOURCE_FIELDS)
        all_hits.extend(hits)
    logger.info(f"Fetched {len(all_hits)} sessions")
    return all_hits


def fetch_district_mappings(client, account_ids):
    """Batch lookup account IDs against clj-prod-districts for NCES/LEAID mapping.
    Returns dict: {account_id_str: {ncesId, name, type, ...}}

    Note: Account IDs from opportunities are numeric. The districts index
    uses 'id' field (numeric) and 'ncesId' for the NCES/LEAID identifier.
    """
    logger.info(f"Fetching district mappings for {len(account_ids)} accounts...")
    # Convert to strings for terms query
    str_ids = [str(aid) for aid in account_ids]
    query = {
        "bool": {
            "filter": [{"terms": {"id": str_ids}}]
        }
    }
    hits = scroll_all(
        client, "clj-prod-districts", query,
        ["id", "ncesId", "name", "state", "hasParent", "asDistrict"],
    )
    mapping = {}
    for hit in hits:
        src = hit["_source"]
        account_id = str(src["id"])
        nces_id = src.get("ncesId")
        mapping[account_id] = {
            "nces_id": nces_id,
            "leaid": nces_id,  # ncesId and leaid are the same
            "name": src.get("name"),
            "type": "district",
        }
    logger.info(f"Resolved {len(mapping)} district mappings")
    return mapping
