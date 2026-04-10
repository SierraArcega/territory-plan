# OpenSearch Sync Field Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new fields to the `opportunities` table and 3 new fields to the `sessions` table, synced from OpenSearch through the existing scheduler pipeline.

**Architecture:** Thread new fields through each layer of the existing sync pipeline: OpenSearch query → Python compute/mapping → Postgres upsert → Prisma schema → TypeScript types. No new architecture — every change extends an existing list or dict.

**Tech Stack:** Python (scheduler), Prisma/PostgreSQL (schema + migration), TypeScript (frontend types), Vitest (JS tests), pytest (Python tests)

**Spec:** `docs/superpowers/specs/2026-04-10-opensearch-sync-field-expansion-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify :1255-1301, :1306-1320 | Add new fields to Opportunity and Session models |
| `scheduler/sync/queries.py` | Modify :8-13, :15-18 | Add new source fields to OpenSearch queries |
| `scheduler/sync/compute.py` | Modify :121-145 | Map new OS fields in `build_opportunity_record` return dict |
| `scheduler/run_sync.py` | Modify :142-154 | Add new fields to session record builder |
| `scheduler/sync/supabase_writer.py` | Modify :21-33, :65-69 | Add columns to OPPORTUNITY_COLUMNS and SESSION_COLUMNS |
| `src/features/shared/types/api-types.ts` | Modify :919-932 | Add fields to PlanOpportunityRow |
| `scheduler/tests/test_queries.py` | Modify :4-14 | Update expected source field lists |
| `scheduler/tests/test_compute.py` | Modify :67-99 | Add new fields to test fixtures and assertions |
| `scheduler/tests/test_supabase_writer.py` | Modify :31-49, :93-114 | Add new fields to opportunity and session test fixtures |
| `scheduler/tests/test_run_sync.py` | Modify :33-37 | Add new fields to session mock data |

---

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:1255-1301` (Opportunity model)
- Modify: `prisma/schema.prisma:1306-1320` (Session model)

- [ ] **Step 1: Add 6 new fields to Opportunity model**

In `prisma/schema.prisma`, add these fields after `serviceTypes` (line 1289) and before `syncedAt` (line 1290):

```prisma
  minimumPurchaseAmount Decimal?  @map("minimum_purchase_amount") @db.Decimal(15, 2)
  maximumBudget         Decimal?  @map("maximum_budget") @db.Decimal(15, 2)
  detailsLink           String?   @map("details_link") @db.Text
  stageHistory          Json      @default("[]") @map("stage_history")
  startDate             DateTime? @map("start_date") @db.Timestamptz
  expiration            DateTime? @map("expiration") @db.Timestamptz
```

- [ ] **Step 2: Add 3 new fields to Session model**

In `prisma/schema.prisma`, add these fields after `startTime` (line 1313) and before `syncedAt` (line 1314):

```prisma
  type                  String?   @db.Text
  status                String?   @db.Text
  serviceName           String?   @map("service_name") @db.Text
```

- [ ] **Step 3: Generate and run the migration**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan
npx prisma migrate dev --name add_opensearch_sync_fields
```

Expected: Migration created and applied. Output includes "Your database is now in sync with your schema."

- [ ] **Step 4: Verify Prisma client generation**

Run:
```bash
npx prisma generate
```

Expected: "Generated Prisma Client"

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add new OpenSearch sync fields to Opportunity and Session models"
```

---

### Task 2: OpenSearch Source Fields + Test

**Files:**
- Test: `scheduler/tests/test_queries.py:4-14`
- Modify: `scheduler/sync/queries.py:8-13, :15-18`

- [ ] **Step 1: Update test with new expected source fields**

In `scheduler/tests/test_queries.py`, replace the `OPPORTUNITY_SOURCE_FIELDS` list (lines 4-9) with:

```python
OPPORTUNITY_SOURCE_FIELDS = [
    "id", "name", "stage", "school_yr", "state", "close_date", "created_at",
    "payment_type", "contractType", "lead_source", "net_booking_amount",
    "sales_rep", "accounts", "invoices", "credit_memos",
    "referring_contact_name", "contracting_through", "funding_through", "payment_terms",
    "minimum_purchase_amount", "maximum_budget", "detailsLink",
    "stage_history", "start_date", "expiration",
]
```

