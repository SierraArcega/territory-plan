# Map-to-Panel Interaction

The core UX loop is "click map element, see details in panel." Selection state flows from a map click through the Zustand store's panel state machine to the correct panel content component, all rendered inside a responsive floating panel shell.

---

## Panel State Machine

`PanelState` is a union of 11 literal strings. Every transition pushes the current state onto `panelHistory` (a `PanelState[]` stack) so `goBack()` can pop to the previous view.

### All States

```ts
type PanelState =
  | "BROWSE"
  | "DISTRICT"
  | "STATE"
  | "PLAN_NEW"
  | "PLAN_VIEW"
  | "PLAN_ADD"
  | "PLAN_OVERVIEW"
  | "PLAN_ACTIVITIES"
  | "PLAN_TASKS"
  | "PLAN_CONTACTS"
  | "PLAN_PERF";
```

### Transitions

| From | Action | To | What happens |
|------|--------|----|--------------|
| BROWSE | Click district on map | DISTRICT | `selectDistrict(leaid)` sets `selectedLeaid`, pushes to `panelHistory` |
| BROWSE | Click state on map | STATE | `selectState(stateCode)` sets `selectedStateCode` |
| BROWSE | Click "New Plan" | PLAN_NEW | `startNewPlan()` opens PlanFormPanel |
| PLAN_NEW | Submit form | PLAN_ADD | `createPlan(planId)` sets `activePlanId`, carries over any pre-selected districts |
| PLAN_ADD | Finish adding districts | PLAN_VIEW | `finishAddingDistricts()` transitions to plan workspace |
| Any plan list | Click existing plan | PLAN_OVERVIEW | `viewPlan(planId)` sets `activePlanId`, resets `planSection` to `"districts"` |
| PLAN_OVERVIEW | Click section tab | PLAN_ACTIVITIES / PLAN_TASKS / PLAN_CONTACTS / PLAN_PERF | `setPlanSection(section)` maps section to state, clears `rightPanelContent` |
| Any | Click back | Previous | `goBack()` pops from `panelHistory`; clears selection when returning to BROWSE |
| Any | Switch icon tab | BROWSE | `setActiveIconTab(tab)` resets `panelHistory`, sets `panelState` to BROWSE for home tab |

---

## Layout Architecture

Component nesting from the top-level shell:

```
MapV2Shell
├── MapV2Container (or ComparisonMapShell when compareMode)
├── FloatingPanel
│   ├── IconBar (home / plans / explore / settings nav)
│   ├── PanelContent (routes based on panelState)
│   └── RightPanel (secondary panel, only rendered in plan workspace)
├── ExploreOverlay
├── MultiSelectChip
├── SelectModePill
├── MapSummaryBar
└── LayerBubble
```

`FloatingPanel` handles desktop vs. mobile rendering. `PanelContent` acts as the state machine router. `RightPanel` is conditionally rendered only when `isInPlanWorkspace` is true.

---

## Panel Sizing

Width classes applied to the `FloatingPanel` outer container:

| Context | Width | Condition |
|---------|-------|-----------|
| Default | `w-[33vw] min-w-[340px] max-w-[520px]` | No right panel or not in plan workspace |
| Plan workspace + right panel | `w-[50vw] max-w-[720px]` | `rightPanelContent` exists and state is a plan workspace state |
| Plan workspace + district card | `w-[65vw] max-w-[900px]` | `rightPanelContent.type === "district_card"` in plan workspace |
| Mobile | Bottom drawer, `max-h-[70vh]` | Below `sm:` breakpoint (640px) |

Plan workspace states: `PLAN_OVERVIEW`, `PLAN_ACTIVITIES`, `PLAN_TASKS`, `PLAN_CONTACTS`, `PLAN_PERF`.

Auto-collapse: panel hides on viewports below 1024px via `matchMedia("(max-width: 1023px)")`.

---

## Click-to-Detail Flow

Complete chain from map click to rendered detail panel:

```tsx
// 1. Map click handler (MapV2Container.tsx)
const store = useMapV2Store.getState();
store.selectDistrict(leaid);

// 2. Store action (store.ts) — pushes history, sets state
selectDistrict: (leaid) =>
  set((s) => ({
    selectedLeaid: leaid,
    panelState: "DISTRICT",
    panelHistory: [...s.panelHistory, s.panelState],
  })),

// 3. PanelContent routes based on panelState
if (panelState === "DISTRICT") return <DistrictDetailPanel />;

// 4. DistrictDetailPanel reads selectedLeaid from store
const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
const { data } = useDistrictDetail(selectedLeaid);
```

Back navigation pops the stack and clears selection when returning to BROWSE:

```tsx
goBack: () =>
  set((s) => {
    const history = [...s.panelHistory];
    const prev = history.pop() || "BROWSE";
    return {
      panelState: prev,
      panelHistory: history,
      ...(prev === "BROWSE"
        ? { selectedLeaid: null, selectedStateCode: null }
        : {}),
    };
  }),
```

---

## RightPanel Content Types

`RightPanelContent` interface — `{ type, id? }`. Only rendered inside plan workspace states.

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
| `contact_form` | -- | 280px | Type exists but no panel component yet |

Wide panels (`district_card`, `plan_card`) get their own close button layout with no header label. Narrow panels render a shared header with uppercase label and compact close button.

**Migration note:** RightPanel close button uses `stroke="#9CA3AF"` (Tailwind gray). Should migrate to `text-[#A69DC0]` per `_foundations.md` close button pattern.

---

## Codebase Reference

| Component | File |
|-----------|------|
| Panel state machine | `src/features/map/lib/store.ts` |
| Shell layout | `src/features/map/components/MapV2Shell.tsx` |
| Floating panel container | `src/features/map/components/FloatingPanel.tsx` |
| Panel content router | `src/features/map/components/PanelContent.tsx` |
| Right panel router | `src/features/map/components/RightPanel.tsx` |
| Icon bar navigation | `src/features/map/components/IconBar.tsx` |
| Map click handlers | `src/features/map/components/MapV2Container.tsx` |
| District detail panel | `src/features/map/components/panels/district/DistrictDetailPanel.tsx` |
