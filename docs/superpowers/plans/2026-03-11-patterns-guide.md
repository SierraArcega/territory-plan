# Domain-Specific UI Patterns Guide — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 5 domain-specific pattern docs in `Documentation/UI Framework/Patterns/` that document how components combine to solve recurring design problems in the Fullmind territory planning product.

**Architecture:** Each pattern doc follows the established format from `Components/` — decision trees, token references, TSX code examples, and codebase reference tables. A `_foundations.md` ties them together. All values reference `tokens.md`. Audience: AI agents + human developers.

**Tech Stack:** Markdown documentation only — no code changes to the application.

---

## File Structure

All files created in `Documentation/UI Framework/Patterns/`:

| File | Responsibility |
|------|---------------|
| `_foundations.md` | Shared patterns index, decision tree for "which pattern doc do I need?", cross-pattern conventions |
| `map-to-panel-interaction.md` | Map click → panel state machine → FloatingPanel routing → RightPanel layering |
| `detail-views.md` | District/Plan detail layouts — headers, tab strips, card stacks, back navigation |
| `filter-and-facets.md` | Explore filters (3-step picker), map layer toggles, filter pill chips |
| `forms-and-editing.md` | RightPanel form pattern, form field conventions, save/delete flows |
| `dashboard-metrics-layout.md` | KPI cards, SignalCards, metric grids, number formatting |

---

## Chunk 1: Foundations + Map-to-Panel Interaction

### Task 1: Create `_foundations.md`

**Files:**
- Create: `Documentation/UI Framework/Patterns/_foundations.md`

**Context needed before writing:**
- Read: `Documentation/UI Framework/Components/Containers/_foundations.md` (format reference)
- Read: `Documentation/UI Framework/tokens.md` (token reference)

- [ ] **Step 1: Write `_foundations.md`**

This file provides:
1. A definition of what "patterns" means in this system (reusable solutions combining components — distinct from individual component docs)
2. A decision tree: "Which pattern doc do I need?" mapping user intent → pattern doc
3. Cross-pattern conventions (state management via zustand `useMapV2Store`, responsive behavior, loading/error state handling)
4. Links to all 5 pattern docs

**Decision tree to include:**

```
1. User clicks something on the map and needs to see details?
   → map-to-panel-interaction.md

2. Building a detail view for a district, plan, or account?
   → detail-views.md

3. Adding filtering, sorting, or faceted search to a view?
   → filter-and-facets.md

4. Building a create/edit form that opens in a panel?
   → forms-and-editing.md

5. Displaying KPIs, stats, metrics, or signal cards?
   → dashboard-metrics-layout.md
```

**Cross-pattern conventions to document:**
- State management: All panel state lives in `useMapV2Store` (zustand) — `panelState`, `selectedLeaid`, `rightPanelContent`, `activePlanId`, `planSection`
- All containers follow `Containers/_foundations.md` for borders, radius, shadows, dismiss behavior
- All text styling follows `tokens.md` type scale — never introduce arbitrary sizes
- Loading states: skeleton pattern with `animate-pulse` and `bg-[#C4E7E6]/20` fills
- Error states: centered text `text-sm text-red-400` (note: should migrate to `text-[#c25a52]` per `Display/_foundations.md` semantic text colors)

