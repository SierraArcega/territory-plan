# Session Storage & Service Type Aggregation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store individual session records from OpenSearch in a new `sessions` table and aggregate distinct service types as a JSON array on each opportunity.

**Architecture:** Extend the existing scheduler sync pipeline. A new `sessions` table stores per-session detail (price, service type, start time, educator cost). During sync, `build_opportunity_record` computes a `service_types` JSON array from sessions. The writer deletes-and-replaces sessions per opportunity in a single transaction.

**Tech Stack:** Python (scheduler), PostgreSQL/Prisma (schema), psycopg2 (writer), pytest (tests)

**Spec:** `docs/superpowers/specs/2026-03-16-session-storage-design.md`

---

## Chunk 1: Schema & Compute Changes

### Task 1: Add Session model and serviceTypes field to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (after Opportunity model, ~line 1118)

- [ ] **Step 1: Add Session model to schema.prisma**

Add after the Opportunity model's closing `}` (after line 1118):

```prisma
// ===== Sessions =====
// Individual session records synced from OpenSearch.
// Linked to opportunities by opportunity_id (no FK constraint).
model Session {
  id                    String    @id @db.Text
  opportunityId         String    @map("opportunity_id") @db.Text
  serviceType           String?   @map("service_type") @db.Text
  sessionPrice          Decimal?  @map("session_price") @db.Decimal(15, 2)
  educatorPrice         Decimal?  @map("educator_price") @db.Decimal(15, 2)
  educatorApprovedPrice Decimal?  @map("educator_approved_price") @db.Decimal(15, 2)
  startTime             DateTime? @map("start_time") @db.Timestamptz
  syncedAt              DateTime? @map("synced_at") @db.Timestamptz

  @@index([opportunityId])
  @@index([opportunityId, serviceType])
  @@index([startTime])
  @@map("sessions")
}
```

- [ ] **Step 2: Add serviceTypes field to Opportunity model**

In the Opportunity model, add after the `averageTakeRate` field (after line 1109):

```prisma
  serviceTypes       Json      @default("[]") @map("service_types")
```

- [ ] **Step 3: Generate Prisma migration**

Run: `npx prisma migrate dev --name add_sessions_table`
Expected: Migration created successfully, schema synced.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add sessions table and service_types field on opportunities"
```

---

### Task 2: Add service_types computation to build_opportunity_record

**Files:**
- Modify: `scheduler/sync/compute.py:80-139`
- Test: `scheduler/tests/test_compute.py`

- [ ] **Step 1: Write failing tests for service_types computation**

Add to `scheduler/tests/test_compute.py`:

```python
def test_build_opportunity_record_computes_service_types():
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
        "invoices": [],
        "credit_memos": [],
        "accounts": [{"id": "acc1", "type": "district", "name": "Test District"}],
        "referring_contact_name": None,
        "contracting_through": None,
        "funding_through": None,
        "payment_type": None,
        "payment_terms": None,
        "lead_source": None,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_compute.py::test_build_opportunity_record_computes_service_types tests/test_compute.py::test_build_opportunity_record_service_types_empty_sessions tests/test_compute.py::test_build_opportunity_record_service_types_filters_nulls -v`
Expected: FAIL — `KeyError: 'service_types'`

- [ ] **Step 3: Add service_types to build_opportunity_record**

In `scheduler/sync/compute.py`, in the `build_opportunity_record` function, add before the `return` statement (before line 116):

```python
    import json

    # Collect distinct non-null service types, sorted for stability
    service_types = sorted(set(
        s.get("serviceType") for s in sessions if s.get("serviceType")
    ))
```

Note: the `import json` should be added at the top of the file (after the existing imports), not inline. It's shown here for context.

Then add `"service_types"` to the returned dict. Change line 138 from:

```python
        "synced_at": now,
```

to:

```python
        "service_types": json.dumps(service_types),
        "synced_at": now,
```

The `json.dumps()` is required because psycopg2 cannot insert a Python list directly into a `jsonb` column — it needs a JSON string.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/test_compute.py -v`
Expected: All tests PASS (including existing ones)

- [ ] **Step 5: Commit**

```bash
git add scheduler/sync/compute.py scheduler/tests/test_compute.py
git commit -m "feat(scheduler): compute service_types in build_opportunity_record"
```

---

## Chunk 2: Writer & Sync Orchestration

### Task 3: Add upsert_sessions and update OPPORTUNITY_COLUMNS in supabase_writer

