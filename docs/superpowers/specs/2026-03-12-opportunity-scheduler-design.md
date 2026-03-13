# Opportunity Sync Scheduler — Design Spec

**Date:** 2026-03-12
**Status:** Approved

## Summary

Add a Docker-based scheduler container to the territory-plan project that syncs opportunity data from OpenSearch into Supabase on an hourly cadence. Stores all opportunities from school year 2024-25 onward with computed financial metrics (invoiced, credited, completed/scheduled revenue and take, average take rate). Maps opportunities to districts via NCES ID and surfaces unmatched opportunities for manual resolution.

## Architecture

### Approach

Standalone scheduler in the territory-plan repo (Approach A). Self-contained Python service following the same pattern as es-bi's scheduler: `schedule` library running hourly, OpenSearch as source, Supabase PostgreSQL as target.

### Directory Structure

```
scheduler/
├── Dockerfile              # Python 3.11-slim
├── requirements.txt        # opensearch-py, psycopg2-binary, schedule, python-dotenv
├── run_scheduler.py        # Hourly loop with heartbeat
├── run_sync.py             # Single sync cycle entry point
├── sync/
│   ├── __init__.py
│   ├── opensearch_client.py    # Connection helper
│   ├── queries.py              # OS queries for opps, sessions, districts
│   ├── compute.py              # Financial metric calculations
│   └── supabase_writer.py      # psycopg2 upserts to opportunities + unmatched
```

### Docker Compose

Added to the existing `docker-compose.yml`:

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
  command: python -u /app/run_scheduler.py
  restart: unless-stopped
