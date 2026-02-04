# Data Reconciliation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build read-only integration to surface unmatched accounts and account fragmentation issues from OpenSearch.

**Architecture:** Next.js DataView calls proxy API route → FastAPI endpoints → OpenSearch queries. Two checks: unmatched accounts (no valid NCES ID) and account fragmentation (same district, different account names).

**Tech Stack:** FastAPI (Python), OpenSearch, Next.js API routes, React Query, TypeScript

**Repositories:**
- FastAPI: `/Users/sierraholstad/v2_lms_react/es-bi` (origin: `https://github.com/bcpitutor/es-bi.git`)
- Next.js: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan` (origin: `https://github.com/SierraArcega/territory-plan.git`)

---

## Phase 1: FastAPI Backend

### Task 1: Create Feature Branch from Origin Main (FastAPI)

**Files:** None (git operations only)

**Step 1: Fetch latest from origin**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
git fetch origin
```

**Step 2: Create branch from origin/main**

```bash
git checkout -b feature/data-reconciliation origin/main
```

**Step 3: Verify branch is based on origin/main**

Run: `git log --oneline -3`
Expected: See recent commits from main branch

Run: `git branch --show-current`
Expected: `feature/data-reconciliation`

---

### Task 2: Create Reconciliation Service Directory

**Files:**
- Create: `/Users/sierraholstad/v2_lms_react/es-bi/app/reconciliation/__init__.py`

**Step 1: Create directory**

```bash
mkdir -p /Users/sierraholstad/v2_lms_react/es-bi/app/reconciliation
```

**Step 2: Create `__init__.py`**

```python
from .service import ReconciliationService

__all__ = ["ReconciliationService"]
```

**Step 3: Commit scaffold**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
git add app/reconciliation/__init__.py
git commit -m "chore: scaffold reconciliation module"
```

---

### Task 3: Implement Unmatched Accounts Query

**Files:**
- Create: `/Users/sierraholstad/v2_lms_react/es-bi/app/reconciliation/service.py`

**Step 1: Create service.py with unmatched accounts method**

```python
"""
Reconciliation service for data quality checks.
Queries OpenSearch to find unmatched accounts and account fragmentation.
"""

import os
import logging
from typing import Dict, List, Any, Optional
from opensearchpy import OpenSearch

logger = logging.getLogger(__name__)

OPPORTUNITIES_INDEX = os.getenv("OPENSEARCH_OPPORTUNITIES_INDEX", "clj-prod-opportunities")
SESSIONS_INDEX = os.getenv("OPENSEARCH_SESSIONS_INDEX", "clj-prod-sessions-v2")
DISTRICTS_INDEX = os.getenv("OPENSEARCH_DISTRICTS_INDEX", "clj-prod-districts")


class ReconciliationService:
    def __init__(self, os_client: OpenSearch):
        self.os_client = os_client

    def get_unmatched_accounts(
        self,
        state: Optional[str] = None,
        sales_exec: Optional[str] = None,
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Find accounts in opportunities index that have no valid nces_id.
        These represent revenue that isn't attributed to any district.
        """
        must_not = [
            {"exists": {"field": "nces_id"}},
        ]

        filters = []
        if state:
            filters.append({"term": {"state.keyword": state}})
        if sales_exec:
            filters.append({"term": {"sales_rep.name.keyword": sales_exec}})

        query = {
            "size": 0,
            "query": {
                "bool": {
                    "must_not": must_not,
                    "filter": filters if filters else [{"match_all": {}}]
                }
            },
            "aggs": {
                "by_account": {
                    "terms": {
                        "field": "accounts.id.keyword",
                        "size": limit
                    },
                    "aggs": {
                        "account_info": {
                            "top_hits": {
                                "size": 1,
                                "_source": [
                                    "accounts.name",
                                    "accounts.id",
                                    "state",
                                    "sales_rep.name"
                                ]
                            }
                        },
                        "total_revenue": {
                            "sum": {"field": "net_booking"}
                        },
                        "opp_count": {
                            "value_count": {"field": "_id"}
                        }
                    }
                }
            }
        }

        try:
            response = self.os_client.search(index=OPPORTUNITIES_INDEX, body=query)
            buckets = response.get("aggregations", {}).get("by_account", {}).get("buckets", [])

            results = []
            for bucket in buckets:
                hits = bucket.get("account_info", {}).get("hits", {}).get("hits", [])
                if not hits:
                    continue

                source = hits[0].get("_source", {})
                accounts = source.get("accounts", [])
                account = accounts[0] if accounts else {}

                results.append({
                    "account_id": bucket.get("key"),
                    "account_name": account.get("name", "Unknown"),
                    "state": source.get("state"),
                    "sales_exec": source.get("sales_rep", {}).get("name"),
                    "total_revenue": bucket.get("total_revenue", {}).get("value", 0),
                    "opportunity_count": bucket.get("opp_count", {}).get("value", 0)
                })

            return sorted(results, key=lambda x: x["total_revenue"], reverse=True)

        except Exception as e:
            logger.error(f"Error fetching unmatched accounts: {e}")
            raise
```

