# Codebase Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all dead code (fy27-trajectory, map-v1, orphaned views, legacy panels), replace the map tab with map-v2, fix broken test imports, delete old plan docs, and verify the build.

**Architecture:** Deletion-heavy cleanup. The sidebar "map" tab swaps from MapView (v1) to MapV2Shell (v2) via dynamic import. Everything else is pure removal — no new features.

**Tech Stack:** Next.js 16 (App Router), TypeScript, React 19, Vitest

---

## Task 1: Create feature branch

**Step 1: Create branch from main**

```bash
git checkout main && git pull origin main
git checkout -b feature/codebase-cleanup-round2
```

**Step 2: Verify clean starting point**

Run: `git status`
Expected: Clean working tree

---

## Task 2: Delete fy27-trajectory page, component, and API route

**Files:**
- Delete: `src/app/fy27-trajectory/page.tsx`
- Delete: `src/app/fy27-trajectory/queries.ts`
- Delete: `src/components/fy27-trajectory/Dashboard.tsx`
- Delete: `src/app/api/fy27-trajectory/route.ts`

**Step 1: Delete the files**

```bash
rm -rf src/app/fy27-trajectory/
rm -rf src/components/fy27-trajectory/
rm src/app/api/fy27-trajectory/route.ts
```

**Step 2: Remove empty parent directories**

```bash
rmdir src/app/api/fy27-trajectory/
rmdir src/components/
```

Note: `src/components/` should now be completely empty after this deletion. If `rmdir` fails because other files exist, skip it — we'll investigate.

**Step 3: Verify no remaining imports**

Run: `grep -r "fy27-trajectory" src/ --include="*.ts" --include="*.tsx"`
Expected: No results

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete unused fy27-trajectory page, component, and API route"
```

---

## Task 3: Delete orphaned GoalsView

**Files:**
- Delete: `src/features/shared/components/views/GoalsView.tsx`

**Step 1: Verify GoalsView is not imported**

Run: `grep -r "GoalsView" src/ --include="*.ts" --include="*.tsx"`
Expected: Only the file's own definition (no external imports)

**Step 2: Delete the file**

```bash
rm src/features/shared/components/views/GoalsView.tsx
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete orphaned GoalsView (not imported anywhere)"
```

---

## Task 4: Replace map tab with MapV2Shell

**Files:**
- Modify: `src/app/page.tsx`

This is the key change. The sidebar "map" tab currently renders `<MapView />` (which uses map-v1). Replace it with a dynamic import of `MapV2Shell` (which is the map-v2 component).

**Step 1: Update src/app/page.tsx**

Remove the MapView import (line 7):
```
- import MapView from "@/features/shared/components/views/MapView";
```

Add a dynamic import for MapV2Shell (after the other imports):
```typescript
import dynamic from "next/dynamic";

// Dynamic import for MapV2Shell — SSR disabled because MapLibre GL requires the browser DOM
const MapV2Shell = dynamic(() => import("@/features/map/components/MapV2Shell"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#FFFCFA]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
        <p className="text-[#403770] font-medium">Loading map...</p>
      </div>
    </div>
  ),
});
```

The `case "map":` switch arm (line 158-159) stays the same structure, just rendering the new component:
```
      case "map":
        return <MapV2Shell />;
```

**Step 2: Build verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(map): replace map-v1 tab with map-v2 shell in main navigation"
```

---

## Task 5: Delete MapView.tsx and all map-v1 components

**Files:**
- Delete: `src/features/shared/components/views/MapView.tsx`
- Delete: `src/features/shared/components/map-v1/CharterLayerToggle.tsx`
- Delete: `src/features/shared/components/map-v1/ClickRipple.tsx`
- Delete: `src/features/shared/components/map-v1/Controls.tsx`
- Delete: `src/features/shared/components/map-v1/CustomerDotsLegend.tsx`
- Delete: `src/features/shared/components/map-v1/CustomerOverviewLegend.tsx`
- Delete: `src/features/shared/components/map-v1/Legend.tsx`
- Delete: `src/features/shared/components/map-v1/MapContainer.tsx`
- Delete: `src/features/shared/components/map-v1/MapTooltip.tsx`
- Delete: `src/features/shared/components/map-v1/TileLoadingIndicator.tsx`
- Delete: `src/features/shared/components/map-v1/VendorComparisonLegend.tsx`
- Delete: `src/features/shared/components/map-v1/VendorLayerToggle.tsx`

**Step 1: Delete files**

```bash
rm src/features/shared/components/views/MapView.tsx
rm -rf src/features/shared/components/map-v1/
```

**Step 2: Verify no remaining imports**

