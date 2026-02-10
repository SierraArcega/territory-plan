
# District Profiles API Specification

## Purpose

This endpoint helps identify data reconciliation issues in our LMS (Learning Management System) where **districts** (school districts) have fragmented data across multiple database IDs.

## Recent Updates (Feb 2026)

**Key changes that make duplicate detection easier:**

1. **Complete Data by Default** - The endpoint now returns ALL districts (21,295) instead of limiting to 200. No pagination needed.

2. **State Normalization** - All states are now normalized to 2-letter codes. "ALASKA", "Alaska", and "AK" all become "AK". This makes grouping by state reliable.

3. **1,027 Duplicate Groups Identified** - When you group by normalized district name + state, you'll find 1,027 groups where the same district appears with multiple IDs.

4. **Clear Pattern Emerged** - Duplicates almost always follow this pattern:
   - **Valid ID** (has NCES): Contains schools, sessions, courses (operational data)
   - **Orphaned ID**: Contains opportunities (sales data) but no schools/sessions

## The Problem We're Solving

Districts can end up with multiple IDs in our system:
- One ID might have **schools and sessions** (operational data)
- Another ID might have **opportunities** (sales/contract data)
- Neither ID exists as a proper district record with an NCES ID

This causes revenue and operational data to not roll up correctly.

## Data Volume Summary (as of Feb 2026)

| Metric | Count |
|--------|-------|
| Total Districts | 21,295 |
| Valid Districts | 18,173 |
| Orphaned Districts | 3,122 |
| **Duplicate Groups** | **1,027** |
| Districts with NCES ID | 5,410 |
| Total Opportunities | 6,535 |
| Total Opportunity Revenue | $358,127,002 |
| Total Schools | 111,872 |
| Total Sessions | 570,103 |
| Total Session Revenue | $31,595,065 |
| Total Courses | 24,337 |

## Endpoint

```
GET /api/reconciliation/district-profiles
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_orphaned` | boolean | `true` | Include district IDs that are referenced but don't exist in the districts index |
| `min_total_entities` | integer | `1` | Minimum total entities (opps + schools + sessions + courses) to include |
| `state` | string | null | Filter by state - accepts abbreviation OR full name (e.g., "SC", "SOUTH CAROLINA", "CA", "California" all work) |
| `limit` | integer | `50000` | Maximum results to return (default returns complete list) |

### Example Requests

```
# Get ALL districts with any attached entities (complete list)
GET http://localhost:8000/api/reconciliation/district-profiles

# Get districts with at least 5 total entities
GET http://localhost:8000/api/reconciliation/district-profiles?min_total_entities=5

# Filter by state
GET http://localhost:8000/api/reconciliation/district-profiles?state=TX
```

## Response Structure

Returns an array of district profiles, sorted by total revenue (highest first).

```json
[
  {
    "district_id": "17592236333690",
    "district_name": "Richland School District Two",
    "state": "SC",
    "state_sources": [["district", "SC"], ["schools", "SC"]],
    "nces_id": "4500001",
    "exists_in_index": true,
    "referenced_by": [],
    
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
| `state` | State (normalized to 2-letter code, e.g., "ALASKA" → "AK") |
| `nces_id` | National Center for Education Statistics ID (null if missing) |
| `exists_in_index` | `true` if this is a real district record, `false` if orphaned |
| `referenced_by` | Which entity types reference this district ID |

**Note on State Normalization:** All states are automatically normalized to 2-letter codes. This means "ALASKA", "Alaska", and "AK" in the source data all become "AK" in the response. This makes it easy to group and filter by state even when source data is inconsistent.

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

## How to Detect Duplicates

### Algorithm for Finding Duplicates

1. **Normalize the district name** - Remove common suffixes like "School District", "Public Schools", "Unified School District", etc.
2. **Group by (normalized_name, state)** - Since states are now all 2-letter codes, this grouping is reliable
3. **Flag groups with 2+ entries** - These are potential duplicates

### Sample JavaScript for Duplicate Detection

```javascript
function normalizeName(name) {
  if (!name) return '';
  return name.toUpperCase()
    .replace(/SCHOOL DISTRICT|PUBLIC SCHOOLS|UNIFIED SCHOOL DISTRICT|CITY SCHOOLS|COUNTY SCHOOLS|SCHOOLS|DISTRICT/g, '')
    .trim();
}

