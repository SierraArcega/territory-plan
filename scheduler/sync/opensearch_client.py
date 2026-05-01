"""OpenSearch connection helper and pagination utility."""

import os
import logging
from urllib.parse import urlparse
from opensearchpy import OpenSearch

logger = logging.getLogger(__name__)


def get_client() -> OpenSearch:
    """Create an OpenSearch client from environment variables."""
    host = os.environ.get("OPENSEARCH_HOST") or os.environ["ELASTICSEARCH_HOST"]

    # Pass full URL directly (matches es-bi pattern for AWS OpenSearch)
    return OpenSearch(
        hosts=[host],
        http_auth=(
            os.environ.get("OPENSEARCH_USERNAME") or os.environ["ELASTICSEARCH_USERNAME"],
            os.environ.get("OPENSEARCH_PASSWORD") or os.environ["ELASTICSEARCH_PASSWORD"],
        ),
        use_ssl=True,
        verify_certs=True,
        ssl_show_warn=False,
        timeout=30,
    )


def scroll_all(
    client: OpenSearch,
    index: str,
    query: dict,
    source_fields: list,
    size: int = 5000,
    sort_field: str = "_doc",
) -> list:
    """Paginate through all results using search_after with a Point-in-Time
    snapshot so concurrent index writes can't perturb pagination.

    Without PIT, search_after's results can drift when documents are added,
    deleted, or updated mid-scroll — silently leaking records. Sessions in
    clj-prod-sessions-v2 are reindexed constantly by the LMS, so PIT is
    required for completeness, not optional.

    Falls back to non-PIT pagination if create_pit raises (e.g., older
    OpenSearch versions or restricted permissions). The fallback path
    matches the previous behavior exactly.
    """
    # Try to open a PIT. AWS OpenSearch Service supports create_pit on
    # versions ≥ 2.4. If unavailable, log and fall back to the old path.
    pit_id = None
    try:
        pit_resp = client.create_pit(index=index, keep_alive="5m")
        pit_id = pit_resp.get("pit_id")
    except Exception as e:
        logger.warning(
            f"create_pit unavailable for {index} ({type(e).__name__}: {e}); "
            f"falling back to non-PIT search_after — pagination may drop records "
            f"under concurrent writes"
        )

    results = []
    search_after = None
    try:
        while True:
            body = {
                "size": size,
                "query": query,
                "_source": source_fields,
                "sort": [{sort_field: "asc"}],
            }
            if search_after:
                body["search_after"] = search_after

            if pit_id:
                # When using PIT, don't pass index — PIT is bound to the index.
                body["pit"] = {"id": pit_id, "keep_alive": "5m"}
                resp = client.search(body=body)
            else:
                resp = client.search(index=index, body=body)

            hits = resp["hits"]["hits"]
            if not hits:
                break

            results.extend(hits)
            search_after = hits[-1]["sort"]
            logger.info(f"  Fetched {len(results)} records from {index}...")
    finally:
        if pit_id:
            try:
                client.delete_pit(body={"pit_id": [pit_id]})
            except Exception as e:
                logger.warning(f"delete_pit failed (PIT will expire on its own): {e}")

    return results
