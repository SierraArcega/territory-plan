# Opportunity Sync Scheduler — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Docker-based Python scheduler that syncs opportunity data from OpenSearch into Supabase PostgreSQL on an hourly cadence, with computed financial metrics and district mapping.

**Architecture:** Standalone Python service in `scheduler/` directory, using `opensearch-py` for reading and `psycopg2` for writing. Runs via Docker Compose alongside the existing `db` service. Follows the same patterns as `scripts/etl/` (procedural Python, psycopg2 bulk ops, dotenv config).

**Tech Stack:** Python 3.11, opensearch-py, psycopg2-binary, schedule, python-dotenv, Docker

**Spec:** `Docs/superpowers/specs/2026-03-12-opportunity-scheduler-design.md`

---

## Task 1: Project Scaffold + Dockerfile

**Files:**
- Create: `scheduler/Dockerfile`
- Create: `scheduler/requirements.txt`
- Create: `scheduler/sync/__init__.py`

**Step 1: Create requirements.txt**

```
opensearch-py>=2.4.0
psycopg2-binary>=2.9.9
schedule>=1.2.0
python-dotenv>=1.0.0
```

**Step 2: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-u", "run_scheduler.py"]
```

**Step 3: Create empty `sync/__init__.py`**

**Step 4: Commit**

```bash
git add scheduler/
git commit -m "feat(scheduler): scaffold project with Dockerfile and requirements"
```

---

## Task 2: OpenSearch Client + Connection Helper

**Files:**
- Create: `scheduler/sync/opensearch_client.py`
- Create: `scheduler/tests/test_opensearch_client.py`

**Step 1: Write the test**

```python
# scheduler/tests/test_opensearch_client.py
import os
import pytest
from unittest.mock import patch, MagicMock

# Patch env before import
os.environ["OPENSEARCH_HOST"] = "https://test-host:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"

from sync.opensearch_client import get_client, scroll_all


def test_get_client_returns_opensearch_instance():
    with patch("sync.opensearch_client.OpenSearch") as MockOS:
        client = get_client()
        MockOS.assert_called_once()
        call_kwargs = MockOS.call_args[1]
        assert call_kwargs["hosts"] == [{"host": "test-host", "port": 9200}]
        assert call_kwargs["http_auth"] == ("user", "pass")
        assert call_kwargs["use_ssl"] is True


def test_scroll_all_paginates():
    mock_client = MagicMock()
    # First page returns 2 hits with sort, second returns 0
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
```

**Step 2: Run test to verify it fails**

```bash
cd scheduler && python -m pytest tests/test_opensearch_client.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'sync.opensearch_client'`

**Step 3: Write implementation**

```python
# scheduler/sync/opensearch_client.py
"""OpenSearch connection helper and pagination utility."""

import os
import logging
from urllib.parse import urlparse
from opensearchpy import OpenSearch

logger = logging.getLogger(__name__)


def get_client() -> OpenSearch:
    """Create an OpenSearch client from environment variables."""
    parsed = urlparse(os.environ["OPENSEARCH_HOST"])
    host = parsed.hostname or os.environ["OPENSEARCH_HOST"]
    port = parsed.port or 9200

    return OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_auth=(
            os.environ["OPENSEARCH_USERNAME"],
            os.environ["OPENSEARCH_PASSWORD"],
        ),
        use_ssl=True,
        verify_certs=True,
        timeout=60,
    )


def scroll_all(
    client: OpenSearch,
    index: str,
    query: dict,
    source_fields: list[str],
    size: int = 5000,
    sort_field: str = "_doc",
) -> list[dict]:
    """Paginate through all results using search_after."""
    results = []
    search_after = None

    while True:
        body = {
            "size": size,
            "query": query,
            "_source": source_fields,
            "sort": [{sort_field: "asc"}],
        }
        if search_after:
            body["search_after"] = search_after

        resp = client.search(index=index, body=body)
        hits = resp["hits"]["hits"]
        if not hits:
            break

        results.extend(hits)
        search_after = hits[-1]["sort"]
        logger.info(f"  Fetched {len(results)} records from {index}...")

    return results
