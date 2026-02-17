# Layer Bubble Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move layer controls (picker + legend) into a standalone floating bubble at bottom-right, and repurpose the main panel's Layers tab as a Search tab.

**Architecture:** Extract LayerPicker/LayerLegend out of the left panel into a new `LayerBubble` component positioned over the map. Update the Zustand store to rename the `"layers"` icon tab to `"search"` and add bubble open/close state. Rename `BrowsePanel` to `SearchPanel` (search-only, no layers).

**Tech Stack:** React 19, Zustand, Tailwind CSS, Next.js 16

**Brand reference:** `Docs/fullmind-brand.md` — Plum `#403770` for primary UI, white bg + shadow-lg for popovers, Plus Jakarta Sans inherited, `text-sm` content text, `text-xs font-medium text-gray-400 uppercase tracking-wider` for section labels.

---

### Task 1: Update Zustand Store — Rename `"layers"` tab to `"search"`, add bubble state

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Update the IconBarTab type**

In `src/lib/map-v2-store.ts:23`, change:

```typescript
// Before
export type IconBarTab = "home" | "layers" | "plans" | "settings";

// After
export type IconBarTab = "home" | "search" | "plans" | "settings";
```

**Step 2: Add layerBubbleOpen state and actions**

In the `MapV2State` interface (line ~48), add after `panelCollapsed: boolean`:

```typescript
  // Layer bubble
  layerBubbleOpen: boolean;
```

In the `MapV2Actions` interface (line ~84), add after `togglePanel`:

```typescript
  // Layer bubble
  setLayerBubbleOpen: (open: boolean) => void;
  toggleLayerBubble: () => void;
```

In the store initializer (after `panelCollapsed: false,` at line ~156), add:

```typescript
  layerBubbleOpen: false,
```

In the `setActiveIconTab` action (line ~187), change `"layers"` to `"search"`:

```typescript
// Before
panelState: tab === "home" || tab === "layers" ? "BROWSE" : s.panelState,

// After
panelState: tab === "home" || tab === "search" ? "BROWSE" : s.panelState,
```

At the end of the store (after `togglePanel` at line ~307), add the new actions:

```typescript
  // Layer bubble
  setLayerBubbleOpen: (open) => set({ layerBubbleOpen: open }),
  toggleLayerBubble: () => set((s) => ({ layerBubbleOpen: !s.layerBubbleOpen })),
```

**Step 3: Verify app compiles**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`

Note: The build will have errors because IconBar still references `"layers"`. That's expected — we fix it in Task 2.

**Step 4: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "refactor(map-v2): rename layers tab to search, add layer bubble state"
```

---

### Task 2: Update IconBar — Replace Layers tab with Search tab

**Files:**
- Modify: `src/components/map-v2/IconBar.tsx`

**Step 1: Update the tabs array**

At line 8, change the layers entry:

```typescript
// Before
{ id: "layers", icon: "layers", label: "Layers" },

// After
{ id: "search", icon: "search", label: "Search" },
```

**Step 2: Replace the layers icon with a search icon in TabIcon**

In the `TabIcon` component switch statement, replace the `case "layers":` block (lines 43-70) with a magnifying glass:

```typescript
    case "search":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle
            cx="9"
            cy="9"
            r="5.5"
            stroke={color}
            strokeWidth="1.5"
          />
          <path
            d="M13.5 13.5L17 17"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
```

**Step 3: Verify app compiles**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds (or only unrelated warnings). The routing in PanelContent still falls through to BrowsePanel as default, so no breakage.

**Step 4: Commit**

```bash
git add src/components/map-v2/IconBar.tsx
git commit -m "feat(map-v2): replace layers icon tab with search tab"
```

---

### Task 3: Rename BrowsePanel to SearchPanel, strip layer UI

**Files:**
- Rename: `src/components/map-v2/panels/BrowsePanel.tsx` → `src/components/map-v2/panels/SearchPanel.tsx`
- Modify: `src/components/map-v2/PanelContent.tsx`

**Step 1: Create SearchPanel by renaming BrowsePanel**

Rename the file:

```bash
cd territory-plan
git mv src/components/map-v2/panels/BrowsePanel.tsx src/components/map-v2/panels/SearchPanel.tsx
```

**Step 2: Rewrite SearchPanel content**

Replace the entire contents of `src/components/map-v2/panels/SearchPanel.tsx` with a clean search-focused panel:

