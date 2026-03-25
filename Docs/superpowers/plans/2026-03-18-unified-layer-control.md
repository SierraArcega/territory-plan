# Implementation Plan: Unified Layer Control

**Date:** 2026-03-18
**Spec:** `docs/superpowers/specs/2026-03-18-unified-layer-control-design.md`
**Worktree:** `map-planning-overlays`
**Branch:** `worktree-map-planning-overlays`

## Overview

Merge Layer Bubble + Layer Drawer into a unified two-tier control: toggle bar with chips, detail drawers, and a tabbed results panel. Work happens in the existing `map-planning-overlays` worktree which already has overlay API routes, React Query hooks, pin layer definitions, and the LayerDrawer component.

## Phase 1: Store Consolidation

**Goal:** Unify the state model before touching UI. Both the LayerBubble state (main repo) and the LayerDrawer state (worktree) need to merge into a single coherent store.

### Task 1.1: Merge LayerBubble state into worktree store
**File:** `src/features/map/lib/store.ts`

The worktree store already has `activeLayers`, `layerFilters`, `dateRange`, `layerDrawerOpen`, `mapBounds`. The main repo store has `layerBubbleOpen`, `activeVendors`, `filterOwner`, `filterStates`, `filterAccountTypes`, `fullmindEngagement`, `competitorEngagement`, `activeSignal`, `visibleLocales`, `visibleSchoolTypes`, `vendorPalettes`, `signalPalette`, `categoryColors`, `categoryOpacities`, `selectedFiscalYear`, `compareMode`, etc.

Changes:
- Add `colorBy: ColorDimension` state field (type: `"engagement" | "enrollment" | "ell" | "swd" | "expenditure" | "locale"`, default `"engagement"`)
- Add `setColorBy` action
- Add `activeDetailDrawer: LayerType | null` state field
- Add `setActiveDetailDrawer` action
- Add `activeResultsTab: LayerType` state field (default `"districts"`)
- Add `setActiveResultsTab` action
- Ensure `activeLayers` always includes `"districts"` (enforce in `toggleLayer`)
- Change `dateRange` from single `DateRange` to `Record<"vacancies" | "activities", DateRange>` for per-layer date ranges
- Port over all existing LayerBubble state fields (`vendorPalettes`, `categoryColors`, `categoryOpacities`, `fullmindEngagement`, `competitorEngagement`, `filterOwner`, `filterStates`, `filterAccountTypes`, `selectedFiscalYear`, `compareMode`, `compareView`, etc.) and their actions from the main repo store
- Remove `layerBubbleOpen` and `layerDrawerOpen` (replaced by `activeDetailDrawer`)

**Dependencies:** None
**Test:** Store actions work correctly — toggling layers, setting colorBy, per-layer date ranges

### Task 1.2: Add LayerType and ColorDimension types
**File:** `src/features/map/lib/layers.ts`

- Add `LayerType = "districts" | "plans" | "contacts" | "vacancies" | "activities"`
- Add `ColorDimension = "engagement" | "enrollment" | "ell" | "swd" | "expenditure" | "locale"`
- Add `LAYER_ORDER: LayerType[]` constant matching spec order
- Add `LAYER_COLORS: Record<LayerType, string>` constant with brand colors from spec

**Dependencies:** None

---

## Phase 2: Toggle Bar Component

**Goal:** Build the primary UI control that replaces both the LayerBubble trigger and the LayerDrawer hamburger.

### Task 2.1: Create ToggleBar component
**File:** `src/features/map/components/ToggleBar.tsx` (new)

- Render `LAYERS` label + row of `LayerChip` components in `LAYER_ORDER`
- Position: absolute, bottom-left of map (same position as old LayerBubble)
- Styling: semi-transparent white background, pill shape, shadow
- Include bookmark icon for saved views (placeholder, wired up in Phase 5)

**Dependencies:** Task 1.2

### Task 2.2: Create LayerChip component
**File:** `src/features/map/components/LayerChip.tsx` (new)

- Props: `layerType`, `active`, `count?`, `loading?`, `onToggle`, `onOpenDrawer`
- Inactive state: light background, muted text, desaturated dot
- Active state: filled with `LAYER_COLORS[layerType]`, white text, white dot
- Districts chip: always active, no toggle behavior, gear icon always visible
- Overlay chips: click toggles, show count badge when active, gear icon on hover/active
- Handle golden (`#FFCF70`) special case: dark text instead of white for contrast

**Dependencies:** Task 1.2

### Task 2.3: Wire ToggleBar into MapV2Shell
**File:** `src/features/map/components/MapV2Shell.tsx`

- Replace LayerBubble rendering with ToggleBar
- Remove LayerDrawer rendering
- Pass feature counts and loading states to ToggleBar (from existing query hooks)
- Remove the gear icon trigger from SearchBar that opened LayerBubble

**Dependencies:** Tasks 2.1, 2.2

---

## Phase 3: Detail Drawers

**Goal:** Build the popover drawers that open from toggle bar chips for filtering and styling.

### Task 3.1: Create DetailDrawer shell component
**File:** `src/features/map/components/DetailDrawer.tsx` (new)

