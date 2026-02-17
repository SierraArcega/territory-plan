# Explore Data Report Builder - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-screen data explorer overlay in map-v2 with multi-entity tabs (Districts, Activities, Tasks, Contacts), column picker, filters, KPI cards, TanStack Table, and bidirectional map integration.

**Architecture:** New "Explore" icon in the IconBar opens a full-screen overlay that replaces the map view. A secondary icon strip in the left toolbar switches between entity tabs. Each entity has a configurable table (TanStack Table v8), filter bar, and dynamic KPI summary cards. A mini-map in the corner maintains map context with bidirectional sync. A new `/api/explore/[entity]` API endpoint handles flexible column selection, filtering, sorting, and pagination with aggregate metadata.

**Tech Stack:** Next.js 14 App Router, TanStack Table v8, TanStack React Query, Zustand, Prisma, Tailwind CSS, MapLibre GL JS

**Design Doc:** `Docs/plans/2026-02-17-explore-data-report-builder-design.md`

---

## Task 1: Install TanStack Table and Add Store Types

**Files:**
- Modify: `package.json`
- Modify: `src/lib/map-v2-store.ts` (lines 10-24 for types, 61-129 for state, 131-219 for actions, 231-262 for initial values)

**Step 1: Install @tanstack/react-table**

Run: `npm install @tanstack/react-table`

**Step 2: Add Explore types to the store**

In `src/lib/map-v2-store.ts`, add after line 27 (after `PlanSection` type):

```typescript
// Explore Data entity tabs
export type ExploreEntity = "districts" | "activities" | "tasks" | "contacts";

// Explore section in icon strip
export type ExploreSection = ExploreEntity;

// Filter operator types
export type FilterOp = "eq" | "neq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false";

export interface ExploreFilter {
  id: string;          // unique ID for React key
  column: string;      // column key
  op: FilterOp;
  value: string | number | boolean | string[] | [number, number];
}

export interface ExploreSortConfig {
  column: string;
  direction: "asc" | "desc";
}
```

**Step 3: Add `"explore"` to `IconBarTab`**

Change line 24 from:
```typescript
export type IconBarTab = "home" | "search" | "plans" | "settings";
```
to:
```typescript
export type IconBarTab = "home" | "search" | "plans" | "explore" | "settings";
```

**Step 4: Add Explore state to `MapV2State` interface**

After `accountFormDefaults` (line 128), add:

```typescript
  // Explore Data
  isExploreActive: boolean;
  exploreEntity: ExploreEntity;
  exploreColumns: Record<ExploreEntity, string[]>;
  exploreFilters: Record<ExploreEntity, ExploreFilter[]>;
  exploreSort: Record<ExploreEntity, ExploreSortConfig | null>;
  explorePage: number;
  filteredDistrictLeaids: string[];
```

**Step 5: Add Explore actions to `MapV2Actions` interface**

After `closeAccountForm` (line 218), add:

```typescript
  // Explore Data
  setExploreEntity: (entity: ExploreEntity) => void;
  setExploreColumns: (entity: ExploreEntity, columns: string[]) => void;
  addExploreFilter: (entity: ExploreEntity, filter: ExploreFilter) => void;
  removeExploreFilter: (entity: ExploreEntity, filterId: string) => void;
  updateExploreFilter: (entity: ExploreEntity, filterId: string, updates: Partial<ExploreFilter>) => void;
  clearExploreFilters: (entity: ExploreEntity) => void;
  setExploreSort: (entity: ExploreEntity, sort: ExploreSortConfig | null) => void;
  setExplorePage: (page: number) => void;
  setFilteredDistrictLeaids: (leaids: string[]) => void;
```

**Step 6: Add initial state values**

After `accountFormDefaults: null` (line 262), add:

```typescript
  isExploreActive: false,
  exploreEntity: "districts" as ExploreEntity,
  exploreColumns: {
    districts: ["name", "state", "enrollment", "isCustomer", "fy26_open_pipeline_value", "fy26_closed_won_net_booking", "planCount", "lastActivity", "tags"],
    activities: ["title", "type", "status", "startDate", "outcomeType", "districtNames", "planNames"],
    tasks: ["title", "status", "priority", "dueDate", "districtNames", "planNames"],
    contacts: ["name", "title", "email", "phone", "districtName", "isPrimary", "lastActivity"],
  } as Record<ExploreEntity, string[]>,
  exploreFilters: {
    districts: [],
    activities: [],
    tasks: [],
    contacts: [],
  } as Record<ExploreEntity, ExploreFilter[]>,
  exploreSort: {
    districts: null,
    activities: null,
    tasks: null,
    contacts: null,
  } as Record<ExploreEntity, ExploreSortConfig | null>,
  explorePage: 1,
  filteredDistrictLeaids: [],
```

**Step 7: Add action implementations**

After the `closeAccountForm` action implementation, add:

```typescript
  // Explore Data
  setExploreEntity: (entity) =>
    set({ exploreEntity: entity, explorePage: 1 }),

  setExploreColumns: (entity, columns) =>
    set((s) => ({
      exploreColumns: { ...s.exploreColumns, [entity]: columns },
    })),

  addExploreFilter: (entity, filter) =>
    set((s) => ({
      exploreFilters: {
        ...s.exploreFilters,
        [entity]: [...s.exploreFilters[entity], filter],
      },
      explorePage: 1,
    })),

  removeExploreFilter: (entity, filterId) =>
    set((s) => ({
      exploreFilters: {
        ...s.exploreFilters,
        [entity]: s.exploreFilters[entity].filter((f) => f.id !== filterId),
      },
      explorePage: 1,
    })),

  updateExploreFilter: (entity, filterId, updates) =>
    set((s) => ({
      exploreFilters: {
        ...s.exploreFilters,
        [entity]: s.exploreFilters[entity].map((f) =>
          f.id === filterId ? { ...f, ...updates } : f
        ),
      },
      explorePage: 1,
    })),

  clearExploreFilters: (entity) =>
    set((s) => ({
      exploreFilters: { ...s.exploreFilters, [entity]: [] },
      explorePage: 1,
    })),

  setExploreSort: (entity, sort) =>
    set((s) => ({
      exploreSort: { ...s.exploreSort, [entity]: sort },
      explorePage: 1,
    })),

  setExplorePage: (page) => set({ explorePage: page }),

  setFilteredDistrictLeaids: (leaids) => set({ filteredDistrictLeaids: leaids }),
```

**Step 8: Update `setActiveIconTab` to handle Explore**

The existing `setActiveIconTab` action resets panel state. Find it in the store and update to also set `isExploreActive`:

```typescript
  setActiveIconTab: (tab) =>
    set((s) => ({
      activeIconTab: tab,
      isExploreActive: tab === "explore",
      // ... keep existing reset logic for non-home/search tabs
    })),
```

**Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/map-v2-store.ts
git commit -m "feat(explore): add TanStack Table dep and explore store types"
```

---

## Task 2: Explore API Endpoint — Districts

**Files:**
- Create: `src/app/api/explore/[entity]/route.ts`

**Step 1: Create the explore API route**

Create `src/app/api/explore/[entity]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Column-to-Prisma-field mapping per entity
const DISTRICT_FIELDS: Record<string, string> = {
  name: "name",
  state: "state",
  enrollment: "enrollment",
  isCustomer: "isCustomer",
  hasOpenPipeline: "hasOpenPipeline",
  fy26_open_pipeline_value: "fy26_open_pipeline_value",
  fy26_open_pipeline_opp_count: "fy26_open_pipeline_opp_count",
  fy26_open_pipeline_weighted: "fy26_open_pipeline_weighted",
  fy26_closed_won_net_booking: "fy26_closed_won_net_booking",
  fy26_closed_won_opp_count: "fy26_closed_won_opp_count",
  fy25_sessions_revenue: "fy25_sessions_revenue",
  fy26_sessions_revenue: "fy26_sessions_revenue",
  fy25_sessions_take: "fy25_sessions_take",
  fy26_sessions_take: "fy26_sessions_take",
  fy25_sessions_count: "fy25_sessions_count",
  fy26_sessions_count: "fy26_sessions_count",
  graduationRate: "graduationRate",
  mathProficiency: "mathProficiency",
  readProficiency: "readProficiency",
  expenditure_per_pupil: "expenditure_per_pupil",
  totalRevenue: "totalRevenue",
  sped_percent: "sped_percent",
  ell_percent: "ell_percent",
  free_lunch_percent: "free_lunch_percent",
  urbanicity: "urbanicity",
  enrollmentTrend3yr: "enrollmentTrend3yr",
  staffingTrend3yr: "staffingTrend3yr",
  absenteeismVsState: "absenteeismVsState",
  graduationVsState: "graduationVsState",
  salesExecutive: "salesExecutive",
};

// Aggregate-able numeric fields
const NUMERIC_FIELDS = new Set([
  "enrollment", "fy26_open_pipeline_value", "fy26_closed_won_net_booking",
  "fy25_sessions_revenue", "fy26_sessions_revenue", "fy25_sessions_take",
  "fy26_sessions_take", "fy25_sessions_count", "fy26_sessions_count",
  "totalRevenue", "expenditure_per_pupil",
]);

interface FilterInput {
  column: string;
  op: string;
  value: unknown;
}

function buildDistrictWhere(filters: FilterInput[]): Prisma.DistrictWhereInput {
  const conditions: Prisma.DistrictWhereInput[] = [];

  for (const f of filters) {
    const field = DISTRICT_FIELDS[f.column];
    if (!field) continue;

    switch (f.op) {
      case "eq":
        conditions.push({ [field]: f.value });
        break;
      case "neq":
        conditions.push({ [field]: { not: f.value } });
        break;
      case "in":
        conditions.push({ [field]: { in: f.value as string[] } });
        break;
      case "contains":
        conditions.push({ [field]: { contains: f.value as string, mode: "insensitive" } });
        break;
      case "gt":
        conditions.push({ [field]: { gt: f.value as number } });
        break;
      case "gte":
        conditions.push({ [field]: { gte: f.value as number } });
        break;
      case "lt":
        conditions.push({ [field]: { lt: f.value as number } });
        break;
      case "lte":
        conditions.push({ [field]: { lte: f.value as number } });
        break;
      case "between": {
        const [min, max] = f.value as [number, number];
        conditions.push({ [field]: { gte: min, lte: max } });
        break;
      }
      case "is_true":
        conditions.push({ [field]: true });
        break;
      case "is_false":
        conditions.push({ [field]: false });
        break;
    }
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

async function handleDistricts(req: NextRequest, userId: string) {
  const url = req.nextUrl;
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "50"), 100);
  const sortCol = url.searchParams.get("sort") || "name";
  const sortDir = (url.searchParams.get("order") || "asc") as "asc" | "desc";
  const filtersParam = url.searchParams.get("filters");

  const filters: FilterInput[] = filtersParam ? JSON.parse(filtersParam) : [];
  const where = buildDistrictWhere(filters);

  const sortField = DISTRICT_FIELDS[sortCol] || "name";

  const [data, total, aggregates] = await Promise.all([
    prisma.district.findMany({
      where,
      select: {
        leaid: true,
        name: true,
        state: true,
        enrollment: true,
        isCustomer: true,
        hasOpenPipeline: true,
        fy26_open_pipeline_value: true,
        fy26_closed_won_net_booking: true,
        salesExecutive: true,
        urbanicity: true,
        graduationRate: true,
        mathProficiency: true,
        readProficiency: true,
        sped_percent: true,
        ell_percent: true,
        free_lunch_percent: true,
        point_location_lat: true,
        point_location_lng: true,
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        territoryPlans: { select: { planId: true } },
        activityLinks: {
          select: { activity: { select: { startDate: true } } },
          orderBy: { activity: { startDate: "desc" } },
          take: 1,
        },
      },
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.district.count({ where }),
    prisma.district.aggregate({
      where,
      _sum: {
        enrollment: true,
        fy26_open_pipeline_value: true,
        fy26_closed_won_net_booking: true,
      },
    }),
  ]);

  // Transform data to include computed fields
  const rows = data.map((d) => ({
    leaid: d.leaid,
    name: d.name,
    state: d.state,
    enrollment: d.enrollment,
    isCustomer: d.isCustomer,
    hasOpenPipeline: d.hasOpenPipeline,
    fy26_open_pipeline_value: d.fy26_open_pipeline_value,
    fy26_closed_won_net_booking: d.fy26_closed_won_net_booking,
    salesExecutive: d.salesExecutive,
    urbanicity: d.urbanicity,
    graduationRate: d.graduationRate,
    mathProficiency: d.mathProficiency,
    readProficiency: d.readProficiency,
    sped_percent: d.sped_percent,
    ell_percent: d.ell_percent,
    free_lunch_percent: d.free_lunch_percent,
    lat: d.point_location_lat,
    lng: d.point_location_lng,
    tags: d.tags.map((t) => t.tag),
    planCount: d.territoryPlans.length,
    lastActivity: d.activityLinks[0]?.activity?.startDate || null,
  }));

  return NextResponse.json({
    data: rows,
    aggregates: {
      count: total,
      enrollment_sum: aggregates._sum.enrollment || 0,
      pipeline_sum: aggregates._sum.fy26_open_pipeline_value || 0,
      closed_won_sum: aggregates._sum.fy26_closed_won_net_booking || 0,
    },
    pagination: { page, pageSize, total },
  });
}

async function handleActivities(req: NextRequest, userId: string) {
  const url = req.nextUrl;
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "50"), 100);
  const sortCol = url.searchParams.get("sort") || "startDate";
  const sortDir = (url.searchParams.get("order") || "desc") as "asc" | "desc";
  const filtersParam = url.searchParams.get("filters");

  const filters: FilterInput[] = filtersParam ? JSON.parse(filtersParam) : [];

  // Build where clause for activities
  const conditions: Prisma.ActivityWhereInput[] = [{ createdByUserId: userId }];
  for (const f of filters) {
    switch (f.op) {
      case "eq": conditions.push({ [f.column]: f.value }); break;
      case "in": conditions.push({ [f.column]: { in: f.value as string[] } }); break;
      case "contains": conditions.push({ [f.column]: { contains: f.value as string, mode: "insensitive" } }); break;
    }
  }
  const where: Prisma.ActivityWhereInput = { AND: conditions };

  const sortFieldMap: Record<string, string> = {
    title: "title", type: "type", status: "status",
    startDate: "startDate", outcomeType: "outcomeType",
  };

  const [data, total, completedCount, positiveCount] = await Promise.all([
    prisma.activity.findMany({
      where,
      select: {
        id: true, title: true, type: true, status: true,
        startDate: true, endDate: true, outcomeType: true, outcome: true,
        districts: { select: { district: { select: { leaid: true, name: true } } } },
        plans: { select: { plan: { select: { id: true, name: true } } } },
        contacts: { select: { contact: { select: { id: true, name: true } } } },
      },
      orderBy: { [sortFieldMap[sortCol] || "startDate"]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activity.count({ where }),
    prisma.activity.count({ where: { ...where, status: "completed" } }),
    prisma.activity.count({ where: { ...where, outcomeType: "positive_progress" } }),
  ]);

  // Count unique districts across all filtered activities (not just current page)
  const allDistrictLinks = await prisma.activityDistrict.findMany({
    where: { activity: where },
    select: { districtLeaid: true },
    distinct: ["districtLeaid"],
  });

  const rows = data.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    status: a.status,
    startDate: a.startDate,
    endDate: a.endDate,
    outcomeType: a.outcomeType,
    outcome: a.outcome,
    districtNames: a.districts.map((d) => d.district.name).join(", "),
    planNames: a.plans.map((p) => p.plan.name).join(", "),
    contactNames: a.contacts.map((c) => c.contact.name).join(", "),
  }));

  return NextResponse.json({
    data: rows,
    aggregates: {
      count: total,
      completed: completedCount,
      positiveOutcomes: positiveCount,
      districtsTouched: allDistrictLinks.length,
    },
    pagination: { page, pageSize, total },
  });
}

