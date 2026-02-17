# Floating District Detail Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cramped 280px right-panel district card with a draggable, floating detail panel (400px x 70vh) tethered to the district's location on the map via a live SVG connector line.

**Architecture:** A new `FloatingDistrictDetail` component renders as a sibling of the main FloatingPanel in MapV2Shell. It reads a new `detailPopout` store field to know which district to show. A `TetherLine` SVG overlay connects the panel to the district's geographic centroid using the map's `project()` API, exposed via a lightweight global ref. The existing right panel (`RightPanel.tsx`) no longer handles `district_card` — it continues to handle tasks, contacts, etc.

**Tech Stack:** React 19, Zustand, MapLibre GL JS (`map.project()`), CSS transforms for drag, SVG for tether line.

---

### Task 1: Expose Map Instance via Global Ref

The map instance is currently private to `MapV2Container`. We need a lightweight way for the tether line to call `map.project()`.

**Files:**
- Create: `src/lib/map-v2-ref.ts`
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Step 1: Create the map ref module**

Create `src/lib/map-v2-ref.ts`:

```ts
import type maplibregl from "maplibre-gl";

// Lightweight global ref for the MapLibre map instance.
// Used by TetherLine to call map.project() for screen-coordinate conversion.
// Set by MapV2Container on map load, cleared on unmount.
export const mapV2Ref: { current: maplibregl.Map | null } = { current: null };
```

**Step 2: Set the ref in MapV2Container**

In `src/components/map-v2/MapV2Container.tsx`, after the existing `map.current` assignment in the initialization `useEffect`:

Add import at top:
```ts
import { mapV2Ref } from "@/lib/map-v2-ref";
```

After `map.current = new maplibregl.Map({...})`, add:
```ts
mapV2Ref.current = map.current;
```

In the cleanup return, add:
```ts
mapV2Ref.current = null;
```

**Step 3: Commit**

```bash
git add src/lib/map-v2-ref.ts src/components/map-v2/MapV2Container.tsx
git commit -m "feat(map-v2): expose map instance via lightweight global ref"
```

---

### Task 2: Add District Centroid to API Response

The tether line needs the district's lat/lng. The `districts` table has a PostGIS `centroid` column but it's not returned by the API.

**Files:**
- Modify: `src/app/api/districts/[leaid]/route.ts` (add centroid extraction)
- Modify: `src/lib/api.ts` (add `centroidLat`/`centroidLng` to `District` interface)

**Step 1: Add centroid to API response**

In `src/app/api/districts/[leaid]/route.ts`, after the existing `findUnique` query (around line 20), add a raw query to get the centroid:

```ts
// Get centroid coordinates for tether line
const centroidResult = await prisma.$queryRaw<
  { lat: number; lng: number }[]
>`SELECT ST_Y(centroid::geometry) as lat, ST_X(centroid::geometry) as lng FROM districts WHERE leaid = ${leaid} AND centroid IS NOT NULL LIMIT 1`;

const centroid = centroidResult.length > 0 ? centroidResult[0] : null;
```

Then in the response object's `district` section, add after `jobBoardUrl`:
```ts
centroidLat: centroid?.lat ?? null,
centroidLng: centroid?.lng ?? null,
```

**Step 2: Update District interface**

In `src/lib/api.ts`, add to the `District` interface (after `jobBoardUrl`):
```ts
centroidLat: number | null;
centroidLng: number | null;
```

**Step 3: Commit**

```bash
git add src/app/api/districts/[leaid]/route.ts src/lib/api.ts
git commit -m "feat: include district centroid lat/lng in API response"
```

---

### Task 3: Add Store State for Detail Popout

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Add state and actions**

Add to the `MapV2State` interface (near `rightPanelContent`):
```ts
detailPopout: { leaid: string } | null;
```

Add to the `MapV2Actions` interface:
```ts
openDetailPopout: (leaid: string) => void;
closeDetailPopout: () => void;
```

Add initial state in the `create` call:
```ts
detailPopout: null,
```

Add action implementations:
```ts
openDetailPopout: (leaid) =>
  set((s) => ({
    detailPopout: s.detailPopout?.leaid === leaid ? null : { leaid },
  })),
closeDetailPopout: () => set({ detailPopout: null }),
```

Note: `openDetailPopout` toggles — clicking the same district closes it.

