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


@patch("run_sync.refresh_opportunity_actuals")
@patch("run_sync.refresh_fullmind_financials")
@patch("run_sync.refresh_map_features")
@patch("run_sync.set_last_synced_at")
@patch("run_sync.get_last_synced_at", return_value=None)
@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.remove_matched_from_unmatched")
@patch("run_sync.upsert_unmatched")
@patch("run_sync.upsert_sessions")
@patch("run_sync.upsert_opportunities")
@patch("run_sync.get_connection")
@patch("run_sync.build_opportunity_record")
@patch("run_sync.fetch_district_mappings")
@patch("run_sync.fetch_sessions")
@patch("run_sync.fetch_opportunities")
@patch("run_sync.get_client")
def test_manual_resolution_overrides_sync_leaid(
    mock_get_client, mock_fetch_opps, mock_fetch_sessions,
    mock_fetch_districts, mock_build, mock_get_conn,
    mock_upsert_opps, mock_upsert_sessions, mock_upsert_unmatched,
    mock_remove_matched, mock_update_agg, mock_get_last, mock_set_last,
    mock_refresh_map, mock_refresh_fin, mock_refresh_actuals,
):
    """Manual resolutions in unmatched_opportunities must win over whatever
    OpenSearch produced — including a non-NULL leaid that disagrees."""
    mock_fetch_opps.return_value = [
        {"_source": {"id": "opp1", "accounts": [{"id": "acc1"}]}}
    ]
    mock_fetch_sessions.return_value = []
    mock_fetch_districts.return_value = {"acc1": {"nces_id": "123", "leaid": "0100001"}}
    # Sync derives leaid 0100001; rep previously mapped this opp to 9999999.
    mock_build.return_value = {
        "id": "opp1", "district_lea_id": "0100001", "net_booking_amount": 5000,
        "service_types": ["tutoring"],
    }
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [("opp1", "9999999")]
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_get_conn.return_value = mock_conn

    run_sync()

    upserted_records = mock_upsert_opps.call_args[0][1]
    assert len(upserted_records) == 1
    assert upserted_records[0]["district_lea_id"] == "9999999"
    mock_upsert_unmatched.assert_not_called()


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


@patch("run_sync.refresh_opportunity_actuals")
@patch("run_sync.refresh_fullmind_financials")
@patch("run_sync.refresh_map_features")
@patch("run_sync.set_last_synced_at")
@patch("run_sync.get_last_synced_at", return_value=None)
@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.remove_matched_from_unmatched")
@patch("run_sync.upsert_unmatched")
@patch("run_sync.upsert_sessions")
@patch("run_sync.upsert_opportunities")
@patch("run_sync.get_connection")
@patch("run_sync.build_opportunity_record")
@patch("run_sync.fetch_district_mappings")
@patch("run_sync.fetch_sessions")
@patch("run_sync.fetch_opportunities")
@patch("run_sync.get_client")
def test_manual_resolution_heals_when_opp_id_is_int(
    mock_get_client, mock_fetch_opps, mock_fetch_sessions,
    mock_fetch_districts, mock_build, mock_get_conn,
    mock_upsert_opps, mock_upsert_sessions, mock_upsert_unmatched,
    mock_remove_matched, mock_update_agg, mock_get_last, mock_set_last,
    mock_refresh, mock_refresh_fin, mock_refresh_actuals,
):
    """OS returns numeric IDs as Python int; manual_resolutions is keyed by str
    (read from a Postgres text column). The heal lookup must coerce so int IDs
    still match. Regression for the long-standing leak that left ~850 admin
    resolutions unpropagated to opportunities.district_lea_id."""
    OPP_ID_INT = 17592305692725
    OPP_ID_STR = "17592305692725"
    RESOLVED_LEAID = "0643470"

    mock_fetch_opps.return_value = [
        {"_source": {"id": OPP_ID_INT, "accounts": [{"id": "acc1"}]}}
    ]
    mock_fetch_sessions.return_value = []
    mock_fetch_districts.return_value = {}  # natural resolver fails
    mock_build.return_value = {
        "id": OPP_ID_INT,
        "district_lea_id": None,  # natural resolver fails -> heal must save
        "net_booking_amount": 5000,
        "service_types": [],
        "_match_status": "no_mapping",
    }

    # Simulate _load_manual_resolutions reading a Postgres text column → str keys
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [(OPP_ID_STR, RESOLVED_LEAID)]
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_get_conn.return_value = mock_conn

    result = run_sync()

    assert result["status"] == "success"
    assert result["unmatched_count"] == 0  # heal collapses the unmatched record

    # The record passed to upsert_opportunities must have the leaid healed in
    upserted = mock_upsert_opps.call_args[0][1]
    assert len(upserted) == 1
    assert upserted[0]["district_lea_id"] == RESOLVED_LEAID

    # And the now-matched id must be sent to remove_matched_from_unmatched
    removed_ids = mock_remove_matched.call_args[0][1]
    assert OPP_ID_INT in removed_ids