```tsx
"use client";

import SearchBar from "../SearchBar";

export default function SearchPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3">
        <SearchBar />
      </div>

      {/* Placeholder for future browse/filter features */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-gray-200 mb-3">
          <circle cx="18" cy="18" r="11" stroke="currentColor" strokeWidth="2" />
          <path d="M27 27L35 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-gray-400">
          Search for a district by name to explore details and add to plans.
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Update PanelContent routing**

In `src/components/map-v2/PanelContent.tsx`:

Update the import (line 4):

```typescript
// Before
import BrowsePanel from "./panels/BrowsePanel";

// After
import SearchPanel from "./panels/SearchPanel";
```

Add explicit search tab routing (after line 24, the `plans` check):

```typescript
  if (activeIconTab === "search") return <PanelContentWrapper><SearchPanel /></PanelContentWrapper>;
```

Update the default fallback (line 27):

```typescript
// Before
  return <PanelContentWrapper><BrowsePanel /></PanelContentWrapper>;

// After
  return <PanelContentWrapper><SearchPanel /></PanelContentWrapper>;
```

**Step 4: Verify app compiles**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds. The old BrowsePanel is gone, SearchPanel is wired in.

**Step 5: Commit**

```bash
git add src/components/map-v2/panels/SearchPanel.tsx src/components/map-v2/PanelContent.tsx
git commit -m "refactor(map-v2): rename BrowsePanel to SearchPanel, strip layer UI from panel"
```

---

### Task 4: Create LayerBubble component

**Files:**
- Create: `src/components/map-v2/LayerBubble.tsx`

**Step 1: Write the LayerBubble component**

Create `src/components/map-v2/LayerBubble.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import { useMapV2Store, type LayerType } from "@/lib/map-v2-store";
import { getLayerConfig } from "@/lib/map-v2-layers";

const layers: Array<{
  id: LayerType;
  label: string;
  dotColor: string;
  description: string;
}> = [
  { id: "customers", label: "Fullmind Customers", dotColor: "#403770", description: "Districts by customer status" },
  { id: "state", label: "By State", dotColor: "#6EA3BE", description: "Districts grouped by state" },
  { id: "owner", label: "By Owner", dotColor: "#22C55E", description: "Districts by sales executive" },
  { id: "territory_plan", label: "Territory Plans", dotColor: "#F59E0B", description: "Districts by assigned plan" },
  { id: "competitors", label: "Competitors", dotColor: "#F37167", description: "Districts by dominant vendor" },
  { id: "enrollment", label: "Enrollment", dotColor: "#8B5CF6", description: "Districts by student count" },
  { id: "revenue", label: "Revenue", dotColor: "#403770", description: "Districts by Fullmind revenue" },
];

