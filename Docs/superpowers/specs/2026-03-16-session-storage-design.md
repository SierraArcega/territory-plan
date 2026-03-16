# Session Storage & Service Type Aggregation

**Date:** 2026-03-16
**Status:** Approved

## Problem

The opportunity scheduler fetches individual session records from OpenSearch (`clj-prod-sessions-v2`) but only uses them transiently to compute aggregate financial metrics. Session-level detail (service type, individual prices, dates, statuses) is discarded after sync. This limits visibility into session mix, financial breakdowns by service type, and operational detail per opportunity.

## Solution

1. **New `sessions` table** — Store every synced session as an individual row, linked to its parent opportunity.
2. **New `service_types` JSON field on Opportunity** — A deduplicated, sorted array of distinct service type values from that opportunity's sessions.

## Design

### Sessions Table Schema

```prisma
model Session {
  id                    String    @id @db.Text           // OpenSearch _id
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

- Uses OpenSearch `_id` as primary key (natural dedup).
- Stores 6 of the 8 fields fetched by the scheduler, plus `syncedAt`. The `status` and `doNotBill` fields are omitted — the OpenSearch query already excludes cancelled and doNotBill sessions via `must_not` filters, so these would always be non-cancelled/false respectively.
- Indexes: `opportunityId` for FK-style lookups, composite `(opportunityId, serviceType)` for per-opportunity service type queries, `startTime` for time-range queries.
- No foreign key to Opportunity — matches existing pattern where the scheduler manages referential integrity.

### Opportunity Model Change

One new field:

```prisma
serviceTypes  Json  @default("[]") @map("service_types")  // ["tutoring", "virtualStaffing"]
```

Computed during sync as a deduplicated, sorted JSON array of non-null `serviceType` values from that opportunity's sessions. Non-nullable with `@default("[]")` — matches the existing `attendees` pattern on CalendarEvent.

### Scheduler Changes

#### queries.py

- No changes needed. The `scroll_all` function already returns full hit objects including `_id`. The change is in `run_sync.py` where `_id` must be preserved alongside `_source` when grouping sessions.

#### compute.py

- After `compute_metrics`, collect distinct non-null `serviceType` values from the opportunity's sessions, sort them, and include `"service_types"` as a JSON-serializable list in the record returned by `build_opportunity_record`.

#### supabase_writer.py

- **New `upsert_sessions(conn, sessions_by_opp)`** — For each affected opportunity: delete all existing sessions for that `opportunity_id`, then bulk insert the fresh set. The entire delete+insert batch runs in a single transaction (matching the existing `upsert_opportunities` commit pattern) so a crash either leaves old sessions intact or has the complete new set.
- **Update `OPPORTUNITY_COLUMNS`** — Add `"service_types"` to the column list.

#### run_sync.py

- When grouping sessions by opportunity (Phase 2b), preserve `hit["_id"]` alongside `hit["_source"]` so session records include their OpenSearch document ID.
- After `upsert_opportunities`, call `upsert_sessions`. Order: opportunities first (row exists), then sessions.
- Update the completion log to include session count.
- `syncedAt` on each session uses the same `now` timestamp from the sync cycle (consistent with opportunity behavior).

### Data Flow

```
OpenSearch (clj-prod-sessions-v2)
  |
  +- fetch_sessions() -> raw session hits (with _id)
  |
  +- compute_metrics() -> aggregate financials (unchanged)
  |
  +- build_opportunity_record() -> now also computes service_types JSON array
  |
  +- upsert_opportunities() -> writes opp record including service_types
  |
  +- upsert_sessions() -> delete-and-replace sessions for affected opps
```

### Deletion Behavior

- **Hard delete**: if a session is cancelled or removed in OpenSearch, it will not appear in the fetch (existing `must_not` filters exclude `cancelled` and `doNotBill`). The delete-and-replace strategy means stale sessions are removed automatically.
- Sessions for opportunities not touched in an incremental sync are left as-is.

### Migration Strategy

1. **Prisma migration** — `prisma migrate dev` to create `sessions` table and add `service_types` column to `opportunities`.
2. **Force full sync** — Delete `last_synced_at` from `sync_state` so the next scheduler run fetches all opportunities and populates both sessions and service types from scratch:
   ```sql
   DELETE FROM sync_state WHERE key = 'last_synced_at';
   ```
3. Trigger the scheduler. Estimated volume: 20K-40K session rows, well within Postgres comfort zone.

### Volume Estimates

- ~2,000 opportunities
- ~10-20 sessions per opportunity on average
- Total: ~20,000-40,000 session rows
- Sync strategy (delete-and-replace per opp) handles this comfortably

### Out of Scope

- No new API routes or UI changes — this is purely scheduler + data layer.
- No per-service-type financial breakdowns on Opportunity (can be queried from sessions table ad-hoc).
- No foreign key constraints between sessions and opportunities.
- No soft delete / status tracking — cancelled and doNotBill sessions are excluded at fetch time.
- Prisma relation between Session and Opportunity is deferred until API/UI work requires it.
