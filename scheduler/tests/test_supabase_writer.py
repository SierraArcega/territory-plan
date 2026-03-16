import os
import pytest
from unittest.mock import patch, MagicMock, call
from decimal import Decimal
from datetime import datetime, timezone

os.environ["SUPABASE_DB_URL"] = "postgresql://test:test@localhost:5432/test"

from sync.supabase_writer import (
    upsert_opportunities,
    upsert_unmatched,
    update_district_pipeline_aggregates,
    upsert_sessions,
    STAGE_WEIGHTS,
    OPPORTUNITY_COLUMNS,
)


def test_stage_weights():
    assert STAGE_WEIGHTS["0"] == Decimal("0.05")
    assert STAGE_WEIGHTS["3"] == Decimal("0.50")
    assert STAGE_WEIGHTS["5"] == Decimal("0.90")


def test_upsert_opportunities_builds_correct_sql():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    records = [{
        "id": "opp1", "name": "Test", "school_yr": "2025-26",
        "contract_type": "direct", "state": "CA",
        "sales_rep_name": "Jane", "sales_rep_email": "j@t.com",
        "district_name": "D1", "district_lms_id": "lms1",
        "district_nces_id": "nces1", "district_lea_id": "lea1",
        "created_at": "2026-01-01", "close_date": "2026-04-01",
        "brand_ambassador": None, "stage": "3 - Proposal",
        "net_booking_amount": Decimal("5000.00"),
        "contract_through": "direct", "funding_through": "district",
        "payment_type": "invoice", "payment_terms": "net30",
        "lead_source": "referral",
        "invoiced": Decimal("1000.00"), "credited": Decimal("0"),
        "completed_revenue": Decimal("0"), "completed_take": Decimal("0"),
        "scheduled_sessions": 0, "scheduled_revenue": Decimal("0"),
        "scheduled_take": Decimal("0"), "total_revenue": Decimal("0"),
        "total_take": Decimal("0"), "average_take_rate": None,
        "synced_at": datetime(2026, 3, 12, tzinfo=timezone.utc),
    }]

    upsert_opportunities(mock_conn, records)
    mock_cursor.execute.assert_called()
    sql = mock_cursor.execute.call_args[0][0]
    assert "ON CONFLICT (id) DO UPDATE" in sql


def test_upsert_unmatched_preserves_resolutions():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    records = [{
        "id": "opp1", "name": "Test", "stage": "1 - Lead",
        "school_yr": "2025-26", "account_name": "Acme",
        "account_lms_id": "lms1", "account_type": "district",
        "state": "CA", "net_booking_amount": Decimal("5000"),
        "reason": "No NCES mapping", "synced_at": datetime(2026, 3, 12, tzinfo=timezone.utc),
    }]

    upsert_unmatched(mock_conn, records)
    sql = mock_cursor.execute.call_args[0][0]
    assert "ON CONFLICT (id) DO UPDATE" in sql
    assert "resolved = false" in sql.lower() or "resolved" in sql.lower()


def test_update_district_pipeline_aggregates():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    update_district_pipeline_aggregates(mock_conn)
    assert mock_cursor.execute.call_count >= 2


def test_upsert_sessions_deletes_then_inserts():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    sessions_by_opp = {
        "opp1": [
            {
                "id": "sess1",
                "opportunity_id": "opp1",
                "service_type": "tutoring",
                "session_price": Decimal("100.00"),
                "educator_price": Decimal("60.00"),
                "educator_approved_price": None,
                "start_time": "2026-01-01T10:00:00+00:00",
                "synced_at": datetime(2026, 3, 16, tzinfo=timezone.utc),
            },
            {
                "id": "sess2",
                "opportunity_id": "opp1",
                "service_type": "virtualStaffing",
                "session_price": Decimal("200.00"),
                "educator_price": Decimal("80.00"),
                "educator_approved_price": Decimal("50.00"),
                "start_time": "2026-06-01T10:00:00+00:00",
                "synced_at": datetime(2026, 3, 16, tzinfo=timezone.utc),
            },
        ],
    }

    upsert_sessions(mock_conn, sessions_by_opp)

    calls = mock_cursor.execute.call_args_list
    delete_sql = calls[0][0][0]
    assert "DELETE FROM sessions" in delete_sql
    insert_sql = calls[1][0][0]
    assert "INSERT INTO sessions" in insert_sql
    assert mock_cursor.execute.call_count == 3
    mock_conn.commit.assert_called_once()


def test_upsert_sessions_empty_dict():
    mock_conn = MagicMock()
    upsert_sessions(mock_conn, {})
    mock_conn.cursor.assert_not_called()


def test_opportunity_columns_includes_service_types():
    assert "service_types" in OPPORTUNITY_COLUMNS