**Step 2: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "feat(map-v2): add detailPopout state for floating district panel"
```

---

### Task 4: Build FloatingDistrictDetail Component

The main draggable floating panel that shows the full tabbed district view.

**Files:**
- Create: `src/components/map-v2/FloatingDistrictDetail.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail } from "@/lib/api";
import DistrictHeader from "./panels/district/DistrictHeader";
import DistrictInfoTab from "./panels/district/DistrictInfoTab";
import DataDemographicsTab from "./panels/district/DataDemographicsTab";
import ContactsTab from "./panels/district/ContactsTab";

type Tab = "info" | "data" | "contacts";

export default function FloatingDistrictDetail() {
  const detailPopout = useMapV2Store((s) => s.detailPopout);
  const closeDetailPopout = useMapV2Store((s) => s.closeDetailPopout);
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const leaid = detailPopout?.leaid ?? null;
  const { data, isLoading, error } = useDistrictDetail(leaid);

  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset tab and position when district changes
  useEffect(() => {
    setActiveTab("info");
    setPosition({ x: 0, y: 0 });
  }, [leaid]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetailPopout();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeDetailPopout]);

  // Drag handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag from header area
      if ((e.target as HTMLElement).closest("button")) return;
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: dragStart.current.posX + dx,
        y: dragStart.current.posY + dy,
      });
    };

    const onMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  if (!detailPopout) return null;

  const contacts = data?.contacts || [];

  return (
    <div
      ref={panelRef}
      data-detail-popout
      className={`
        absolute z-20 w-[400px]
        bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
        flex flex-col overflow-hidden
        transition-opacity duration-200
        ${isDragging ? "cursor-grabbing select-none" : ""}
      `}
      style={{
        top: "15vh",
        right: "2rem",
        height: "70vh",
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {/* Drag handle / header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-100 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={onMouseDown}
      >
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider select-none">
          District Detail
        </span>
        <button
          onClick={closeDetailPopout}
          className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 2L10 10M10 2L2 10"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-4/5 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
                  <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ) : error || !data ? (
          <div className="text-center py-8 text-sm text-gray-400">
            Failed to load district
          </div>
        ) : (
          <>
            <DistrictHeader
              district={data.district}
              fullmindData={data.fullmindData}
              tags={data.tags}
            />

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 px-1">
              {(
                [
                  { key: "info", label: "District Info" },
                  { key: "data", label: "Data + Demographics" },
                  { key: "contacts", label: `Contacts (${contacts.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                    activeTab === tab.key
                      ? "text-[#F37167]"
                      : "text-gray-500 hover:text-[#403770]"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "info" && (
              <DistrictInfoTab data={data} leaid={leaid!} />
            )}
            {activeTab === "data" && <DataDemographicsTab data={data} />}
            {activeTab === "contacts" && (
              <ContactsTab leaid={leaid!} contacts={contacts} />
            )}
          </>
        )}
      </div>

      {/* Plan actions footer */}
      {activePlanId && leaid && (
        <div className="border-t border-gray-100 px-3 py-2 flex gap-2">
          <button
            onClick={() => openRightPanel({ type: "task_form", id: leaid })}
            className="flex-1 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            + Add Task
          </button>
          <button
            onClick={() => {
              /* Remove from plan - wire up in Task 6 */
            }}
            className="flex-1 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/FloatingDistrictDetail.tsx
git commit -m "feat(map-v2): create draggable FloatingDistrictDetail component"
```

---

### Task 5: Build TetherLine SVG Overlay

Draws a dashed line from the district's geographic point on the map to the floating panel.

**Files:**
- Create: `src/components/map-v2/TetherLine.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail } from "@/lib/api";
import { mapV2Ref } from "@/lib/map-v2-ref";

export default function TetherLine() {
  const detailPopout = useMapV2Store((s) => s.detailPopout);
  const leaid = detailPopout?.leaid ?? null;
  const { data } = useDistrictDetail(leaid);

  const [line, setLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const updateLine = useCallback(() => {
    const map = mapV2Ref.current;
    if (!map || !data?.district) {
      setLine(null);
      return;
    }

    const { centroidLat, centroidLng } = data.district;
    if (centroidLat == null || centroidLng == null) {
      setLine(null);
      return;
    }

    // Project district lat/lng to screen coords
    const point = map.project([centroidLng, centroidLat]);

    // Find the floating panel element
    const panel = document.querySelector("[data-detail-popout]");
    if (!panel) {
      setLine(null);
      return;
    }

    const rect = panel.getBoundingClientRect();

    // Connect to the nearest edge midpoint of the panel
    const panelCenterY = rect.top + rect.height / 2;
    const panelLeft = rect.left;
    const panelRight = rect.right;

    // Default: connect to left edge center
    let targetX = panelLeft;
    let targetY = panelCenterY;

    // If district point is to the right of the panel, connect to right edge
    if (point.x > panelRight) {
      targetX = panelRight;
    }
    // If district point is above/below, adjust Y
    if (point.y < rect.top) {
      targetY = rect.top;
      targetX = rect.left + rect.width / 2;
    } else if (point.y > rect.bottom) {
      targetY = rect.bottom;
      targetX = rect.left + rect.width / 2;
    }

    // Hide if district point is off-screen
    const isOffScreen =
      point.x < -50 ||
      point.x > window.innerWidth + 50 ||
      point.y < -50 ||
      point.y > window.innerHeight + 50;

    if (isOffScreen) {
      setLine(null);
      return;
    }

    setLine({ x1: point.x, y1: point.y, x2: targetX, y2: targetY });
  }, [data]);

  // Update on map move and animation frame for drag
  useEffect(() => {
    const map = mapV2Ref.current;
    if (!map || !detailPopout) return;

    // Update immediately
    updateLine();

    // Update on map pan/zoom
    map.on("move", updateLine);

    // Poll for panel position changes (drag)
    let rafId: number;
    const pollPosition = () => {
      updateLine();
      rafId = requestAnimationFrame(pollPosition);
    };
    rafId = requestAnimationFrame(pollPosition);

    return () => {
      map.off("move", updateLine);
      cancelAnimationFrame(rafId);
    };
  }, [detailPopout, updateLine]);

  if (!line) return null;

  return (
    <svg
      className="absolute inset-0 z-10 pointer-events-none"
      width="100%"
      height="100%"
    >
      {/* Dashed connector line */}
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="#F37167"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Dot at district point */}
      <circle
        cx={line.x1}
        cy={line.y1}
        r="4"
        fill="#F37167"
        opacity="0.8"
      />
    </svg>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/TetherLine.tsx
git commit -m "feat(map-v2): create TetherLine SVG connector overlay"
```

---

### Task 6: Wire Everything Together in MapV2Shell

Mount the new components and update PlanOverviewSection to use the popout.

**Files:**
- Modify: `src/components/map-v2/MapV2Shell.tsx` (add FloatingDistrictDetail + TetherLine)
- Modify: `src/components/map-v2/panels/PlanOverviewSection.tsx` (use `openDetailPopout`)
- Modify: `src/components/map-v2/FloatingPanel.tsx` (stop expanding width for district_card)

**Step 1: Update MapV2Shell**

In `src/components/map-v2/MapV2Shell.tsx`, add imports and render the new components:

```tsx
import FloatingDistrictDetail from "./FloatingDistrictDetail";
import TetherLine from "./TetherLine";
```

Add inside the root `<div>`, after `<FloatingPanel />`:

```tsx
{/* Floating district detail popout */}
<FloatingDistrictDetail />
<TetherLine />
```

**Step 2: Update PlanOverviewSection**

In `src/components/map-v2/panels/PlanOverviewSection.tsx`:

Change the import:
```ts
const openDetailPopout = useMapV2Store((s) => s.openDetailPopout);
```

Remove the `openRightPanel` line.

Change the click handler in `DistrictRow` rendering (the `onClick` in the `sortedDistricts.map`):
```tsx
onClick={() => openDetailPopout(d.leaid)}
```

**Step 3: Update FloatingPanel width logic**

In `src/components/map-v2/FloatingPanel.tsx`, the panel currently expands to `50vw` when `rightPanelContent` exists. Since district detail no longer uses the right panel, the expansion should only happen when the right panel has non-district content:

The existing logic already works correctly because `rightPanelContent` will be `null` when a district popout is open (we use `detailPopout` instead). No change needed here unless task forms still use the right panel while a district is open — that case is fine since the panel will expand when a task form opens.

**Step 4: Commit**

```bash
git add src/components/map-v2/MapV2Shell.tsx src/components/map-v2/panels/PlanOverviewSection.tsx
git commit -m "feat(map-v2): wire floating district detail + tether into shell"
```

---

### Task 7: Add Remove-from-Plan to Floating Detail

Wire up the "Remove" button in the floating panel footer.

**Files:**
- Modify: `src/components/map-v2/FloatingDistrictDetail.tsx`

**Step 1: Add the remove mutation**

Import:
```ts
import { useDistrictDetail, useRemoveDistrictFromPlan } from "@/lib/api";
```

Add inside the component:
```ts
const removeMutation = useRemoveDistrictFromPlan();
const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
```

Replace the placeholder "Remove" button in the footer with a confirm flow:
```tsx
{!showRemoveConfirm ? (
  <button
    onClick={() => setShowRemoveConfirm(true)}
    className="flex-1 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
  >
    Remove
  </button>
) : (
  <div className="flex-1 flex gap-1">
    <button
      onClick={() => {
        removeMutation.mutate(
          { planId: activePlanId!, leaid },
          { onSuccess: () => { setShowRemoveConfirm(false); closeDetailPopout(); } }
        );
      }}
      disabled={removeMutation.isPending}
      className="flex-1 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg disabled:opacity-50"
    >
      {removeMutation.isPending ? "..." : "Confirm"}
    </button>
    <button
      onClick={() => setShowRemoveConfirm(false)}
      className="flex-1 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg"
    >
      Cancel
    </button>
  </div>
)}
```

Also reset confirm state when district changes:
```ts
useEffect(() => {
  setActiveTab("info");
  setPosition({ x: 0, y: 0 });
  setShowRemoveConfirm(false);
}, [leaid]);
```

**Step 2: Commit**

```bash
git add src/components/map-v2/FloatingDistrictDetail.tsx
git commit -m "feat(map-v2): add remove-from-plan with confirm to floating detail"
```

---

### Task 8: Clean Up Old Right Panel District Card

Now that district detail uses the floating popout, remove the district_card handling from the right panel.

**Files:**
- Modify: `src/components/map-v2/RightPanel.tsx` (remove district_card branch)
- Delete or simplify: `src/components/map-v2/right-panels/DistrictCard.tsx` (no longer used)

**Step 1: Update RightPanel.tsx**

Remove the `district_card` conditional branch. The header label no longer needs the "District" case. The content area reverts to the simple `overflow-y-auto p-3` wrapper for all content types.

```tsx
{/* Content */}
<div className="flex-1 overflow-y-auto p-3">
  {rightPanelContent.type === "task_form" && (
    <TaskForm preLinkedLeaid={rightPanelContent.id} />
  )}
  {rightPanelContent.type === "task_edit" && rightPanelContent.id && (
    <TaskForm taskId={rightPanelContent.id} />
  )}
  {rightPanelContent.type === "contact_detail" && rightPanelContent.id && (
    <ContactDetail contactId={rightPanelContent.id} />
  )}
</div>
```

Remove the DistrictCard import.

**Step 2: Delete DistrictCard.tsx**

```bash
rm src/components/map-v2/right-panels/DistrictCard.tsx
```

**Step 3: Update RightPanelContent type in store**

In `src/lib/map-v2-store.ts`, remove `"district_card"` from the `RightPanelContent` type:
```ts
export interface RightPanelContent {
  type: "task_form" | "task_edit" | "contact_detail" | "contact_form";
  id?: string;
}
```

**Step 4: Commit**

```bash
git add src/components/map-v2/RightPanel.tsx src/lib/map-v2-store.ts
git rm src/components/map-v2/right-panels/DistrictCard.tsx
git commit -m "chore(map-v2): remove old DistrictCard, district detail uses floating popout"
```

---

### Task 9: Verify and Polish

**Step 1: TypeScript check**

```bash
cd territory-plan && npx tsc --noEmit 2>&1 | grep -E "FloatingDistrictDetail|TetherLine|DistrictCard|map-v2-ref|detailPopout"
```

Expected: No errors.

**Step 2: Manual testing checklist**

1. Open a plan → click a district → floating panel appears with full tabs
2. Dashed tether line connects panel to district on map
3. Pan/zoom map → tether line updates in real time
4. Drag the panel by its header → tether line follows
5. Click same district again → panel closes (toggle)
6. Click different district → panel content switches, position resets
7. Press Escape → panel closes
8. "Add Task" button in footer → opens task form in right panel
9. "Remove" button → shows confirm → removes district from plan, panel closes
10. Close panel → tether line disappears

**Step 3: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(map-v2): polish floating district detail panel"
```