**Format:** Match the existing `_foundations.md` style — terse tables, no prose padding, decision tree at top.

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Patterns/_foundations.md"
git commit -m "docs: add pattern foundations with decision tree and cross-pattern conventions"
```

---

### Task 2: Create `map-to-panel-interaction.md`

**Files:**
- Create: `Documentation/UI Framework/Patterns/map-to-panel-interaction.md`

**Context needed before writing:**
- Read: `src/features/map/lib/store.ts` (lines 14-90 — PanelState type, RightPanelContent type, IconBarTab, PlanSection)
- Read: `src/features/map/components/MapV2Shell.tsx` (shell layout)
- Read: `src/features/map/components/FloatingPanel.tsx` (panel container + responsive behavior)
- Read: `src/features/map/components/PanelContent.tsx` (state machine router)
- Read: `src/features/map/components/RightPanel.tsx` (secondary panel)
- Read: `src/features/map/components/IconBar.tsx` (navigation)
- Read: `src/features/map/components/MapV2Container.tsx` (click handler — search for `selectDistrict`)

- [ ] **Step 1: Write `map-to-panel-interaction.md`**

**Sections to include:**

**1. Overview** — One paragraph: the core UX loop is "click map element → see details in panel." This pattern documents how selection state flows from a map click through the state machine to the correct panel content.

**2. Panel State Machine** — Document the `PanelState` type and transitions:

| From | Action | To | What happens |
|------|--------|----|-------------|
| BROWSE | Click district on map | DISTRICT | `selectDistrict(leaid)` sets `selectedLeaid`, pushes to `panelHistory` |
| BROWSE | Click state on map | STATE | `selectState(stateCode)` sets `selectedStateCode` |
| BROWSE | Click "New Plan" | PLAN_NEW | `startNewPlan()` opens PlanFormPanel |
| PLAN_NEW | Submit form | PLAN_ADD | `createPlan(planId)` sets `activePlanId`, transitions to district-adding mode |
| PLAN_ADD | Finish adding districts | PLAN_OVERVIEW | `viewPlan(planId)` enters plan workspace |
| Any plan list | Click existing plan | PLAN_VIEW → PLAN_OVERVIEW | `viewPlan(planId)` sets `activePlanId` |
| PLAN_OVERVIEW | Click section tab | PLAN_ACTIVITIES/TASKS/CONTACTS/PERF | `setPlanSection(section)` |
| Any | Click back | Previous | `goBack()` pops from `panelHistory` |

Include the full state enum (all 11 states) and note that `panelHistory` acts as a stack for back navigation.

**3. Layout Architecture** — Document the nesting:

```
MapV2Shell
├── MapV2Container (or ComparisonMapShell)
├── FloatingPanel
│   ├── IconBar (home/plans/explore/settings nav)
│   ├── PanelContent (routes based on panelState)
│   └── RightPanel (secondary panel, only in plan workspace)
├── ExploreOverlay
├── MultiSelectChip
├── SelectModePill
├── MapSummaryBar
└── LayerBubble
```

**4. Panel Sizing** — Document the responsive width rules from FloatingPanel:

| Context | Width | Condition |
|---------|-------|-----------|
| Default | `w-[33vw] min-w-[340px] max-w-[520px]` | No right panel or not in plan workspace |
| Plan workspace + right panel | `w-[50vw] max-w-[720px]` | `rightPanelContent` exists, in plan workspace |
| Plan workspace + district card | `w-[65vw] max-w-[900px]` | Right panel type is `district_card` |
| Mobile | Bottom drawer, `max-h-[70vh]` | Below `sm:` breakpoint (640px) |

**5. Click-to-Detail Flow** — TSX example showing the complete chain:

```tsx
// 1. Map click handler (MapV2Container.tsx)
store.selectDistrict(leaid);

// 2. Store action (store.ts)
selectDistrict: (leaid) => set(s => ({
  selectedLeaid: leaid,
  panelState: "DISTRICT",
  panelHistory: [...s.panelHistory, s.panelState],
}))

// 3. PanelContent routes to DistrictDetailPanel
if (panelState === "DISTRICT") return <DistrictDetailPanel />;

// 4. DistrictDetailPanel reads selectedLeaid from store
const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
const { data } = useDistrictDetail(selectedLeaid);
```

**6. RightPanel Content Types** — Document the `RightPanelContent` type:

| Type | Component | Width | Context |
|------|-----------|-------|---------|
| `district_card` | DistrictCard | 380px | View district from plan workspace |
| `plan_card` | PlanCard | 380px | View plan details |
| `task_form` | TaskForm | 280px | Create task |
| `task_edit` | TaskForm | 280px | Edit existing task |
| `activity_form` | ActivityForm | 280px | Create activity |
| `activity_edit` | ActivityForm | 280px | Edit activity |
| `plan_edit` | PlanEditForm | 280px | Edit plan metadata |
| `contact_detail` | ContactDetail | 280px | View contact |
| `contact_form` | — | 280px | Create contact |

**7. Codebase Reference Table**

| Component | File |
|-----------|------|
| Panel state machine | `src/features/map/lib/store.ts` |
| Shell layout | `src/features/map/components/MapV2Shell.tsx` |
| Floating panel container | `src/features/map/components/FloatingPanel.tsx` |
| Panel content router | `src/features/map/components/PanelContent.tsx` |
| Right panel router | `src/features/map/components/RightPanel.tsx` |
| Icon bar navigation | `src/features/map/components/IconBar.tsx` |
| Map click handlers | `src/features/map/components/MapV2Container.tsx` |

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Patterns/map-to-panel-interaction.md"
git commit -m "docs: add map-to-panel interaction pattern guide"
```

