import os
os.environ["OPENSEARCH_HOST"] = "https://test:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"
os.environ["SUPABASE_DB_URL"] = "postgresql://test:test@localhost:5432/test"

from unittest.mock import patch, MagicMock
from run_sync import run_sync


@patch("run_sync.refresh_map_features")
@patch("run_sync.set_last_synced_at")
@patch("run_sync.get_last_synced_at", return_value=None)
@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.upsert_unmatched")
@patch("run_sync.upsert_sessions")
@patch("run_sync.upsert_opportunities")
@patch("run_sync.get_connection")
@patch("run_sync.build_opportunity_record")
@patch("run_sync.fetch_district_mappings")
@patch("run_sync.fetch_sessions")
@patch("run_sync.fetch_opportunities")
@patch("run_sync.get_client")
def test_run_sync_happy_path(
    mock_get_client, mock_fetch_opps, mock_fetch_sessions,
    mock_fetch_districts, mock_build, mock_get_conn,
    mock_upsert_opps, mock_upsert_sessions, mock_upsert_unmatched,
    mock_update_agg, mock_get_last, mock_set_last, mock_refresh,
):
    mock_fetch_opps.return_value = [
        {"_source": {"id": "opp1", "accounts": [{"id": "acc1"}]}}
    ]
    mock_fetch_sessions.return_value = [
        {"_id": "sess1", "_source": {"opportunityId": "opp1", "sessionPrice": 100,
         "educatorPrice": 60, "educatorApprovedPrice": None,
         "startTime": "2026-01-01T10:00:00Z", "serviceType": "tutoring"}}
    ]
    mock_fetch_districts.return_value = {"acc1": {"nces_id": "123", "leaid": "0100001"}}
    mock_build.return_value = {
        "id": "opp1", "district_lea_id": "0100001", "net_booking_amount": 5000,
        "service_types": ["tutoring"],
    }
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_get_conn.return_value = mock_conn

    result = run_sync()

    assert result["status"] == "success"
    assert result["opps_synced"] == 1
    assert result["sessions_stored"] == 1
    assert result["unmatched_count"] == 0
    mock_upsert_opps.assert_called_once()
    mock_upsert_sessions.assert_called_once()
    mock_update_agg.assert_called_once()
    mock_refresh.assert_called_once()
    mock_set_last.assert_called_once()
    mock_conn.close.assert_called_once()


@patch("run_sync.refresh_map_features")
@patch("run_sync.set_last_synced_at")
@patch("run_sync.get_last_synced_at", return_value=None)
@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.upsert_unmatched")
@patch("run_sync.upsert_sessions")
@patch("run_sync.upsert_opportunities")
@patch("run_sync.get_connection")
@patch("run_sync.build_opportunity_record")
@patch("run_sync.fetch_district_mappings")
@patch("run_sync.fetch_sessions")
@patch("run_sync.fetch_opportunities")
@patch("run_sync.get_client")
def test_run_sync_no_opportunities_skips(
    mock_get_client, mock_fetch_opps, mock_fetch_sessions,
    mock_fetch_districts, mock_build, mock_get_conn,
    mock_upsert_opps, mock_upsert_sessions, mock_upsert_unmatched,
    mock_update_agg, mock_get_last, mock_set_last, mock_refresh,
):
    mock_fetch_opps.return_value = []
    mock_conn = MagicMock()
    mock_get_conn.return_value = mock_conn

    result = run_sync()

    assert result["status"] == "success"
    assert result["opps_synced"] == 0
    assert result["unmatched_count"] is None
    mock_fetch_sessions.assert_not_called()
    mock_upsert_opps.assert_not_called()
    mock_upsert_sessions.assert_not_called()
    mock_set_last.assert_called_once()
    mock_conn.close.assert_called_once()


def test_name_mismatch_opp_routes_to_unmatched_with_correct_reason():
    """Yuba City opp with Woodville's NCES ID should land in unmatched
    with reason='Name/LEAID mismatch', not the generic 'Needs Review'."""
    from run_sync import _build_record_and_classify
    opp = {
        "id": "OPP-YUBA",
        "name": "Yuba City Tutoring",
        "accounts": [{"id": "ACC-YUBA", "name": "Yuba City Unified School District"}],
        "stage": "1 - Discovery",
        "school_yr": "2026-27",
        "state": "CA",
        "invoices": [], "credit_memos": [], "sales_rep": {},
    }
    mapping = {"ACC-YUBA": {
        "nces_id": "0643170",
        "leaid":   "0643170",
        "name":    "Woodville Elementary School District",
        "type":    "district",
    }}
    from datetime import datetime, timezone
    now = datetime(2026, 4, 13, 12, 0, 0, tzinfo=timezone.utc)
    record, unmatched = _build_record_and_classify(opp, [], mapping, now=now)
    assert record["district_lea_id"] is None
    assert unmatched is not None
    assert unmatched["reason"] == "Name/LEAID mismatch"
    assert unmatched["id"] == "OPP-YUBA"
    # _match_status should be stripped from the record so it never reaches the DB
    assert "_match_status" not in record


def test_build_and_classify_happy_path_no_unmatched():
    """Matched opps should return unmatched=None."""
    from run_sync import _build_record_and_classify
    opp = {
        "id": "OPP-ROCK",
        "name": "Rockdale renewal",
        "accounts": [{"id": "ACC-ROCK", "name": "Rockdale County School District"}],
        "stage": "3 - Proposal", "school_yr": "2026-27", "state": "GA",
        "invoices": [], "credit_memos": [], "sales_rep": {},
    }
    mapping = {"ACC-ROCK": {
        "nces_id": "1304410",
        "leaid":   "1304410",
        "name":    "Rockdale County Public Schools",
        "type":    "district",
    }}
    from datetime import datetime, timezone
    now = datetime(2026, 4, 13, 12, 0, 0, tzinfo=timezone.utc)
    record, unmatched = _build_record_and_classify(opp, [], mapping, now=now)
    assert record["district_lea_id"] == "1304410"
    assert unmatched is None
    assert "_match_status" not in record