export default function LayerBubble() {
  const activeLayer = useMapV2Store((s) => s.activeLayer);
  const setActiveLayer = useMapV2Store((s) => s.setActiveLayer);
  const layerBubbleOpen = useMapV2Store((s) => s.layerBubbleOpen);
  const setLayerBubbleOpen = useMapV2Store((s) => s.setLayerBubbleOpen);
  const ref = useRef<HTMLDivElement>(null);

  const active = layers.find((l) => l.id === activeLayer) || layers[0];
  const config = getLayerConfig(activeLayer);

  // Close on outside click
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setLayerBubbleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  // Close on Escape
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLayerBubbleOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  return (
    <div ref={ref} className="absolute bottom-6 right-6 z-10">
      {/* Expanded popover */}
      {layerBubbleOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[280px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: "bottom right" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Map Layer
            </span>
            <button
              onClick={() => setLayerBubbleOpen(false)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-plum hover:bg-gray-100 transition-colors"
              aria-label="Close layer picker"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Layer list */}
          <div className="px-1 pb-1">
            {layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => {
                  setActiveLayer(layer.id);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeLayer === layer.id ? "bg-plum/5" : "hover:bg-gray-50"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: layer.dotColor }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      activeLayer === layer.id ? "font-medium text-plum" : "text-gray-700"
                    }`}
                  >
                    {layer.label}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{layer.description}</div>
                </div>
                {activeLayer === layer.id && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                    <path d="M3 7L6 10L11 4" stroke="#403770" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Legend */}
          {config.legend.length > 0 && (
            <div className="px-3 pb-3 pt-1 border-t border-gray-100">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 mt-2">
                Legend
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {config.legend.map((entry) => (
                  <div key={entry.label} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-[11px] text-gray-500">{entry.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed pill */}
      <button
        onClick={() => setLayerBubbleOpen(!layerBubbleOpen)}
        className={`
          flex items-center gap-2 px-3 py-2
          bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60
          hover:shadow-xl transition-all duration-150
          ${layerBubbleOpen ? "ring-2 ring-plum/20" : ""}
        `}
        aria-label={`Map layer: ${active.label}. Click to change.`}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: active.dotColor }}
        />
        <span className="text-sm font-medium text-gray-700">{active.label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`text-gray-400 transition-transform duration-150 ${layerBubbleOpen ? "rotate-180" : ""}`}
        >
          <path d="M2.5 6.5L5 4L7.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
```

**Step 2: Verify the file compiles standalone**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds (component exists but isn't rendered yet).

**Step 3: Commit**

```bash
git add src/components/map-v2/LayerBubble.tsx
git commit -m "feat(map-v2): add LayerBubble floating widget component"
```

---

### Task 5: Wire LayerBubble into MapV2Shell

**Files:**
- Modify: `src/components/map-v2/MapV2Shell.tsx`

**Step 1: Add LayerBubble import and render**

Add import after the MultiSelectChip import (line 5):

```typescript
import LayerBubble from "./LayerBubble";
```

Add `<LayerBubble />` inside the shell div, after `<MultiSelectChip />` (line 30):

```tsx
      {/* Layer control bubble */}
      <LayerBubble />
```

**Step 2: Verify app compiles and runs**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds. The LayerBubble renders at bottom-right of the map.

**Step 3: Commit**

```bash
git add src/components/map-v2/MapV2Shell.tsx
git commit -m "feat(map-v2): wire LayerBubble into map shell"
```

---

### Task 6: Update FloatingPanel mobile collapsed bar

**Files:**
- Modify: `src/components/map-v2/FloatingPanel.tsx`

**Step 1: Replace the layers icon in the mobile collapsed bar**

In `FloatingPanel.tsx`, the mobile collapsed button (lines 57-59) has a layers SVG. Replace it with a compass/explore icon:

```tsx
// Before (lines 57-59)
<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
  <path d="M2 10L10 14L18 10" stroke="#403770" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M2 6L10 10L18 6L10 2L2 6Z" stroke="#403770" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
</svg>

// After
<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
  <circle cx="10" cy="10" r="7.5" stroke="#403770" strokeWidth="1.5" />
  <circle cx="10" cy="10" r="1.5" fill="#403770" />
  <path d="M10 4V6.5M10 13.5V16M4 10H6.5M13.5 10H16" stroke="#403770" strokeWidth="1.5" strokeLinecap="round" />
</svg>
```

**Step 2: Verify app compiles**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/map-v2/FloatingPanel.tsx
git commit -m "refactor(map-v2): update mobile collapsed bar icon to compass"
```

---

### Task 7: Clean up old LayerPicker and LayerLegend imports

**Files:**
- Check: `src/components/map-v2/LayerPicker.tsx` — still used? (LayerBubble has its own inline layer list)
- Check: `src/components/map-v2/LayerLegend.tsx` — still used? (LayerBubble has its own inline legend)

**Step 1: Verify no remaining imports**

Run a grep to confirm nothing else imports these:

```bash
cd territory-plan && grep -r "LayerPicker\|LayerLegend" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (SearchPanel no longer imports them, LayerBubble uses inline versions).

If no imports remain, these files are dead code. Leave them for now — they can be deleted in a separate cleanup PR. Do not delete in this branch to keep the diff focused.

**Step 2: Final build check**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`

Expected: Clean build.

**Step 3: Manual smoke test checklist**

Run: `cd territory-plan && npm run dev`

Open `http://localhost:3000/map-v2` and verify:

- [ ] **Layer bubble** appears at bottom-right as a small pill showing "Fullmind Customers"
- [ ] **Click pill** → popover expands upward with all 7 layers + legend
- [ ] **Switch layer** → pill label updates, map colors change, legend updates
- [ ] **Click outside** → popover closes
- [ ] **Press Escape** → popover closes
- [ ] **Icon bar** shows magnifying glass where layers icon was
- [ ] **Click Search tab** → panel shows SearchPanel with search bar
- [ ] **Search works** → typing a district name shows autocomplete results
- [ ] **Click district result** → navigates to DistrictDetailPanel
- [ ] **Home tab** → still shows HomePanel
- [ ] **Plans tab** → still shows PlansListPanel
- [ ] **Mobile view** (resize to <640px) → collapsed bar shows compass icon, layer bubble still visible at bottom-right

**Step 4: Commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore(map-v2): cleanup and verify layer bubble extraction"
```
