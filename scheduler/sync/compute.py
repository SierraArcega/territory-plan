"""Financial metric computation for opportunities."""

import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from .normalize import normalize_state

logger = logging.getLogger(__name__)

FOUR_PLACES = Decimal("0.0001")
TWO_PLACES = Decimal("0.01")


def _to_decimal(val):
    if val is None:
        return Decimal("0")
    s = str(val).strip()
    if not s:
        return Decimal("0")
    try:
        return Decimal(s).quantize(TWO_PLACES)
    except Exception:
        logger.warning(f"Could not convert to Decimal: {val!r}, defaulting to 0")
        return Decimal("0")


def _educator_cost(session):
    """Use educatorApprovedPrice for virtualStaffing, else educatorPrice."""
    if session.get("serviceType") == "virtualStaffing" and session.get("educatorApprovedPrice") is not None:
        return _to_decimal(session["educatorApprovedPrice"])
    return _to_decimal(session.get("educatorPrice", 0))


def compute_metrics(sessions, now=None):
    """Compute financial metrics from a list of session records."""
    if now is None:
        now = datetime.now(timezone.utc)

    completed_revenue = Decimal("0")
    completed_take = Decimal("0")
    scheduled_sessions = 0
    scheduled_revenue = Decimal("0")
    scheduled_take = Decimal("0")

    for s in sessions:
        price = _to_decimal(s.get("sessionPrice", 0))
        cost = _educator_cost(s)
        start_str = s.get("startTime", "")
        try:
            start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue

        if start < now:
            completed_revenue += price
            completed_take += price - cost
        else:
            scheduled_sessions += 1
            scheduled_revenue += price
            scheduled_take += price - cost

    total_revenue = completed_revenue + scheduled_revenue
    total_take = completed_take + scheduled_take
    avg_take_rate = None
    if total_revenue > 0:
        avg_take_rate = (total_take / total_revenue).quantize(FOUR_PLACES, ROUND_HALF_UP)

    return {
        "completed_revenue": completed_revenue,
        "completed_take": completed_take,
        "scheduled_sessions": scheduled_sessions,
        "scheduled_revenue": scheduled_revenue,
        "scheduled_take": scheduled_take,
        "total_revenue": total_revenue,
        "total_take": total_take,
        "average_take_rate": avg_take_rate,
    }


def build_opportunity_record(opp, sessions, district_mapping, now=None):
    """Build a flat opportunity record ready for DB upsert."""
    if now is None:
        now = datetime.now(timezone.utc)

    metrics = compute_metrics(sessions, now=now)

    invoiced = sum(_to_decimal(inv.get("amount", 0)) for inv in (opp.get("invoices") or []))
    credited = sum(_to_decimal(cm.get("amount", 0)) for cm in (opp.get("credit_memos") or []))

    sales_rep = opp.get("sales_rep") or {}

    accounts = opp.get("accounts") or []
    district_account = None
    for acc in accounts:
        acc_id = str(acc.get("id", ""))
        if acc_id and acc_id in district_mapping:
            mapped = district_mapping[acc_id]
            if mapped.get("type") == "district" or district_account is None:
                district_account = {
                    "district_name": mapped.get("name", acc.get("name")),
                    "district_lms_id": acc_id,
                    "district_nces_id": mapped.get("nces_id"),
                    "district_lea_id": mapped.get("leaid"),
                }
                if mapped.get("type") == "district":
                    break

    if district_account is None:
        district_account = {
            "district_name": accounts[0].get("name") if accounts else None,
            "district_lms_id": accounts[0].get("id") if accounts else None,
            "district_nces_id": None,
            "district_lea_id": None,
        }

    service_types = sorted(set(
        s.get("serviceType") for s in sessions if s.get("serviceType")
    ))

    return {
        "id": opp["id"],
        "name": opp.get("name"),
        "school_yr": opp.get("school_yr"),
        "contract_type": opp.get("contractType"),
        "state": normalize_state(opp.get("state")),
        "sales_rep_name": sales_rep.get("name"),
        "sales_rep_email": sales_rep.get("email"),
        "stage": opp.get("stage"),
        "net_booking_amount": _to_decimal(opp.get("net_booking_amount")),
        "close_date": opp.get("close_date"),
        "created_at": opp.get("created_at"),
        "brand_ambassador": opp.get("referring_contact_name"),
        "contract_through": opp.get("contracting_through"),
        "funding_through": opp.get("funding_through"),
        "payment_type": opp.get("payment_type"),
        "payment_terms": opp.get("payment_terms"),
        "lead_source": opp.get("lead_source"),
        "minimum_purchase_amount": _to_decimal(opp.get("minimum_purchase_amount")) if opp.get("minimum_purchase_amount") is not None else None,
        "maximum_budget": _to_decimal(opp.get("maximum_budget")) if opp.get("maximum_budget") is not None else None,
        "details_link": opp.get("detailsLink"),
        "stage_history": json.dumps(opp.get("stage_history") or []),
        "start_date": opp.get("start_date"),
        "expiration": opp.get("expiration"),
        "invoiced": invoiced,
        "credited": credited,
        **metrics,
        **district_account,
        "service_types": json.dumps(service_types),
        "synced_at": now,
    }