```

**Step 4: Run test to verify it passes**

```bash
cd scheduler && python -m pytest tests/test_opensearch_client.py -v
```

**Step 5: Commit**

```bash
git add scheduler/sync/opensearch_client.py scheduler/tests/
git commit -m "feat(scheduler): add OpenSearch client with search_after pagination"
```

---

## Task 3: OpenSearch Queries (Opportunities + Sessions)

**Files:**
- Create: `scheduler/sync/queries.py`
- Create: `scheduler/tests/test_queries.py`

**Step 1: Write the test**

```python
# scheduler/tests/test_queries.py
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
        # Pass 1 ID — should still call scroll_all
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
```

**Step 2: Run test to verify it fails**

```bash
cd scheduler && python -m pytest tests/test_queries.py -v
```

**Step 3: Write implementation**

```python
# scheduler/sync/queries.py
"""OpenSearch query definitions for opportunities, sessions, and district lookups."""

import logging
from sync.opensearch_client import scroll_all

logger = logging.getLogger(__name__)

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

# School years to sync (2024-25 onward)
SCHOOL_YEARS = ["2024-25", "2025-26", "2026-27", "2027-28"]


def fetch_opportunities(client) -> list[dict]:
    """Fetch all opportunities from school year 2024-25 onward."""
    logger.info("Fetching opportunities...")
    query = {
        "bool": {
            "filter": [
                {"terms": {"school_yr": SCHOOL_YEARS}}
            ]
        }
    }
    hits = scroll_all(client, "clj-prod-opportunities", query, OPPORTUNITY_SOURCE_FIELDS)
    logger.info(f"Fetched {len(hits)} opportunities")
    return hits


def fetch_sessions(client, opportunity_ids: list[str]) -> list[dict]:
    """Fetch sessions for given opportunity IDs, excluding cancelled and doNotBill."""
    logger.info(f"Fetching sessions for {len(opportunity_ids)} opportunities...")
    all_hits = []

    # Batch into chunks of 1000 to avoid huge terms queries
    batch_size = 1000
    for i in range(0, len(opportunity_ids), batch_size):
        batch = opportunity_ids[i : i + batch_size]
        query = {
            "bool": {
                "filter": [
                    {"terms": {"opportunityId": batch}},
                ],
                "must_not": [
                    {"term": {"status": "cancelled"}},
                    {"term": {"doNotBill": True}},
                ],
            }
        }
        hits = scroll_all(client, "clj-prod-sessions-v2", query, SESSION_SOURCE_FIELDS)
        all_hits.extend(hits)

    logger.info(f"Fetched {len(all_hits)} sessions")
    return all_hits


def fetch_district_mappings(client, account_ids: list[str]) -> dict:
    """Batch lookup account IDs against clj-prod-districts for NCES/LEAID mapping.

    Returns dict: {lms_account_id: {nces_id, leaid, parent_district_id, name}}
    """
    logger.info(f"Fetching district mappings for {len(account_ids)} accounts...")
    query = {
        "bool": {
            "filter": [{"terms": {"lms_id": account_ids}}]
        }
    }
    hits = scroll_all(
        client, "clj-prod-districts", query,
        ["lms_id", "nces_id", "leaid", "parent_district_id", "name", "type"],
    )
    mapping = {}
    for hit in hits:
        src = hit["_source"]
        mapping[src["lms_id"]] = src
    logger.info(f"Resolved {len(mapping)} district mappings")
    return mapping
```

**Step 4: Run tests**

```bash
cd scheduler && python -m pytest tests/test_queries.py -v
```

**Step 5: Commit**

```bash
git add scheduler/sync/queries.py scheduler/tests/test_queries.py
git commit -m "feat(scheduler): add OpenSearch queries for opps, sessions, districts"
```

---

## Task 4: Financial Metric Computation

**Files:**
- Create: `scheduler/sync/compute.py`
- Create: `scheduler/tests/test_compute.py`

**Step 1: Write the test**

```python
# scheduler/tests/test_compute.py
from decimal import Decimal
from datetime import datetime, timezone
from sync.compute import compute_metrics, build_opportunity_record

NOW = datetime(2026, 3, 12, 12, 0, 0, tzinfo=timezone.utc)


