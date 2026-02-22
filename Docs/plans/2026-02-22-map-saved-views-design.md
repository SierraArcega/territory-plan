# Map Saved Views & Plan Actions — Design

**Date:** 2026-02-22
**Status:** Approved

## Problem

Users filter and configure the map extensively (vendors, palettes, states, engagement levels, fiscal year, signals, etc.) but have no way to save that state for reuse, share it with colleagues, or quickly convert the visible districts into a territory plan.

## Goals

1. Let users **name and save** the current map state as a reusable view.
2. Let users **load** saved views (own + shared) to restore map configuration.
3. Let users **create a territory plan** from the currently visible/filtered districts.
4. Let users **add visible districts** to an existing territory plan.
5. Views are stored in the database and can be **shared** with other users.

## Data Model

### New: `MapView` table

```prisma
model MapView {
  id          String      @id @default(uuid())
  name        String      @db.VarChar(200)
  description String?     @db.Text
  ownerId     String      @map("owner_id") @db.Uuid
  isShared    Boolean     @default(false) @map("is_shared")
  state       Json                          // Full serialized map state snapshot
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  owner       UserProfile @relation("MapViewOwner", fields: [ownerId], references: [id], onDelete: Cascade)

  @@map("map_views")
}
```

Add to `UserProfile`:
```prisma
savedMapViews  MapView[] @relation("MapViewOwner")
```

### State Snapshot Shape

The `state` JSON column stores a serialized subset of the Zustand store:

```typescript
interface MapViewState {
  activeVendors: string[];           // VendorId[]
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
  mapBounds?: [[number, number], [number, number]];
  mapZoom?: number;
}
```

Sets are serialized as arrays. No district selections or panel UI state is captured — only visual/filter configuration.

## UI Design

### Action Row (top of MapSummaryBar)

A compact row of three ghost-style buttons above the financial stats:

```
┌──────────────────────────────────────────────────┐
│  [Save View]  [Create Plan]  [+ Add to Plan]    │
├──────────────────────────────────────────────────┤
│  Districts  Enrollment  Pipeline  Bookings  ...  │
├──────────────────────────────────────────────────┤
│  ● Fullmind   120   $2.3M   $1.1M  ...          │
│  ● Proximity   85   $1.8M   $900K  ...          │
└──────────────────────────────────────────────────┘
```

### Save View Popover

Triggered by "Save View" button. Small popover anchored to the button:

- **Name** — text input (required, max 200 chars)
- **Description** — optional text area
- **Share with team** — toggle (default off)
- **Save** / **Cancel** buttons

On save: serializes current store state → `POST /api/map-views`.

### Load View

A small dropdown icon (or secondary click on "Save View") shows a list of saved views grouped:
- **My Views** — user's own views
- **Shared Views** — other users' shared views (with owner name)

Selecting a view restores the serialized state into the Zustand store.

### Create Plan Popover

Triggered by "Create Plan" button:

- **Plan Name** — text input (required)
- **Fiscal Year** — dropdown, defaults to store's `selectedFiscalYear`
- **Description** — optional text area
- **Create** button

On create:
1. `POST /api/territory-plans` with name, fiscal year, description.
2. `POST /api/territory-plans/[id]/districts` with the LEAIDs of all currently visible districts (from the summary query or tile API).
3. Navigate to the new plan workspace (`panelState → PLAN_VIEW`).

### Add to Plan Popover

Triggered by "+ Add to Plan" button:

- **Select Plan** — searchable dropdown of existing territory plans (fetched from `GET /api/territory-plans`)
- **Add Districts** button

On confirm:
1. `POST /api/territory-plans/[id]/districts` with visible district LEAIDs.
2. Toast notification: "Added X districts to [Plan Name]" (duplicates skipped automatically by the existing `skipDuplicates` behavior).

## API Routes

### `POST /api/map-views`

Create a new saved map view.

**Request:**
```json
{
  "name": "Northeast FY26 Pipeline",
  "description": "Optional description",
  "isShared": false,
  "state": { /* MapViewState */ }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Northeast FY26 Pipeline",
  "description": null,
  "isShared": false,
  "ownerId": "user-uuid",
  "ownerName": "John Doe",
  "state": { /* MapViewState */ },
  "createdAt": "2026-02-22T...",
  "updatedAt": "2026-02-22T..."
}
```

### `GET /api/map-views`

List views the user can access (own views + shared views from others).

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Northeast FY26 Pipeline",
    "isShared": false,
    "ownerId": "user-uuid",
    "ownerName": "John Doe",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

Note: list endpoint omits `state` blob for performance. Client fetches full state on load.

### `GET /api/map-views/[id]`

Get a single view including its full `state` JSON.

### `PATCH /api/map-views/[id]`

Update name, description, or isShared. Owner only.

### `DELETE /api/map-views/[id]`

Delete a view. Owner only.

## Visible District Resolution

The "Create Plan" and "Add to Plan" flows need the list of currently visible district LEAIDs. Two approaches:

**Approach chosen: Server-side filter replay.** Rather than tracking LEAIDs client-side, send the current filter parameters to the existing tile/summary API and let the server resolve the matching LEAIDs. The summary hook already constructs these filters. We pass the same filter set to `POST /api/territory-plans/[id]/districts` using the existing `filters` parameter.

This avoids maintaining a client-side list of potentially thousands of LEAIDs.

## Store Changes

Add to `useMapV2Store`:

```typescript
// Serialize current map state for saving as a view
getViewSnapshot(): MapViewState

// Restore map state from a saved view
applyViewSnapshot(state: MapViewState): void
```

These methods handle the Set ↔ Array conversion and only touch visual/filter state, leaving panel and selection state untouched.

## Component Structure

```
MapSummaryBar.tsx
├── ViewActionsBar (new)
│   ├── SaveViewButton → SaveViewPopover
│   ├── CreatePlanButton → CreatePlanPopover
│   └── AddToPlanButton → AddToPlanPopover
├── FinancialStats (existing)
└── VendorRow[] (existing)
```

## Query Hooks (new file: `src/features/map/lib/map-view-queries.ts`)

```typescript
useMapViews()              // GET /api/map-views (list)
useMapView(id)             // GET /api/map-views/[id] (detail with state)
useCreateMapView()         // POST /api/map-views
useUpdateMapView()         // PATCH /api/map-views/[id]
useDeleteMapView()         // DELETE /api/map-views/[id]
```

## Edge Cases

- **Empty view state**: If the map has no filters applied (default state), still allow saving — useful as a "reset to defaults" view.
- **Stale state fields**: If a saved view references a vendor palette ID that no longer exists, fall back to the vendor's default palette. The `applyViewSnapshot` method handles unknown keys gracefully.
- **Large district sets**: Filter replay on the server avoids sending thousands of LEAIDs from the client. The existing `buildWhereClause` utility handles this.
- **Shared view ownership**: Only the owner can edit/delete. Others can load but not modify.

## Out of Scope

- View thumbnails or map previews
- View versioning or history
- Collaborative real-time editing of views
- Drag-and-drop view ordering
