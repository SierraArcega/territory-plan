# Backend Context: Pacing Revenue + Sessions by Service Type

**Date:** 2026-03-24
**Spec:** `docs/superpowers/specs/2026-03-24-pacing-revenue-sessions-by-service-type-design.md`

---

## 1. Current Pacing API

**File:** `src/app/api/territory-plans/[id]/route.ts` (lines 99-151)

### Three Pacing Queries

The GET handler runs 3 parallel raw SQL queries against the `opportunities` table, grouped by `district_lea_id`. All three share the same SELECT shape and produce `PacingRow[]`:

```sql
SELECT district_lea_id,
       COALESCE(SUM(total_revenue), 0) AS revenue,
       COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost')
                    THEN net_booking_amount ELSE 0 END), 0) AS pipeline,
       COUNT(*)::int AS deals,
       COALESCE(SUM(scheduled_sessions), 0)::int AS sessions
FROM opportunities
WHERE district_lea_id = ANY($1) AND school_yr = $2
GROUP BY district_lea_id
```

| Query | Filter | Purpose |
|-------|--------|---------|
| **Current FY** | `school_yr = currentSchoolYr` | Current fiscal year totals |
| **Same Date PFY** | `school_yr = priorSchoolYr AND created_at <= oneYearAgo` | Prior FY opps created by this date last year |
| **Full PFY** | `school_yr = priorSchoolYr` | Full prior FY totals |

### PacingRow Type

Defined inline (line 100):

```typescript
type PacingRow = {
  district_lea_id: string;
  revenue: number;
  pipeline: number;
  deals: number;
  sessions: number;
};
```

All four fields (`revenue`, `pipeline`, `deals`, `sessions`) come from the `opportunities` table:
- `revenue` = `SUM(total_revenue)` -- pre-aggregated from sessions by the scheduler
- `pipeline` = `SUM(net_booking_amount)` for open-stage opps
- `deals` = `COUNT(*)` of opportunities
- `sessions` = `SUM(scheduled_sessions)` -- only future sessions, NOT total sessions

### oneYearAgo Date Calculation (lines 104-105)

```typescript
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
```

Creates a JavaScript Date representing "today minus 1 year". Used in the Same Date PFY query to filter `created_at <= oneYearAgo`. This is the opportunity's creation date, not session start time.

**Important for the new feature:** The spec calls for filtering Same Date PFY sessions by `s.start_time <= oneYearAgo` instead of `o.created_at`, since we want sessions that had *occurred* by this point last year.

### Pacing Assembly (lines 148-224)

Results are indexed into three Maps keyed by `district_lea_id`:

```typescript
const currentPacingByDistrict = new Map(currentPacing.map(r => [r.district_lea_id, r]));
const priorSameDateByDistrict = new Map(priorSameDatePacing.map(r => [r.district_lea_id, r]));
const priorFullByDistrict = new Map(priorFullPacing.map(r => [r.district_lea_id, r]));
```

For each district in the plan, a `pacing` object is built (lines 205-224) with 12 fields:

```typescript
pacing: {
  currentRevenue, currentPipeline, currentDeals, currentSessions,
  priorSameDateRevenue, priorSameDatePipeline, priorSameDateDeals, priorSameDateSessions,
  priorFullRevenue, priorFullPipeline, priorFullDeals, priorFullSessions,
}
```

If none of the three lookups yield data for a district, `pacing` is `undefined`.

### DistrictPacing Type

**File:** `src/features/shared/types/api-types.ts` (lines 339-352)

```typescript
export interface DistrictPacing {
  currentRevenue: number;
  currentPipeline: number;
  currentDeals: number;
  currentSessions: number;
  priorSameDateRevenue: number;
  priorSameDatePipeline: number;
  priorSameDateDeals: number;
  priorSameDateSessions: number;
  priorFullRevenue: number;
  priorFullPipeline: number;
  priorFullDeals: number;
  priorFullSessions: number;
}
```

All 12 fields are numbers. The spec adds `serviceTypeBreakdown?: ServiceTypePacing[]` to this interface.

---

## 2. Sessions Table Schema

**File:** `prisma/schema.prisma` (lines 1235-1249)

```prisma
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

### Key Fields for the Feature

| Field | DB Column | Type | Notes |
|-------|-----------|------|-------|
| `serviceType` | `service_type` | `text` (nullable) | Per-session service type; null or empty string should be grouped as "Other" |
| `sessionPrice` | `session_price` | `decimal(15,2)` (nullable) | Revenue per session; SUM gives total revenue |
| `startTime` | `start_time` | `timestamptz` (nullable) | Used for Same Date PFY filter (`<= oneYearAgo`) |
| `opportunityId` | `opportunity_id` | `text` | Links to `opportunities.id` (no FK constraint) |

### Available Indexes

1. **`@@index([opportunityId])`** -- single-column on `opportunity_id`
2. **`@@index([opportunityId, serviceType])`** -- composite, directly supports GROUP BY `service_type` after joining on `opportunity_id`
3. **`@@index([startTime])`** -- single-column on `start_time`, useful for the Same Date PFY date filter

### JOIN Path: Session -> District

```
sessions.opportunity_id -> opportunities.id -> opportunities.district_lea_id
```

There is **no foreign key constraint** between sessions and opportunities (comment in schema: "Linked to opportunities by opportunity_id (no FK constraint)"). The join is a logical relationship only.

The `opportunities` table has an index on `district_lea_id` and a composite index on `(district_lea_id, school_yr, stage)`.

### Nullable district_lea_id

`Opportunity.districtLeaId` is `String?` (nullable). Sessions on opportunities with NULL `district_lea_id` will be excluded by the `WHERE o.district_lea_id = ANY($1)` filter, which is correct behavior per the spec.

---

## 3. Scheduler Computation

**File:** `scheduler/sync/compute.py`

### compute_metrics(sessions, now)

Iterates over all session records for an opportunity and classifies each by whether `start_time < now`:

```python
for s in sessions:
    price = _to_decimal(s.get("sessionPrice", 0))
    cost = _educator_cost(s)
    start = datetime.fromisoformat(start_str)

    if start < now:
        completed_revenue += price
        completed_take += price - cost
    else:
        scheduled_sessions += 1
        scheduled_revenue += price
        scheduled_take += price - cost

