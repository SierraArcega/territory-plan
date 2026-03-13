import os
import pytest
from unittest.mock import patch, MagicMock

os.environ["OPENSEARCH_HOST"] = "https://test-host:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"

from sync.opensearch_client import get_client, scroll_all


def test_get_client_returns_opensearch_instance():
    with patch.dict(os.environ, {"OPENSEARCH_HOST": "https://test-host:9200"}):
        with patch("sync.opensearch_client.OpenSearch") as MockOS:
            client = get_client()
            MockOS.assert_called_once()
            call_kwargs = MockOS.call_args[1]
            assert call_kwargs["hosts"] == [{"host": "test-host", "port": 9200}]
            assert call_kwargs["http_auth"] == ("user", "pass")
            assert call_kwargs["use_ssl"] is True


def test_scroll_all_paginates():
    mock_client = MagicMock()
    mock_client.search.side_effect = [
        {"hits": {"hits": [
            {"_source": {"id": "1"}, "sort": [1]},
            {"_source": {"id": "2"}, "sort": [2]},
        ]}},
        {"hits": {"hits": []}},
    ]
    results = scroll_all(mock_client, "test-index", {"match_all": {}}, ["id"], size=2)
    assert len(results) == 2
    assert results[0]["_source"]["id"] == "1"
    assert mock_client.search.call_count == 2
