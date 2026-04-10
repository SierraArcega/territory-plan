from decimal import Decimal
from datetime import datetime, timezone
from sync.compute import compute_metrics, build_opportunity_record

NOW = datetime(2026, 3, 12, 12, 0, 0, tzinfo=timezone.utc)


def test_compute_metrics_basic():
    sessions = [
        {
            "sessionPrice": 100.0,
            "educatorPrice": 60.0,
            "educatorApprovedPrice": None,
            "startTime": "2026-01-01T10:00:00Z",
            "serviceType": "tutoring",
        },
        {
            "sessionPrice": 200.0,
            "educatorPrice": 80.0,
            "educatorApprovedPrice": None,
            "startTime": "2026-06-01T10:00:00Z",
            "serviceType": "tutoring",
        },
    ]
    m = compute_metrics(sessions, now=NOW)
    assert m["completed_revenue"] == Decimal("100.00")
    assert m["completed_take"] == Decimal("40.00")
    assert m["scheduled_sessions"] == 1
    assert m["scheduled_revenue"] == Decimal("200.00")
    assert m["scheduled_take"] == Decimal("120.00")
    assert m["total_revenue"] == Decimal("300.00")
    assert m["total_take"] == Decimal("160.00")
    assert m["average_take_rate"] == Decimal("0.5333")


def test_compute_metrics_virtual_staffing_uses_approved_price():
    sessions = [
        {
            "sessionPrice": 100.0,
            "educatorPrice": 60.0,
            "educatorApprovedPrice": 50.0,
            "startTime": "2026-01-01T10:00:00Z",
            "serviceType": "virtualStaffing",
        },
    ]
    m = compute_metrics(sessions, now=NOW)
    assert m["completed_take"] == Decimal("50.00")


def test_compute_metrics_empty_sessions():
    m = compute_metrics([])
    assert m["total_revenue"] == Decimal("0")
    assert m["average_take_rate"] is None


def test_to_decimal_handles_empty_string():
    """Regression: empty string in numeric field caused ConversionSyntax."""
    from sync.compute import _to_decimal
    assert _to_decimal("") == Decimal("0")
    assert _to_decimal("  ") == Decimal("0")
    assert _to_decimal("N/A") == Decimal("0")
    assert _to_decimal(None) == Decimal("0")
    assert _to_decimal(0) == Decimal("0.00")
    assert _to_decimal(100.5) == Decimal("100.50")


def test_build_opportunity_record():
    opp_source = {
        "id": "opp1",
        "name": "Test Opp",
        "school_yr": "2025-26",
        "contractType": "direct",
        "state": "CA",
        "sales_rep": {"name": "Jane", "email": "jane@test.com"},
        "stage": "3 - Proposal",
        "net_booking_amount": 5000.0,
        "close_date": "2026-04-01",
        "created_at": "2026-01-15",
        "invoices": [{"amount": 1000}, {"amount": 500}],
        "credit_memos": [{"amount": 200}],
        "accounts": [{"id": "acc1", "type": "district", "name": "Test District"}],
        "referring_contact_name": "Brand Ambassador",
        "contracting_through": "direct",
        "funding_through": "district",
        "payment_type": "invoice",
        "payment_terms": "net30",
        "lead_source": "referral",
        "minimum_purchase_amount": 1000.0,
        "maximum_budget": 10000.0,
        "detailsLink": "https://lms.example.com/opp/opp1",
        "stage_history": [{"stage": "1 - Lead", "date": "2026-01-01"}],
        "start_date": "2026-02-01",
        "expiration": "2026-12-31",
    }
    district_mapping = {
        "acc1": {"nces_id": "0601234", "leaid": "0601234", "name": "Test District", "type": "district"}
    }
    sessions = []
    record = build_opportunity_record(opp_source, sessions, district_mapping, now=NOW)
    assert record["id"] == "opp1"
    assert record["invoiced"] == Decimal("1500.00")
    assert record["credited"] == Decimal("200.00")
    assert record["district_nces_id"] == "0601234"
    assert record["district_lea_id"] == "0601234"
    assert record["sales_rep_name"] == "Jane"
    assert record["minimum_purchase_amount"] == Decimal("1000.00")
    assert record["maximum_budget"] == Decimal("10000.00")
    assert record["details_link"] == "https://lms.example.com/opp/opp1"
    assert record["stage_history"] == '[{"stage": "1 - Lead", "date": "2026-01-01"}]'
    assert record["start_date"] == "2026-02-01"
    assert record["expiration"] == "2026-12-31"