- Popover positioned above the toggle bar, anchored to the active chip
- Header with layer color dot, layer name, close button
- Renders the correct drawer content based on `activeDetailDrawer` from store
- Click-outside-to-close behavior
- Escape to close
- Max width ~340px, white background, rounded corners, shadow

**Dependencies:** Task 2.1

### Task 3.2: Create DistrictsDrawer content
**File:** `src/features/map/components/drawers/DistrictsDrawer.tsx` (new)

- **Filters section:** State multi-select, Owner dropdown, Engagement dropdown (port from LayerBubble)
- **Color By section:** Chip selector for `ColorDimension` values. Clicking a chip calls `setColorBy(dim)`.
- **Customize Colors section** (collapsed by default): Port the palette pickers, per-category color swatches, and opacity sliders from LayerBubble. This is the existing `VendorPalettePicker`, `SignalPalettePicker`, `CategorySwatchPicker`, `CategoryRow` logic, reorganized into a collapsible section.
- Fiscal year selector
- Compare mode toggle

**Dependencies:** Tasks 1.1, 3.1

### Task 3.3: Create overlay drawer contents
**Files:**
- `src/features/map/components/drawers/ContactsDrawer.tsx` (new)
- `src/features/map/components/drawers/VacanciesDrawer.tsx` (new)
- `src/features/map/components/drawers/ActivitiesDrawer.tsx` (new)
- `src/features/map/components/drawers/PlansDrawer.tsx` (new)

Port filter controls from the existing LayerDrawer sub-components (`LayerFilterSection`, `FilterDropdown`, `DateRangeFilter`). Each drawer gets:
- Contacts: Seniority Level dropdown, Persona dropdown
- Vacancies: Category dropdown, Status dropdown, Date Range (presets + custom)
- Activities: Type dropdown, Status dropdown, Date Range (presets + custom)
- Plans: Status dropdown

These already exist in the LayerDrawer — this is a reorganization into individual drawer components.

**Dependencies:** Tasks 1.1, 3.1

---

## Phase 4: Tabbed Results Panel

**Goal:** Extend the SearchResults panel to support multiple entity tabs.

### Task 4.1: Create ResultsTabStrip component
**File:** `src/features/map/components/SearchResults/ResultsTabStrip.tsx` (new)

- Reads `activeLayers` from store
- Renders tabs in `LAYER_ORDER` for each active layer
- Each tab shows label + count badge
- Active tab highlighted (bottom border in layer color)
- Clicking a tab calls `setActiveResultsTab(layerType)`
- Districts tab always present

**Dependencies:** Task 1.1

### Task 4.2: Create entity card components
**Files:**
- `src/features/map/components/SearchResults/PlanCard.tsx` (new)
- `src/features/map/components/SearchResults/ContactCard.tsx` (new)
- `src/features/map/components/SearchResults/VacancyCard.tsx` (new)
- `src/features/map/components/SearchResults/ActivityCard.tsx` (new)

Each card displays entity-appropriate info:
- PlanCard: name, status badge, district count, owner, color dot
- ContactCard: name, title, seniority badge, district name
- VacancyCard: title, category badge, status, school name, days open
- ActivityCard: title, type badge, status, date, district name

Follow the existing `DistrictSearchCard` pattern for card structure and styling.

**Dependencies:** None (pure presentational)

### Task 4.3: Create entity list components for each tab
**Files:**
- `src/features/map/components/SearchResults/PlansTab.tsx` (new)
- `src/features/map/components/SearchResults/ContactsTab.tsx` (new)
- `src/features/map/components/SearchResults/VacanciesTab.tsx` (new)
- `src/features/map/components/SearchResults/ActivitiesTab.tsx` (new)

Each tab component:
- Reads data from the existing React Query hooks (`useMapPlans`, `useMapContacts`, `useMapVacancies`, `useMapActivities`)
- Renders a list of entity cards
- Loading skeleton state
- Empty state message
- Pagination if needed (overlay data is typically <500 items so simple scrolling may suffice initially)

**Dependencies:** Tasks 4.2, existing query hooks

### Task 4.4: Integrate tabs into SearchResults
**File:** `src/features/map/components/SearchResults/index.tsx`

- Add `ResultsTabStrip` above the existing content
- Conditionally render the existing districts content OR the new entity tab content based on `activeResultsTab`
- When `activeResultsTab === "districts"`, render the existing search results (no change)
- When `activeResultsTab` is an overlay type, render the corresponding tab component
- The header, bulk actions, and pagination only show for the Districts tab (other tabs have simpler layouts initially)

**Dependencies:** Tasks 4.1, 4.3

---

## Phase 5: Map Integration

**Goal:** Wire the Color By selector to MapLibre layers and integrate hit-test priority.

### Task 5.1: Implement Color By switching in MapV2Container
**File:** `src/features/map/components/MapV2Container.tsx`