async function handleTasks(req: NextRequest, userId: string) {
  const url = req.nextUrl;
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "50"), 100);
  const sortCol = url.searchParams.get("sort") || "dueDate";
  const sortDir = (url.searchParams.get("order") || "asc") as "asc" | "desc";
  const filtersParam = url.searchParams.get("filters");

  const filters: FilterInput[] = filtersParam ? JSON.parse(filtersParam) : [];
  const conditions: Prisma.TaskWhereInput[] = [{ createdByUserId: userId }];
  for (const f of filters) {
    switch (f.op) {
      case "eq": conditions.push({ [f.column]: f.value }); break;
      case "in": conditions.push({ [f.column]: { in: f.value as string[] } }); break;
    }
  }
  const where: Prisma.TaskWhereInput = { AND: conditions };

  const now = new Date();
  const [data, total, overdueCount, doneCount, blockedCount] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true, title: true, status: true, priority: true, dueDate: true,
        districts: { select: { district: { select: { leaid: true, name: true } } } },
        plans: { select: { plan: { select: { id: true, name: true } } } },
        contacts: { select: { contact: { select: { id: true, name: true } } } },
      },
      orderBy: { [sortCol === "districtNames" ? "title" : sortCol]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, dueDate: { lt: now }, status: { not: "done" } } }),
    prisma.task.count({ where: { ...where, status: "done" } }),
    prisma.task.count({ where: { ...where, status: "blocked" } }),
  ]);

  const rows = data.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    districtNames: t.districts.map((d) => d.district.name).join(", "),
    planNames: t.plans.map((p) => p.plan.name).join(", "),
    contactNames: t.contacts.map((c) => c.contact.name).join(", "),
  }));

  return NextResponse.json({
    data: rows,
    aggregates: { count: total, overdue: overdueCount, completed: doneCount, blocked: blockedCount },
    pagination: { page, pageSize, total },
  });
}