---

## Chunk 2: Detail Views + Filter & Facets

### Task 3: Create `detail-views.md`

**Files:**
- Create: `Documentation/UI Framework/Patterns/detail-views.md`

**Context needed before writing:**
- Read: `src/features/map/components/panels/district/DistrictDetailPanel.tsx`
- Read: `src/features/map/components/panels/district/DistrictHeader.tsx`
- Read: `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx`
- Read: `src/features/map/components/panels/PlanWorkspace.tsx`
- Read: `src/features/map/components/right-panels/DistrictCard.tsx`
- Read: `src/features/map/components/panels/PlanViewPanel.tsx`

- [ ] **Step 1: Write `detail-views.md`**

**Sections to include:**

**1. Overview** — Detail views show the full information about a single entity (district, plan, account). They share a common anatomy: back-button header → entity header → tab strip or card stack → scrollable content.

**2. Decision Tree: Which Detail Layout?**

```
1. Showing a full district with all data cards?
   → District Detail Panel (card stack layout)

2. Showing a plan with sections for districts/tasks/activities?
   → Plan Workspace (icon tab strip layout)

3. Showing a district summary inside a plan workspace?
   → District Card in RightPanel (compact card layout)
```

**3. Common Anatomy**

Document the shared structure across all detail views:

```
┌─ Back Button Header ──────────────────────┐
│  [←]  ENTITY TYPE (uppercase label)       │
├───────────────────────────────────────────┤
│  Entity Header                             │
│  - Name (text-lg font-bold text-[#403770])│
│  - Metadata line (text-xs text-gray-500)  │
│  - Tags / signal badges                   │
├───────────────────────────────────────────┤
│  Tab Strip (optional)                      │
├───────────────────────────────────────────┤
│  Scrollable Content                        │
│  - Card stack or section content           │
└───────────────────────────────────────────┘
```

**4. Back Button Header Pattern** — TSX example:

```tsx
<div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
  <button onClick={goBack} className="w-7 h-7 rounded-lg hover:bg-gray-100 ..." aria-label="Go back">
    {/* ← chevron SVG */}
  </button>
  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
    District
  </span>
</div>
```

Note: uses `border-gray-100` not `border-[#E2DEEC]` — this is a migration candidate.

**5. Entity Header Variants**

Document DistrictHeader vs PlanWorkspace header — what's shared, what differs.

- District: name + account type badge + state/county/LEAID line + external links + tags + signal strip + compact stats
- Plan: name + edit button + status badge + FY badge + district count + state badges + owner/collaborators

**6. Tab Strip Pattern** — Two variants:

| Variant | Component | Used by |
|---------|-----------|---------|
| `DistrictTabStrip` | Exported component in `panels/district/tabs/DistrictTabStrip.tsx` | District detail (DistrictCard in right panel) |
| Plan section strip | Inline `PlanIconStrip` function within `PlanWorkspace.tsx` (not exported) | Plan workspace |

Both use: `flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium` with `border-b border-gray-100` container. Active state: `bg-plum/10 text-plum`. Inactive: `text-gray-400 hover:text-gray-600 hover:bg-gray-50`.

**7. Card Stack Layout** — District detail uses a vertical card stack (`space-y-3` in `p-3`), each card being a `SignalCard` component. Document the SignalCard pattern (expandable card with header/content/detail).

**8. Loading & Error States** — Document the skeleton pattern used in DistrictDetailPanel and PlanWorkspace.

