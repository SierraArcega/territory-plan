from unittest.mock import MagicMock, patch
from sync.queries import fetch_opportunities, fetch_sessions, fetch_district_mappings

OPPORTUNITY_SOURCE_FIELDS = [
    "id", "name", "stage", "school_yr", "state", "close_date", "created_at",
    "payment_type", "contractType", "lead_source", "net_booking_amount",
    "sales_rep", "accounts", "invoices", "credit_memos",
    "referring_contact_name", "contracting_through", "funding_through", "payment_terms",
]

SESSION_SOURCE_FIELDS = [
    "opportunityId", "sessionPrice", "educatorPrice", "educatorApprovedPrice",
    "startTime", "status", "doNotBill", "serviceType",
]


def test_fetch_opportunities_calls_scroll_all():
    with patch("sync.queries.scroll_all") as mock_scroll:
        mock_scroll.return_value = [{"_source": {"id": "opp1"}}]
        result = fetch_opportunities(MagicMock())
        mock_scroll.assert_called_once()
        call_args = mock_scroll.call_args
        assert call_args[0][1] == "clj-prod-opportunities"
        assert call_args[0][3] == OPPORTUNITY_SOURCE_FIELDS
        assert len(result) == 1


def test_fetch_sessions_batches_ids():
    with patch("sync.queries.scroll_all") as mock_scroll:
        mock_scroll.return_value = []
        fetch_sessions(MagicMock(), ["opp1"])
        assert mock_scroll.call_count >= 1
        query = mock_scroll.call_args[0][2]
        assert "bool" in query


def test_fetch_district_mappings():
    with patch("sync.queries.scroll_all") as mock_scroll:
        mock_scroll.return_value = [
            {"_source": {"lms_id": "acc1", "nces_id": "123", "leaid": "0100001"}}
        ]
        result = fetch_district_mappings(MagicMock(), ["acc1"])
        assert "acc1" in result