async function handleContacts(req: NextRequest, userId: string) {
  const url = req.nextUrl;
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "50"), 100);
  const sortCol = url.searchParams.get("sort") || "name";
  const sortDir = (url.searchParams.get("order") || "asc") as "asc" | "desc";
  const filtersParam = url.searchParams.get("filters");

  const filters: FilterInput[] = filtersParam ? JSON.parse(filtersParam) : [];
  const conditions: Prisma.ContactWhereInput[] = [];
  for (const f of filters) {
    switch (f.op) {
      case "eq": conditions.push({ [f.column]: f.value }); break;
      case "in": conditions.push({ [f.column]: { in: f.value as string[] } }); break;
      case "contains": conditions.push({ [f.column]: { contains: f.value as string, mode: "insensitive" } }); break;
    }
  }
  const where: Prisma.ContactWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [data, total, primaryCount, districtsCount] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: {
        id: true, name: true, title: true, email: true, phone: true, isPrimary: true,
        district: { select: { leaid: true, name: true } },
        activityLinks: {
          select: { activity: { select: { startDate: true } } },
          orderBy: { activity: { startDate: "desc" } },
          take: 1,
        },
      },
      orderBy: { [sortCol === "districtName" ? "name" : sortCol]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
    prisma.contact.count({ where: { ...where, isPrimary: true } }),
    prisma.contact.findMany({
      where,
      select: { districtLeaid: true },
      distinct: ["districtLeaid"],
    }),
  ]);

  // Count contacts with activity in last 30 days
  const withRecentActivity = await prisma.contact.count({
    where: {
      ...where,
      activityLinks: { some: { activity: { startDate: { gte: thirtyDaysAgo } } } },
    },
  });

  const rows = data.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    email: c.email,
    phone: c.phone,
    isPrimary: c.isPrimary,
    districtLeaid: c.district?.leaid || null,
    districtName: c.district?.name || "—",
    lastActivity: c.activityLinks[0]?.activity?.startDate || null,
  }));

  return NextResponse.json({
    data: rows,
    aggregates: {
      count: total,
      primaryCount,
      districtsCovered: districtsCount.length,
      withRecentActivity,
    },
    pagination: { page, pageSize, total },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity } = await params;

    switch (entity) {
      case "districts":
        return handleDistricts(req, user.id);
      case "activities":
        return handleActivities(req, user.id);
      case "tasks":
        return handleTasks(req, user.id);
      case "contacts":
        return handleContacts(req, user.id);
      default:
        return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
    }
  } catch (error) {
    console.error("Explore API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/explore/
git commit -m "feat(explore): add /api/explore/[entity] endpoint for all four entities"
```

---

## Task 3: React Query Hook for Explore

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add the useExploreData hook**

At the bottom of `src/lib/api.ts`, add:

```typescript
// ------ Explore Data ------

export interface ExploreFilter {
  id: string;
  column: string;
  op: string;
  value: unknown;
}

export interface ExploreSort {
  column: string;
  direction: "asc" | "desc";
}

export interface ExploreResponse<T = Record<string, unknown>> {
  data: T[];
  aggregates: Record<string, number>;
  pagination: { page: number; pageSize: number; total: number };
}

export function useExploreData<T = Record<string, unknown>>(
  entity: string,
  params: {
    filters?: ExploreFilter[];
    sort?: ExploreSort | null;
    page?: number;
    pageSize?: number;
  }
) {
  const searchParams = new URLSearchParams();
  if (params.filters && params.filters.length > 0) {
    searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.sort) {
    searchParams.set("sort", params.sort.column);
    searchParams.set("order", params.sort.direction);
  }
  searchParams.set("page", String(params.page || 1));
  searchParams.set("pageSize", String(params.pageSize || 50));

  return useQuery({
    queryKey: ["explore", entity, params],
    queryFn: () =>
      fetchJson<ExploreResponse<T>>(
        `${API_BASE}/explore/${entity}?${searchParams}`
      ),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev: ExploreResponse<T> | undefined) => prev,
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(explore): add useExploreData React Query hook"
```

---

## Task 4: Column Definitions

**Files:**
- Create: `src/components/map-v2/explore/columns/districtColumns.ts`
- Create: `src/components/map-v2/explore/columns/activityColumns.ts`
- Create: `src/components/map-v2/explore/columns/taskColumns.ts`
- Create: `src/components/map-v2/explore/columns/contactColumns.ts`

**Step 1: Create the explore/columns directory and district columns**

Create `src/components/map-v2/explore/columns/districtColumns.ts`:

```typescript
import { createColumnHelper } from "@tanstack/react-table";

export interface DistrictRow {
  leaid: string;
  name: string;
  state: string;
  enrollment: number | null;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  fy26_open_pipeline_value: number | null;
  fy26_closed_won_net_booking: number | null;
  salesExecutive: string | null;
  urbanicity: string | null;
  graduationRate: number | null;
  mathProficiency: number | null;
  readProficiency: number | null;
  sped_percent: number | null;
  ell_percent: number | null;
  free_lunch_percent: number | null;
  lat: number | null;
  lng: number | null;
  tags: { id: string; name: string; color: string }[];
  planCount: number;
  lastActivity: string | null;
}

const col = createColumnHelper<DistrictRow>();

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags";
  enumValues?: string[];
}

export const DISTRICT_COLUMN_DEFS: ColumnDef[] = [
  // Default columns
  { key: "name", label: "Name", group: "Core", isDefault: true, filterType: "text" },
  { key: "state", label: "State", group: "Core", isDefault: true, filterType: "enum" },
  { key: "enrollment", label: "Enrollment", group: "Core", isDefault: true, filterType: "number" },
  { key: "isCustomer", label: "Customer", group: "Core", isDefault: true, filterType: "boolean" },
  { key: "fy26_open_pipeline_value", label: "Open Pipeline", group: "CRM / Revenue", isDefault: true, filterType: "number" },
  { key: "fy26_closed_won_net_booking", label: "FY26 Revenue", group: "CRM / Revenue", isDefault: true, filterType: "number" },
  { key: "planCount", label: "Plans", group: "Engagement", isDefault: true, filterType: "number" },
  { key: "lastActivity", label: "Last Activity", group: "Engagement", isDefault: true, filterType: "date" },
  { key: "tags", label: "Tags", group: "Core", isDefault: true, filterType: "tags" },

  // CRM / Revenue (non-default)
  { key: "hasOpenPipeline", label: "Has Pipeline", group: "CRM / Revenue", isDefault: false, filterType: "boolean" },
  { key: "salesExecutive", label: "Sales Executive", group: "CRM / Revenue", isDefault: false, filterType: "text" },
  { key: "fy25_sessions_revenue", label: "FY25 Revenue", group: "CRM / Revenue", isDefault: false, filterType: "number" },
  { key: "fy26_sessions_revenue", label: "FY26 Revenue (Sessions)", group: "CRM / Revenue", isDefault: false, filterType: "number" },
  { key: "fy25_sessions_count", label: "FY25 Sessions", group: "CRM / Revenue", isDefault: false, filterType: "number" },
  { key: "fy26_sessions_count", label: "FY26 Sessions", group: "CRM / Revenue", isDefault: false, filterType: "number" },

  // Education
  { key: "graduationRate", label: "Graduation Rate", group: "Education", isDefault: false, filterType: "number" },
  { key: "mathProficiency", label: "Math Proficiency", group: "Education", isDefault: false, filterType: "number" },
  { key: "readProficiency", label: "Reading Proficiency", group: "Education", isDefault: false, filterType: "number" },
  { key: "expenditure_per_pupil", label: "Spending/Pupil", group: "Education", isDefault: false, filterType: "number" },

  // Demographics
  { key: "urbanicity", label: "Urbanicity", group: "Demographics", isDefault: false, filterType: "enum", enumValues: ["City", "Suburb", "Town", "Rural"] },
  { key: "sped_percent", label: "SPED %", group: "Demographics", isDefault: false, filterType: "number" },
  { key: "ell_percent", label: "ELL %", group: "Demographics", isDefault: false, filterType: "number" },
  { key: "free_lunch_percent", label: "Free Lunch %", group: "Demographics", isDefault: false, filterType: "number" },

  // Signals
  { key: "absenteeismVsState", label: "Absenteeism vs State", group: "Signals", isDefault: false, filterType: "number" },
  { key: "graduationVsState", label: "Graduation vs State", group: "Signals", isDefault: false, filterType: "number" },
];
```

**Step 2: Create activity columns**

Create `src/components/map-v2/explore/columns/activityColumns.ts`:

```typescript
export interface ActivityRow {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  outcomeType: string | null;
  outcome: string | null;
  districtNames: string;
  planNames: string;
  contactNames: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date";
  enumValues?: string[];
}

export const ACTIVITY_COLUMN_DEFS: ColumnDef[] = [
  { key: "title", label: "Title", group: "Core", isDefault: true, filterType: "text" },
  { key: "type", label: "Type", group: "Core", isDefault: true, filterType: "enum",
    enumValues: ["conference", "road_trip", "email_campaign", "discovery_call", "demo", "proposal_review", "check_in", "onboarding", "training", "internal", "other"] },
  { key: "status", label: "Status", group: "Core", isDefault: true, filterType: "enum",
    enumValues: ["planned", "completed", "cancelled"] },
  { key: "startDate", label: "Date", group: "Core", isDefault: true, filterType: "date" },
  { key: "outcomeType", label: "Outcome", group: "Core", isDefault: true, filterType: "enum",
    enumValues: ["positive_progress", "neutral", "negative", "follow_up_needed", "no_response", "not_applicable"] },
  { key: "districtNames", label: "Districts", group: "Links", isDefault: true, filterType: "text" },
  { key: "planNames", label: "Plans", group: "Links", isDefault: true, filterType: "text" },
  { key: "contactNames", label: "Contacts", group: "Links", isDefault: false, filterType: "text" },
  { key: "outcome", label: "Outcome Notes", group: "Core", isDefault: false, filterType: "text" },
];
```

**Step 3: Create task columns**

Create `src/components/map-v2/explore/columns/taskColumns.ts`:

```typescript
export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  districtNames: string;
  planNames: string;
  contactNames: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date";
  enumValues?: string[];
}

export const TASK_COLUMN_DEFS: ColumnDef[] = [
  { key: "title", label: "Title", group: "Core", isDefault: true, filterType: "text" },
  { key: "status", label: "Status", group: "Core", isDefault: true, filterType: "enum",
    enumValues: ["todo", "in_progress", "blocked", "done"] },
  { key: "priority", label: "Priority", group: "Core", isDefault: true, filterType: "enum",
    enumValues: ["low", "medium", "high", "urgent"] },
  { key: "dueDate", label: "Due Date", group: "Core", isDefault: true, filterType: "date" },
  { key: "districtNames", label: "Districts", group: "Links", isDefault: true, filterType: "text" },
  { key: "planNames", label: "Plans", group: "Links", isDefault: true, filterType: "text" },
  { key: "contactNames", label: "Contacts", group: "Links", isDefault: false, filterType: "text" },
];
```

**Step 4: Create contact columns**

Create `src/components/map-v2/explore/columns/contactColumns.ts`:

```typescript
export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  districtLeaid: string | null;
  districtName: string;
  lastActivity: string | null;
}

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date";
  enumValues?: string[];
}