def test_compute_metrics_basic():
    sessions = [
        # Completed session (past)
        {
            "sessionPrice": 100.0,
            "educatorPrice": 60.0,
            "educatorApprovedPrice": None,
            "startTime": "2026-01-01T10:00:00Z",
            "serviceType": "tutoring",
        },
        # Scheduled session (future)
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
    assert m["completed_take"] == Decimal("40.00")  # 100 - 60
    assert m["scheduled_sessions"] == 1
    assert m["scheduled_revenue"] == Decimal("200.00")
    assert m["scheduled_take"] == Decimal("120.00")  # 200 - 80
    assert m["total_revenue"] == Decimal("300.00")
    assert m["total_take"] == Decimal("160.00")
    assert m["average_take_rate"] == Decimal("0.5333")  # 160/300 rounded to 4 places


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
    assert m["completed_take"] == Decimal("50.00")  # 100 - 50 (approved price)


def test_compute_metrics_empty_sessions():
    m = compute_metrics([])
    assert m["total_revenue"] == Decimal("0")
    assert m["average_take_rate"] is None


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
```

**Step 2: Run test to verify it fails**

```bash
cd scheduler && python -m pytest tests/test_compute.py -v
```

**Step 3: Write implementation**

```python
# scheduler/sync/compute.py
"""Financial metric computation for opportunities."""

import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

FOUR_PLACES = Decimal("0.0001")
TWO_PLACES = Decimal("0.01")


def _to_decimal(val) -> Decimal:
    if val is None:
        return Decimal("0")
    return Decimal(str(val)).quantize(TWO_PLACES)


def _educator_cost(session: dict) -> Decimal:
    """Use educatorApprovedPrice for virtualStaffing, else educatorPrice."""
    if session.get("serviceType") == "virtualStaffing" and session.get("educatorApprovedPrice") is not None:
        return _to_decimal(session["educatorApprovedPrice"])
    return _to_decimal(session.get("educatorPrice", 0))


def compute_metrics(sessions: list[dict], now: datetime | None = None) -> dict:
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


def build_opportunity_record(
    opp: dict,
    sessions: list[dict],
    district_mapping: dict,
    now: datetime | None = None,
) -> dict:
    """Build a flat opportunity record ready for DB upsert."""
    if now is None:
        now = datetime.now(timezone.utc)

    metrics = compute_metrics(sessions, now=now)

    # Invoiced & credited
    invoiced = sum(_to_decimal(inv.get("amount", 0)) for inv in (opp.get("invoices") or []))
    credited = sum(_to_decimal(cm.get("amount", 0)) for cm in (opp.get("credit_memos") or []))

    # Sales rep
    sales_rep = opp.get("sales_rep") or {}

    # District resolution — find the district-type account
    accounts = opp.get("accounts") or []
    district_account = None
    for acc in accounts:
        acc_id = acc.get("id")
        if acc_id and acc_id in district_mapping:
            mapped = district_mapping[acc_id]
            # Prefer district-type, but take what we can get
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

    return {
        "id": opp["id"],
        "name": opp.get("name"),
        "school_yr": opp.get("school_yr"),
        "contract_type": opp.get("contractType"),
        "state": opp.get("state"),
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
        "invoiced": invoiced,
        "credited": credited,
        **metrics,
        **district_account,
        "synced_at": now,
    }
```

**Step 4: Run tests**

```bash
cd scheduler && python -m pytest tests/test_compute.py -v
```

**Step 5: Commit**

```bash
git add scheduler/sync/compute.py scheduler/tests/test_compute.py
git commit -m "feat(scheduler): add financial metric computation with TDD"
```

---

## Task 5: Supabase Writer (Upserts + Pipeline Aggregates)

**Files:**
- Create: `scheduler/sync/supabase_writer.py`
- Create: `scheduler/tests/test_supabase_writer.py`

**Step 1: Write the test**

```python
# scheduler/tests/test_supabase_writer.py
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
    STAGE_WEIGHTS,
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


def test_update_district_pipeline_aggregates():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    update_district_pipeline_aggregates(mock_conn)
    # Should execute: reset all, then update from opps, then update has_open_pipeline
    assert mock_cursor.execute.call_count >= 2
```

**Step 2: Run test to verify it fails**

```bash
cd scheduler && python -m pytest tests/test_supabase_writer.py -v
```

**Step 3: Write implementation**

```python
# scheduler/sync/supabase_writer.py
"""Write opportunity data to Supabase PostgreSQL."""

import os
import logging
from decimal import Decimal
import psycopg2

logger = logging.getLogger(__name__)

# Stage prefix -> weight for weighted pipeline
STAGE_WEIGHTS = {
    "0": Decimal("0.05"),
    "1": Decimal("0.10"),
    "2": Decimal("0.25"),
    "3": Decimal("0.50"),
    "4": Decimal("0.75"),
    "5": Decimal("0.90"),
}

# School year -> fiscal year label (for district column mapping)
SCHOOL_YR_TO_FY = {
    "2024-25": "fy25",
    "2025-26": "fy26",
    "2026-27": "fy27",
}

OPPORTUNITY_COLUMNS = [
    "id", "name", "school_yr", "contract_type", "state",
    "sales_rep_name", "sales_rep_email",
    "district_name", "district_lms_id", "district_nces_id", "district_lea_id",
    "created_at", "close_date", "brand_ambassador", "stage", "net_booking_amount",
    "contract_through", "funding_through", "payment_type", "payment_terms", "lead_source",
    "invoiced", "credited",
    "completed_revenue", "completed_take",
    "scheduled_sessions", "scheduled_revenue", "scheduled_take",
    "total_revenue", "total_take", "average_take_rate",
    "synced_at",
]


def get_connection():
    return psycopg2.connect(os.environ["SUPABASE_DB_URL"])


def upsert_opportunities(conn, records: list[dict]):
    """Upsert opportunity records into the opportunities table."""
    if not records:
        return

    cols = OPPORTUNITY_COLUMNS
    placeholders = ", ".join(["%s"] * len(cols))
    update_cols = [c for c in cols if c != "id"]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = f"""
        INSERT INTO opportunities ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET {update_set}
    """

    with conn.cursor() as cur:
        for record in records:
            values = [record.get(c) for c in cols]
            cur.execute(sql, values)

    conn.commit()
    logger.info(f"Upserted {len(records)} opportunities")


def upsert_unmatched(conn, records: list[dict]):
    """Upsert unmatched opportunity records, preserving manual resolutions."""
    if not records:
        return

    cols = [
        "id", "name", "stage", "school_yr", "account_name", "account_lms_id",
        "account_type", "state", "net_booking_amount", "reason", "synced_at",
    ]
    placeholders = ", ".join(["%s"] * len(cols))
    # Don't overwrite resolved/resolved_district_leaid
    update_cols = [c for c in cols if c != "id"]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = f"""
        INSERT INTO unmatched_opportunities ({", ".join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET {update_set}
        WHERE unmatched_opportunities.resolved = false
    """

    with conn.cursor() as cur:
        for record in records:
            values = [record.get(c) for c in cols]
            cur.execute(sql, values)

    conn.commit()
    logger.info(f"Upserted {len(records)} unmatched opportunities")


def update_district_pipeline_aggregates(conn):
    """Recompute pipeline aggregates on districts table from synced opportunities."""

    # Build CASE expression for stage weights
    weight_cases = "\n".join(
        f"WHEN stage LIKE '{prefix} %%' THEN {weight}" for prefix, weight in STAGE_WEIGHTS.items()
    )

    sql = f"""
        -- Reset pipeline fields for all districts
        UPDATE districts SET
            fy26_open_pipeline_opp_count = 0,
            fy26_open_pipeline = 0,
            fy26_open_pipeline_weighted = 0,
            fy27_open_pipeline_opp_count = 0,
            fy27_open_pipeline = 0,
            fy27_open_pipeline_weighted = 0,
            has_open_pipeline = false;

        -- Recompute from opportunities
        WITH pipeline AS (
            SELECT
                district_lea_id,
                school_yr,
                COUNT(*) AS opp_count,
                COALESCE(SUM(net_booking_amount), 0) AS total_pipeline,
                COALESCE(SUM(
                    net_booking_amount * CASE
                        {weight_cases}
                        ELSE 0
                    END
                ), 0) AS weighted_pipeline
            FROM opportunities
            WHERE district_lea_id IS NOT NULL
              AND stage LIKE ANY(ARRAY['0 %%', '1 %%', '2 %%', '3 %%', '4 %%', '5 %%'])
            GROUP BY district_lea_id, school_yr
        )
        UPDATE districts d SET
            fy26_open_pipeline_opp_count = COALESCE(p26.opp_count, 0),
            fy26_open_pipeline = COALESCE(p26.total_pipeline, 0),
            fy26_open_pipeline_weighted = COALESCE(p26.weighted_pipeline, 0),
            fy27_open_pipeline_opp_count = COALESCE(p27.opp_count, 0),
            fy27_open_pipeline = COALESCE(p27.total_pipeline, 0),
            fy27_open_pipeline_weighted = COALESCE(p27.weighted_pipeline, 0),
            has_open_pipeline = (COALESCE(p26.opp_count, 0) + COALESCE(p27.opp_count, 0)) > 0
        FROM (SELECT 1) AS dummy
        LEFT JOIN pipeline p26 ON p26.district_lea_id = d.leaid AND p26.school_yr = '2025-26'
        LEFT JOIN pipeline p27 ON p27.district_lea_id = d.leaid AND p27.school_yr = '2026-27';
    """

    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    logger.info("Updated district pipeline aggregates")
```

**Step 4: Run tests**

```bash
cd scheduler && python -m pytest tests/test_supabase_writer.py -v
```

**Step 5: Commit**

```bash
git add scheduler/sync/supabase_writer.py scheduler/tests/test_supabase_writer.py
git commit -m "feat(scheduler): add Supabase writer with upserts and pipeline aggregates"
```

---

## Task 6: Sync Orchestrator (Single Cycle)

**Files:**
- Create: `scheduler/run_sync.py`
- Create: `scheduler/tests/test_run_sync.py`

**Step 1: Write the test**

```python
# scheduler/tests/test_run_sync.py
import os
os.environ["OPENSEARCH_HOST"] = "https://test:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"
os.environ["SUPABASE_DB_URL"] = "postgresql://test:test@localhost:5432/test"

from unittest.mock import patch, MagicMock
from run_sync import run_sync


@patch("run_sync.update_district_pipeline_aggregates")
@patch("run_sync.upsert_unmatched")
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
    mock_upsert_opps, mock_upsert_unmatched, mock_update_agg,
):
    mock_fetch_opps.return_value = [
        {"_source": {"id": "opp1", "accounts": [{"id": "acc1"}]}}
    ]
    mock_fetch_sessions.return_value = [
        {"_source": {"opportunityId": "opp1", "sessionPrice": 100}}
    ]
    mock_fetch_districts.return_value = {"acc1": {"nces_id": "123", "leaid": "0100001"}}
    mock_build.return_value = {"id": "opp1", "district_lea_id": "0100001"}
    mock_conn = MagicMock()
    mock_get_conn.return_value = mock_conn

    run_sync()

    mock_upsert_opps.assert_called_once()
    mock_update_agg.assert_called_once()
    mock_conn.close.assert_called_once()
