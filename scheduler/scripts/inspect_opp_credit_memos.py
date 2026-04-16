"""Diagnostic: inspect raw OpenSearch opportunity documents to find where
credit-memo data actually lives.

The scheduler currently expects `credit_memos` as an array of objects each
with an `amount` field (see compute.py:89). In practice, every opportunity
in Postgres has `credited = 0`, so either:
  (a) the field is genuinely empty in the index,
  (b) it lives under a different name, or
  (c) the sub-field name isn't `amount`.

This script pulls a handful of full _source documents (NOT restricted to the
OPPORTUNITY_SOURCE_FIELDS list) so we can see raw keys, then prints anything
that looks credit-related.

Usage (from repo root):
    cd scheduler
    python scripts/inspect_opp_credit_memos.py

Requires OPENSEARCH_HOST / OPENSEARCH_USERNAME / OPENSEARCH_PASSWORD env vars
(or the ELASTICSEARCH_* aliases) — same as the main sync.
"""

import json
import logging
import os
import re
import sys

# Allow running as `python scripts/inspect_opp_credit_memos.py` from scheduler/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sync.opensearch_client import get_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("inspect_credit_memos")

INDEX = "clj-prod-opportunities"
SAMPLE_SIZE = 10

CREDIT_PATTERN = re.compile(r"credit|memo|refund", re.IGNORECASE)


def fetch_sample_docs(client):
    """Fetch SAMPLE_SIZE closed-won FY25 opportunities with the full _source.

    No source-field whitelist — we want to see every key the index stores.
    """
    body = {
        "size": SAMPLE_SIZE,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"school_yr.keyword": "2024-25"}},
                ],
                "should": [
                    {"term": {"stage.keyword": "Closed Won"}},
                    {"term": {"stage.keyword": "Active"}},
                    {"term": {"stage.keyword": "Position Purchased"}},
                ],
                "minimum_should_match": 1,
            }
        },
        "_source": True,
        "sort": [{"_doc": "asc"}],
    }
    resp = client.search(index=INDEX, body=body)
    return resp["hits"]["hits"]


def find_credit_like_keys(obj, path="_source"):
    """Recursively yield (path, value) for any key matching /credit|memo|refund/i."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            here = f"{path}.{k}"
            if CREDIT_PATTERN.search(k):
                yield here, v
            yield from find_credit_like_keys(v, here)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from find_credit_like_keys(v, f"{path}[{i}]")


def preview(value, max_len=300):
    """Render a short JSON preview of any value."""
    try:
        text = json.dumps(value, default=str, indent=2)
    except Exception as e:
        return f"<unrepr: {e}>"
    if len(text) > max_len:
        return text[:max_len] + f"... (+{len(text) - max_len} chars)"
    return text


def main():
    log.info("Connecting to OpenSearch (%s)...", INDEX)
    client = get_client()

    hits = fetch_sample_docs(client)
    log.info("Fetched %d sample documents", len(hits))

    if not hits:
        log.warning("No documents returned — check the query filters or index name.")
        return

    # Report 1: top-level _source keys on the first doc
    first_source = hits[0]["_source"]
    print("\n=== Top-level _source keys on the first returned opportunity ===")
    for k in sorted(first_source.keys()):
        sample_val = first_source[k]
        if isinstance(sample_val, (dict, list)):
            size = f"(size={len(sample_val)})"
        else:
            size = ""
        print(f"  {k} {size}")

    # Report 2: any credit-like keys across the sample
    print(f"\n=== Any key matching /credit|memo|refund/i across {len(hits)} docs ===")
    any_found = False
    for i, hit in enumerate(hits):
        src = hit["_source"]
        matches = list(find_credit_like_keys(src, path=f"doc[{i}]._source"))
        if not matches:
            continue
        any_found = True
        opp_id = src.get("id", "?")
        stage = src.get("stage", "?")
        print(f"\n  Opportunity {opp_id} (stage={stage}):")
        for path, value in matches:
            print(f"    {path}")
            print("      " + preview(value).replace("\n", "\n      "))

    if not any_found:
        print("  No credit-related keys found in any of the sampled documents.")
        print("  → OpenSearch index does not contain credit-memo data at all.")
        print("  → Next step: verify the Salesforce → OpenSearch ETL is indexing credit memos.")
    else:
        print("\n→ Keys found. Update queries.py + compute.py to use the actual names.")

    # Report 3: explicitly check the expected path `credit_memos`
    print("\n=== Explicit check: does `credit_memos` exist on the sampled docs? ===")
    present_count = 0
    nonempty_count = 0
    for hit in hits:
        src = hit["_source"]
        if "credit_memos" in src:
            present_count += 1
            v = src["credit_memos"]
            if v:
                nonempty_count += 1
    print(f"  `credit_memos` present on: {present_count} / {len(hits)} sampled docs")
    print(f"  `credit_memos` non-empty on: {nonempty_count} / {len(hits)} sampled docs")


if __name__ == "__main__":
    main()
