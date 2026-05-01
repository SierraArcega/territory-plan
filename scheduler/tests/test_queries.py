from unittest.mock import MagicMock, patch
from sync.queries import fetch_opportunities, fetch_sessions, fetch_district_mappings, fetch_opportunities_for_school_yrs

OPPORTUNITY_SOURCE_FIELDS = [
    "id", "name", "stage", "school_yr", "state", "close_date", "created_at",
    "payment_type", "contractType", "lead_source", "net_booking_amount",
    "sales_rep", "accounts", "invoices", "credit_memos",
    "referring_contact_name", "contracting_through", "funding_through", "payment_terms",
    "minimum_purchase_amount", "maximum_budget", "detailsLink",
    "stage_history", "start_date", "expiration",
]

SESSION_SOURCE_FIELDS = [
    "opportunityId", "sessionPrice", "educatorPrice", "educatorApprovedPrice",
    "startTime", "status", "doNotBill", "serviceType",
    "type", "serviceName",
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
            {"_source": {"id": 12345, "ncesId": "0100001", "name": "Test District"}}
        ]
        result = fetch_district_mappings(MagicMock(), [12345])
        assert "12345" in result
        assert result["12345"]["leaid"] == "0100001"
        assert result["12345"]["nces_id"] == "0100001"


def test_fetch_district_mappings_rejects_non_seven_digit_ncesid():
    with patch("sync.queries.scroll_all") as mock_scroll:
        mock_scroll.return_value = [
            {"_source": {"id": 1, "ncesId": "0100001", "name": "Good District"}},
            {"_source": {"id": 2, "ncesId": "010000100123", "name": "School Row"}},
            {"_source": {"id": 3, "ncesId": "abc1234", "name": "Non-numeric"}},
            {"_source": {"id": 4, "ncesId": None, "name": "Null ncesId"}},
        ]
        result = fetch_district_mappings(MagicMock(), [1, 2, 3, 4])

        assert result["1"]["leaid"] == "0100001"
        assert result["2"]["leaid"] is None
        assert result["2"]["nces_id"] is None
        assert result["3"]["leaid"] is None
        assert result["3"]["nces_id"] is None
        assert result["4"]["leaid"] is None


@patch("sync.queries.scroll_all")
def test_fetch_opportunities_for_school_yrs_filters_by_provided_list(mock_scroll):
    mock_scroll.return_value = []
    client = MagicMock()
    fetch_opportunities_for_school_yrs(client, ["2025-26", "2024-25"])
    args = mock_scroll.call_args
    body = args[0][2]  # (client, index, query, source_fields)
    filters = body["bool"]["filter"]
    yr_filter = next(f for f in filters if "terms" in f)
    assert yr_filter["terms"]["school_yr.keyword"] == ["2025-26", "2024-25"]


@patch("sync.queries.scroll_all")
def test_fetch_opportunities_for_school_yrs_does_not_apply_since(mock_scroll):
    mock_scroll.return_value = []
    client = MagicMock()
    fetch_opportunities_for_school_yrs(client, ["2025-26"])
    body = mock_scroll.call_args[0][2]
    filters = body["bool"]["filter"]
    # No range filter on updated_at — every opp in the school year is fetched.
    assert not any("range" in f and "updated_at" in (f.get("range") or {}) for f in filters)