Replace the `SESSION_SOURCE_FIELDS` list (lines 11-14) with:

```python
SESSION_SOURCE_FIELDS = [
    "opportunityId", "sessionPrice", "educatorPrice", "educatorApprovedPrice",
    "startTime", "status", "doNotBill", "serviceType",
    "type", "serviceName",
]
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/test_queries.py::test_fetch_opportunities_calls_scroll_all -v
```

Expected: FAIL — the source fields passed to `scroll_all` don't include the new fields yet.

- [ ] **Step 3: Update source field lists in queries.py**

In `scheduler/sync/queries.py`, replace `OPPORTUNITY_SOURCE_FIELDS` (lines 8-13) with:

```python
OPPORTUNITY_SOURCE_FIELDS = [
    "id", "name", "stage", "school_yr", "state", "close_date", "created_at",
    "payment_type", "contractType", "lead_source", "net_booking_amount",
    "sales_rep", "accounts", "invoices", "credit_memos",
    "referring_contact_name", "contracting_through", "funding_through", "payment_terms",
    "minimum_purchase_amount", "maximum_budget", "detailsLink",
    "stage_history", "start_date", "expiration",
]
```

Replace `SESSION_SOURCE_FIELDS` (lines 15-18) with:

```python
SESSION_SOURCE_FIELDS = [
    "opportunityId", "sessionPrice", "educatorPrice", "educatorApprovedPrice",
    "startTime", "status", "doNotBill", "serviceType",
    "type", "serviceName",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/test_queries.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scheduler/sync/queries.py scheduler/tests/test_queries.py
git commit -m "feat: add new source fields to OpenSearch queries"
```

---

### Task 3: Opportunity Record Builder + Test

**Files:**
- Test: `scheduler/tests/test_compute.py:67-99`
- Modify: `scheduler/sync/compute.py:121-145`

- [ ] **Step 1: Add new fields to test fixture and assertions**

In `scheduler/tests/test_compute.py`, add the new fields to the `opp_source` dict in `test_build_opportunity_record` (after `"lead_source": "referral"` on line 88):

```python
        "minimum_purchase_amount": 1000.0,
        "maximum_budget": 10000.0,
        "detailsLink": "https://lms.example.com/opp/opp1",
        "stage_history": [{"stage": "1 - Lead", "date": "2026-01-01"}],
        "start_date": "2026-02-01",
        "expiration": "2026-12-31",
```

Add assertions after the existing ones (after line 99):

```python
    assert record["minimum_purchase_amount"] == Decimal("1000.00")
    assert record["maximum_budget"] == Decimal("10000.00")
    assert record["details_link"] == "https://lms.example.com/opp/opp1"
    assert record["stage_history"] == '[{"stage": "1 - Lead", "date": "2026-01-01"}]'
    assert record["start_date"] == "2026-02-01"
    assert record["expiration"] == "2026-12-31"
```

Also add new fields (with `None` values) to the `opp_source` dicts in:
- `test_build_opportunity_record_computes_service_types` (after `"lead_source": None` on line 113):
  ```python
          "minimum_purchase_amount": None, "maximum_budget": None,
          "detailsLink": None, "stage_history": None,
          "start_date": None, "expiration": None,
  ```
- `test_build_opportunity_record_service_types_empty_sessions` (after `"lead_source": None` on line 141):
  ```python
          "minimum_purchase_amount": None, "maximum_budget": None,
          "detailsLink": None, "stage_history": None,
          "start_date": None, "expiration": None,
  ```
- `test_build_opportunity_record_service_types_filters_nulls` (after `"lead_source": None` on line 161):
  ```python
          "minimum_purchase_amount": None, "maximum_budget": None,
          "detailsLink": None, "stage_history": None,
          "start_date": None, "expiration": None,
  ```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/test_compute.py::test_build_opportunity_record -v