**Files:**
- Modify: `scheduler/sync/supabase_writer.py:20-31` (OPPORTUNITY_COLUMNS), new function
- Test: `scheduler/tests/test_supabase_writer.py`

- [ ] **Step 1: Write failing test for upsert_sessions**

Add to `scheduler/tests/test_supabase_writer.py`:

```python
from sync.supabase_writer import upsert_sessions


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
    # First call should be DELETE for opp1
    delete_sql = calls[0][0][0]
    assert "DELETE FROM sessions" in delete_sql
    # Subsequent calls should be INSERTs
    insert_sql = calls[1][0][0]
    assert "INSERT INTO sessions" in insert_sql
    # Should have been called 3 times: 1 DELETE + 2 INSERTs
    assert mock_cursor.execute.call_count == 3
    mock_conn.commit.assert_called_once()


def test_upsert_sessions_empty_dict():
    mock_conn = MagicMock()
    upsert_sessions(mock_conn, {})
    mock_conn.cursor.assert_not_called()
```

- [ ] **Step 2: Write failing test for updated OPPORTUNITY_COLUMNS**

Add to `scheduler/tests/test_supabase_writer.py`:

```python
from sync.supabase_writer import OPPORTUNITY_COLUMNS


def test_opportunity_columns_includes_service_types():
    assert "service_types" in OPPORTUNITY_COLUMNS
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_supabase_writer.py::test_upsert_sessions_deletes_then_inserts tests/test_supabase_writer.py::test_upsert_sessions_empty_dict tests/test_supabase_writer.py::test_opportunity_columns_includes_service_types -v`
Expected: FAIL — `ImportError` for `upsert_sessions` and assertion failure for `service_types`

- [ ] **Step 4: Add service_types to OPPORTUNITY_COLUMNS**

In `scheduler/sync/supabase_writer.py`, add `"service_types"` to the `OPPORTUNITY_COLUMNS` list. Change line 30 from:

```python
    "synced_at",
```

to:

```python
    "service_types",
    "synced_at",
```

- [ ] **Step 5: Implement upsert_sessions**

Add to `scheduler/sync/supabase_writer.py` after the `upsert_opportunities` function (after line 60):

```python
SESSION_COLUMNS = [
    "id", "opportunity_id", "service_type",
    "session_price", "educator_price", "educator_approved_price",
    "start_time", "synced_at",
]


def upsert_sessions(conn, sessions_by_opp):
    """Delete-and-replace sessions for each affected opportunity.

    Runs all deletes and inserts in a single transaction so a crash
    either leaves old sessions intact or has the complete new set.
    """
    if not sessions_by_opp:
        return

    placeholders = ", ".join(["%s"] * len(SESSION_COLUMNS))
    insert_sql = f"INSERT INTO sessions ({', '.join(SESSION_COLUMNS)}) VALUES ({placeholders})"

    total = 0
    with conn.cursor() as cur:
        for opp_id, sessions in sessions_by_opp.items():
            cur.execute("DELETE FROM sessions WHERE opportunity_id = %s", (opp_id,))
            for session in sessions:
                values = [session.get(c) for c in SESSION_COLUMNS]
                cur.execute(insert_sql, values)
                total += 1

    conn.commit()
    logger.info(f"Upserted {total} sessions across {len(sessions_by_opp)} opportunities")
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/test_supabase_writer.py -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add scheduler/sync/supabase_writer.py scheduler/tests/test_supabase_writer.py
git commit -m "feat(scheduler): add upsert_sessions and service_types to OPPORTUNITY_COLUMNS"
```

---

### Task 4: Wire session storage into run_sync

**Files:**
- Modify: `scheduler/run_sync.py:17-26` (imports), `scheduler/run_sync.py:77-81` (session grouping), `scheduler/run_sync.py:130-148` (write phase)
- Test: `scheduler/tests/test_run_sync.py`

- [ ] **Step 1: Update the existing happy-path test**

In `scheduler/tests/test_run_sync.py`, the `test_run_sync_happy_path` test needs to:

1. Add `mock_upsert_sessions` to the patch stack
2. Update `mock_fetch_sessions` to return hits with `_id`
3. Assert `upsert_sessions` was called

Replace the entire `test_run_sync_happy_path` function:

```python
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
```

