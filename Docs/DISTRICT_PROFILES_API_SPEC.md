# District Profiles API Specification

## Purpose

This endpoint helps identify data reconciliation issues in our LMS (Learning Management System) where **districts** (school districts) have fragmented data across multiple database IDs.

## The Problem We're Solving

Districts can end up with multiple IDs in our system:
- One ID might have **schools and sessions** (operational data)
- Another ID might have **opportunities** (sales/contract data)
- Neither ID exists as a proper district record with an NCES ID

This causes revenue and operational data to not roll up correctly.

## Endpoint

```
GET /api/reconciliation/district-profiles
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_orphaned` | boolean | `true` | Include district IDs that are referenced but don't exist in the districts index |
| `min_total_entities` | integer | `1` | Minimum total entities (opps + schools + sessions + courses) to include |
| `state` | string | null | Filter by state (e.g., "SC", "SOUTH CAROLINA", "CA") |
| `limit` | integer | `200` | Maximum results to return |

### Example Request

```
GET http://localhost:8000/api/reconciliation/district-profiles?include_orphaned=true&min_total_entities=5&limit=100
```

## Response Structure

Returns an array of district profiles, sorted by total revenue (highest first).

```json
[
  {
    "district_id": "17592236333690",
    "district_name": "Richland School District Two",
    "state": "SOUTH CAROLINA",
    "state_sources": [["district", "SOUTH CAROLINA"], ["schools", "SOUTH CAROLINA"]],
    "nces_id": null,
    "exists_in_index": false,
    "referenced_by": ["opportunities", "schools", "sessions", "courses"],
    
    "opportunities": {
      "count": 148,
      "revenue": 16951842.00,
      "account_names_used": ["Richland School District Two"]
    },
    
    "schools": {
      "count": 47,
      "sample_names": ["Westwood High School", "Richland Northeast High"]
    },
    
    "sessions": {
      "count": 29886,
      "revenue": 1690283.00,
      "schools_in_sessions": ["Richland School District Two", "Westwood High School"]
    },
    
    "courses": {
      "count": 1620
    },
    
    "totals": {
      "entity_count": 31701,
      "total_revenue": 18642125.00
    },
    
    "data_quality": {
      "has_nces": false,
      "has_state": true,
      "is_orphaned": true,
      "has_opps": true,
      "has_schools": true,
      "has_sessions": true
    }
  }
]
```

## Key Fields Explained

### Identity Fields

| Field | Description |
|-------|-------------|
| `district_id` | The unique ID for this district (may be orphaned/invalid) |
| `district_name` | District name (from district record or inferred from opportunities) |
| `state` | State (from district record or inferred from related entities) |
| `nces_id` | National Center for Education Statistics ID (null if missing) |
| `exists_in_index` | `true` if this is a real district record, `false` if orphaned |
| `referenced_by` | Which entity types reference this district ID |

### Entity Counts

| Field | Description |
|-------|-------------|
| `opportunities.count` | Number of sales opportunities tied to this district |
| `opportunities.revenue` | Total booking value (contract amount) - **PRIMARY REVENUE METRIC** |
| `schools.count` | Number of schools that reference this district |
| `sessions.count` | Number of sessions delivered at schools in this district |
| `sessions.revenue` | Total session price (delivered value) |
| `courses.count` | Number of courses at schools in this district |

### Data Quality Flags

| Field | Description |
|-------|-------------|
| `is_orphaned` | `true` = This ID doesn't exist as a real district record |
| `has_nces` | `true` = Has a valid NCES ID for federal reporting |
| `has_state` | `true` = Has a state value |
| `has_opps` | `true` = Has opportunities (sales data) |
| `has_schools` | `true` = Has schools (operational data) |
| `has_sessions` | `true` = Has sessions (delivery data) |

## Common Patterns to Display

### 1. Duplicate Districts (Same Name, Multiple IDs)

Look for multiple records with the same `district_name` and `state`. These need to be consolidated.

**Example:**
- ID `17592236333690`: 148 opps, 47 schools, 29K sessions
- ID `17592192005474`: 66 opps, 0 schools, 0 sessions

Both are "Richland School District Two" in South Carolina.

### 2. Orphaned vs Valid Districts

- `is_orphaned: true` = The ID is referenced but doesn't exist as a proper record
- `is_orphaned: false` + `has_nces: true` = Valid district with NCES ID (good!)
- `is_orphaned: false` + `has_nces: false` = Exists but missing NCES ID

### 3. Fragmented Data

Districts where:
- One ID has `has_opps: true` but `has_schools: false`
- Another ID has `has_schools: true` but `has_opps: false`

These represent the same district but data is split across IDs.

## UX Recommendations

### Views to Build

1. **Summary Dashboard**
   - Total orphaned districts
   - Total revenue affected
   - Count by state

2. **Duplicate Finder**
   - Group records by normalized name + state
   - Show which IDs should be merged
   - Highlight revenue impact

3. **District Detail View**
   - Show all entities tied to a district ID
   - List sample schools and their sessions
   - Show data quality issues

4. **Migration Planner**
   - For duplicate groups, show recommended merge actions
   - Calculate total entities to migrate
   - Provide export for bulk updates

### Sorting/Filtering Options

- Sort by: `opportunities.revenue`, `totals.total_revenue`, `totals.entity_count`
- Filter by: `state`, `is_orphaned`, `has_nces`
- Group by: Normalized district name (to find duplicates)

### Key Metrics to Highlight

- **Opportunity Bookings** (`opportunities.revenue`) - Contract/sales value
- **Session Revenue** (`sessions.revenue`) - Delivered value
- **Entity Count** - Total schools + sessions + courses affected

## Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/reconciliation/summary` | Quick counts of all issue types |
| `/api/reconciliation/orphaned-accounts-with-matches` | Orphaned accounts with suggested valid matches |
| `/api/reconciliation/fragmented-entities` | Districts split across multiple IDs |