export const CONTACT_COLUMN_DEFS: ColumnDef[] = [
  { key: "name", label: "Name", group: "Core", isDefault: true, filterType: "text" },
  { key: "title", label: "Title", group: "Core", isDefault: true, filterType: "text" },
  { key: "email", label: "Email", group: "Core", isDefault: true, filterType: "text" },
  { key: "phone", label: "Phone", group: "Core", isDefault: true, filterType: "text" },
  { key: "districtName", label: "District", group: "Links", isDefault: true, filterType: "text" },
  { key: "isPrimary", label: "Primary", group: "Core", isDefault: true, filterType: "boolean" },
  { key: "lastActivity", label: "Last Activity", group: "Engagement", isDefault: true, filterType: "date" },
];
```

**Step 5: Commit**

```bash
git add src/components/map-v2/explore/
git commit -m "feat(explore): add column definitions for all four entities"
```

---

## Task 5: ExploreOverlay Container + IconBar Integration

**Files:**
- Create: `src/components/map-v2/explore/ExploreOverlay.tsx`
- Modify: `src/components/map-v2/IconBar.tsx`
- Modify: `src/components/map-v2/MapV2Shell.tsx`

**Step 1: Create ExploreOverlay skeleton**

Create `src/components/map-v2/explore/ExploreOverlay.tsx`:

```typescript
"use client";

import { useMapV2Store, type ExploreEntity } from "@/lib/map-v2-store";

const ENTITY_TABS: { key: ExploreEntity; label: string; icon: string }[] = [
  { key: "districts", label: "Districts", icon: "M3 3H7V7H3V3ZM9 3H13V7H9V3ZM3 9H7V13H3V9ZM9 9H13V13H9V9Z" },
  { key: "activities", label: "Activities", icon: "M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3M4.7 14 14 8S11.3 14 8 14 4.7 14 8 14Z" },
  { key: "tasks", label: "Tasks", icon: "M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13M3 12H5V14H3V12ZM7 12.5H13" },
  { key: "contacts", label: "Contacts", icon: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13" },
];

export default function ExploreOverlay() {
  const isExploreActive = useMapV2Store((s) => s.isExploreActive);
  const exploreEntity = useMapV2Store((s) => s.exploreEntity);
  const setExploreEntity = useMapV2Store((s) => s.setExploreEntity);
  const setActiveIconTab = useMapV2Store((s) => s.setActiveIconTab);

  if (!isExploreActive) return null;

  return (
    <div className="absolute inset-0 z-20 flex">
      {/* Left sidebar: entity tabs */}
      <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center pt-3 gap-1">
        {/* Back to map button */}
        <button
          onClick={() => setActiveIconTab("home")}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 mb-2"
          title="Back to Map"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8L10 4" />
          </svg>
        </button>

        <div className="w-8 border-t border-gray-200 mb-2" />

        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setExploreEntity(tab.key)}
            className={`w-10 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
              exploreEntity === tab.key
                ? "bg-plum/10 text-plum"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
            title={tab.label}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            <span className="leading-none">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            Explore {exploreEntity.charAt(0).toUpperCase() + exploreEntity.slice(1)}
          </h1>
        </div>

        {/* Filter bar placeholder */}
        <div className="bg-white border-b border-gray-200 px-6 py-2">
          <span className="text-sm text-gray-400">Filters will go here</span>
        </div>

        {/* KPI cards placeholder */}
        <div className="px-6 py-3">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 h-16 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Table placeholder */}
        <div className="flex-1 px-6 pb-6 overflow-hidden">
          <div className="bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center text-gray-400">
            Table will render here
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add Explore icon to IconBar**

In `src/components/map-v2/IconBar.tsx`, add `"explore"` to the tabs array (alongside home/search/plans). Add it before the settings icon. The icon should be a bar-chart/table icon:

```typescript
{ id: "explore" as IconBarTab, icon: <svg>...</svg>, label: "Explore" }
```

Use this SVG path for the explore icon (bar chart): `M3 13V8M7 13V5M11 13V9M15 13V3`

**Step 3: Render ExploreOverlay in MapV2Shell**

In `src/components/map-v2/MapV2Shell.tsx`, import and render `ExploreOverlay` after the `FloatingPanel`:

```typescript
import ExploreOverlay from "@/components/map-v2/explore/ExploreOverlay";

// In the render, after FloatingPanel:
<ExploreOverlay />
```

**Step 4: Verify it renders**

Run: `npm run dev`

Click the Explore icon in the IconBar. The full-screen overlay should appear with the entity tabs on the left and placeholder content. Clicking "Back" or another IconBar icon should close it.

**Step 5: Commit**

```bash
git add src/components/map-v2/explore/ExploreOverlay.tsx src/components/map-v2/IconBar.tsx src/components/map-v2/MapV2Shell.tsx
git commit -m "feat(explore): add ExploreOverlay shell with entity tabs and IconBar integration"
```

---

## Task 6: KPI Summary Cards

**Files:**
- Create: `src/components/map-v2/explore/ExploreKPICards.tsx`
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Create ExploreKPICards**

Create `src/components/map-v2/explore/ExploreKPICards.tsx`:

```typescript
"use client";

import type { ExploreEntity } from "@/lib/map-v2-store";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
}

function KPICard({ label, value, subtitle }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-0.5">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

interface Props {
  entity: ExploreEntity;
  aggregates: Record<string, number> | undefined;
  isLoading: boolean;
}

export default function ExploreKPICards({ entity, aggregates, isLoading }: Props) {
  if (isLoading || !aggregates) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 h-[68px] animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = getCardsForEntity(entity, aggregates);

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} />
      ))}
    </div>
  );
}

