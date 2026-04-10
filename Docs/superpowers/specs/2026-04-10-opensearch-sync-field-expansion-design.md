# OpenSearch Sync Field Expansion — Design Spec

**Date:** 2026-04-10
**Status:** Approved

## Summary

Expand the scheduler sync pipeline to pull additional fields from OpenSearch into the `opportunities` and `sessions` Postgres tables. These fields are already available in the OpenSearch indices (`clj-prod-opportunities`, `clj-prod-sessions-v2`) but are not currently being synced. No UI changes are included — the new columns will be consumed by future frontend work.

## New Fields

### Opportunities — 6 new columns

| Postgres column | Type | OpenSearch field | Notes |
|---|---|---|---|
| `minimum_purchase_amount` | Decimal(15,2) | `minimum_purchase_amount` | Money field, nullable |
| `maximum_budget` | Decimal(15,2) | `maximum_budget` | Money field, nullable |
| `details_link` | Text | `detailsLink` | URL string, nullable |
| `stage_history` | JSON (default `[]`) | `stage_history` | Array of stage transition objects |
| `start_date` | Timestamptz | `start_date` | Opportunity start date, nullable |
| `expiration` | Timestamptz | `expiration` | Opportunity expiration date, nullable |

### Sessions — 3 new columns

| Postgres column | Type | OpenSearch field | Notes |
|---|---|---|---|
| `type` | Text | `type` | Session type (distinct from `service_type`) |
| `status` | Text | `status` | Already fetched for query filtering, now also stored |
| `service_name` | Text | `serviceName` | Human-readable service name |

## Architecture

No new architecture. All changes thread through the existing 6-layer sync pipeline:

```
OpenSearch index
  → scheduler/sync/queries.py         (source field lists)
  → scheduler/sync/compute.py         (field mapping for opportunities)
  → scheduler/run_sync.py             (field mapping for sessions)
  → scheduler/sync/supabase_writer.py (UPSERT column lists)
  → prisma/schema.prisma              (DB model + migration)
  → src/features/shared/types/api-types.ts (TypeScript types)
```

### Layer-by-layer changes

**1. `scheduler/sync/queries.py`**
- Add to `OPPORTUNITY_SOURCE_FIELDS`: `"minimum_purchase_amount"`, `"maximum_budget"`, `"detailsLink"`, `"stage_history"`, `"start_date"`, `"expiration"`
- Add to `SESSION_SOURCE_FIELDS`: `"type"`, `"serviceName"` (note: `"status"` is already fetched)

**2. `scheduler/sync/compute.py` — `build_opportunity_record()`**
- Add 6 new keys to the return dict:
  - `minimum_purchase_amount`: use `_to_decimal()` for money conversion
  - `maximum_budget`: use `_to_decimal()` for money conversion
  - `details_link`: direct string from `detailsLink`
  - `stage_history`: `json.dumps()` the array (or `"[]"` if null)
  - `start_date`: direct passthrough
  - `expiration`: direct passthrough

**3. `scheduler/sync/supabase_writer.py`**
- Add to `OPPORTUNITY_COLUMNS`: `"minimum_purchase_amount"`, `"maximum_budget"`, `"details_link"`, `"stage_history"`, `"start_date"`, `"expiration"`
- Add to `SESSION_COLUMNS`: `"type"`, `"status"`, `"service_name"`

**4. `scheduler/run_sync.py`**
- In the session record builder, add mappings:
  - `"type"`: from `type`
  - `"status"`: from `status`
  - `"service_name"`: from `serviceName`

**5. `prisma/schema.prisma`**
- `model Opportunity`: add 6 fields with `@map()` annotations
- `model Session`: add 3 fields with `@map()` annotations
- Generate migration via `npx prisma migrate dev`

**6. `src/features/shared/types/api-types.ts`**
- Add fields to `PlanOpportunityRow` (or relevant opportunity type)
- Add fields to any session type if one exists

**7. Tests**
- `scheduler/tests/test_queries.py`: update `OPPORTUNITY_SOURCE_FIELDS` assertion
- `scheduler/tests/test_compute.py`: add new fields to test fixtures and expected output
- `scheduler/tests/test_supabase_writer.py`: add new fields to test fixtures
- `scheduler/tests/test_run_sync.py`: add new fields to test fixtures

## Data handling notes

- **Money fields** (`minimum_purchase_amount`, `maximum_budget`): converted via `_to_decimal()`, which handles nulls, empty strings, and invalid values by defaulting to `Decimal("0")`. However, unlike `net_booking_amount` which is always meaningful, these fields should be nullable — a `NULL` means "not set" rather than "$0". The `_to_decimal()` call should be wrapped: use `_to_decimal(val) if val is not None else None`.
- **`stage_history`**: stored as JSON. Use `json.dumps(opp.get("stage_history") or [])` to handle null/missing.
- **`status` on sessions**: currently used in `must_not` query filters to exclude cancelled sessions. Storing it does not change the filter behavior — cancelled sessions are still excluded from sync. The stored `status` column reflects the status of non-cancelled, non-doNotBill sessions only.

## Out of scope

- No UI changes (columns available for future frontend work)
- No changes to pipeline aggregation logic (`update_district_pipeline_aggregates`)
- No backfill script — existing rows get populated on next scheduler sync cycle
- No changes to the `unmatched_opportunities` table