Run: `grep -r "map-v1\|MapView" src/ --include="*.ts" --include="*.tsx" | grep -v "SavedMapView"`
Expected: No results (SavedMapView is excluded — it's an unrelated interface in LayerBubble.tsx)

**Step 3: Build verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete map-v1 components and MapView (replaced by map-v2)"
```

---

## Task 6: Delete legacy panel directory

**Files:**
- Delete: `src/features/shared/components/panel/` (entire directory — 16 files)

PanelContainer's only import was MapView.tsx (deleted in Task 5). The entire panel tree is now dead code. Map-v2 has its own panel components in `src/features/map/components/panels/`.

**Step 1: Verify no external imports remain**

Run: `grep -r "shared/components/panel" src/ --include="*.ts" --include="*.tsx"`
Expected: No results (MapView.tsx is already deleted)

**Step 2: Delete the entire panel directory**

```bash
rm -rf src/features/shared/components/panel/
```

**Step 3: Build verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete legacy panel directory (16 files, superseded by map-v2 panels)"
```

---

## Task 7: Delete /map-v2 standalone route

**Files:**
- Delete: `src/app/map-v2/page.tsx`

Now that map-v2 is in the main tab navigation, the standalone `/map-v2` route is redundant.

**Step 1: Delete the route**

```bash
rm -rf src/app/map-v2/
```

**Step 2: Verify no links to /map-v2**

Run: `grep -r "map-v2" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"`
Expected: Results should only be internal map-v2 component references (store, layers, etc.), no route links

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete standalone /map-v2 route (now in main tab navigation)"
```

---

## Task 8: Fix broken test imports

**Files:**
- Modify: `src/lib/__tests__/store.test.ts` — update import from `../store` to `@/features/shared/lib/app-store`
- Modify: `src/lib/__tests__/map-v2-store.test.ts` — update import from `../map-v2-store` to `@/features/map/lib/store`

These test files reference source files that were moved during the previous cleanup round but the test imports were not updated.

**Step 1: Fix store.test.ts import**

In `src/lib/__tests__/store.test.ts`, change:
```
- import { useMapStore } from "../store";
+ import { useMapStore } from "@/features/shared/lib/app-store";
```

**Step 2: Fix map-v2-store.test.ts import**

In `src/lib/__tests__/map-v2-store.test.ts`, change:
```
- import { useMapV2Store } from "../map-v2-store";
+ import { useMapV2Store } from "@/features/map/lib/store";
```

**Step 3: Run tests to verify fixes**

Run: `npx vitest run`
Expected: All 8 remaining test files pass (the 9th — AddToPlanButton.test.tsx — was deleted with the panel directory)

**Step 4: Commit**

```bash
git add src/lib/__tests__/store.test.ts src/lib/__tests__/map-v2-store.test.ts
git commit -m "fix(tests): update broken imports in store test files"
```

---

## Task 9: Delete all old plan docs

**Files:**
- Delete: all 86 `.md` files in `Docs/plans/` EXCEPT `2026-02-21-codebase-cleanup-design.md` and `2026-02-21-codebase-cleanup-plan.md` (the current plan)

**Step 1: Delete old plan docs**

```bash
# Delete everything in Docs/plans/ except today's files
find Docs/plans/ -name "*.md" ! -name "2026-02-21-*" -delete
```

**Step 2: Verify only today's files remain**

Run: `ls Docs/plans/`
Expected: Only `2026-02-21-codebase-cleanup-design.md` and `2026-02-21-codebase-cleanup-plan.md`

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete 86 completed plan docs (preserved in git history)"
```

---

## Task 10: Full build and test verification

**Step 1: Run TypeScript build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All 8 test files pass

**Step 3: Verify no broken imports to deleted paths**

Run: `grep -r "fy27-trajectory\|map-v1\|MapView\|GoalsView" src/ --include="*.ts" --include="*.tsx" | grep -v "SavedMapView"`
Expected: No results

**Step 4: Verify src/components/ is gone**

Run: `ls src/components/ 2>/dev/null || echo "Directory removed"`
Expected: "Directory removed"

**Step 5: Commit if any fixes were needed, then push**

```bash
git push origin feature/codebase-cleanup-round2
```

---

## Summary

| Task | Action | Files |
|------|--------|-------|
| 1 | Create feature branch | 0 |
| 2 | Delete fy27-trajectory | 4 deleted |
| 3 | Delete orphaned GoalsView | 1 deleted |
| 4 | Replace map tab with v2 | 1 modified |
| 5 | Delete MapView + map-v1 | 12 deleted |
| 6 | Delete legacy panel directory | 16 deleted |
| 7 | Delete /map-v2 route | 1 deleted |
| 8 | Fix broken test imports | 2 modified |
| 9 | Delete old plan docs | 86 deleted |
| 10 | Full verification | 0 |
| **Total** | | **~120 files removed, 3 modified** |