- Subscribe to `colorBy` from store
- When `colorBy === "engagement"`: show vendor fill layers (existing behavior), hide signal/locale layers
- When `colorBy` is a signal type: hide vendor fill layers, show signal fill layer with appropriate expression
- When `colorBy === "locale"`: hide vendor/signal, show locale fill layer
- Use existing `buildVendorFillExpression` / `buildSignalFillExpression` helpers — just toggle visibility + swap paint properties

**Dependencies:** Task 1.1

### Task 5.2: Implement hit-test priority for overlay clicks
**File:** `src/features/map/components/MapV2Container.tsx`

- Replace the current click handler cascade with the priority order from spec:
  1. `activities-pins` (overlay-activities-point)
  2. `vacancies-pins` (overlay-vacancies-point)
  3. `contacts-pins` (overlay-contacts-point)
  4. `plans-fill` (overlay-plans-fill)
  5. `schools-unclustered`
  6. `district-base-fill`
  7. `state-fill`
- On overlay pin click: call `setActiveResultsTab(layerType)` to switch results panel to that entity's tab
- On hover: same priority — suppress district hover highlight when cursor is over a pin

**Dependencies:** Task 1.1, existing pin layers

### Task 5.3: Update overlay layer z-ordering
**File:** `src/features/map/lib/pin-layers.ts`

- Verify render stack matches spec order (plans polygons below point layers)
- Adjust `beforeId` parameters if needed when adding layers at init
- Update plans layer styling: outline-only or very low fill opacity (~0.1) + dashed outline per spec

**Dependencies:** None

---

## Phase 6: Cleanup & Polish

**Goal:** Remove old components, wire up saved views, polish transitions.

### Task 6.1: Remove old LayerBubble and LayerDrawer
**Files to remove/gut:**
- `src/features/map/components/LayerBubble.tsx` — delete (1,993 lines)
- `src/features/map/components/LayerDrawer.tsx` — delete (262 lines)
- `src/features/map/components/LayerToggle.tsx` — delete
- `src/features/map/components/LayerFilterSection.tsx` — delete
- `src/features/map/components/DateRangeFilter.tsx` — delete (logic ported to drawers)
- `src/features/map/components/SearchBar/LayersPanel.tsx` — delete
- Remove gear icon from SearchBar that triggered LayerBubble
- Clean up dead store state/actions (`layerBubbleOpen`, `layerDrawerOpen`)

**Dependencies:** All Phase 2-5 tasks complete

### Task 6.2: Wire up saved views
**File:** `src/features/map/components/SavedViewsDropdown.tsx` (new)

- Port saved views logic from LayerBubble (localStorage-based)
- Extend serialization to include: `activeLayers`, `colorBy`, `layerFilters`, `dateRange`, plus existing palette/color/opacity state
- Bookmark icon in ToggleBar opens this dropdown
- Save/Load/Delete views

**Dependencies:** Task 2.1, Task 1.1

### Task 6.3: Transitions and polish
- Chip toggle animation (color fill transition, ~150ms)
- Detail drawer slide-up animation (~200ms ease-out)
- Tab switch transition in results panel
- Ensure responsive behavior on smaller screens (chips may need to wrap or compact)

**Dependencies:** All above

---

## Task Dependency Graph

```
Phase 1: Store
  1.1 (store merge) ──┐
  1.2 (types) ────────┤
                       │
Phase 2: Toggle Bar    │
  2.1 (ToggleBar) ←── 1.2
  2.2 (LayerChip) ←── 1.2
  2.3 (wire in) ←──── 2.1, 2.2
                       │
Phase 3: Drawers       │
  3.1 (shell) ←─────── 2.1
  3.2 (districts) ←── 1.1, 3.1
  3.3 (overlays) ←─── 1.1, 3.1
                       │
Phase 4: Results       │
  4.1 (tab strip) ←── 1.1
  4.2 (cards) ─────── (none)
  4.3 (tab lists) ←── 4.2
  4.4 (integrate) ←── 4.1, 4.3
                       │
Phase 5: Map           │
  5.1 (color by) ←─── 1.1
  5.2 (hit-test) ←─── 1.1
  5.3 (z-order) ───── (none)
                       │
Phase 6: Cleanup       │
  6.1 (remove old) ←── all above
  6.2 (saved views) ← 2.1, 1.1
  6.3 (polish) ←────── all above
```

## Parallelization Opportunities

- **Phase 2 + Phase 4.2** can run in parallel (ToggleBar and entity cards are independent)
- **Phase 3.2 + Phase 3.3** can run in parallel (district drawer and overlay drawers are independent)
- **Phase 5.1 + Phase 5.2 + Phase 5.3** can run in parallel (different MapLibre concerns)
- **Task 4.2** (entity cards) can start immediately as it has no dependencies

## Test Strategy

- **Store tests:** Verify `toggleLayer` always keeps districts active, `colorBy` switching, per-layer date ranges
- **Component tests:** ToggleBar renders correct chip states, DetailDrawer opens/closes, ResultsTabStrip shows correct tabs
- **Integration tests:** Toggle a layer → verify tab appears in results panel, click overlay pin → verify results tab switches
- **MapLibre tests:** Color By switching applies correct paint properties, hit-test priority resolves correctly
