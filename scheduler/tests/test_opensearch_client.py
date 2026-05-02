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
            assert call_kwargs["hosts"] == ["https://test-host:9200"]
            assert call_kwargs["http_auth"] == ("user", "pass")
            assert call_kwargs["use_ssl"] is True


def test_scroll_all_paginates():
    mock_client = MagicMock()
    # First search() opens a scroll with 2 hits, second scroll() returns 0 hits.
    mock_client.search.return_value = {
        "_scroll_id": "test_scroll_abc",
        "hits": {"hits": [
            {"_id": "1", "_source": {"id": "1"}},
            {"_id": "2", "_source": {"id": "2"}},
        ]},
    }
    mock_client.scroll.return_value = {
        "_scroll_id": "test_scroll_abc",
        "hits": {"hits": []},
    }
    results = scroll_all(mock_client, "test-index", {"match_all": {}}, ["id"], size=2)
    assert len(results) == 2
    assert results[0]["_source"]["id"] == "1"
    assert mock_client.search.call_count == 1


def test_scroll_all_uses_legacy_scroll_api():
    client = MagicMock()
    # First search() opens a scroll, returns 2 hits + scroll_id.
    # Second client.scroll() returns 1 hit + same scroll_id.
    # Third client.scroll() returns 0 hits — terminates.
    client.search.return_value = {
        "_scroll_id": "test_scroll_abc",
        "hits": {"hits": [
            {"_id": "1", "_source": {"x": 1}},
            {"_id": "2", "_source": {"x": 2}},
        ]},
    }
    client.scroll.side_effect = [
        {"_scroll_id": "test_scroll_abc",
         "hits": {"hits": [{"_id": "3", "_source": {"x": 3}}]}},
        {"_scroll_id": "test_scroll_abc",
         "hits": {"hits": []}},
    ]

    results = scroll_all(client, "myindex", {"match_all": {}}, ["x"], size=100)

    assert len(results) == 3
    assert [r["_id"] for r in results] == ["1", "2", "3"]
    # Verify scroll lifecycle: search opened with scroll="5m", scroll() called, clear_scroll called
    client.search.assert_called_once()
    search_call = client.search.call_args
    assert search_call.kwargs.get("scroll") == "5m"
    assert search_call.kwargs.get("index") == "myindex"
    assert client.scroll.call_count == 2
    client.clear_scroll.assert_called_once_with(scroll_id="test_scroll_abc")


def test_scroll_all_clears_scroll_even_on_error():
    client = MagicMock()
    client.search.return_value = {
        "_scroll_id": "test_scroll_abc",
        "hits": {"hits": [{"_id": "1", "_source": {"x": 1}}]},
    }
    client.scroll.side_effect = Exception("network blip")

    try:
        scroll_all(client, "myindex", {"match_all": {}}, ["x"])
    except Exception:
        pass

    # Scroll context must always be cleared — even if scroll() raises mid-pagination
    client.clear_scroll.assert_called_once_with(scroll_id="test_scroll_abc")


def test_scroll_all_handles_empty_first_page():
    client = MagicMock()
    client.search.return_value = {
        "_scroll_id": "test_scroll_abc",
        "hits": {"hits": []},
    }

    results = scroll_all(client, "myindex", {"match_all": {}}, ["x"])

    assert results == []
    client.scroll.assert_not_called()  # Loop exits immediately on empty hits
    client.clear_scroll.assert_called_once()


def test_scroll_all_handles_clear_scroll_failure_gracefully():
    """clear_scroll failures shouldn't propagate — scroll contexts time out anyway."""
    client = MagicMock()
    client.search.return_value = {
        "_scroll_id": "test_scroll_abc",
        "hits": {"hits": [{"_id": "1", "_source": {"x": 1}}]},
    }
    client.scroll.return_value = {"_scroll_id": "test_scroll_abc", "hits": {"hits": []}}
    client.clear_scroll.side_effect = Exception("scroll already cleared")

    # Should not raise
    results = scroll_all(client, "myindex", {"match_all": {}}, ["x"])
    assert len(results) == 1