**9. Codebase Reference Table**

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Patterns/detail-views.md"
git commit -m "docs: add detail views pattern guide"
```

---

### Task 4: Create `filter-and-facets.md`

**Files:**
- Create: `Documentation/UI Framework/Patterns/filter-and-facets.md`

**Context needed before writing:**
- Read: `src/features/map/components/explore/ExploreFilters.tsx`
- Read: `src/features/map/components/explore/ExploreOverlay.tsx`
- Read: `src/features/map/components/explore/ExploreTable.tsx`
- Read: `src/features/map/components/explore/ExploreColumnPicker.tsx`
- Read: `src/features/map/components/explore/ExploreSortDropdown.tsx`
- Read: `src/features/map/components/explore/ExploreSavedViews.tsx`
- Read: `src/features/map/components/LayerBubble.tsx` (map-level filters)
- Read: `src/features/map/lib/store.ts` (ExploreFilter, ExploreSortConfig types)
- Read: `src/features/explore/lib/filters.ts` (FilterOp type)

- [ ] **Step 1: Write `filter-and-facets.md`**

**Sections to include:**

**1. Overview** — Two filter systems exist: Explore filters (structured column/operator/value) and Map layer toggles (vendor/signal/locale visibility). This doc covers both.

**2. Decision Tree: Which Filter Pattern?**

```
1. Filtering tabular data with column-based criteria?
   → Explore Filters (3-step picker)

2. Toggling map layer visibility (vendors, signals, school types)?
   → Layer Bubble toggles

3. Quick-filtering a list by search text?
   → Inline search input (see forms-and-editing.md)
```

**3. Explore Filter Architecture**

Document the 3-step picker flow:

```
Step 1: Column       Step 2: Operator      Step 3: Value
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Search...    │    │ [←] Column   │    │ [←] Col · Op │
│ ─ Group ─── │    │ ──────────── │    │ ──────────── │
│  Column A   │ →  │  is          │ →  │  [input]     │
│  Column B   │    │  is not      │    │  [Apply]     │
│  Column C   │    │  contains    │    └──────────────┘
└──────────────┘    │  is empty    │
                    └──────────────┘
```

**4. Filter Types & Operators** — Document `OPERATORS_BY_TYPE` table:

| Filter Type | Operators |
|-------------|-----------|
| text | is, is not, contains, is empty, is not empty |
| enum | is, is not, is empty, is not empty |
| number | is, is not, greater than, less than, between, is empty, is not empty |
| boolean | is true, is false |
| date | is, after, before, between, is empty, is not empty |
| tags | contains, is empty, is not empty |
| relation | includes any of, excludes all of, has none, has any |

**5. Filter Pill Pattern** — TSX example showing active filter chip styling.

**6. Column Definitions by Entity** — Reference the column definition files:

| Entity | Column Defs File |
|--------|-----------------|
| districts | `src/features/map/components/explore/columns/districtColumns.ts` |
| activities | `src/features/map/components/explore/columns/activityColumns.ts` |
| tasks | `src/features/map/components/explore/columns/taskColumns.ts` |
| contacts | `src/features/map/components/explore/columns/contactColumns.ts` |
| plans | `src/features/map/components/explore/columns/planColumns.ts` |

**7. Map Layer Toggles** — Document the LayerBubble pattern (vendor toggles, signal toggles, school type toggles, locale toggles) — these are distinct from Explore filters.

**8. Codebase Reference Table**

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Patterns/filter-and-facets.md"
git commit -m "docs: add filter and facets pattern guide"
```

---

## Chunk 3: Forms & Editing + Dashboard Metrics

### Task 5: Create `forms-and-editing.md`

**Files:**
- Create: `Documentation/UI Framework/Patterns/forms-and-editing.md`

**Context needed before writing:**
- Read: `src/features/map/components/right-panels/TaskForm.tsx`
- Read: `src/features/map/components/right-panels/ActivityForm.tsx`
- Read: `src/features/map/components/right-panels/PlanEditForm.tsx`
- Read: `src/features/map/components/panels/PlanFormPanel.tsx`
- Read: `src/features/map/components/panels/AccountForm.tsx`
- Read: `Documentation/UI Framework/Components/forms.md`

- [ ] **Step 1: Write `forms-and-editing.md`**

**Sections to include:**

**1. Overview** — Forms in Fullmind open in one of two contexts: the RightPanel (for editing within a plan workspace) or the main PanelContent (for creating new entities like plans). This doc covers the shared patterns.

**2. Decision Tree: Which Form Pattern?**

