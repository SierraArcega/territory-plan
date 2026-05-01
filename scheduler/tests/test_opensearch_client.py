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


def test_scroll_all_uses_pit_when_available():
    client = MagicMock()
    # First search returns 2 hits, second returns 0 (terminating)
    client.create_pit.return_value = {"pit_id": "test_pit_123"}
    client.search.side_effect = [
        {"hits": {"hits": [
            {"_id": "1", "_source": {"x": 1}, "sort": [1]},
            {"_id": "2", "_source": {"x": 2}, "sort": [2]},
        ]}},
        {"hits": {"hits": []}},
    ]

    results = scroll_all(client, "myindex", {"match_all": {}}, ["x"], size=5000)

    assert len(results) == 2
    # PIT lifecycle assertions
    client.create_pit.assert_called_once_with(index="myindex", keep_alive="5m")
    client.delete_pit.assert_called_once_with(body={"pit_id": ["test_pit_123"]})

    # When PIT is in use, search() should NOT be called with `index`
    for call in client.search.call_args_list:
        kwargs = call.kwargs
        assert "index" not in kwargs, f"search called with index when PIT was open: {call}"
        body = kwargs.get("body") or (call.args[0] if call.args else {})
        # Body must contain pit, not index
        assert "pit" in body, f"search body missing pit: {body}"
        assert body["pit"]["id"] == "test_pit_123"


def test_scroll_all_falls_back_when_create_pit_fails():
    client = MagicMock()
    client.create_pit.side_effect = Exception("PIT not supported")
    client.search.side_effect = [
        {"hits": {"hits": [{"_id": "1", "_source": {"x": 1}, "sort": [1]}]}},
        {"hits": {"hits": []}},
    ]

    results = scroll_all(client, "myindex", {"match_all": {}}, ["x"], size=5000)

    assert len(results) == 1
    # Fallback path: search must be called with `index`, no PIT
    for call in client.search.call_args_list:
        kwargs = call.kwargs
        body = kwargs.get("body") or (call.args[0] if call.args else {})
        assert "pit" not in body
    # No delete_pit call when PIT was never opened
    client.delete_pit.assert_not_called()


def test_scroll_all_closes_pit_even_on_error():
    client = MagicMock()
    client.create_pit.return_value = {"pit_id": "test_pit_123"}
    # First page works, second page raises
    client.search.side_effect = [
        {"hits": {"hits": [{"_id": "1", "_source": {"x": 1}, "sort": [1]}]}},
        Exception("network blip"),
    ]

    try:
        scroll_all(client, "myindex", {"match_all": {}}, ["x"], size=5000)
    except Exception:
        pass

    # PIT must always be closed, even if scroll errors out
    client.delete_pit.assert_called_once_with(body={"pit_id": ["test_pit_123"]})