```

Expected: FAIL — `build_opportunity_record` doesn't return the new keys yet.

- [ ] **Step 3: Add new fields to build_opportunity_record return dict**

In `scheduler/sync/compute.py`, add these lines to the return dict (after `"lead_source": opp.get("lead_source"),` on line 138, before `"invoiced": invoiced,` on line 139):

```python
        "minimum_purchase_amount": _to_decimal(opp.get("minimum_purchase_amount")) if opp.get("minimum_purchase_amount") is not None else None,
        "maximum_budget": _to_decimal(opp.get("maximum_budget")) if opp.get("maximum_budget") is not None else None,
        "details_link": opp.get("detailsLink"),
        "stage_history": json.dumps(opp.get("stage_history") or []),
        "start_date": opp.get("start_date"),
        "expiration": opp.get("expiration"),
```

Note: Money fields use a nullable pattern (`_to_decimal() if not None else None`) so that missing values stay `NULL` in Postgres rather than becoming `0`. This differs from `net_booking_amount` which always defaults to `0`.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/test_compute.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scheduler/sync/compute.py scheduler/tests/test_compute.py
git commit -m "feat: map new OpenSearch fields in opportunity record builder"
```

---

### Task 4: Opportunity Writer Columns + Test

**Files:**
- Test: `scheduler/tests/test_supabase_writer.py:31-49`
- Modify: `scheduler/sync/supabase_writer.py:21-33`

- [ ] **Step 1: Add new fields to test fixture**

In `scheduler/tests/test_supabase_writer.py`, add the new fields to the `records` dict in `test_upsert_opportunities_builds_correct_sql` (after `"service_types": '["tutoring"]',` — which you should add if missing — before `"synced_at"`):

```python
        "minimum_purchase_amount": Decimal("1000.00"),
        "maximum_budget": Decimal("10000.00"),
        "details_link": "https://lms.example.com/opp/opp1",
        "stage_history": '[{"stage": "1 - Lead"}]',
        "start_date": "2026-02-01",
        "expiration": "2026-12-31",
```

Also add a test that the new columns are present:

```python
def test_opportunity_columns_includes_new_sync_fields():
    assert "minimum_purchase_amount" in OPPORTUNITY_COLUMNS
    assert "maximum_budget" in OPPORTUNITY_COLUMNS
    assert "details_link" in OPPORTUNITY_COLUMNS
    assert "stage_history" in OPPORTUNITY_COLUMNS
    assert "start_date" in OPPORTUNITY_COLUMNS
    assert "expiration" in OPPORTUNITY_COLUMNS
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/test_supabase_writer.py::test_opportunity_columns_includes_new_sync_fields -v
```

Expected: FAIL — new columns not in `OPPORTUNITY_COLUMNS` yet.

- [ ] **Step 3: Add new columns to OPPORTUNITY_COLUMNS**

In `scheduler/sync/supabase_writer.py`, update `OPPORTUNITY_COLUMNS` (lines 21-33). Add the new columns after `"service_types"` and before `"synced_at"`:

```python
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
    "service_types",
    "minimum_purchase_amount", "maximum_budget", "details_link",
    "stage_history", "start_date", "expiration",
    "synced_at",
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/test_supabase_writer.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scheduler/sync/supabase_writer.py scheduler/tests/test_supabase_writer.py
git commit -m "feat: add new columns to opportunity upsert writer"
```

---

### Task 5: Session Writer Columns + Run Sync Mapping + Tests

**Files:**
- Test: `scheduler/tests/test_supabase_writer.py:93-114`
- Test: `scheduler/tests/test_run_sync.py:33-37`
- Modify: `scheduler/sync/supabase_writer.py:65-69`
- Modify: `scheduler/run_sync.py:142-154`

- [ ] **Step 1: Add new columns to SESSION_COLUMNS test fixture**

In `scheduler/tests/test_supabase_writer.py`, update the session test fixtures in `test_upsert_sessions_deletes_then_inserts`. Add the new fields to each session dict (after `"synced_at"`):

```python
            {
                "id": "sess1",
                "opportunity_id": "opp1",
                "service_type": "tutoring",
                "session_price": Decimal("100.00"),
                "educator_price": Decimal("60.00"),
                "educator_approved_price": None,
                "start_time": "2026-01-01T10:00:00+00:00",
                "type": "live",
                "status": "completed",
                "service_name": "Math Tutoring",
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
                "type": "virtual",
                "status": "scheduled",
                "service_name": "Virtual Staffing",
                "synced_at": datetime(2026, 3, 16, tzinfo=timezone.utc),
            },
```

