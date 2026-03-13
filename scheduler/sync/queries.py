"""OpenSearch query definitions for opportunities, sessions, and district lookups."""

import logging
from sync.opensearch_client import scroll_all

logger = logging.getLogger(__name__)

OPPORTUNITY_SOURCE_FIELDS = [
    "id", "name", "stage", "school_yr", "state", "close_date", "created_at",
    "payment_type", "contractType", "lead_source", "net_booking_amount",
    "sales_rep", "accounts", "invoices", "credit_memos",
    "referring_contact_name", "contracting_through", "funding_through", "payment_terms",
]

SESSION_SOURCE_FIELDS = [
    "opportunityId", "sessionPrice", "educatorPrice", "educatorApprovedPrice",
    "startTime", "status", "doNotBill", "serviceType",
]

SCHOOL_YEARS = ["2024-25", "2025-26", "2026-27", "2027-28"]


def fetch_opportunities(client):
    """Fetch all opportunities from school year 2024-25 onward."""
    logger.info("Fetching opportunities...")
    query = {
        "bool": {
            "filter": [
                {"terms": {"school_yr": SCHOOL_YEARS}}
            ]
        }
    }
    hits = scroll_all(client, "clj-prod-opportunities", query, OPPORTUNITY_SOURCE_FIELDS)
    logger.info(f"Fetched {len(hits)} opportunities")
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
                "filter": [
                    {"terms": {"opportunityId": batch}},
                ],
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
    Returns dict: {lms_account_id: {nces_id, leaid, parent_district_id, name}}
    """
    logger.info(f"Fetching district mappings for {len(account_ids)} accounts...")
    query = {
        "bool": {
            "filter": [{"terms": {"lms_id": account_ids}}]
        }
    }
    hits = scroll_all(
        client, "clj-prod-districts", query,
        ["lms_id", "nces_id", "leaid", "parent_district_id", "name", "type"],
    )
    mapping = {}
    for hit in hits:
        src = hit["_source"]
        mapping[src["lms_id"]] = src
    logger.info(f"Resolved {len(mapping)} district mappings")
    return mapping