```

**Step 2: Run test to verify it fails**

```bash
cd scheduler && python -m pytest tests/test_run_sync.py -v
```

**Step 3: Write implementation**

```python
# scheduler/run_sync.py
"""Single sync cycle: fetch from OpenSearch, compute, write to Supabase."""

import logging
from collections import defaultdict
from datetime import datetime, timezone

from sync.opensearch_client import get_client
from sync.queries import fetch_opportunities, fetch_sessions, fetch_district_mappings
from sync.compute import build_opportunity_record
from sync.supabase_writer import (
    get_connection,
    upsert_opportunities,
    upsert_unmatched,
    update_district_pipeline_aggregates,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def run_sync():
    """Execute one full sync cycle."""
    now = datetime.now(timezone.utc)
    logger.info(f"=== Starting sync cycle at {now.isoformat()} ===")

    # Phase 1: Fetch opportunities
    os_client = get_client()
    opp_hits = fetch_opportunities(os_client)
    if not opp_hits:
        logger.info("No opportunities found, skipping cycle")
        return

    # Phase 2: Fetch sessions
    opp_ids = [h["_source"]["id"] for h in opp_hits]
    session_hits = fetch_sessions(os_client, opp_ids)

    # Group sessions by opportunity ID
    sessions_by_opp = defaultdict(list)
    for sh in session_hits:
        src = sh["_source"]
        sessions_by_opp[src["opportunityId"]].append(src)

    # Phase 3: District mappings
    account_ids = set()
    for h in opp_hits:
        for acc in (h["_source"].get("accounts") or []):
            if acc.get("id"):
                account_ids.add(acc["id"])
    district_mapping = fetch_district_mappings(os_client, list(account_ids))

    # Check for manual resolutions from unmatched_opportunities
    conn = get_connection()
    try:
        manual_resolutions = _load_manual_resolutions(conn)

        # Phase 4: Compute metrics and build records
        matched_records = []
        unmatched_records = []

        for h in opp_hits:
            opp = h["_source"]
            opp_sessions = sessions_by_opp.get(opp["id"], [])
            record = build_opportunity_record(opp, opp_sessions, district_mapping, now=now)

            # Check if unmatched but manually resolved
            if record["district_lea_id"] is None and opp["id"] in manual_resolutions:
                record["district_lea_id"] = manual_resolutions[opp["id"]]

            if record["district_lea_id"] is not None:
                matched_records.append(record)
            else:
                # Build unmatched record
                accounts = opp.get("accounts") or []
                first_acc = accounts[0] if accounts else {}
                unmatched_records.append({
                    "id": opp["id"],
                    "name": opp.get("name"),
                    "stage": opp.get("stage"),
                    "school_yr": opp.get("school_yr"),
                    "account_name": first_acc.get("name"),
                    "account_lms_id": first_acc.get("id"),
                    "account_type": first_acc.get("type"),
                    "state": opp.get("state"),
                    "net_booking_amount": record["net_booking_amount"],
                    "reason": "No NCES/LEAID mapping found for account",
                    "synced_at": now,
                })
                # Still upsert to opportunities (with null district)
                matched_records.append(record)

        # Phase 5: Write to Supabase
        upsert_opportunities(conn, matched_records)
        if unmatched_records:
            upsert_unmatched(conn, unmatched_records)
        update_district_pipeline_aggregates(conn)

        logger.info(
            f"=== Sync complete: {len(matched_records)} opps, "
            f"{len(unmatched_records)} unmatched ==="
        )
    finally:
        conn.close()


def _load_manual_resolutions(conn) -> dict:
    """Load manually resolved opportunity -> district mappings."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, resolved_district_leaid FROM unmatched_opportunities "
            "WHERE resolved = true AND resolved_district_leaid IS NOT NULL"
        )
        return {row[0]: row[1] for row in cur.fetchall()}


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    run_sync()
```

**Step 4: Run tests**

```bash
cd scheduler && python -m pytest tests/test_run_sync.py -v
```

**Step 5: Commit**

```bash
git add scheduler/run_sync.py scheduler/tests/test_run_sync.py
git commit -m "feat(scheduler): add sync orchestrator with 5-phase pipeline"
```

---

## Task 7: Scheduler Loop (Hourly + Heartbeat)

**Files:**
- Create: `scheduler/run_scheduler.py`

**Step 1: Write implementation**

```python
# scheduler/run_scheduler.py
"""Hourly scheduler with heartbeat monitoring."""

import os
import time
import logging
import traceback
from pathlib import Path
from datetime import datetime, timezone

import schedule
from dotenv import load_dotenv

load_dotenv()

from run_sync import run_sync

LOG_DIR = Path("/app/logs") if os.path.isdir("/app") else Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "scheduler.log"),
    ],
)
logger = logging.getLogger("scheduler")

HEARTBEAT_FILE = LOG_DIR / "heartbeat"
HEARTBEAT_INTERVAL = 300  # 5 minutes


def safe_sync():
    """Run sync with error handling and retry."""
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            run_sync()
            return
        except Exception as e:
            logger.error(f"Sync attempt {attempt}/{max_retries} failed: {e}")
            logger.error(traceback.format_exc())
            if attempt < max_retries:
                wait = 2 ** attempt * 10  # 20s, 40s
                logger.info(f"Retrying in {wait}s...")
                time.sleep(wait)
    logger.error("All sync attempts failed for this cycle")


def write_heartbeat():
    """Write heartbeat file for monitoring."""
    HEARTBEAT_FILE.write_text(datetime.now(timezone.utc).isoformat())


if __name__ == "__main__":
    logger.info("Starting opportunity sync scheduler")

    # Immediate first sync
    safe_sync()

    # Schedule hourly
    schedule.every(1).hour.do(safe_sync)

    # Run loop
    last_heartbeat = 0
    while True:
        schedule.run_pending()
        now = time.time()
        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            write_heartbeat()
            last_heartbeat = now
        time.sleep(10)
```

**Step 2: Commit**

```bash
git add scheduler/run_scheduler.py
git commit -m "feat(scheduler): add hourly scheduler loop with heartbeat and retry"
```

---

## Task 8: Docker Compose Integration

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

**Step 1: Add scheduler service to docker-compose.yml**

Append to the existing `services:` block (after `db:`):

```yaml
  scheduler:
    build: ./scheduler
    container_name: tp_scheduler
    environment:
      - OPENSEARCH_HOST=${OPENSEARCH_HOST}
      - OPENSEARCH_USERNAME=${OPENSEARCH_USERNAME}
      - OPENSEARCH_PASSWORD=${OPENSEARCH_PASSWORD}
      - SUPABASE_DB_URL=${SUPABASE_DB_URL}
    volumes:
      - ./scheduler:/app
      - scheduler_logs:/app/logs
    command: python -u /app/run_scheduler.py
    restart: unless-stopped
```

Add to `volumes:` block:

```yaml
  scheduler_logs:
```

**Step 2: Add env vars to .env.example**

Append:

```
# Scheduler (OpenSearch -> Supabase sync)
OPENSEARCH_HOST="https://your-opensearch-endpoint:9200"
OPENSEARCH_USERNAME="[opensearch-username]"
OPENSEARCH_PASSWORD="[opensearch-password]"
SUPABASE_DB_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

**Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(scheduler): add Docker Compose integration and env vars"
```

---

## Task 9: Database Tables + RLS (Supabase SQL)

**Files:**
- Create: `supabase/migrations/001_opportunities.sql`

**Step 1: Write migration SQL**

```sql
-- Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    name TEXT,
    school_yr TEXT,
    contract_type TEXT,
    state TEXT,
    sales_rep_name TEXT,
    sales_rep_email TEXT,
    district_name TEXT,
    district_lms_id TEXT,
    district_nces_id TEXT,
    district_lea_id TEXT,
    created_at TIMESTAMPTZ,
    close_date TIMESTAMPTZ,
    brand_ambassador TEXT,
    stage TEXT,
    net_booking_amount DECIMAL(15,2),
    contract_through TEXT,
    funding_through TEXT,
    payment_type TEXT,
    payment_terms TEXT,
    lead_source TEXT,
    invoiced DECIMAL(15,2),
    credited DECIMAL(15,2),
    completed_revenue DECIMAL(15,2),
    completed_take DECIMAL(15,2),
    scheduled_sessions INT,
    scheduled_revenue DECIMAL(15,2),
    scheduled_take DECIMAL(15,2),
    total_revenue DECIMAL(15,2),
    total_take DECIMAL(15,2),
    average_take_rate DECIMAL(5,4),
    synced_at TIMESTAMPTZ
);

CREATE INDEX idx_opps_school_yr ON opportunities (school_yr);
CREATE INDEX idx_opps_district_nces_id ON opportunities (district_nces_id);
CREATE INDEX idx_opps_district_lea_id ON opportunities (district_lea_id);
CREATE INDEX idx_opps_stage ON opportunities (stage);

-- Create unmatched_opportunities table
CREATE TABLE IF NOT EXISTS unmatched_opportunities (
    id TEXT PRIMARY KEY,
    name TEXT,
    stage TEXT,
    school_yr TEXT,
    account_name TEXT,
    account_lms_id TEXT,
    account_type TEXT,
    state TEXT,
    net_booking_amount DECIMAL(15,2),
    reason TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_district_leaid TEXT,
    synced_at TIMESTAMPTZ
);

CREATE INDEX idx_unmatched_resolved ON unmatched_opportunities (resolved);
CREATE INDEX idx_unmatched_school_yr ON unmatched_opportunities (school_yr);

-- RLS Policies
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_opportunities ENABLE ROW LEVEL SECURITY;

-- Opportunities: read-only for authenticated users
CREATE POLICY "Authenticated users can read opportunities"
    ON opportunities FOR SELECT
    USING (auth.role() = 'authenticated');

-- Unmatched: read for authenticated, update resolved fields for authenticated
CREATE POLICY "Authenticated users can read unmatched opportunities"
    ON unmatched_opportunities FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can resolve unmatched opportunities"
    ON unmatched_opportunities FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
```

**Step 2: Add to existing RLS file**

Append the new table RLS policies to `supabase/rls-policies.sql` for documentation.

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat(scheduler): add opportunities tables migration and RLS policies"
```

---

## Task 10: Prisma Schema Update

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Opportunity and UnmatchedOpportunity models**

Add after the existing models:

```prisma
model Opportunity {
  id                 String    @id
  name               String?
  schoolYr           String?   @map("school_yr")
  contractType       String?   @map("contract_type")
  state              String?
  salesRepName       String?   @map("sales_rep_name")
  salesRepEmail      String?   @map("sales_rep_email")
  districtName       String?   @map("district_name")
  districtLmsId      String?   @map("district_lms_id")
  districtNcesId     String?   @map("district_nces_id")
  districtLeaId      String?   @map("district_lea_id")
  createdAt          DateTime? @map("created_at") @db.Timestamptz
  closeDate          DateTime? @map("close_date") @db.Timestamptz
  brandAmbassador    String?   @map("brand_ambassador")
  stage              String?
  netBookingAmount   Decimal?  @map("net_booking_amount") @db.Decimal(15, 2)
  contractThrough    String?   @map("contract_through")
  fundingThrough     String?   @map("funding_through")
  paymentType        String?   @map("payment_type")
  paymentTerms       String?   @map("payment_terms")
  leadSource         String?   @map("lead_source")
  invoiced           Decimal?  @db.Decimal(15, 2)
  credited           Decimal?  @db.Decimal(15, 2)
  completedRevenue   Decimal?  @map("completed_revenue") @db.Decimal(15, 2)
  completedTake      Decimal?  @map("completed_take") @db.Decimal(15, 2)
  scheduledSessions  Int?      @map("scheduled_sessions")
  scheduledRevenue   Decimal?  @map("scheduled_revenue") @db.Decimal(15, 2)
  scheduledTake      Decimal?  @map("scheduled_take") @db.Decimal(15, 2)
  totalRevenue       Decimal?  @map("total_revenue") @db.Decimal(15, 2)
  totalTake          Decimal?  @map("total_take") @db.Decimal(15, 2)
  averageTakeRate    Decimal?  @map("average_take_rate") @db.Decimal(5, 4)
  syncedAt           DateTime? @map("synced_at") @db.Timestamptz

  @@map("opportunities")
  @@index([schoolYr])
  @@index([districtNcesId])
  @@index([districtLeaId])
  @@index([stage])
}

model UnmatchedOpportunity {
  id                    String   @id
  name                  String?
  stage                 String?
  schoolYr              String?  @map("school_yr")
  accountName           String?  @map("account_name")
  accountLmsId          String?  @map("account_lms_id")
  accountType           String?  @map("account_type")
  state                 String?
  netBookingAmount      Decimal? @map("net_booking_amount") @db.Decimal(15, 2)
  reason                String?
  resolved              Boolean  @default(false)
  resolvedDistrictLeaid String?  @map("resolved_district_leaid")
  syncedAt              DateTime? @map("synced_at") @db.Timestamptz

  @@map("unmatched_opportunities")
  @@index([resolved])
  @@index([schoolYr])
}
```

**Step 2: Verify schema is valid**

```bash
npx prisma validate
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(scheduler): add Opportunity and UnmatchedOpportunity Prisma models"
```

---

## Summary

| Task | What | Estimated Steps |
|------|------|----------------|
| 1 | Scaffold + Dockerfile | 4 |
| 2 | OpenSearch client | 5 |
| 3 | OpenSearch queries | 5 |
| 4 | Financial computation | 5 |
| 5 | Supabase writer | 5 |
| 6 | Sync orchestrator | 5 |
| 7 | Scheduler loop | 2 |
| 8 | Docker Compose integration | 3 |
| 9 | DB tables + RLS migration | 3 |
| 10 | Prisma schema update | 3 |

**Note:** The frontend discrepancy queue and database audit are handled by teammates — see separate briefs.