Also add a test for the new session columns:

```python
from sync.supabase_writer import SESSION_COLUMNS

def test_session_columns_includes_new_sync_fields():
    assert "type" in SESSION_COLUMNS
    assert "status" in SESSION_COLUMNS
    assert "service_name" in SESSION_COLUMNS
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/test_supabase_writer.py::test_session_columns_includes_new_sync_fields -v
```

Expected: FAIL — new columns not in `SESSION_COLUMNS` yet.

- [ ] **Step 3: Update SESSION_COLUMNS in supabase_writer.py**

In `scheduler/sync/supabase_writer.py`, replace `SESSION_COLUMNS` (lines 65-69):

```python
SESSION_COLUMNS = [
    "id", "opportunity_id", "service_type",
    "session_price", "educator_price", "educator_approved_price",
    "start_time",
    "type", "status", "service_name",
    "synced_at",
]
```

- [ ] **Step 4: Update session record builder in run_sync.py**

In `scheduler/run_sync.py`, replace the session record dict (lines 143-152):

```python
                {
                    "id": s["_id"],
                    "opportunity_id": s["opportunityId"],
                    "service_type": s.get("serviceType"),
                    "session_price": _to_decimal(s.get("sessionPrice")),
                    "educator_price": _to_decimal(s.get("educatorPrice")),
                    "educator_approved_price": _to_decimal(s.get("educatorApprovedPrice")),
                    "start_time": s.get("startTime"),
                    "type": s.get("type"),
                    "status": s.get("status"),
                    "service_name": s.get("serviceName"),
                    "synced_at": now,
                }
```

- [ ] **Step 5: Update run_sync test mock data**

In `scheduler/tests/test_run_sync.py`, update the `mock_fetch_sessions.return_value` in `test_run_sync_happy_path` (lines 33-37). Add the new fields to the `_source` dict:

```python
    mock_fetch_sessions.return_value = [
        {"_id": "sess1", "_source": {"opportunityId": "opp1", "sessionPrice": 100,
         "educatorPrice": 60, "educatorApprovedPrice": None,
         "startTime": "2026-01-01T10:00:00Z", "serviceType": "tutoring",
         "type": "live", "status": "completed", "serviceName": "Math Tutoring"}}
    ]
```

- [ ] **Step 6: Run all scheduler tests**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scheduler/sync/supabase_writer.py scheduler/run_sync.py scheduler/tests/test_supabase_writer.py scheduler/tests/test_run_sync.py
git commit -m "feat: add new columns to session upsert writer and record builder"
```

---

### Task 6: TypeScript Types

**Files:**
- Modify: `src/features/shared/types/api-types.ts:919-932`

- [ ] **Step 1: Add new fields to PlanOpportunityRow**

In `src/features/shared/types/api-types.ts`, add the new opportunity fields to `PlanOpportunityRow` (after `closeDate: string | null;` on line 931):

```typescript
  minimumPurchaseAmount: number | null;
  maximumBudget: number | null;
  detailsLink: string | null;
  stageHistory: Array<Record<string, string>> | null;
  startDate: string | null;
  expiration: string | null;
```

Also add new fields to `PlanDistrictOpportunity` (after `scheduledRevenue: number;` on line 917) if these will be consumed in that context:

```typescript
  startDate: string | null;
  expiration: string | null;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/sierrastorm/thespot/territory-plan
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors introduced (existing errors unrelated to this change are acceptable).

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/types/api-types.ts
git commit -m "feat: add new OpenSearch sync fields to TypeScript types"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run all scheduler tests**

```bash
cd /Users/sierrastorm/thespot/territory-plan/scheduler
python -m pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 2: Run frontend tests**

```bash
cd /Users/sierrastorm/thespot/territory-plan
npm test -- --run 2>&1 | tail -20
```

Expected: All tests PASS. If any tests fail because they snapshot or assert on `PlanOpportunityRow` shape, update those tests to include the new fields.

- [ ] **Step 3: Verify Prisma client works**

```bash
npx prisma validate
```

Expected: "The schema is valid."