total_revenue = completed_revenue + scheduled_revenue
```

**Key findings:**

- **`total_revenue`** = `completed_revenue + scheduled_revenue` = sum of `session_price` across ALL sessions (completed + scheduled). This means `SUM(session_price) FROM sessions` should match `total_revenue` on the opportunity.
- **`scheduled_sessions`** = count of FUTURE sessions only (where `start_time >= now`). This is what the existing pacing queries sum. It does NOT count completed sessions.
- **`service_types`** JSON = sorted unique set of `serviceType` values from sessions (excluding falsy values). Stored as a JSON array on the opportunity.

### Revenue Equivalence

`total_revenue` on the opportunity is computed as `SUM(session_price)` across all sessions for that opportunity. Therefore:

```sql
SUM(s.session_price) FROM sessions s JOIN opportunities o ON o.id = s.opportunity_id
  WHERE o.district_lea_id = ANY($1) AND o.school_yr = $2
```

should closely match:

```sql
SUM(o.total_revenue) FROM opportunities o
  WHERE o.district_lea_id = ANY($1) AND o.school_yr = $2
```

Minor discrepancies could occur if:
- A session has a null `session_price` (treated as 0 in compute but NULL in the DB SUM)
- Rounding differences in Decimal vs DB decimal arithmetic
- Sync timing: sessions written slightly before/after opportunity metric recomputation

In practice, these should be negligible. The spec explicitly chooses sessions-table data as the source of truth for this feature, to ensure parent row = exact sum of children.

### build_opportunity_record(opp, sessions, district_mapping)

Calls `compute_metrics(sessions)` and also builds:
- `service_types`: `json.dumps(sorted(set(s.get("serviceType") for s in sessions if s.get("serviceType"))))` -- a JSON array of distinct service type strings for the opportunity

---

## 4. Data Volume and Query Patterns

### Current Scale

The `src/app/api/admin/sync/health/route.ts` endpoint queries `COUNT(*) FROM sessions` for health monitoring. This is the only existing query against the sessions table in the frontend codebase. All other sessions queries are in the Python scheduler.

The scheduler logs indicate typical sync volumes of hundreds of opps with associated sessions per cycle. The sessions table stores every individual session record for every synced opportunity.

### Query Pattern for New Feature

The new queries will JOIN sessions to opportunities with:
- `WHERE o.district_lea_id = ANY($1)` -- filter by plan's district LEA IDs
- `AND o.school_yr = $2` -- filter by school year
- `GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')`

**Index coverage analysis:**

The query planner should:
1. Use `opportunities(district_lea_id, school_yr, stage)` composite index to find matching opportunities
2. Use `sessions(opportunity_id)` or `sessions(opportunity_id, service_type)` index for the JOIN
3. The `sessions(start_time)` index helps with the Same Date PFY query's `s.start_time <= oneYearAgo` filter

A typical territory plan has 10-100 districts. Each district might have 1-20 opportunities per school year. Each opportunity might have 0-500+ sessions. Worst case for a large plan: ~100 districts x 20 opps x 500 sessions = 1M session rows scanned, but this is filtered by the `ANY($1)` and `school_yr` predicates first.

### Existing Parallel Query Pattern

The current implementation already runs 3 pacing queries in parallel via `Promise.all()` (lines 108-143). The new 3 sessions queries should be added to this same `Promise.all()` block (6 total queries in parallel) or as a separate parallel group.

### Error Handling Pattern

The existing pacing queries are wrapped in `try/catch` with an empty catch block (line 144-146: `// Opportunities table may not exist yet`). The new sessions queries should follow the same pattern since the sessions table may not exist in all environments.

---

## 5. Implementation Notes

### What Changes in the Existing Queries

The spec says to **keep** the existing 3 pacing queries for Pipeline and Deals, but **remove** `revenue` and `sessions` from them since those now come from the sessions-table queries. In practice, the simplest approach is:
- Keep the 3 existing queries as-is (the extra columns are harmless and avoid changing working code)
- Add 3 new sessions-table queries
- In the response mapping, use revenue/sessions from the sessions queries and pipeline/deals from the existing queries

### Lookup Structure

The spec calls for building: `Map<district_lea_id, Map<service_type, { current, sameDate, full }>>`.

Each of the 3 new queries returns rows like `{ district_lea_id, service_type, sessions, revenue }`. These need to be merged into a per-district structure with:
- `serviceTypeBreakdown[]` array
- `currentRevenue` / `currentSessions` totals (sum across service types, replacing the opportunity-level values)

### Response Shape Change

The `pacing` object gains a `serviceTypeBreakdown` array. The `currentRevenue`, `currentSessions`, `priorSameDateRevenue`, `priorSameDateSessions`, `priorFullRevenue`, `priorFullSessions` fields change their source from opportunity-level aggregates to session-level aggregates (should be nearly identical values, but now match the service-type breakdown exactly).

`currentPipeline`, `currentDeals`, `priorSameDatePipeline`, `priorSameDateDeals`, `priorFullPipeline`, `priorFullDeals` continue to come from the existing opportunity-level queries.