def test_build_opportunity_record_computes_service_types():
    opp_source = {
        "id": "opp1", "name": "Test Opp", "school_yr": "2025-26",
        "contractType": "direct", "state": "CA",
        "sales_rep": {"name": "Jane", "email": "jane@test.com"},
        "stage": "3 - Proposal", "net_booking_amount": 5000.0,
        "close_date": "2026-04-01", "created_at": "2026-01-15",
        "invoices": [], "credit_memos": [],
        "accounts": [{"id": "acc1", "type": "district", "name": "Test District"}],
        "referring_contact_name": None, "contracting_through": None,
        "funding_through": None, "payment_type": None,
        "payment_terms": None, "lead_source": None,
        "minimum_purchase_amount": None, "maximum_budget": None,
        "detailsLink": None, "stage_history": None,
        "start_date": None, "expiration": None,
    }
    district_mapping = {
        "acc1": {"nces_id": "0601234", "leaid": "0601234", "name": "Test District", "type": "district"}
    }
    sessions = [
        {"sessionPrice": 100, "educatorPrice": 60, "educatorApprovedPrice": None,
         "startTime": "2026-01-01T10:00:00Z", "serviceType": "tutoring"},
        {"sessionPrice": 200, "educatorPrice": 80, "educatorApprovedPrice": None,
         "startTime": "2026-06-01T10:00:00Z", "serviceType": "virtualStaffing"},
        {"sessionPrice": 150, "educatorPrice": 70, "educatorApprovedPrice": None,
         "startTime": "2026-02-01T10:00:00Z", "serviceType": "tutoring"},
    ]
    record = build_opportunity_record(opp_source, sessions, district_mapping, now=NOW)
    import json
    assert json.loads(record["service_types"]) == ["tutoring", "virtualStaffing"]


def test_build_opportunity_record_service_types_empty_sessions():
    opp_source = {
        "id": "opp2", "name": "Empty", "school_yr": "2025-26",
        "contractType": None, "state": "CA",
        "sales_rep": {}, "stage": "1 - Lead", "net_booking_amount": 0,
        "close_date": None, "created_at": None,
        "invoices": [], "credit_memos": [],
        "accounts": [{"id": "acc1", "name": "D1"}],
        "referring_contact_name": None, "contracting_through": None,
        "funding_through": None, "payment_type": None,
        "payment_terms": None, "lead_source": None,
        "minimum_purchase_amount": None, "maximum_budget": None,
        "detailsLink": None, "stage_history": None,
        "start_date": None, "expiration": None,
    }
    district_mapping = {
        "acc1": {"nces_id": "0601234", "leaid": "0601234", "name": "D1", "type": "district"}
    }
    record = build_opportunity_record(opp_source, [], district_mapping, now=NOW)
    import json
    assert json.loads(record["service_types"]) == []


def test_build_opportunity_record_service_types_filters_nulls():
    opp_source = {
        "id": "opp3", "name": "Nulls", "school_yr": "2025-26",
        "contractType": None, "state": "CA",
        "sales_rep": {}, "stage": "1 - Lead", "net_booking_amount": 0,
        "close_date": None, "created_at": None,
        "invoices": [], "credit_memos": [],
        "accounts": [{"id": "acc1", "name": "D1"}],
        "referring_contact_name": None, "contracting_through": None,
        "funding_through": None, "payment_type": None,
        "payment_terms": None, "lead_source": None,
        "minimum_purchase_amount": None, "maximum_budget": None,
        "detailsLink": None, "stage_history": None,
        "start_date": None, "expiration": None,
    }
    district_mapping = {
        "acc1": {"nces_id": "0601234", "leaid": "0601234", "name": "D1", "type": "district"}
    }
    sessions = [
        {"sessionPrice": 100, "educatorPrice": 60, "educatorApprovedPrice": None,
         "startTime": "2026-01-01T10:00:00Z", "serviceType": None},
        {"sessionPrice": 100, "educatorPrice": 60, "educatorApprovedPrice": None,
         "startTime": "2026-01-01T10:00:00Z", "serviceType": "tutoring"},
    ]
    record = build_opportunity_record(opp_source, sessions, district_mapping, now=NOW)
    import json
    assert json.loads(record["service_types"]) == ["tutoring"]
