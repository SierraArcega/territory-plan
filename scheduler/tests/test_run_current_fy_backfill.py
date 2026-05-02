import os
os.environ["OPENSEARCH_HOST"] = "https://test:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"
os.environ["SUPABASE_DB_URL"] = "postgresql://test:test@localhost:5432/test"

from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from run_sync import run_current_fy_backfill, _derive_current_and_prior_school_yrs


def test_derive_school_yrs_after_july():
    assert _derive_current_and_prior_school_yrs(datetime(2025, 9, 1, tzinfo=timezone.utc)) == ["2024-25", "2025-26"]


def test_derive_school_yrs_before_july():
    assert _derive_current_and_prior_school_yrs(datetime(2026, 4, 30, tzinfo=timezone.utc)) == ["2024-25", "2025-26"]


def test_derive_school_yrs_july_1_boundary():
    assert _derive_current_and_prior_school_yrs(datetime(2026, 7, 1, tzinfo=timezone.utc)) == ["2025-26", "2026-27"]


@patch("run_sync.refresh_opportunity_actuals")
@patch("run_sync.refresh_fullmind_financials")
@patch("run_sync.refresh_map_features")
@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.remove_matched_from_unmatched")
@patch("run_sync.upsert_unmatched")
@patch("run_sync.upsert_sessions")
@patch("run_sync.upsert_opportunities")
@patch("run_sync.get_connection")
@patch("run_sync._build_record_and_classify")
@patch("run_sync.fetch_district_mappings")
@patch("run_sync.fetch_sessions")
@patch("run_sync.fetch_opportunities_for_school_yrs")
@patch("run_sync.get_client")
def test_run_current_fy_backfill_uses_school_yr_helper_not_incremental(
    mock_get_client, mock_fetch_yrs, mock_fetch_sessions,
    mock_fetch_districts, mock_build, mock_get_conn,
    mock_upsert_opps, mock_upsert_sessions, mock_upsert_unmatched,
    mock_remove_matched, mock_update_agg, mock_refresh_map,
    mock_refresh_fin, mock_refresh_actuals,
):
    mock_fetch_yrs.return_value = [
        {"_source": {"id": "opp1", "accounts": [{"id": "acc1"}]}}
    ]
    mock_fetch_sessions.return_value = []
    mock_fetch_districts.return_value = {}
    mock_build.return_value = ({"id": "opp1", "district_lea_id": "0100001",
                                 "net_booking_amount": 1, "service_types": []}, None)
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_get_conn.return_value = mock_conn

    result = run_current_fy_backfill()

    mock_fetch_yrs.assert_called_once()
    school_yrs_arg = mock_fetch_yrs.call_args[0][1]
    assert "2025-26" in school_yrs_arg
    assert "2024-25" in school_yrs_arg
    assert result["status"] == "success"
    assert result["opps_synced"] == 1


@patch("run_sync.refresh_opportunity_actuals")
@patch("run_sync.refresh_fullmind_financials")
@patch("run_sync.refresh_map_features")
@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.remove_matched_from_unmatched")
@patch("run_sync.upsert_unmatched")
@patch("run_sync.upsert_sessions")
@patch("run_sync.upsert_opportunities")
@patch("run_sync.set_last_synced_at")
@patch("run_sync.get_connection")
@patch("run_sync._build_record_and_classify")
@patch("run_sync.fetch_district_mappings")
@patch("run_sync.fetch_sessions")
@patch("run_sync.fetch_opportunities_for_school_yrs")
@patch("run_sync.get_client")
def test_run_current_fy_backfill_does_not_touch_watermark(
    mock_get_client, mock_fetch_yrs, mock_fetch_sessions,
    mock_fetch_districts, mock_build, mock_get_conn,
    mock_set_last, mock_upsert_opps, mock_upsert_sessions, mock_upsert_unmatched,
    mock_remove_matched, mock_update_agg, mock_refresh_map,
    mock_refresh_fin, mock_refresh_actuals,
):
    mock_fetch_yrs.return_value = [
        {"_source": {"id": "opp1", "accounts": [{"id": "acc1"}]}}
    ]
    mock_fetch_sessions.return_value = []
    mock_fetch_districts.return_value = {}
    mock_build.return_value = ({"id": "opp1", "district_lea_id": "0100001",
                                 "net_booking_amount": 1, "service_types": []}, None)
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_get_conn.return_value = mock_conn

    run_current_fy_backfill()

    # Backfill must NOT advance the watermark — the hourly incremental still
    # needs to catch up from where it last left off.
    mock_set_last.assert_not_called()