function getCardsForEntity(entity: ExploreEntity, agg: Record<string, number>): KPICardProps[] {
  switch (entity) {
    case "districts":
      return [
        { label: "Districts", value: formatNumber(agg.count) },
        { label: "Total Enrollment", value: formatNumber(agg.enrollment_sum), subtitle: "students" },
        { label: "Open Pipeline", value: formatCurrency(agg.pipeline_sum) },
        { label: "Closed Won", value: formatCurrency(agg.closed_won_sum) },
      ];
    case "activities":
      return [
        { label: "Total Activities", value: formatNumber(agg.count) },
        { label: "Completed", value: formatNumber(agg.completed) },
        { label: "Positive Outcomes", value: formatNumber(agg.positiveOutcomes) },
        { label: "Districts Touched", value: formatNumber(agg.districtsTouched) },
      ];
    case "tasks":
      return [
        { label: "Total Tasks", value: formatNumber(agg.count) },
        { label: "Overdue", value: formatNumber(agg.overdue) },
        { label: "Completed", value: formatNumber(agg.completed) },
        { label: "Blocked", value: formatNumber(agg.blocked) },
      ];
    case "contacts":
      return [
        { label: "Total Contacts", value: formatNumber(agg.count) },
        { label: "Districts Covered", value: formatNumber(agg.districtsCovered) },
        { label: "Primary Contacts", value: formatNumber(agg.primaryCount) },
        { label: "Recently Active", value: formatNumber(agg.withRecentActivity) },
      ];
  }
}
```

**Step 2: Wire KPICards into ExploreOverlay**

Replace the KPI placeholder in `ExploreOverlay.tsx` with the real component, passing `aggregates` from the API response (which we'll connect in the next task).

**Step 3: Commit**

```bash
git add src/components/map-v2/explore/ExploreKPICards.tsx src/components/map-v2/explore/ExploreOverlay.tsx
git commit -m "feat(explore): add dynamic KPI summary cards per entity"
```

---

## Task 7: ExploreTable with TanStack Table

**Files:**
- Create: `src/components/map-v2/explore/ExploreTable.tsx`
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Create ExploreTable**

Create `src/components/map-v2/explore/ExploreTable.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import type { ExploreEntity } from "@/lib/map-v2-store";

interface Props {
  entity: ExploreEntity;
  data: Record<string, unknown>[];
  visibleColumns: string[];
  sort: { column: string; direction: "asc" | "desc" } | null;
  onSort: (column: string) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  isLoading: boolean;
  pagination: { page: number; pageSize: number; total: number } | undefined;
  onPageChange: (page: number) => void;
}