// Group districts by normalized name + state
const groups = {};
data.forEach(d => {
  const key = `${normalizeName(d.district_name)}|${d.state}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push(d);
});

// Find duplicates (groups with more than 1 district)
const duplicates = Object.entries(groups)
  .filter(([key, districts]) => districts.length > 1)
  .sort((a, b) => {
    const revA = a[1].reduce((sum, d) => sum + d.totals.total_revenue, 0);
    const revB = b[1].reduce((sum, d) => sum + d.totals.total_revenue, 0);
    return revB - revA; // Sort by revenue impact
  });
```

### Top 5 Duplicate Groups by Revenue Impact

| District Name | State | # of IDs | Total Revenue | Pattern |
|--------------|-------|----------|---------------|---------|
| Richland Two | SC | 2 | $28.6M | Valid has schools/sessions, Orphaned has 66 opps |
| Colleton County | SC | 2 | $17.0M | Valid has schools/sessions, Orphaned has 20 opps |
| Richland County 1 | SC | 2 | $13.4M | Valid has schools/sessions, Orphaned has 5 opps |
| Barstow Unified | CA | 2 | $10.0M | Valid has schools/sessions, Orphaned has 2 opps |
| Browning | MT | 2 | $9.4M | Valid has schools/sessions, Orphaned has 26 opps |

### The Canonical Pattern

Almost every duplicate follows this pattern:

| | Valid District (✓ NCES) | Orphaned Duplicate |
|---|---|---|
| `exists_in_index` | `true` | `false` |
| `has_nces` | `true` | `false` |
| `has_schools` | `true` | `false` |
| `has_sessions` | `true` | `false` |
| `has_opps` | varies | `true` |

**Resolution:** Migrate opportunities from the orphaned ID to the valid ID.

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

### Priority View: Duplicate Finder

This should be the primary view since it addresses the biggest reconciliation need.

**Recommended Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ DUPLICATE DISTRICTS                           [Filter by State ▼]  │
├─────────────────────────────────────────────────────────────────────┤
│ Found 1,027 duplicate groups affecting $XXX in revenue             │
├─────────────────────────────────────────────────────────────────────┤
│ ▼ Richland Two (SC) - 2 duplicates - $28.6M total                  │
│   ┌───────────────────────────────────────────────────────────────┐│
│   │ ✓ VALID: ID ...3690  │ 148 opps │ 47 schools │ 29K sessions  ││
│   │   ORPHANED: ID ...5474 │ 66 opps │ 0 schools │ 0 sessions    ││
│   │   [Merge Orphaned → Valid]                                    ││
│   └───────────────────────────────────────────────────────────────┘│
│ ▶ Colleton County (SC) - 2 duplicates - $17.0M total               │
│ ▶ Richland County 1 (SC) - 2 duplicates - $13.4M total             │
└─────────────────────────────────────────────────────────────────────┘
```

**Key UX Features:**
- Expandable rows showing all IDs in a duplicate group
- Visual indicator (✓) for the valid/canonical district
- "Merge" action button for each orphaned ID
- Sort by revenue impact (default)
- Filter by state

### Other Views

1. **Summary Dashboard**
   - 1,027 duplicate groups found
   - 3,122 orphaned districts total
   - Revenue at risk breakdown by state

2. **All Districts Table**
   - Searchable/filterable list of all 21,295 districts
   - Columns: Name, State, NCES, Opps, Schools, Sessions, Revenue, Status
   - Color-code: Green (valid+NCES), Yellow (valid, no NCES), Red (orphaned)

3. **District Detail View**
   - Full profile for a single district
   - List of related entities
   - Suggested merge targets (if orphaned)

### Sorting/Filtering Options

- **Sort by:** `totals.total_revenue` (default), `opportunities.revenue`, `totals.entity_count`, `district_name`
- **Filter by:** `state`, `is_orphaned`, `has_nces`, `has_opps`, `has_schools`
- **Group by:** Normalized district name (for duplicate finder)

### Key Metrics to Highlight

| Metric | Field | Why It Matters |
|--------|-------|----------------|
| **Opportunity Bookings** | `opportunities.revenue` | Contract/sales value - PRIMARY |
| **Session Revenue** | `sessions.revenue` | Delivered value |
| **Entity Count** | `totals.entity_count` | Scale of migration needed |
| **Is Orphaned** | `data_quality.is_orphaned` | Needs resolution |
| **Has NCES** | `data_quality.has_nces` | Valid for federal reporting |

## Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/reconciliation/summary` | Quick counts of all issue types |
| `/api/reconciliation/orphaned-accounts-with-matches` | Orphaned accounts with suggested valid matches |
| `/api/reconciliation/fragmented-entities` | Districts split across multiple IDs |