```
1. Creating a new plan?
   → PlanFormPanel in main PanelContent (full-width panel form)

2. Editing plan metadata?
   → PlanEditForm in RightPanel (280px secondary panel)

3. Creating/editing a task or activity?
   → TaskForm/ActivityForm in RightPanel (280px)

Note: `contact_form` exists as a RightPanelContent type but has no standalone panel component yet — contacts are created inline via `ContactsList.tsx`. If building a standalone contact form panel, follow the TaskForm pattern.

4. Creating a new account from the map?
   → AccountForm in main PanelContent (replaces panel content)
```

**3. Form Field Conventions**

Document the standard field pattern used across all forms:

```tsx
<div>
  <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
    Field Label
  </label>
  <input
    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200
      focus:border-gray-400 focus:outline-none focus:ring-0
      transition-colors placeholder:text-gray-300"
  />
</div>
```

Note migration targets: labels use `text-gray-400` (should be `text-[#A69DC0]`), borders use `border-gray-200` (should be `border-[#C2BBD4]`).

**4. Form State Management** — Document the pattern: controlled `useState` for each field, React Query mutations for save/update/delete. No form library (no react-hook-form, no formik).

**5. Save/Cancel/Delete Flow**

- Save button: `w-full py-2 bg-gray-800 text-white text-xs font-medium rounded-lg` — disabled when title is empty or mutation is pending
- Delete (edit mode only): Two-phase — "Delete Task" text button → inline confirmation card with `bg-red-50 border border-red-200` + Delete/Cancel buttons
- Cancel: Close right panel (`closeRightPanel()`) — no explicit cancel button, dismiss via close button

**6. Priority Selector Pattern** — Document the button-group selector used in TaskForm (applicable to any enum selector):

```tsx
<div className="flex gap-1">
  {OPTIONS.map((option) => (
    <button
      className={`flex-1 flex items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium
        ${isSelected ? "ring-1 ring-offset-1" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
      style={isSelected ? { backgroundColor: `${color}18`, color, "--tw-ring-color": color } : undefined}
    />
  ))}
</div>
```

**7. Linked Entity Checkboxes** — Document the checkbox list pattern for linking districts to tasks/activities.

**8. Loading Skeleton for Forms** — Document the skeleton pattern used when editing (loading existing data).

**9. Codebase Reference Table**

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Patterns/forms-and-editing.md"
git commit -m "docs: add forms and editing pattern guide"
```

---

### Task 6: Create `dashboard-metrics-layout.md`

**Files:**
- Create: `Documentation/UI Framework/Patterns/dashboard-metrics-layout.md`

**Context needed before writing:**
- Read: `src/features/map/components/explore/ExploreKPICards.tsx`
- Read: `src/features/map/components/panels/district/signals/SignalCard.tsx`
- Read: `src/features/map/components/panels/district/signals/SignalBadge.tsx`
- Read: `src/features/map/components/panels/district/signals/TrendArrow.tsx`
- Read: `src/features/map/components/panels/district/EnrollmentCard.tsx`
- Read: `src/features/map/components/panels/district/FinanceCard.tsx`
- Read: `src/features/map/components/panels/district/StaffingCard.tsx`
- Read: `src/features/map/components/panels/district/CompetitorSpendCard.tsx`
- Read: `src/features/map/components/panels/district/PurchasingHistoryCard.tsx`
- Read: `src/features/map/components/panels/PlanPerfSection.tsx`
- Read: `Documentation/UI Framework/Components/Display/_foundations.md` (number formatting)

- [ ] **Step 1: Write `dashboard-metrics-layout.md`**

**Sections to include:**

**1. Overview** — Metrics are displayed in two contexts: KPI card grids (Explore overlay) and signal card stacks (district detail). This doc covers both patterns.

**2. Decision Tree: Which Metric Layout?**

```
1. Showing aggregate KPIs across many entities?
   → KPI Card Grid (ExploreKPICards pattern)

2. Showing detailed metrics for a single district?
   → Signal Card Stack (DistrictDetailPanel pattern)

3. Showing a single stat inline in a card?
   → Inline stat (text-xl font-bold + label)
```

**3. KPI Card Pattern**

Document the ExploreKPICards component:

```tsx
<div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 relative overflow-hidden">
  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accent }} />
  <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
  <div className="text-xl font-bold text-[#403770] mt-1">{value}</div>
  {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
</div>
```

