"""OpenSearch connection helper and pagination utility."""

import os
import logging
from urllib.parse import urlparse
from opensearchpy import OpenSearch

logger = logging.getLogger(__name__)


def get_client() -> OpenSearch:
    """Create an OpenSearch client from environment variables."""
    parsed = urlparse(os.environ["OPENSEARCH_HOST"])
    host = parsed.hostname or os.environ["OPENSEARCH_HOST"]
    port = parsed.port or 9200

    return OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_auth=(
            os.environ["OPENSEARCH_USERNAME"],
            os.environ["OPENSEARCH_PASSWORD"],
        ),
        use_ssl=True,
        verify_certs=True,
        timeout=60,
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
