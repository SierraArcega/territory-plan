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
    """Paginate through all results using the legacy OpenSearch scroll API.

    The scroll API maintains a server-side cursor that is stable under
    concurrent index writes (in contrast to search_after, which can leak
    or duplicate records when documents are added/reindexed mid-scroll).
    The scroll context is opened on the first search() call (via the
    `scroll` parameter), advanced via client.scroll(), and explicitly
    cleared in a finally block so we don't leak server-side state.

    `sort_field` is accepted for backwards compatibility but unused —
    the scroll API doesn't require explicit sort.
    """
    scroll_id = None
    results = []
    body = {
        "size": size,
        "query": query,
        "_source": source_fields,
    }
    try:
        resp = client.search(index=index, body=body, scroll="5m")
        scroll_id = resp.get("_scroll_id")
        hits = resp["hits"]["hits"]
        while hits:
            results.extend(hits)
            logger.info(f"  Fetched {len(results)} records from {index}...")
            resp = client.scroll(scroll_id=scroll_id, scroll="5m")
            scroll_id = resp.get("_scroll_id")
            hits = resp["hits"]["hits"]
    finally:
        if scroll_id:
            try:
                client.clear_scroll(scroll_id=scroll_id)
            except Exception as e:
                logger.warning(f"clear_scroll failed (scroll context will time out): {e}")

    return results