- Accent bar: 3px left border, color varies by metric semantic meaning
- Grid layout: `grid gap-4 grid-cols-{n}` where n = number of cards (4-7)
- Skeleton: same card shape with `animate-pulse` fills

**4. KPI Cards by Entity** — Table showing which KPIs display for each entity type (districts, activities, tasks, contacts, plans) with their accent colors.

**5. Signal Card Pattern**

Document the SignalCard component — expandable card with:
- Header: icon + title + badge
- Content: primary metric + context
- Expandable detail: "View details" toggle

Styling: `border border-gray-100 rounded-xl bg-white`

**6. Signal Badge Pattern** — Document the trend badge used in district headers (SignalBadge component with directional arrows and color coding).

**7. Number Formatting** — Reference `Display/_foundations.md` conventions:

| Input | Output | Currency |
|-------|--------|----------|
| null/undefined | "—" | "—" |
| 1,000,000+ | "1.2M" | "$1.2M" |
| 1,000+ | "12K" | "$12K" |
| Below 1,000 | "1,234" | "$1,234" |

**8. Metric Color Semantics** — Document the accent color mapping used across KPI cards:

| Accent | Hex | Meaning |
|--------|-----|---------|
| Plum | `#403770` | Primary count/total |
| Steel Blue | `#6EA3BE` | Coverage, enrollment |
| Coral | `#F37167` | Pipeline, overdue, urgency |
| Golden | `#FFCF70` | Win back, blocked, warnings |
| Green | `#8AA891` | Closed won, completed, positive |
| Robin's Egg | `#C4E7E6` | Secondary, new business |

**9. Codebase Reference Table**

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Patterns/dashboard-metrics-layout.md"
git commit -m "docs: add dashboard metrics layout pattern guide"
```

---

## Chunk 4: Final Integration

### Task 7: Finalize `_foundations.md` index and verify cross-references

After all 5 pattern docs exist, update `_foundations.md` to include a complete index table and verify accuracy.

- [ ] **Step 1: Add pattern index table to `_foundations.md`**

Add a `## Pattern Index` section with this format:

```markdown
## Pattern Index

| Pattern | File | When to use |
|---------|------|-------------|
| Map-to-Panel Interaction | [map-to-panel-interaction.md](map-to-panel-interaction.md) | User clicks a map element and needs to see details in a panel |
| Detail Views | [detail-views.md](detail-views.md) | Building a full detail view for a district, plan, or account |
| Filter & Facets | [filter-and-facets.md](filter-and-facets.md) | Adding filtering, sorting, or faceted search to any view |
| Forms & Editing | [forms-and-editing.md](forms-and-editing.md) | Building a create/edit form in a panel |
| Dashboard Metrics | [dashboard-metrics-layout.md](dashboard-metrics-layout.md) | Displaying KPIs, stats, metrics, or signal cards |
```

- [ ] **Step 2: Verify all internal links resolve** — Check that every `[link](file.md)` in all 6 pattern files points to an existing file.

- [ ] **Step 3: Verify codebase file paths** — Spot-check 5+ file paths referenced in "Codebase Reference" tables to confirm they still exist.

- [ ] **Step 4: Commit**

```bash
git add "Documentation/UI Framework/Patterns/_foundations.md"
git commit -m "docs: finalize pattern foundations with complete index"
```

---

## Prerequisites

- **Create the directory** before writing files: `mkdir -p "Documentation/UI Framework/Patterns/"`

---

## Notes for Writers

- **Format reference:** Follow the style of `Components/Containers/_foundations.md` and `Components/Display/empty-states.md` — terse, table-heavy, TSX examples, codebase reference tables at the bottom.
- **Token compliance:** All colors must reference `tokens.md`. Flag any codebase values that use Tailwind grays (`gray-*`) or non-token hex values as migration candidates.
- **No prose padding:** Lead with the structure/table, not explanatory paragraphs. One-line intros per section max.
- **Migration notes:** When documenting patterns that use non-token values (e.g., `border-gray-100` instead of `border-[#E2DEEC]`), add a migration note like the existing docs do.
- **Dual audience:** Write so both an AI agent and a human developer can find the right pattern and implement it correctly.
