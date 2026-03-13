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
    """Paginate through all results using search_after."""
    results = []
    search_after = None

    while True:
        body = {
            "size": size,
            "query": query,
            "_source": source_fields,
            "sort": [{sort_field: "asc"}],
        }
        if search_after:
            body["search_after"] = search_after

        resp = client.search(index=index, body=body)
        hits = resp["hits"]["hits"]
        if not hits:
            break

        results.extend(hits)
        search_after = hits[-1]["sort"]
        logger.info(f"  Fetched {len(results)} records from {index}...")

    return results