**Step 2: Commit**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
git add app/reconciliation/service.py
git commit -m "feat: add get_unmatched_accounts query

Finds accounts in opportunities index without valid NCES IDs.
Returns account name, state, sales exec, revenue, and opp count."
```

---

### Task 4: Implement Fragmented Accounts Query

**Files:**
- Modify: `/Users/sierraholstad/v2_lms_react/es-bi/app/reconciliation/service.py`

**Step 1: Add get_fragmented_accounts method to ReconciliationService class**

```python
    def get_fragmented_accounts(
        self,
        state: Optional[str] = None,
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Find districts where sessions and opportunities have different account names.
        This indicates potential duplicate accounts or data fragmentation.
        """
        # Step 1: Get account names per nces_id from opportunities
        opp_query = {
            "size": 0,
            "query": {
                "bool": {
                    "filter": [
                        {"exists": {"field": "nces_id"}},
                        *([{"term": {"state.keyword": state}}] if state else [])
                    ]
                }
            },
            "aggs": {
                "by_nces": {
                    "terms": {"field": "nces_id.keyword", "size": limit},
                    "aggs": {
                        "account_names": {
                            "terms": {"field": "accounts.name.keyword", "size": 10}
                        },
                        "district_info": {
                            "top_hits": {
                                "size": 1,
                                "_source": ["district_name", "nces_id", "state"]
                            }
                        }
                    }
                }
            }
        }

        # Step 2: Get account names per nces_id from sessions
        session_query = {
            "size": 0,
            "query": {
                "bool": {
                    "filter": [
                        {"exists": {"field": "ncesId"}},
                        *([{"term": {"state.keyword": state}}] if state else [])
                    ]
                }
            },
            "aggs": {
                "by_nces": {
                    "terms": {"field": "ncesId.keyword", "size": limit},
                    "aggs": {
                        "account_names": {
                            "terms": {"field": "accountName.keyword", "size": 10}
                        }
                    }
                }
            }
        }

        try:
            opp_response = self.os_client.search(index=OPPORTUNITIES_INDEX, body=opp_query)
            session_response = self.os_client.search(index=SESSIONS_INDEX, body=session_query)

            # Build lookup of session account names by nces_id
            session_accounts: Dict[str, List[str]] = {}
            for bucket in session_response.get("aggregations", {}).get("by_nces", {}).get("buckets", []):
                nces_id = bucket.get("key")
                names = [b["key"] for b in bucket.get("account_names", {}).get("buckets", [])]
                session_accounts[nces_id] = names

            # Compare with opportunity account names
            results = []
            for bucket in opp_response.get("aggregations", {}).get("by_nces", {}).get("buckets", []):
                nces_id = bucket.get("key")
                opp_names = [b["key"] for b in bucket.get("account_names", {}).get("buckets", [])]
                sess_names = session_accounts.get(nces_id, [])

                # Get district info
                hits = bucket.get("district_info", {}).get("hits", {}).get("hits", [])
                source = hits[0].get("_source", {}) if hits else {}

                # Combine all unique names
                all_names = set(opp_names + sess_names)

                # Only include if there are multiple distinct account names
                if len(all_names) > 1:
                    variants = []
                    for name in opp_names:
                        variants.append({
                            "name": name,
                            "source": "opportunities",
                            "count": next(
                                (b["doc_count"] for b in bucket.get("account_names", {}).get("buckets", []) if b["key"] == name),
                                0
                            )
                        })
                    for name in sess_names:
                        if name not in opp_names:
                            variants.append({
                                "name": name,
                                "source": "sessions",
                                "count": 0  # Count not easily available for cross-index
                            })

                    # Calculate similarity score (simple: 1 / number of variants)
                    similarity_score = 1.0 / len(all_names) if all_names else 1.0

                    results.append({
                        "nces_id": nces_id,
                        "district_name": source.get("district_name"),
                        "state": source.get("state"),
                        "account_variants": variants,
                        "similarity_score": round(similarity_score, 2)
                    })

            return sorted(results, key=lambda x: x["similarity_score"])

        except Exception as e:
            logger.error(f"Error fetching fragmented accounts: {e}")
            raise
```

**Step 2: Commit**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
git add app/reconciliation/service.py
git commit -m "feat: add get_fragmented_accounts query

Finds districts where sessions and opportunities have different
account names, indicating potential duplicates or data fragmentation."
```

---

### Task 5: Add Unmatched Accounts API Endpoint

**Files:**
- Modify: `/Users/sierraholstad/v2_lms_react/es-bi/app/main.py`

**Step 1: Add import at top of main.py (after other app imports, around line 9)**

```python
from app.reconciliation import ReconciliationService
```

**Step 2: Add Pydantic model (after existing models, around line 43)**

```python
# Reconciliation models
class UnmatchedAccountResponse(BaseModel):
    account_id: str
    account_name: str
    state: Optional[str]
    sales_exec: Optional[str]
    total_revenue: float
    opportunity_count: int
```

**Step 3: Add endpoint (at end of file, before any `if __name__` block)**

```python
# --- Reconciliation Endpoints ---

@app.get("/api/reconciliation/unmatched", response_model=List[UnmatchedAccountResponse])
async def get_unmatched_accounts(
    state: Optional[str] = Query(None, description="Filter by state abbreviation"),
    sales_exec: Optional[str] = Query(None, description="Filter by sales executive name"),
    limit: int = Query(500, description="Maximum results to return")
):
    """
    Get accounts that have no valid NCES ID mapping.
    These represent revenue not attributed to any district.
    """
    try:
        service = ReconciliationService(os_client)
        return service.get_unmatched_accounts(state=state, sales_exec=sales_exec, limit=limit)
    except Exception as e:
        logger.error(f"Error in unmatched accounts endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 4: Commit**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
git add app/main.py
git commit -m "feat: add GET /api/reconciliation/unmatched endpoint

Returns accounts without valid NCES IDs.
Supports state and sales_exec filters."
```

---

### Task 6: Add Fragmented Accounts API Endpoint

**Files:**
- Modify: `/Users/sierraholstad/v2_lms_react/es-bi/app/main.py`

**Step 1: Add Pydantic models (after UnmatchedAccountResponse)**

```python
class AccountVariant(BaseModel):
    name: str
    source: str
    count: int

class FragmentedDistrictResponse(BaseModel):
    nces_id: str
    district_name: Optional[str]
    state: Optional[str]
    account_variants: List[AccountVariant]
    similarity_score: float
```

**Step 2: Add endpoint (after unmatched endpoint)**

```python
@app.get("/api/reconciliation/fragmented", response_model=List[FragmentedDistrictResponse])
async def get_fragmented_accounts(
    state: Optional[str] = Query(None, description="Filter by state abbreviation"),
    limit: int = Query(500, description="Maximum results to return")
):
    """
    Get districts where sessions and opportunities have different account names.
    Indicates potential duplicate accounts or data fragmentation.
    """
    try:
        service = ReconciliationService(os_client)
        return service.get_fragmented_accounts(state=state, limit=limit)
    except Exception as e:
        logger.error(f"Error in fragmented accounts endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 3: Commit**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
git add app/main.py
git commit -m "feat: add GET /api/reconciliation/fragmented endpoint

Returns districts with multiple account name variants.
Supports state filter."
```

---

### Task 7: Test FastAPI Endpoints Locally

**Step 1: Start FastAPI server**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
uvicorn app.main:app --reload --port 8000
```

**Step 2: Test unmatched endpoint (in new terminal)**

```bash
curl "http://localhost:8000/api/reconciliation/unmatched?limit=5" | python -m json.tool
```

Expected: JSON array of unmatched accounts

**Step 3: Test fragmented endpoint**

```bash
curl "http://localhost:8000/api/reconciliation/fragmented?limit=5" | python -m json.tool
```

Expected: JSON array of fragmented districts

**Step 4: Check Swagger docs**

Open: `http://localhost:8000/docs`
Expected: See new `/api/reconciliation/*` endpoints documented

---

### Task 8: Push FastAPI Feature Branch

**Step 1: Verify all commits**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
git log --oneline origin/main..HEAD
```

Expected: See 5 commits (scaffold, unmatched query, fragmented query, unmatched endpoint, fragmented endpoint)

**Step 2: Push to origin**

```bash
git push -u origin feature/data-reconciliation
```

---

## Phase 2: Next.js Frontend

### Task 9: Create Feature Branch from Origin Main (Next.js)

**Files:** None (git operations only)

**Step 1: Fetch latest from origin**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git fetch origin
```

**Step 2: Create branch from origin/main**

```bash
git checkout -b feature/data-reconciliation origin/main
```

**Step 3: Verify branch**

Run: `git log --oneline -3`
Expected: See recent commits from main branch

Run: `git branch --show-current`
Expected: `feature/data-reconciliation`

---

### Task 10: Add FASTAPI_URL Environment Variable

**Files:**
- Modify: `.env.local` (do NOT commit)

**Step 1: Add to .env.local**

```
FASTAPI_URL=http://localhost:8000
```

Note: `.env.local` should already be in `.gitignore`. No commit needed.

---

### Task 11: Create Next.js API Proxy Route

**Files:**
- Create: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/app/api/data/reconciliation/route.ts`

**Step 1: Create directory**

```bash
mkdir -p "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/app/api/data/reconciliation"
```

**Step 2: Create route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const state = searchParams.get("state");
  const salesExec = searchParams.get("salesExec");
  const limit = searchParams.get("limit") || "500";

  if (!type || !["unmatched", "fragmented"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be 'unmatched' or 'fragmented'" },
      { status: 400 }
    );
  }

  const endpoint = type === "unmatched"
    ? "/api/reconciliation/unmatched"
    : "/api/reconciliation/fragmented";

  const params = new URLSearchParams();
  params.set("limit", limit);
  if (state) params.set("state", state);
  if (salesExec && type === "unmatched") params.set("sales_exec", salesExec);

  try {
    const response = await fetch(`${FASTAPI_URL}${endpoint}?${params}`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`FastAPI error: ${response.status} - ${error}`);
      return NextResponse.json(
        { error: "Failed to fetch reconciliation data" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying to FastAPI:", error);
    return NextResponse.json(
      { error: "Failed to connect to reconciliation service" },
      { status: 503 }
    );
  }
}
```

**Step 3: Commit**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git add src/app/api/data/reconciliation/
git commit -m "feat: add reconciliation API proxy route

Proxies requests to FastAPI service.
GET /api/data/reconciliation?type=unmatched|fragmented
Supports state and salesExec filters."
```

---

### Task 12: Add Reconciliation Types

**Files:**
- Modify: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/lib/api.ts`

**Step 1: Add types (near other interface definitions)**

```typescript
// Reconciliation types
export interface UnmatchedAccount {
  account_id: string;
  account_name: string;
  state: string | null;
  sales_exec: string | null;
  total_revenue: number;
  opportunity_count: number;
}

export interface AccountVariant {
  name: string;
  source: "sessions" | "opportunities";
  count: number;
}

export interface FragmentedDistrict {
  nces_id: string;
  district_name: string | null;
  state: string | null;
  account_variants: AccountVariant[];
  similarity_score: number;
}

export interface ReconciliationFilters {
  state?: string;
  salesExec?: string;
  limit?: number;
}
```

**Step 2: Commit**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git add src/lib/api.ts
git commit -m "feat: add reconciliation TypeScript types

UnmatchedAccount, FragmentedDistrict, AccountVariant interfaces
ReconciliationFilters for query parameters"
```

---

### Task 13: Add React Query Hooks

**Files:**
- Modify: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/lib/api.ts`

**Step 1: Add hooks (near other useQuery hooks)**

```typescript
// Reconciliation hooks
export function useUnmatchedAccounts(filters: ReconciliationFilters = {}) {
  const params = new URLSearchParams();
  params.set("type", "unmatched");
  if (filters.state) params.set("state", filters.state);
  if (filters.salesExec) params.set("salesExec", filters.salesExec);
  if (filters.limit) params.set("limit", filters.limit.toString());

  return useQuery({
    queryKey: ["reconciliation", "unmatched", filters],
    queryFn: () => fetchJson<UnmatchedAccount[]>(`/api/data/reconciliation?${params}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useFragmentedAccounts(filters: ReconciliationFilters = {}) {
  const params = new URLSearchParams();
  params.set("type", "fragmented");
  if (filters.state) params.set("state", filters.state);
  if (filters.limit) params.set("limit", filters.limit.toString());

  return useQuery({
    queryKey: ["reconciliation", "fragmented", filters],
    queryFn: () => fetchJson<FragmentedDistrict[]>(`/api/data/reconciliation?${params}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Step 2: Commit**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git add src/lib/api.ts
git commit -m "feat: add useUnmatchedAccounts and useFragmentedAccounts hooks

React Query hooks for fetching reconciliation data.
5-minute stale time for both."
```

---

### Task 14: Build DataView Tab Structure

**Files:**
- Modify: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/components/views/DataView.tsx`

**Step 1: Replace DataView with basic tab structure**

```typescript
"use client";

import { useState } from "react";
import {
  useUnmatchedAccounts,
  useFragmentedAccounts,
  ReconciliationFilters,
} from "@/lib/api";

type TabType = "unmatched" | "fragmented";

export default function DataView() {
  const [activeTab, setActiveTab] = useState<TabType>("unmatched");
  const [filters, setFilters] = useState<ReconciliationFilters>({});
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: unmatchedData,
    isLoading: unmatchedLoading,
    error: unmatchedError,
  } = useUnmatchedAccounts(filters);

  const {
    data: fragmentedData,
    isLoading: fragmentedLoading,
    error: fragmentedError,
  } = useFragmentedAccounts(filters);

  const isLoading = activeTab === "unmatched" ? unmatchedLoading : fragmentedLoading;
  const error = activeTab === "unmatched" ? unmatchedError : fragmentedError;

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-[#403770]">Data Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review data quality issues affecting actuals accuracy
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("unmatched")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "unmatched"
                ? "bg-[#403770] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Unmatched Accounts
            {unmatchedData && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {unmatchedData.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("fragmented")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "fragmented"
                ? "bg-[#403770] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Account Fragmentation
            {fragmentedData && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {fragmentedData.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, state, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770]"
              />
            </div>
            <select
              value={filters.state || ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, state: e.target.value || undefined }))
              }
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
            >
              <option value="">All States</option>
              <option value="CA">California</option>
              <option value="TX">Texas</option>
              <option value="NY">New York</option>
              <option value="FL">Florida</option>
              <option value="IL">Illinois</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#403770]"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Failed to load data. Make sure the FastAPI service is running.
          </div>
        )}

        {/* Content placeholder */}
        {!isLoading && !error && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            {activeTab === "unmatched"
              ? `${unmatchedData?.length || 0} unmatched accounts`
              : `${fragmentedData?.length || 0} fragmented districts`}
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git add src/components/views/DataView.tsx
git commit -m "feat: add DataView tab structure and filters

Tabbed interface: Unmatched Accounts / Account Fragmentation
Search input and state filter dropdown
Loading and error states"
```

---

### Task 15: Add Unmatched Accounts Table Component

**Files:**
- Modify: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/components/views/DataView.tsx`

**Step 1: Add UnmatchedTable component and integrate it**

Add this component at the bottom of the file:

```typescript
function UnmatchedTable({ data, searchTerm }: { data: UnmatchedAccount[]; searchTerm: string }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = data.filter(
    (item) =>
      item.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sales_exec?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No unmatched accounts found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              Account Name
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              State
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              Sales Exec
            </th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
              Total Revenue
            </th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
              Opps
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr
              key={row.account_id}
              onClick={() =>
                setExpandedRow(expandedRow === row.account_id ? null : row.account_id)
              }
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-4 py-3 text-sm text-[#403770] font-medium">
                {row.account_name}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.state || "—"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.sales_exec || "Unassigned"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                ${row.total_revenue.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                {row.opportunity_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Update the import to include `UnmatchedAccount`:

```typescript
import {
  useUnmatchedAccounts,
  useFragmentedAccounts,
  ReconciliationFilters,
  UnmatchedAccount,
} from "@/lib/api";
```

Replace the content placeholder with:

```typescript
{/* Unmatched Accounts Table */}
{!isLoading && !error && activeTab === "unmatched" && unmatchedData && (
  <UnmatchedTable data={unmatchedData} searchTerm={searchTerm} />
)}

{/* Fragmented placeholder */}
{!isLoading && !error && activeTab === "fragmented" && (
  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
    {fragmentedData?.length || 0} fragmented districts (table coming next)
  </div>
)}
```

**Step 2: Commit**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git add src/components/views/DataView.tsx
git commit -m "feat: add UnmatchedTable component

Displays unmatched accounts with filtering.
Shows account name, state, sales exec, revenue, opp count.
Clickable rows for future expansion."
```

---

### Task 16: Add Fragmented Accounts Table Component

**Files:**
- Modify: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/components/views/DataView.tsx`

**Step 1: Add FragmentedTable component**

Add this component at the bottom of the file:

```typescript
function FragmentedTable({ data, searchTerm }: { data: FragmentedDistrict[]; searchTerm: string }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = data.filter(
    (item) =>
      item.district_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nces_id.includes(searchTerm) ||
      item.account_variants.some((v) =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No account fragmentation issues found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              NCES ID
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              District Name
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              State
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              Account Variants
            </th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
              Similarity
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <Fragment key={row.nces_id}>
              <tr
                onClick={() =>
                  setExpandedRow(expandedRow === row.nces_id ? null : row.nces_id)
                }
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                  {row.nces_id}
                </td>
                <td className="px-4 py-3 text-sm text-[#403770] font-medium">
                  {row.district_name || "Unknown"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {row.state || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <div className="flex gap-1 flex-wrap">
                    {row.account_variants.slice(0, 2).map((v, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded text-xs ${
                          v.source === "sessions"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {v.name.length > 25 ? v.name.slice(0, 25) + "..." : v.name}
                      </span>
                    ))}
                    {row.account_variants.length > 2 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        +{row.account_variants.length - 2} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      row.similarity_score < 0.5
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {Math.round(row.similarity_score * 100)}%
                  </span>
                </td>
              </tr>
              {expandedRow === row.nces_id && (
                <tr className="bg-gray-50">
                  <td colSpan={5} className="px-4 py-4">
                    <div className="text-sm text-gray-600">
                      <strong className="text-gray-900">All Account Variants:</strong>
                      <div className="mt-2 space-y-1">
                        {row.account_variants.map((v, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                v.source === "sessions"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {v.source}
                            </span>
                            <span>{v.name}</span>
                            <span className="text-gray-400">({v.count} records)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Update imports:

```typescript
import { useState, Fragment } from "react";
import {
  useUnmatchedAccounts,
  useFragmentedAccounts,
  ReconciliationFilters,
  UnmatchedAccount,
  FragmentedDistrict,
} from "@/lib/api";
```

Replace fragmented placeholder with:

```typescript
{/* Fragmented Accounts Table */}
{!isLoading && !error && activeTab === "fragmented" && fragmentedData && (
  <FragmentedTable data={fragmentedData} searchTerm={searchTerm} />
)}
```

**Step 2: Commit**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git add src/components/views/DataView.tsx
git commit -m "feat: add FragmentedTable component

Displays districts with multiple account name variants.
Color-coded badges for sessions vs opportunities source.
Expandable rows show all variants with record counts."
```

---

### Task 17: Add CSV Export Functionality

**Files:**
- Modify: `/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/src/components/views/DataView.tsx`

**Step 1: Add export handler in DataView component (before return)**

```typescript
const handleExport = () => {
  const data = activeTab === "unmatched" ? unmatchedData : fragmentedData;
  if (!data) return;

  let csv = "";
  if (activeTab === "unmatched") {
    csv = "Account Name,State,Sales Exec,Total Revenue,Opportunity Count\n";
    csv += (data as UnmatchedAccount[])
      .map(
        (row) =>
          `"${row.account_name}","${row.state || ""}","${row.sales_exec || ""}",${row.total_revenue},${row.opportunity_count}`
      )
      .join("\n");
  } else {
    csv = "NCES ID,District Name,State,Account Variants,Similarity Score\n";
    csv += (data as FragmentedDistrict[])
      .map(
        (row) =>
          `"${row.nces_id}","${row.district_name || ""}","${row.state || ""}","${row.account_variants.map((v) => v.name).join("; ")}",${row.similarity_score}`
      )
      .join("\n");
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${activeTab}-accounts-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Step 2: Add export button in filter bar (after state select)**

```typescript
<button
  onClick={handleExport}
  disabled={!unmatchedData && !fragmentedData}
  className="px-4 py-2 bg-[#C4E7E6] text-[#403770] rounded-lg font-medium hover:bg-[#b3dbd9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  Export CSV
</button>
```

**Step 3: Commit**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git add src/components/views/DataView.tsx
git commit -m "feat: add CSV export functionality

Export button downloads current tab data as CSV.
Includes all columns with proper escaping."
```

---

### Task 18: Test End-to-End Integration

**Step 1: Ensure FastAPI is running**

```bash
cd /Users/sierraholstad/v2_lms_react/es-bi
uvicorn app.main:app --reload --port 8000
```

**Step 2: Start Next.js dev server**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
npm run dev
```

**Step 3: Test in browser**

Open: `http://localhost:3005`
Navigate to: Data tab

Expected:
- See "Unmatched Accounts" tab with data from OpenSearch
- See "Account Fragmentation" tab with data
- Search filtering works
- State dropdown filters data
- Expandable rows in fragmented table
- CSV export downloads file

**Step 4: Test error handling**

Stop FastAPI server, refresh page.
Expected: See error message "Failed to load data. Make sure the FastAPI service is running."

---

### Task 19: Push Next.js Feature Branch

**Step 1: Verify all commits**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git log --oneline origin/main..HEAD
```

Expected: See 7 commits (proxy route, types, hooks, tab structure, unmatched table, fragmented table, export)

**Step 2: Push to origin**

```bash
git push -u origin feature/data-reconciliation
```

---

## Summary

| Phase | Task | Description | Commit |
|-------|------|-------------|--------|
| FastAPI | 1 | Create feature branch from origin/main | - |
| FastAPI | 2 | Scaffold reconciliation module | `chore: scaffold reconciliation module` |
| FastAPI | 3 | Implement unmatched accounts query | `feat: add get_unmatched_accounts query` |
| FastAPI | 4 | Implement fragmented accounts query | `feat: add get_fragmented_accounts query` |
| FastAPI | 5 | Add unmatched accounts endpoint | `feat: add GET /api/reconciliation/unmatched endpoint` |
| FastAPI | 6 | Add fragmented accounts endpoint | `feat: add GET /api/reconciliation/fragmented endpoint` |
| FastAPI | 7 | Test endpoints locally | - |
| FastAPI | 8 | Push feature branch | - |
| Next.js | 9 | Create feature branch from origin/main | - |
| Next.js | 10 | Add FASTAPI_URL env variable | - |
| Next.js | 11 | Create API proxy route | `feat: add reconciliation API proxy route` |
| Next.js | 12 | Add TypeScript types | `feat: add reconciliation TypeScript types` |
| Next.js | 13 | Add React Query hooks | `feat: add useUnmatchedAccounts and useFragmentedAccounts hooks` |
| Next.js | 14 | Build tab structure | `feat: add DataView tab structure and filters` |
| Next.js | 15 | Add unmatched table | `feat: add UnmatchedTable component` |
| Next.js | 16 | Add fragmented table | `feat: add FragmentedTable component` |
| Next.js | 17 | Add CSV export | `feat: add CSV export functionality` |
| E2E | 18 | Test full integration | - |
| Final | 19 | Push Next.js feature branch | - |

**Total commits:** 12 (6 FastAPI + 6 Next.js)
