# Data Reconciliation Feature Design

## Overview

Build a read-only integration between the Next.js app and a local FastAPI/OpenSearch service to surface data quality issues that could affect actuals accuracy in territory plans.

## Reconciliation Checks

### 1. Unmatched Accounts
Accounts in OpenSearch with no valid `nces_id` (null, empty, or not found in known districts).

**Why it matters:** These accounts have revenue/pipeline data that isn't being attributed to any district in the territory planning system.

### 2. Account Fragmentation
Districts where sessions data and opportunities data are attributed to different `account_name`/`account_id` values that appear to be the same entity.

**Why it matters:** Revenue may be split across multiple account records, causing inaccurate totals on district views.

**Detection approach:**
- Exact match: same `nces_id`, different `account_name`
- Fuzzy match: similar names (Levenshtein distance), same state, partial ID overlap

## Architecture

```
Next.js DataView → Next.js API Route → FastAPI → OpenSearch
                   (proxy/passthrough)    (queries)
```

### Why Proxy Through Next.js
- Keeps FastAPI URL server-side (not exposed to browser)
- Consistent error handling with existing API patterns
- Easy to add auth/rate limiting later

## OpenSearch Indices

| Index | Env Variable | Content |
|-------|--------------|---------|
| `clj-prod-opportunities` | `OPENSEARCH_OPPORTUNITIES_INDEX` | Closed won + pipeline |
| `clj-prod-sessions-v2` | `OPENSEARCH_SESSIONS_INDEX` | Session revenue/take/count |
| `clj-prod-districts` | `OPENSEARCH_DISTRICTS_INDEX` | District metadata |

### Key Fields
- `account_name`, `account_id` - Account identifiers
- `nces_id` - Maps to `leaid` in Next.js app
- `sales_exec`, `state` - Filtering/grouping

## FastAPI Endpoints

### `GET /api/reconciliation/unmatched`

Returns accounts missing valid NCES IDs.

**Response:**
```json
[
  {
    "account_id": "abc123",
    "account_name": "Springfield School District",
    "state": "IL",
    "sales_exec": "Jane Smith",
    "total_revenue": 45200.00,
    "opportunity_count": 3
  }
]
```

**Query approach:**
- Aggregate opportunities by `account_id`
- Filter where `nces_id` is null/empty or not in known NCES list
- Include revenue totals and opp counts

### `GET /api/reconciliation/fragmented`

Returns districts with session/opportunity account mismatches.

**Response:**
```json
[
  {
    "nces_id": "1700001",
    "district_name": "Springfield USD",
    "account_variants": [
      { "name": "Springfield USD", "source": "sessions", "count": 12 },
      { "name": "Springfield Unified", "source": "opportunities", "count": 3 }
    ],
    "similarity_score": 0.85
  }
]
```

**Query approach:**
- Group by `nces_id` across sessions and opportunities indices
- Collect distinct `account_name` values per source
- Flag where count > 1 or fuzzy similarity detected

## Next.js Integration

### API Route

`/api/data/reconciliation/route.ts`

```typescript
GET /api/data/reconciliation?type=unmatched
GET /api/data/reconciliation?type=fragmented
```

- Reads `FASTAPI_URL` from environment
- Proxies request to FastAPI
- Standardizes error responses

### React Query Hooks

Add to `/lib/api.ts`:

```typescript
export function useUnmatchedAccounts() {
  return useQuery({
    queryKey: ["reconciliation", "unmatched"],
    queryFn: () => fetchJson<UnmatchedAccount[]>("/api/data/reconciliation?type=unmatched"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFragmentedAccounts() {
  return useQuery({
    queryKey: ["reconciliation", "fragmented"],
    queryFn: () => fetchJson<FragmentedDistrict[]>("/api/data/reconciliation?type=fragmented"),
    staleTime: 5 * 60 * 1000,
  });
}
```

### TypeScript Types

```typescript
interface UnmatchedAccount {
  accountId: string;
  accountName: string;
  state: string | null;
  salesExec: string | null;
  totalRevenue: number;
  opportunityCount: number;
}

interface FragmentedDistrict {
  ncesId: string;
  districtName: string | null;
  accountVariants: {
    name: string;
    source: "sessions" | "opportunities";
    count: number;
  }[];
  similarityScore: number;
}
```

## DataView UI

### Layout

Two tabs replacing the "Coming Soon" placeholder:
- **Unmatched Accounts** - Table with account name, state, sales exec, revenue, opp count
- **Account Fragmentation** - Table showing districts with multiple account name variants

### Features

- Filter by state, sales exec
- Search by account/district name
- Sortable columns
- Row expansion for details
- Pagination (25 per page)
- CSV export

### Interactions

- Read-only (no write actions)
- Click row to expand and see full details
- Export button for ops team review

## Environment Variables

Add to `.env`:

```
FASTAPI_URL=http://localhost:8000
```

## Files to Create/Modify

### New Files
- `src/app/api/data/reconciliation/route.ts` - Next.js proxy route
- FastAPI: `routers/reconciliation.py` - Endpoints
- FastAPI: `services/reconciliation.py` - OpenSearch query logic

### Modified Files
- `src/lib/api.ts` - Add types and hooks
- `src/components/views/DataView.tsx` - Replace placeholder with tabbed UI

## Out of Scope

- Metric drift detection (will auto-sync when data is clean)
- Write operations (matching accounts to districts)
- Real-time webhooks/push notifications