```

Production override (`docker-compose.production.yml`):
- Remove dev volumes, use built-in files
- `restart: always`
- Persistent log volume

## Data Model

### `opportunities` table

| Column | Type | Source |
|--------|------|--------|
| `id` | TEXT PK | LMS opportunity ID (`id`) |
| `name` | TEXT | `name` |
| `school_yr` | TEXT | `school_yr` (e.g. "2024-25") |
| `contract_type` | TEXT | `contractType` |
| `state` | TEXT | `state` |
| `sales_rep_name` | TEXT | `sales_rep.name` |
| `sales_rep_email` | TEXT | `sales_rep.email` |
| `district_name` | TEXT | Resolved from `accounts` |
| `district_lms_id` | TEXT | Account ID for the district |
| `district_nces_id` | TEXT | Via `clj-prod-districts` lookup |
| `district_lea_id` | TEXT | For joining to `districts` table |
| `created_at` | TIMESTAMPTZ | `created_at` |
| `close_date` | TIMESTAMPTZ | `close_date` |
| `brand_ambassador` | TEXT | `referring_contact_name` |
| `stage` | TEXT | `stage` (all statuses stored) |
| `net_booking_amount` | DECIMAL(15,2) | `net_booking_amount` |
| `contract_through` | TEXT | `contracting_through` |
| `funding_through` | TEXT | `funding_through` |
| `payment_type` | TEXT | `payment_type` |
| `payment_terms` | TEXT | `payment_terms` |
| `lead_source` | TEXT | `lead_source` |
| `invoiced` | DECIMAL(15,2) | Computed: sum of `invoices[].amount` |
| `credited` | DECIMAL(15,2) | Computed: sum of `credit_memos[].amount` |
| `completed_revenue` | DECIMAL(15,2) | Computed: sum `sessionPrice` where `startTime < now` |
| `completed_take` | DECIMAL(15,2) | Computed: completed revenue - educator cost |
| `scheduled_sessions` | INT | Computed: count sessions where `startTime >= now` |
| `scheduled_revenue` | DECIMAL(15,2) | Computed: sum `sessionPrice` where `startTime >= now` |
| `scheduled_take` | DECIMAL(15,2) | Computed: scheduled revenue - educator cost |
| `total_revenue` | DECIMAL(15,2) | Computed: completed + scheduled revenue |
| `total_take` | DECIMAL(15,2) | Computed: completed + scheduled take |
| `average_take_rate` | DECIMAL(5,4) | Computed: total_take / total_revenue |
| `synced_at` | TIMESTAMPTZ | Sync timestamp |

**Indexes:** `school_yr`, `district_nces_id`, `district_lea_id`, `stage`

### `unmatched_opportunities` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | LMS opportunity ID |
| `name` | TEXT | Opportunity name |
| `stage` | TEXT | Current stage |
| `school_yr` | TEXT | School year |
| `account_name` | TEXT | Account name from OpenSearch |
| `account_lms_id` | TEXT | Account LMS ID we tried to match |
| `account_type` | TEXT | district/school |
| `state` | TEXT | State |
| `net_booking_amount` | DECIMAL(15,2) | For prioritizing resolution |
| `reason` | TEXT | Why it couldn't be matched |
| `resolved` | BOOLEAN | Default false |
| `resolved_district_leaid` | TEXT | FK to districts(leaid) when manually resolved |
| `synced_at` | TIMESTAMPTZ | Sync timestamp |

**Indexes:** `resolved`, `school_yr`

### District-Level Aggregate Updates

After syncing opportunity records, recompute and update the existing pipeline fields on the `districts` table:
- `fy26_open_pipeline_opp_count`, `fy26_open_pipeline`, `fy26_open_pipeline_weighted`
- `fy27_open_pipeline_opp_count`, `fy27_open_pipeline`, `fy27_open_pipeline_weighted`
- `has_open_pipeline`

Aggregated from the freshly synced `opportunities` table using SQL `GROUP BY district_lea_id`.

**Stage weight map for weighted pipeline:**

| Stage prefix | Weight |
|-------------|--------|
| 0 | 0.05 |
| 1 | 0.10 |
| 2 | 0.25 |
| 3 | 0.50 |
| 4 | 0.75 |
| 5 | 0.90 |

Weighted pipeline = `SUM(net_booking_amount * stage_weight)` for open opps (stages 0-5) grouped by district.

**School year to fiscal year mapping:** School year `"2025-26"` = FY26 (fiscal year starts July 1 of the first year in the label). So `"2024-25"` = FY25, `"2025-26"` = FY26, `"2026-27"` = FY27.

## Data Flow

### Per Sync Cycle (hourly)

**Phase 1: Fetch opportunities**
- Query `clj-prod-opportunities` for all opps where `school_yr` is 2024-25 or later
- `_source` fields: `id`, `name`, `stage`, `school_yr`, `state`, `close_date`, `created_at`, `payment_type`, `contractType`, `lead_source`, `net_booking_amount`, `sales_rep`, `accounts`, `invoices`, `credit_memos`, `referring_contact_name`, `contracting_through`, `funding_through`, `payment_terms`
- Paginate with `search_after` (no size limit on results)

**Phase 2: Fetch sessions**
- Query `clj-prod-sessions-v2` with `terms` filter on collected opportunity IDs
- `_source` fields: `opportunityId`, `sessionPrice`, `educatorPrice`, `educatorApprovedPrice`, `startTime`, `status`, `doNotBill`, `serviceType`
- Exclude cancelled sessions and `doNotBill=true`
- Paginate with `search_after`

**Phase 3: NCES lookup**
- Batch lookup account IDs against `clj-prod-districts`
- Resolve NCES IDs and parent district for school-type accounts
- Check for manual resolutions from `unmatched_opportunities` table

**Phase 4: Compute metrics per opportunity**
- **Invoiced**: sum `invoices[].amount`
- **Credited**: sum `credit_memos[].amount`
- **Completed revenue**: sum `sessionPrice` where `startTime < now`
- **Completed take**: completed revenue - educator cost (`educatorApprovedPrice` for virtualStaffing, else `educatorPrice`)
- **Scheduled sessions**: count where `startTime >= now`
- **Scheduled take**: scheduled revenue - educator cost for future sessions
- **Total revenue**: completed + scheduled
- **Total take**: completed take + scheduled take
- **Average take rate**: total_take / total_revenue (null if no revenue)

**Phase 5: Write to Supabase**
- Upsert opportunities via `INSERT ... ON CONFLICT (id) DO UPDATE`
- Write/update unmatched opportunities (respecting existing manual resolutions)
- Recompute district-level pipeline aggregates

## RLS Policies

- `opportunities`: SELECT for authenticated users, full CRUD for service role
- `unmatched_opportunities`: SELECT for authenticated users, UPDATE on `resolved` and `resolved_district_leaid` for authenticated users, full CRUD for service role

## Unmatched Opportunity Resolution UI

- Admin-style page listing unmatched opportunities
- Sorted by `net_booking_amount` DESC (highest-value mismatches first)
- Each row shows account name, state, school year, and reason for mismatch
- Search/select widget to pick the correct district from the `districts` table
- On resolution: sets `resolved = true` and `resolved_district_leaid`
- Next sync cycle picks up the resolution and populates `district_lea_id` on the opportunity

## Environment Variables (scheduler)

| Variable | Description |
|----------|-------------|
| `OPENSEARCH_HOST` | OpenSearch endpoint URL |
| `OPENSEARCH_USERNAME` | OpenSearch auth username |
| `OPENSEARCH_PASSWORD` | OpenSearch auth password |
| `SUPABASE_DB_URL` | Direct (non-pooled) Supabase connection string |

## Scheduler Behavior

- Runs on startup (immediate first sync)
- Then every hour via `schedule` library
- Heartbeat file written every 5 minutes for monitoring
- Logging to file + stdout
- Retry with exponential backoff on OpenSearch query failures (3 attempts)
- Full table upsert each cycle (idempotent)