function formatCellValue(value: unknown, key: string): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    return new Date(value as string).toLocaleDateString();
  }
  if (Array.isArray(value)) {
    // Tags array
    return value.map((t: { name?: string }) => t.name || t).join(", ");
  }
  if (typeof value === "number") {
    if (key.includes("percent") || key.includes("Rate") || key.includes("Proficiency")) {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (key.includes("revenue") || key.includes("pipeline") || key.includes("booking") || key.includes("value") || key.includes("take") || key.includes("expenditure")) {
      return value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  }
  return String(value);
}

export default function ExploreTable({
  entity,
  data,
  visibleColumns,
  sort,
  onSort,
  onRowClick,
  isLoading,
  pagination,
  onPageChange,
}: Props) {
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      visibleColumns.map((key) => ({
        id: key,
        accessorKey: key,
        header: () => {
          const isSorted = sort?.column === key;
          return (
            <button
              className="flex items-center gap-1 text-left w-full"
              onClick={() => onSort(key)}
            >
              <span>{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}</span>
              {isSorted && (
                <span className="text-plum">{sort.direction === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          );
        },
        cell: (info) => formatCellValue(info.getValue(), key),
      })),
    [visibleColumns, sort, onSort]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-auto v2-scrollbar">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {visibleColumns.map((col) => (
                    <td key={col} className="px-3 py-2">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-3 py-12 text-center text-gray-400">
                  No results found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-plum/5 cursor-pointer transition-colors"
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap max-w-[200px] truncate"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="px-2 py-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              ←
            </button>
            <span className="px-2 text-gray-700">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              disabled={pagination.page >= totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="px-2 py-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Wire ExploreTable into ExploreOverlay**

Update `ExploreOverlay.tsx` to:
1. Import and use `useExploreData` hook
2. Pass data to `ExploreKPICards` and `ExploreTable`
3. Handle sort toggling (same column = flip direction, new column = asc)
4. Handle row clicks (for districts: `selectDistrict(row.leaid)`)

```typescript
// In ExploreOverlay, add:
const exploreFilters = useMapV2Store((s) => s.exploreFilters);
const exploreSort = useMapV2Store((s) => s.exploreSort);
const explorePage = useMapV2Store((s) => s.explorePage);
const exploreColumns = useMapV2Store((s) => s.exploreColumns);
const setExploreSort = useMapV2Store((s) => s.setExploreSort);
const setExplorePage = useMapV2Store((s) => s.setExplorePage);

const { data: result, isLoading } = useExploreData(exploreEntity, {
  filters: exploreFilters[exploreEntity],
  sort: exploreSort[exploreEntity],
  page: explorePage,
});

const handleSort = (column: string) => {
  const current = exploreSort[exploreEntity];
  if (current?.column === column) {
    setExploreSort(exploreEntity, {
      column,
      direction: current.direction === "asc" ? "desc" : "asc",
    });
  } else {
    setExploreSort(exploreEntity, { column, direction: "asc" });
  }
};
```

**Step 3: Verify the table renders with real data**

Run: `npm run dev`

Navigate to Explore. The districts tab should load real data from the API, display in the table with sortable columns, and show KPI cards with real aggregates.

**Step 4: Commit**

```bash
git add src/components/map-v2/explore/ExploreTable.tsx src/components/map-v2/explore/ExploreOverlay.tsx
git commit -m "feat(explore): add TanStack Table with pagination and sorting"
```

---

## Task 8: Column Picker

**Files:**
- Create: `src/components/map-v2/explore/ExploreColumnPicker.tsx`
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Create ExploreColumnPicker**

Create `src/components/map-v2/explore/ExploreColumnPicker.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import type { ExploreEntity } from "@/lib/map-v2-store";
import { DISTRICT_COLUMN_DEFS } from "./columns/districtColumns";
import { ACTIVITY_COLUMN_DEFS } from "./columns/activityColumns";
import { TASK_COLUMN_DEFS } from "./columns/taskColumns";
import { CONTACT_COLUMN_DEFS } from "./columns/contactColumns";

const COLUMN_DEFS_MAP = {
  districts: DISTRICT_COLUMN_DEFS,
  activities: ACTIVITY_COLUMN_DEFS,
  tasks: TASK_COLUMN_DEFS,
  contacts: CONTACT_COLUMN_DEFS,
};

interface Props {
  entity: ExploreEntity;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export default function ExploreColumnPicker({ entity, selectedColumns, onColumnsChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const allDefs = COLUMN_DEFS_MAP[entity];
  const groups = [...new Set(allDefs.map((d) => d.group))];

  const toggle = (key: string) => {
    if (selectedColumns.includes(key)) {
      onColumnsChange(selectedColumns.filter((c) => c !== key));
    } else {
      onColumnsChange([...selectedColumns, key]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-gray-600"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4H14M2 8H14M2 12H14" strokeLinecap="round" />
        </svg>
        Columns
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-30 max-h-80 overflow-y-auto v2-scrollbar">
          {groups.map((group) => (
            <div key={group}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-medium bg-gray-50 sticky top-0">
                {group}
              </div>
              {allDefs
                .filter((d) => d.group === group)
                .map((d) => (
                  <label
                    key={d.key}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(d.key)}
                      onChange={() => toggle(d.key)}
                      className="rounded border-gray-300 text-plum focus:ring-plum"
                    />
                    <span className="text-sm text-gray-700">{d.label}</span>
                  </label>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add to ExploreOverlay filter bar**

Replace the filter bar placeholder with `ExploreColumnPicker`:

```typescript
<ExploreColumnPicker
  entity={exploreEntity}
  selectedColumns={exploreColumns[exploreEntity]}
  onColumnsChange={(cols) => setExploreColumns(exploreEntity, cols)}
/>
```

**Step 3: Persist column selections to localStorage**

Add a `useEffect` in `ExploreOverlay` that saves/loads column selections:

```typescript
useEffect(() => {
  const saved = localStorage.getItem("explore-columns");
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.entries(parsed).forEach(([entity, cols]) => {
      setExploreColumns(entity as ExploreEntity, cols as string[]);
    });
  }
}, []);

useEffect(() => {
  localStorage.setItem("explore-columns", JSON.stringify(exploreColumns));
}, [exploreColumns]);
```

**Step 4: Commit**

```bash
git add src/components/map-v2/explore/ExploreColumnPicker.tsx src/components/map-v2/explore/ExploreOverlay.tsx
git commit -m "feat(explore): add column picker with grouped checkboxes and localStorage persistence"
```

---

## Task 9: Filter Bar

**Files:**
- Create: `src/components/map-v2/explore/ExploreFilters.tsx`
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Create ExploreFilters**

Create `src/components/map-v2/explore/ExploreFilters.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import type { ExploreEntity, ExploreFilter, FilterOp } from "@/lib/map-v2-store";
import { DISTRICT_COLUMN_DEFS } from "./columns/districtColumns";
import { ACTIVITY_COLUMN_DEFS } from "./columns/activityColumns";
import { TASK_COLUMN_DEFS } from "./columns/taskColumns";
import { CONTACT_COLUMN_DEFS } from "./columns/contactColumns";

const COLUMN_DEFS_MAP = {
  districts: DISTRICT_COLUMN_DEFS,
  activities: ACTIVITY_COLUMN_DEFS,
  tasks: TASK_COLUMN_DEFS,
  contacts: CONTACT_COLUMN_DEFS,
};

interface Props {
  entity: ExploreEntity;
  filters: ExploreFilter[];
  onAddFilter: (filter: ExploreFilter) => void;
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
}

export default function ExploreFilters({ entity, filters, onAddFilter, onRemoveFilter, onClearAll }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [filterMin, setFilterMin] = useState("");
  const [filterMax, setFilterMax] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPicker(false);
        setSelectedColumn(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const allDefs = COLUMN_DEFS_MAP[entity];
  const selectedDef = selectedColumn ? allDefs.find((d) => d.key === selectedColumn) : null;

  const addFilter = () => {
    if (!selectedDef) return;

    let op: FilterOp;
    let value: ExploreFilter["value"];

    switch (selectedDef.filterType) {
      case "text":
        op = "contains";
        value = filterValue;
        break;
      case "enum":
        op = "eq";
        value = filterValue;
        break;
      case "number":
        if (filterMin && filterMax) {
          op = "between";
          value = [parseFloat(filterMin), parseFloat(filterMax)];
        } else if (filterMin) {
          op = "gte";
          value = parseFloat(filterMin);
        } else {
          op = "lte";
          value = parseFloat(filterMax);
        }
        break;
      case "boolean":
        op = filterValue === "true" ? "is_true" : "is_false";
        value = filterValue === "true";
        break;
      case "date":
        op = "gte";
        value = filterValue; // ISO date string
        break;
      default:
        op = "contains";
        value = filterValue;
    }

    onAddFilter({
      id: crypto.randomUUID(),
      column: selectedDef.key,
      op,
      value,
    });

    setShowPicker(false);
    setSelectedColumn(null);
    setFilterValue("");
    setFilterMin("");
    setFilterMax("");
  };

  const renderValueInput = () => {
    if (!selectedDef) return null;

    switch (selectedDef.filterType) {
      case "text":
        return (
          <input
            type="text"
            placeholder="Contains..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded w-full"
            autoFocus
          />
        );
      case "enum":
        return (
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded w-full"
          >
            <option value="">Select...</option>
            {selectedDef.enumValues?.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        );
      case "number":
        return (
          <div className="flex gap-1">
            <input type="number" placeholder="Min" value={filterMin} onChange={(e) => setFilterMin(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-200 rounded w-full" />
            <input type="number" placeholder="Max" value={filterMax} onChange={(e) => setFilterMax(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-200 rounded w-full" />
          </div>
        );
      case "boolean":
        return (
          <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded w-full">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      case "date":
        return (
          <input type="date" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded w-full" />
        );
      default:
        return null;
    }
  };

  const formatFilterPill = (f: ExploreFilter): string => {
    const def = allDefs.find((d) => d.key === f.column);
    const label = def?.label || f.column;
    if (f.op === "contains") return `${label}: "${f.value}"`;
    if (f.op === "between") return `${label}: ${(f.value as [number, number]).join("–")}`;
    if (f.op === "is_true") return `${label}: Yes`;
    if (f.op === "is_false") return `${label}: No`;
    if (f.op === "gte") return `${label} ≥ ${f.value}`;
    if (f.op === "lte") return `${label} ≤ ${f.value}`;
    return `${label}: ${f.value}`;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filter pills */}
      {filters.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-plum/10 text-plum rounded-full"
        >
          {formatFilterPill(f)}
          <button
            onClick={() => onRemoveFilter(f.id)}
            className="hover:text-plum/70 ml-0.5"
          >
            ×
          </button>
        </span>
      ))}

      {/* Add filter button */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="px-2.5 py-1 text-xs border border-dashed border-gray-300 rounded-full hover:bg-gray-50 text-gray-500"
        >
          + Add Filter
        </button>

        {showPicker && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-30">
            {!selectedColumn ? (
              <div className="max-h-60 overflow-y-auto v2-scrollbar">
                {allDefs.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setSelectedColumn(d.key)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                <div className="text-xs font-medium text-gray-500">{selectedDef?.label}</div>
                {renderValueInput()}
                <div className="flex gap-2">
                  <button onClick={() => setSelectedColumn(null)}
                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">
                    Back
                  </button>
                  <button onClick={addFilter}
                    className="px-2 py-1 text-xs bg-plum text-white rounded hover:bg-plum/90">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear all */}
      {filters.length > 0 && (
        <button onClick={onClearAll} className="text-xs text-gray-400 hover:text-gray-600">
          Clear all
        </button>
      )}
    </div>
  );
}
```

**Step 2: Wire into ExploreOverlay**

Replace the filter placeholder with:

```typescript
<ExploreFilters
  entity={exploreEntity}
  filters={exploreFilters[exploreEntity]}
  onAddFilter={(f) => addExploreFilter(exploreEntity, f)}
  onRemoveFilter={(id) => removeExploreFilter(exploreEntity, id)}
  onClearAll={() => clearExploreFilters(exploreEntity)}
/>
```

**Step 3: Verify filters work end-to-end**

Run: `npm run dev`

Add a filter on Districts tab (e.g., State = "IL"). Verify the table re-fetches with the filter applied, KPI cards update, and the filter pill appears.

**Step 4: Commit**

```bash
git add src/components/map-v2/explore/ExploreFilters.tsx src/components/map-v2/explore/ExploreOverlay.tsx
git commit -m "feat(explore): add filter bar with pills, column picker, and multi-type filter inputs"
```

---

## Task 10: Mini-Map and Bidirectional Map Sync

**Files:**
- Create: `src/components/map-v2/explore/ExploreMiniMap.tsx`
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`
- Modify: `src/components/map-v2/MapV2Shell.tsx` (or the map container that reads layer filters)

**Step 1: Create ExploreMiniMap**

Create `src/components/map-v2/explore/ExploreMiniMap.tsx`:

```typescript
"use client";

import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import { useMapV2Store } from "@/lib/map-v2-store";

interface Props {
  filteredLeaids: string[];
  districtLocations: { leaid: string; lat: number | null; lng: number | null }[];
  onExpand: () => void;
}

export default function ExploreMiniMap({ filteredLeaids, districtLocations, onExpand }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-96, 38],
      zoom: 3,
      interactive: false,
      attributionControl: false,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add markers for filtered districts
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing markers
    const markers = document.querySelectorAll(".explore-mini-marker");
    markers.forEach((m) => m.remove());

    const validLocations = districtLocations.filter(
      (d) => d.lat && d.lng && filteredLeaids.includes(d.leaid)
    );

    // Only show dots if reasonable count
    if (validLocations.length > 500) return;

    validLocations.forEach((d) => {
      const el = document.createElement("div");
      el.className = "explore-mini-marker";
      el.style.cssText = "width:4px;height:4px;background:#7c3aed;border-radius:50%;";

      new maplibregl.Marker({ element: el })
        .setLngLat([d.lng!, d.lat!])
        .addTo(map);
    });
  }, [filteredLeaids, districtLocations]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-4 right-4 z-30 w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-700"
        title="Show mini-map"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 6V1H6M10 1H15V6M15 10V15H10M6 15H1V10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-30 w-[280px] h-[200px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={onExpand}
          className="w-7 h-7 bg-white/90 rounded shadow flex items-center justify-center text-gray-500 hover:text-plum"
          title="Expand to full map"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 15L6 10M10 1H15V6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 bg-white/90 rounded shadow flex items-center justify-center text-gray-500 hover:text-gray-700"
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12H12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Wire mini-map into ExploreOverlay**

Add `ExploreMiniMap` at the bottom of the overlay, positioned absolutely:

```typescript
{exploreEntity === "districts" && result?.data && (
  <ExploreMiniMap
    filteredLeaids={result.data.map((d: any) => d.leaid)}
    districtLocations={result.data.map((d: any) => ({ leaid: d.leaid, lat: d.lat, lng: d.lng }))}
    onExpand={() => {
      setFilteredDistrictLeaids(result.data.map((d: any) => d.leaid));
      setActiveIconTab("home");
    }}
  />
)}
```

**Step 3: Update the main map to read filteredDistrictLeaids**

In the main map container (MapV2Container or wherever district layer styles are applied), read `filteredDistrictLeaids` from the store. When non-empty, apply an opacity filter:

```typescript
const filteredDistrictLeaids = useMapV2Store((s) => s.filteredDistrictLeaids);

// When setting map paint properties for district fill layer:
if (filteredDistrictLeaids.length > 0) {
  map.setPaintProperty("districts-fill", "fill-opacity", [
    "case",
    ["in", ["get", "leaid"], ["literal", filteredDistrictLeaids]],
    0.6,
    0.05,
  ]);
}
```

**Step 4: Commit**

```bash
git add src/components/map-v2/explore/ExploreMiniMap.tsx src/components/map-v2/explore/ExploreOverlay.tsx
git commit -m "feat(explore): add mini-map with district dots and bidirectional map sync"
```

---

## Task 11: Row Click → District Card Integration

**Files:**
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Add row click handler**

In `ExploreOverlay.tsx`, add a handler that opens the district card in the right panel when a district row is clicked:

```typescript
const openRightPanel = useMapV2Store((s) => s.openRightPanel);

const handleRowClick = (row: Record<string, unknown>) => {
  if (exploreEntity === "districts" && row.leaid) {
    openRightPanel({ type: "district_card", id: row.leaid as string });
  }
  // For activities/tasks: could open edit forms in the future
};
```

Pass `onRowClick={handleRowClick}` to `ExploreTable`.

**Step 2: Handle right panel visibility in Explore mode**

The right panel currently only shows in plan workspace states. Update `FloatingPanel.tsx` or the overlay to conditionally render `RightPanel` when `isExploreActive` too. Since ExploreOverlay is a separate full-screen layer, render the right panel inside the overlay:

```typescript
{rightPanelContent && (
  <div className="w-[380px] border-l border-gray-200 bg-white overflow-y-auto v2-scrollbar">
    <RightPanel />
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/components/map-v2/explore/ExploreOverlay.tsx
git commit -m "feat(explore): add row click → district card integration"
```

---

## Task 12: Polish and Edge Cases

**Files:**
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Clear filteredDistrictLeaids when exiting Explore**

In the store's `setActiveIconTab`, when switching away from "explore", clear `filteredDistrictLeaids`:

```typescript
setActiveIconTab: (tab) =>
  set((s) => ({
    activeIconTab: tab,
    isExploreActive: tab === "explore",
    filteredDistrictLeaids: tab === "explore" ? s.filteredDistrictLeaids : [],
    // ... existing reset logic
  })),
```

**Step 2: Add empty state for each entity tab**

In `ExploreTable`, when `data.length === 0` and no filters are active, show a helpful message:

```
"No [entity] found. Try adjusting your filters or adding data."
```

**Step 3: Add keyboard navigation**

In `ExploreOverlay`, add an `Escape` key handler to exit Explore:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isExploreActive) {
      setActiveIconTab("home");
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [isExploreActive]);
```

**Step 4: Style the explore icon in IconBar to match Fullmind brand**

Use `text-plum` for the active state (consistent with existing IconBar pattern).

**Step 5: Test all four entity tabs**

Run `npm run dev` and verify:
1. Districts tab: data loads, columns show, filters work, KPIs update, sort works, pagination works
2. Activities tab: same
3. Tasks tab: same
4. Contacts tab: same
5. Column picker: add/remove columns, selections persist across tab switches
6. Row click on district opens right panel card
7. Mini-map shows filtered district dots
8. Expanding mini-map returns to map with filtered districts highlighted
9. Escape key exits Explore mode
10. Switching entity tabs preserves filters per entity

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(explore): polish edge cases, keyboard nav, empty states"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | Store + Deps | Install TanStack Table, add Explore types/state/actions to Zustand |
| 2 | API | Create `/api/explore/[entity]` with filters, sorting, pagination, aggregates |
| 3 | Hook | Add `useExploreData` React Query hook |
| 4 | Columns | Column definitions for Districts, Activities, Tasks, Contacts |
| 5 | Shell | ExploreOverlay container + IconBar integration |
| 6 | KPI Cards | Dynamic summary cards per entity |
| 7 | Table | TanStack Table with sorting, pagination, loading states |
| 8 | Column Picker | Grouped checkbox popover with localStorage persistence |
| 9 | Filter Bar | Filter pills, multi-type inputs, add/remove/clear |
| 10 | Mini-Map | Mini-map with district dots + bidirectional sync |
| 11 | Row Click | District card integration on row click |
| 12 | Polish | Edge cases, keyboard nav, empty states, testing |
