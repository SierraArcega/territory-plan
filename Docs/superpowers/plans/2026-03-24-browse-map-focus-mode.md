# Browse Map → Focus Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "Browse Map" button in the plan detail modal to navigate to the Map tab and enter focus mode, zooming to the plan's associated states.

**Architecture:** Update the `BrowseMapButton` component in `PlanDistrictsTab.tsx` to use `focusPlan()` (map V2 store) + `setActiveTab("map")` (app store) instead of the current broken `viewPlan()` call. Bounds computed from `STATE_BBOX`.

**Tech Stack:** React, Zustand (two stores), MapLibre (fitBounds via pendingFitBounds)

**Spec:** `docs/superpowers/specs/2026-03-24-browse-map-focus-mode-design.md`

---

### Task 1: Create feature branch

**Files:** None

- [ ] **Step 1: Create and switch to new branch from main**

```bash
git checkout main
git checkout -b fix/browse-map-focus-mode
```

- [ ] **Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `fix/browse-map-focus-mode`

---

### Task 2: Update BrowseMapButton to use focusPlan + tab navigation

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:1-16` (imports)
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:120-130` (first call site)
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:170-180` (second call site)
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:805-823` (BrowseMapButton component)

- [ ] **Step 1: Add imports**

Add to the existing imports at the top of `PlanDistrictsTab.tsx`:

```typescript
import { useMapStore } from "@/features/shared/lib/app-store";
import { STATE_BBOX } from "@/features/map/components/MapV2Container";
```

- [ ] **Step 2: Rewrite BrowseMapButton component**

Replace the entire `BrowseMapButton` component (lines 807–823) with:

```typescript
function BrowseMapButton({ plan, onClose }: { plan: TerritoryPlanDetail; onClose: () => void }) {
  const focusPlan = useMapV2Store((s) => s.focusPlan);
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  const handleClick = () => {
    const abbrevs = plan.states.map((s) => s.abbrev);
    const leaids = plan.districts.map((d) => d.leaid);

    if (abbrevs.length > 0) {
      // Compute combined bounding box from plan states
      let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
      for (const abbrev of abbrevs) {
        const bbox = STATE_BBOX[abbrev];
        if (!bbox) continue;
        if (bbox[0][0] < minLng) minLng = bbox[0][0];
        if (bbox[0][1] < minLat) minLat = bbox[0][1];
        if (bbox[1][0] > maxLng) maxLng = bbox[1][0];
        if (bbox[1][1] > maxLat) maxLat = bbox[1][1];
      }

      if (minLng <= maxLng) {
        focusPlan(plan.id, abbrevs, leaids, [[minLng, minLat], [maxLng, maxLat]]);
      }
    }

    setActiveTab("map");
    onClose();
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#544A78] border border-[#D4CFE2] hover:border-[#403770]/30 hover:text-[#403770] transition-colors"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M1 3L4.5 1.5L7.5 3L11 1.5V9L7.5 10.5L4.5 9L1 10.5V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M4.5 1.5V9M7.5 3V10.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      Browse Map
    </button>
  );
}
```

- [ ] **Step 3: Update first call site (empty state, ~line 128)**

Change:
```typescript
<BrowseMapButton planId={plan.id} onClose={onClose} />
```
To:
```typescript
<BrowseMapButton plan={plan} onClose={onClose} />
```

- [ ] **Step 4: Update second call site (footer, ~line 178)**

Change:
```typescript
<BrowseMapButton planId={plan.id} onClose={onClose} />
```
To:
```typescript
<BrowseMapButton plan={plan} onClose={onClose} />
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors related to `PlanDistrictsTab.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/PlanDistrictsTab.tsx
git commit -m "fix: wire Browse Map button to focus mode with state zoom"
```

---

### Task 3: Manual Testing

- [ ] **Step 1: Test plan with states and districts**

Open a plan that has states and districts assigned. Click "Browse Map".
Expected: Modal closes, switches to Map tab, map zooms to the plan's states, districts are highlighted.

- [ ] **Step 2: Test plan with states but no districts**

Open a plan that has a state selected but 0 districts (like the Montana plan).
Expected: Modal closes, switches to Map tab, map zooms to the state. Empty `leaids` array is fine.

- [ ] **Step 3: Test plan with no states**

Open a plan with no states at all.
Expected: Modal closes, switches to Map tab at default zoom (no focusPlan called).

- [ ] **Step 4: Test unfocus restoration**

After entering focus mode via Browse Map, click the unfocus button.
Expected: Previous map filters are restored.
