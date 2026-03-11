# Map Saved Views & Plan Actions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add save/load named map views, create territory plans from visible districts, and add visible districts to existing plans — all from a new action bar at the top of MapSummaryBar.

**Architecture:** New `MapView` Prisma model stores named map state snapshots (JSON blob of all filters, vendors, palettes, signals). Three new popovers in a `ViewActionsBar` component sit above MapSummaryBar's stats row. Server-side filter replay resolves visible LEAIDs for plan creation. Standard React Query mutations + API routes follow existing patterns.

**Tech Stack:** Prisma (Postgres), Next.js App Router API routes, Zustand store, TanStack React Query, Tailwind CSS

---

### Task 1: Add MapView model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add MapView model to schema**

Add after the `TerritoryPlan` related models (around line 560):

```prisma
// ===== Map Views =====
// Named map state snapshots — captures filter, vendor, palette, and signal configuration
model MapView {
  id          String      @id @default(uuid())
  name        String      @db.VarChar(200)
  description String?     @db.Text
  ownerId     String      @map("owner_id") @db.Uuid
  isShared    Boolean     @default(false) @map("is_shared")
  state       Json
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  owner       UserProfile @relation("MapViewOwner", fields: [ownerId], references: [id], onDelete: Cascade)

  @@map("map_views")
}
```

**Step 2: Add relation to UserProfile**

In the `UserProfile` model (around line 656), add:

```prisma
savedMapViews  MapView[] @relation("MapViewOwner")
```

**Step 3: Generate migration**

Run: `npx prisma migrate dev --name add_map_views`

**Step 4: Verify migration**

Run: `npx prisma generate`
Expected: Prisma client regenerated successfully.

**Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add MapView model for saved map state snapshots"
```

---

### Task 2: Add getViewSnapshot and applyViewSnapshot to Zustand store

**Files:**
- Modify: `src/features/map/lib/store.ts`

**Step 1: Define MapViewState type**

Add after the `ExploreSavedView` interface (around line 56):

```typescript
/** Serialized map view state for saving/loading named views */
export interface MapViewState {
  activeVendors: string[];
  filterOwner: string | null;
  filterStates: string[];
  filterAccountTypes: string[];
  fullmindEngagement: string[];
  competitorEngagement: Record<string, string[]>;
  vendorPalettes: Record<string, string>;
  signalPalette: string;
  categoryColors: Record<string, string>;
  categoryOpacities: Record<string, number>;
  vendorOpacities: Record<string, number>;
  activeSignal: string | null;
  visibleLocales: string[];
  visibleSchoolTypes: string[];
  selectedFiscalYear: string;
}
```

**Step 2: Add actions to MapV2Actions interface**

Add after `hasUnsavedChanges` (around line 299):

```typescript
// Map view save/load
getViewSnapshot: () => MapViewState;
applyViewSnapshot: (state: MapViewState) => void;
```

**Step 3: Implement getViewSnapshot**

Add to the store creator (after `hasUnsavedChanges` implementation). This reuses the `serializeMapState` fields but returns a structured object instead of a JSON string:

```typescript
getViewSnapshot: () => {
  const s = get();
  return {
    activeVendors: [...s.activeVendors].sort(),
    filterOwner: s.filterOwner,
    filterStates: [...s.filterStates].sort(),
    filterAccountTypes: [...s.filterAccountTypes].sort(),
    fullmindEngagement: [...s.fullmindEngagement].sort(),
    competitorEngagement: s.competitorEngagement,
    vendorPalettes: s.vendorPalettes,
    signalPalette: s.signalPalette,
    categoryColors: s.categoryColors,
    categoryOpacities: s.categoryOpacities,
    vendorOpacities: s.vendorOpacities,
    activeSignal: s.activeSignal,
    visibleLocales: [...s.visibleLocales].sort(),
    visibleSchoolTypes: [...s.visibleSchoolTypes].sort(),
    selectedFiscalYear: s.selectedFiscalYear,
  };
},
```

**Step 4: Implement applyViewSnapshot**

```typescript
applyViewSnapshot: (state: MapViewState) => {
  set({
    activeVendors: new Set(state.activeVendors as VendorId[]),
    filterOwner: state.filterOwner,
    filterStates: state.filterStates,
    filterAccountTypes: state.filterAccountTypes as AccountTypeValue[],
    fullmindEngagement: state.fullmindEngagement,
    competitorEngagement: state.competitorEngagement,
    vendorPalettes: state.vendorPalettes as Record<VendorId, string>,
    signalPalette: state.signalPalette,
    categoryColors: state.categoryColors,
    categoryOpacities: state.categoryOpacities,
    vendorOpacities: state.vendorOpacities as Record<VendorId, number>,
    activeSignal: state.activeSignal as SignalId | null,
    visibleLocales: new Set(state.visibleLocales as LocaleId[]),
    visibleSchoolTypes: new Set(state.visibleSchoolTypes as SchoolType[]),
    selectedFiscalYear: state.selectedFiscalYear as "fy24" | "fy25" | "fy26" | "fy27",
  });
},
```

**Step 5: Commit**

```bash
git add src/features/map/lib/store.ts
git commit -m "feat: add getViewSnapshot and applyViewSnapshot to map store"
```

---

### Task 3: Create Map Views API routes

**Files:**
- Create: `src/app/api/map-views/route.ts`
- Create: `src/app/api/map-views/[id]/route.ts`

**Step 1: Create the list/create route**

Create `src/app/api/map-views/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const views = await prisma.mapView.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { isShared: true },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        isShared: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(views);
  } catch (error) {
    console.error("Error fetching map views:", error);
    return NextResponse.json({ error: "Failed to fetch map views" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, isShared, state } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (name.trim().length > 200) {
      return NextResponse.json({ error: "name must be 200 characters or fewer" }, { status: 400 });
    }
    if (!state || typeof state !== "object") {
      return NextResponse.json({ error: "state is required" }, { status: 400 });
    }

    const view = await prisma.mapView.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: user.id,
        isShared: isShared === true,
        state,
      },
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    console.error("Error creating map view:", error);
    return NextResponse.json({ error: "Failed to create map view" }, { status: 500 });
  }
}
```

**Step 2: Create the detail/update/delete route**

Create `src/app/api/map-views/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const view = await prisma.mapView.findFirst({
      where: {
        id,
        OR: [{ ownerId: user.id }, { isShared: true }],
      },
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    if (!view) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    return NextResponse.json(view);
  } catch (error) {
    console.error("Error fetching map view:", error);
    return NextResponse.json({ error: "Failed to fetch map view" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;

    // Only owner can update
    const existing = await prisma.mapView.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "View not found or not owned by you" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, isShared } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      }
      if (name.trim().length > 200) {
        return NextResponse.json({ error: "name must be 200 characters or fewer" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (isShared !== undefined) data.isShared = isShared === true;

    const view = await prisma.mapView.update({
      where: { id },
      data,
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(view);
  } catch (error) {
    console.error("Error updating map view:", error);
    return NextResponse.json({ error: "Failed to update map view" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;

    // Only owner can delete
    const existing = await prisma.mapView.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "View not found or not owned by you" }, { status: 404 });
    }

    await prisma.mapView.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting map view:", error);
    return NextResponse.json({ error: "Failed to delete map view" }, { status: 500 });
  }
}
```

**Step 3: Verify routes compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/app/api/map-views/
git commit -m "feat: add CRUD API routes for map views"
```

---

### Task 4: Create React Query hooks for map views

**Files:**
- Create: `src/features/map/lib/map-view-queries.ts`

**Step 1: Create the query hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

export interface MapViewSummary {
  id: string;
  name: string;
  description: string | null;
  isShared: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: { id: true; fullName: string | null; avatarUrl: string | null };
}

export interface MapViewDetail extends MapViewSummary {
  state: Record<string, unknown>;
}

export function useMapViews() {
  return useQuery({
    queryKey: ["mapViews"],
    queryFn: () => fetchJson<MapViewSummary[]>(`${API_BASE}/map-views`),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMapView(id: string | null) {
  return useQuery({
    queryKey: ["mapView", id],
    queryFn: () => fetchJson<MapViewDetail>(`${API_BASE}/map-views/${id}`),
    enabled: !!id,
  });
}

export function useCreateMapView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (view: {
      name: string;
      description?: string;
      isShared?: boolean;
      state: Record<string, unknown>;
    }) =>
      fetchJson<MapViewDetail>(`${API_BASE}/map-views`, {
        method: "POST",
        body: JSON.stringify(view),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapViews"] });
    },
  });
}

export function useUpdateMapView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      isShared?: boolean;
    }) =>
      fetchJson<MapViewDetail>(`${API_BASE}/map-views/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mapViews"] });
      queryClient.invalidateQueries({ queryKey: ["mapView", variables.id] });
    },
  });
}

export function useDeleteMapView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/map-views/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapViews"] });
    },
  });
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/features/map/lib/map-view-queries.ts
git commit -m "feat: add React Query hooks for map view CRUD"
```

---

### Task 5: Create a districts/leaids API endpoint

The "Create Plan" and "Add to Plan" flows need the LEAIDs of currently visible districts. The summary endpoint only returns aggregate stats, not individual LEAIDs. Add a lightweight endpoint that returns just the LEAIDs matching the current map filters.

**Files:**
- Create: `src/app/api/districts/leaids/route.ts`

**Step 1: Create the endpoint**

This mirrors the filter logic from `/api/districts/summary` but only returns LEAIDs:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const fy = params.get("fy") || "fy26";
    const states = params.get("states");
    const owner = params.get("owner");
    const planId = params.get("planId");
    const accountTypes = params.get("accountTypes");
    const vendors = params.get("vendors");

    // Build WHERE clauses matching the summary endpoint logic
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (vendors) {
      const vendorList = vendors.split(",").filter(Boolean);
      if (vendorList.length > 0) {
        const placeholders = vendorList.map(() => `$${paramIdx++}`);
        conditions.push(`dmf.vendor_id IN (${placeholders.join(",")})`);
        values.push(...vendorList);
      }
    }

    if (states) {
      const stateList = states.split(",").filter(Boolean);
      if (stateList.length > 0) {
        const placeholders = stateList.map(() => `$${paramIdx++}`);
        conditions.push(`d.state_abbrev IN (${placeholders.join(",")})`);
        values.push(...stateList);
      }
    }

    if (owner) {
      conditions.push(`d.sales_executive_id = $${paramIdx++}`);
      values.push(owner);
    }

    if (planId) {
      conditions.push(`EXISTS (SELECT 1 FROM territory_plan_districts tpd WHERE tpd.plan_id = $${paramIdx++} AND tpd.district_leaid = dmf.leaid)`);
      values.push(planId);
    }

    if (accountTypes) {
      const typeList = accountTypes.split(",").filter(Boolean);
      if (typeList.length > 0) {
        const placeholders = typeList.map(() => `$${paramIdx++}`);
        conditions.push(`dmf.${fy}_category IN (${placeholders.join(",")})`);
        values.push(...typeList);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await prisma.$queryRawUnsafe<{ leaid: string }[]>(
      `SELECT DISTINCT dmf.leaid
       FROM district_map_facts dmf
       JOIN districts d ON dmf.leaid = d.leaid
       ${whereClause}
       ORDER BY dmf.leaid`,
      ...values
    );

    return NextResponse.json({ leaids: result.map((r) => r.leaid) });
  } catch (error) {
    console.error("Error fetching district leaids:", error);
    return NextResponse.json({ error: "Failed to fetch district leaids" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/districts/leaids/route.ts
git commit -m "feat: add endpoint to resolve filtered district LEAIDs"
```

---

### Task 6: Build the ViewActionsBar component

**Files:**
- Create: `src/features/map/components/ViewActionsBar.tsx`
- Modify: `src/features/map/components/MapSummaryBar.tsx`

**Step 1: Create ViewActionsBar component**

This is the container for the three action buttons plus their popovers. Start with just the button row and toast:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useCreateMapView, useMapViews } from "@/features/map/lib/map-view-queries";
import { useTerritoryPlans, useCreateTerritoryPlan, useAddDistrictsToPlan } from "@/features/plans/lib/queries";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { MapViewState } from "@/features/map/lib/store";

type ActivePopover = "save" | "load" | "create-plan" | "add-to-plan" | null;

export default function ViewActionsBar() {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggle = (p: ActivePopover) =>
    setActivePopover((cur) => (cur === p ? null : p));

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-200/60">
        <ActionBtn label="Save View" onClick={() => toggle("save")} />
        <ActionBtn label="Load View" onClick={() => toggle("load")} />
        <div className="w-px h-4 bg-gray-200/60 shrink-0" />
        <ActionBtn label="Create Plan" onClick={() => toggle("create-plan")} />
        <ActionBtn label="Add to Plan" onClick={() => toggle("add-to-plan")} />
      </div>

      {activePopover === "save" && (
        <SaveViewPopover
          onClose={() => setActivePopover(null)}
          onSuccess={(name) => {
            setActivePopover(null);
            setToast(`Saved view "${name}"`);
          }}
        />
      )}
      {activePopover === "load" && (
        <LoadViewPopover
          onClose={() => setActivePopover(null)}
          onLoaded={(name) => {
            setActivePopover(null);
            setToast(`Loaded view "${name}"`);
          }}
        />
      )}
      {activePopover === "create-plan" && (
        <CreatePlanPopover
          onClose={() => setActivePopover(null)}
          onSuccess={(name) => {
            setActivePopover(null);
            setToast(`Created plan "${name}"`);
          }}
        />
      )}
      {activePopover === "add-to-plan" && (
        <AddToPlanPopover
          onClose={() => setActivePopover(null)}
          onSuccess={(name, count) => {
            setActivePopover(null);
            setToast(`Added ${count} district${count !== 1 ? "s" : ""} to "${name}"`);
          }}
        />
      )}

      {toast && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
    >
      {label}
    </button>
  );
}
```

**Step 2: Add SaveViewPopover**

Append to the same file:

```typescript
function SaveViewPopover({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const getViewSnapshot = useMapV2Store((s) => s.getViewSnapshot);
  const createView = useCreateMapView();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await createView.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        isShared,
        state: getViewSnapshot() as unknown as Record<string, unknown>,
      });
      onSuccess(name.trim());
    } catch {
      // fetchJson throws with detail
    }
  };

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Save View</div>
      <input
        ref={inputRef}
        type="text"
        placeholder="View name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2"
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2 resize-none"
      />
      <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isShared}
          onChange={(e) => setIsShared(e.target.checked)}
          className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
        />
        Share with team
      </label>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || createView.isPending}
          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
        >
          {createView.isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </Popover>
  );
}
```

**Step 3: Add LoadViewPopover**

```typescript
function LoadViewPopover({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: (name: string) => void;
}) {
  const { data: views, isLoading } = useMapViews();
  const applyViewSnapshot = useMapV2Store((s) => s.applyViewSnapshot);

  const handleLoad = async (viewId: string, viewName: string) => {
    try {
      const detail = await fetchJson<{ state: MapViewState }>(
        `${API_BASE}/map-views/${viewId}`
      );
      applyViewSnapshot(detail.state);
      onLoaded(viewName);
    } catch {
      // fetchJson throws with detail
    }
  };

  const myViews = views?.filter((v) => !v.isShared || v.ownerId === v.owner?.id) ?? [];
  const sharedViews = views?.filter((v) => v.isShared && v.ownerId !== v.owner?.id) ?? [];

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Load View</div>
      {isLoading ? (
        <div className="text-xs text-gray-400 py-2">Loading...</div>
      ) : !views?.length ? (
        <div className="text-xs text-gray-400 py-2">No saved views yet</div>
      ) : (
        <div className="max-h-48 overflow-y-auto -mx-1">
          {myViews.length > 0 && (
            <>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-1 mb-1">My Views</div>
              {myViews.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleLoad(v.id, v.name)}
                  className="w-full text-left text-xs text-gray-600 hover:bg-gray-100 rounded px-1 py-1 truncate"
                >
                  {v.name}
                </button>
              ))}
            </>
          )}
          {sharedViews.length > 0 && (
            <>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-1 mb-1 mt-2">Shared</div>
              {sharedViews.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleLoad(v.id, v.name)}
                  className="w-full text-left text-xs text-gray-600 hover:bg-gray-100 rounded px-1 py-1 truncate"
                >
                  {v.name}
                  <span className="text-gray-400 ml-1">by {v.owner?.fullName ?? "Unknown"}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </Popover>
  );
}
```

**Step 4: Add CreatePlanPopover**

```typescript
function CreatePlanPopover({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const [fiscalYear, setFiscalYear] = useState(
    parseInt(selectedFiscalYear.replace("fy", "20"), 10)
  );
  const createPlan = useCreateTerritoryPlan();
  const addDistricts = useAddDistrictsToPlan();
  const [isWorking, setIsWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the filter params to resolve visible LEAIDs
  const filterStates = useMapV2Store((s) => s.filterStates);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsWorking(true);
    try {
      // 1. Get the visible district LEAIDs
      const params = new URLSearchParams();
      params.set("fy", selectedFiscalYear);
      const statesCsv = [...filterStates].sort().join(",");
      const vendorsCsv = [...activeVendors].sort().join(",");
      const accountTypesCsv = [...filterAccountTypes].sort().join(",");
      if (statesCsv) params.set("states", statesCsv);
      if (filterOwner) params.set("owner", filterOwner);
      if (filterPlanId) params.set("planId", filterPlanId);
      if (accountTypesCsv) params.set("accountTypes", accountTypesCsv);
      if (vendorsCsv) params.set("vendors", vendorsCsv);

      const { leaids } = await fetchJson<{ leaids: string[] }>(
        `${API_BASE}/districts/leaids?${params.toString()}`
      );

      // 2. Create the plan
      const plan = await createPlan.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        fiscalYear,
      });

      // 3. Add districts to the plan
      if (leaids.length > 0) {
        await addDistricts.mutateAsync({ planId: plan.id, leaids });
      }

      onSuccess(name.trim());
    } catch {
      setIsWorking(false);
    }
  };

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Create Plan from Visible Districts</div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Plan name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2"
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      />
      <select
        value={fiscalYear}
        onChange={(e) => setFiscalYear(Number(e.target.value))}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2 bg-white"
      >
        <option value={2024}>FY24</option>
        <option value={2025}>FY25</option>
        <option value={2026}>FY26</option>
        <option value={2027}>FY27</option>
      </select>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2 resize-none"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || isWorking}
          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
        >
          {isWorking ? "Creating..." : "Create"}
        </button>
      </div>
    </Popover>
  );
}
```

**Step 5: Add AddToPlanPopover**

```typescript
function AddToPlanPopover({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string, count: number) => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data: plans, isLoading: plansLoading } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();
  const [isWorking, setIsWorking] = useState(false);

  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const filterStates = useMapV2Store((s) => s.filterStates);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  const filtered = plans?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const handleAdd = async () => {
    if (!selectedPlanId) return;
    const plan = plans?.find((p) => p.id === selectedPlanId);
    if (!plan) return;
    setIsWorking(true);
    try {
      const params = new URLSearchParams();
      params.set("fy", selectedFiscalYear);
      const statesCsv = [...filterStates].sort().join(",");
      const vendorsCsv = [...activeVendors].sort().join(",");
      const accountTypesCsv = [...filterAccountTypes].sort().join(",");
      if (statesCsv) params.set("states", statesCsv);
      if (filterOwner) params.set("owner", filterOwner);
      if (filterPlanId) params.set("planId", filterPlanId);
      if (accountTypesCsv) params.set("accountTypes", accountTypesCsv);
      if (vendorsCsv) params.set("vendors", vendorsCsv);

      const { leaids } = await fetchJson<{ leaids: string[] }>(
        `${API_BASE}/districts/leaids?${params.toString()}`
      );

      const result = await addDistricts.mutateAsync({
        planId: selectedPlanId,
        leaids,
      });

      onSuccess(plan.name, result.added);
    } catch {
      setIsWorking(false);
    }
  };

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Add Visible Districts to Plan</div>
      <input
        type="text"
        placeholder="Search plans..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2"
        autoFocus
      />
      <div className="max-h-36 overflow-y-auto mb-2 -mx-1">
        {plansLoading ? (
          <div className="text-xs text-gray-400 py-2 px-1">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-gray-400 py-2 px-1">No plans found</div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlanId(p.id)}
              className={`w-full text-left text-xs rounded px-1 py-1 truncate ${
                selectedPlanId === p.id
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
              <span className="text-gray-400 ml-1">({p.districtCount} districts)</span>
            </button>
          ))
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
        <button
          onClick={handleAdd}
          disabled={!selectedPlanId || isWorking}
          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
        >
          {isWorking ? "Adding..." : "Add Districts"}
        </button>
      </div>
    </Popover>
  );
}
```

**Step 6: Add shared Popover container**

```typescript
function Popover({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-3 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-20 animate-in fade-in zoom-in-95 duration-150"
    >
      {children}
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add src/features/map/components/ViewActionsBar.tsx
git commit -m "feat: add ViewActionsBar with save, load, create plan, and add to plan popovers"
```

---

### Task 7: Integrate ViewActionsBar into MapSummaryBar

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx`

**Step 1: Add import**

Add at the top of MapSummaryBar.tsx:

```typescript
import ViewActionsBar from "@/features/map/components/ViewActionsBar";
```

**Step 2: Add ViewActionsBar above the stats row**

In the `MapSummaryBar` component's return, add `<ViewActionsBar />` as the first child inside the card, right before the loading check. Replace the current structure:

From:
```tsx
<div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 overflow-hidden">
  {isLoading ? (
```

To:
```tsx
<div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 overflow-hidden">
  <ViewActionsBar />
  {isLoading ? (
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: integrate ViewActionsBar into MapSummaryBar"
```

---

### Task 8: Manual QA and polish

**Step 1: Verify the full flow**

Run: `npm run dev`

Test these flows:
1. Open the map, apply some filters (e.g., select states, change fiscal year, toggle vendors)
2. Click "Save View" → enter a name → toggle shared → save. Verify toast appears.
3. Click "Load View" → verify the saved view appears in the list → click to load. Verify filters restore.
4. Click "Create Plan" → enter a name, select fiscal year → create. Verify plan appears in plans list.
5. Click "Add to Plan" → search for a plan → select → add. Verify toast shows count.

**Step 2: Fix any issues found during QA**

**Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix: polish view actions bar from QA"
```