Also update `test_run_sync_no_opportunities_skips` to add the `mock_upsert_sessions` patch:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_run_sync.py -v`
Expected: FAIL — `ImportError` for `upsert_sessions` in `run_sync`, missing `sessions_stored` key

- [ ] **Step 3: Update run_sync.py imports**

In `scheduler/run_sync.py`, add `upsert_sessions` to the import from `sync.supabase_writer` (line 17-26):

```python
from sync.supabase_writer import (
    get_connection,
    upsert_opportunities,
    upsert_sessions,
    upsert_unmatched,
    remove_matched_from_unmatched,
    update_district_pipeline_aggregates,
    refresh_map_features,
    get_last_synced_at,
    set_last_synced_at,
)
```

- [ ] **Step 4: Update session grouping to preserve _id**

In `scheduler/run_sync.py`, change the session grouping block (lines 77-81) from:

```python
    # Group sessions by opportunity ID
    sessions_by_opp = defaultdict(list)
    for sh in session_hits:
        src = sh["_source"]
        sessions_by_opp[src["opportunityId"]].append(src)
```

to:

```python
    # Group sessions by opportunity ID (preserve _id for storage)
    sessions_by_opp = defaultdict(list)
    for sh in session_hits:
        src = sh["_source"]
        src["_id"] = sh["_id"]
        sessions_by_opp[src["opportunityId"]].append(src)
```

- [ ] **Step 4b: Update early return to include sessions_stored**

In `scheduler/run_sync.py`, update the early return (line 55) from:

```python
        return {"status": "success", "opps_synced": 0, "unmatched_count": None, "error": None}
```

to:

```python
        return {"status": "success", "opps_synced": 0, "sessions_stored": 0, "unmatched_count": None, "error": None}
```

- [ ] **Step 5: Build session records and call upsert_sessions**

In `scheduler/run_sync.py`, replace the code inside the `try:` block from the Phase 5 comment through the `return` statement (lines 130-154). The `try:` on line 91 and `finally: conn.close()` on lines 155-156 must be preserved — only replace the content between them. Replace with:

```python
        # Phase 5: Write to Supabase
        upsert_opportunities(conn, matched_records)
        if unmatched_records:
            upsert_unmatched(conn, unmatched_records)

        # Build session records for storage
        session_records_by_opp = {}
        for opp_id, opp_sessions in sessions_by_opp.items():
            session_records_by_opp[opp_id] = [
                {
                    "id": s["_id"],
                    "opportunity_id": s["opportunityId"],
                    "service_type": s.get("serviceType"),
                    "session_price": s.get("sessionPrice"),
                    "educator_price": s.get("educatorPrice"),
                    "educator_approved_price": s.get("educatorApprovedPrice"),
                    "start_time": s.get("startTime"),
                    "synced_at": now,
                }
                for s in opp_sessions
            ]
        total_sessions = sum(len(v) for v in session_records_by_opp.values())
        upsert_sessions(conn, session_records_by_opp)

        # Clean up: remove opps from unmatched that now have a district match
        newly_matched_ids = [
            r["id"] for r in matched_records if r.get("district_lea_id") is not None
        ]
        remove_matched_from_unmatched(conn, newly_matched_ids)

        update_district_pipeline_aggregates(conn)
        refresh_map_features(conn)
        set_last_synced_at(conn, now)

        logger.info(
            f"=== Sync complete: {len(matched_records)} opps, "
            f"{total_sessions} sessions, "
            f"{len(unmatched_records)} unmatched ==="
        )
        return {
            "status": "success",
            "opps_synced": len(matched_records),
            "sessions_stored": total_sessions,
            "unmatched_count": len(unmatched_records),
            "error": None,
        }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add scheduler/run_sync.py scheduler/tests/test_run_sync.py
git commit -m "feat(scheduler): wire session storage into sync pipeline"
```

---

### Task 5: Write the spec file to the repo (if not already present)

**Files:**
- Create: `docs/superpowers/specs/2026-03-16-session-storage-design.md`

- [ ] **Step 1: Verify the spec file exists**

Check if `docs/superpowers/specs/2026-03-16-session-storage-design.md` exists. If not, recreate it from the approved design (see the brainstorming conversation for the full spec content).

- [ ] **Step 2: Commit if new**

```bash
git add docs/superpowers/specs/2026-03-16-session-storage-design.md
git commit -m "docs: add session storage design spec"
```

---

### Task 6: Run full test suite and verify

- [ ] **Step 1: Run all scheduler tests**

Run: `cd scheduler && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Verify Prisma schema is valid**

Run: `npx prisma validate`
Expected: Schema is valid

- [ ] **Step 3: Final commit (if any formatting/lint fixes needed)**
