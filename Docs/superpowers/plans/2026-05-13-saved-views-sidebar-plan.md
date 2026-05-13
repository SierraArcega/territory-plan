# Implementation Plan: Saved Views — Plans & Lists Sidebar

**Spec:** `Docs/superpowers/specs/2026-05-13-saved-views-sidebar-spec.md`
**Backend context:** `Docs/superpowers/specs/2026-05-13-saved-views-sidebar-backend-context.md`
**Branch:** `worktree-saved-views-sidebar`
**Date:** 2026-05-13

## Execution Strategy

The work is sliced into **6 phases** that map cleanly to implementer-subagent passes. Phases A and B can run in parallel; everything after depends on A+B. Each phase ends with a green test suite and a commit.

```
Phase A: Backend foundations (Prisma + core API routes)
    ↓
Phase B: Frontend foundations (routes + types + sidebar shell)   <- parallel with A
    ↓
Phase C: Group canvas + 8 view bodies
    ↓
Phase D: Detail panel system (6 kinds)
    ↓
Phase E: List builder modal + AI agent fork
    ↓
Phase F: Portfolio + context menus + polish + legacy fallback wiring
```

Total estimated implementer-subagent passes: **6 sequential**, with A and B optionally fanned out as parallel agents.

---

## Phase A — Backend Foundations

**Owner agent:** general-purpose with `backend-discovery` skill loaded.

### A1. Prisma schema + migration

**Files:**
- `prisma/schema.prisma` — add models
- `prisma/migrations/[timestamp]_saved_lists/migration.sql` — generated migration

**Models to add** (see spec §"New Prisma Models"):
- `SavedList`
- `SavedListHidden`
- `TerritoryPlanHidden`

**Acceptance:**
- `npx prisma migrate dev --name saved_lists` runs cleanly.
- Generated Prisma Client compiles.
- Foreign keys: `SavedList.ownerId → Profile.id`, `SavedListHidden.listId → SavedList.id (cascade)`, `TerritoryPlanHidden.planId → TerritoryPlan.id (cascade)`.
- Indexes on `SavedList(ownerId)` and `SavedList(shared)`.

### A2. Filter-tree type + validators (shared with frontend)

**Files:**
- `src/lib/saved-views/filter-tree.ts` — shared types + Zod schema for filter trees (used by API + UI)

**Schema:**
```ts
type FilterRule = { kind: 'rule', fieldId: string, op: string, value: unknown }
                | { kind: 'any', fieldId: string, op: string, values: unknown[] }
type FilterNode = { kind: 'and', children: (FilterRule | FilterNode)[] }
                | FilterRule
type ListSpec = {
  schemaVersion: 1
  source: 'districts' | 'contacts' | 'opps' | 'vacancies' | 'news' | 'rfps'
  filterTree: FilterNode
  scope: { mode: 'none' } | { mode: 'rules', filterTree: FilterNode }
                          | { mode: 'reference', kind: 'plan'|'list', id: string }
}
```

**Acceptance:**
- Zod schema lives in `src/lib/saved-views/schema.ts` and is imported by both API routes and frontend.
- Includes `flattenForUi()` utility — input: arbitrary FilterNode, output: flat list with `kind: 'any'` collapses. Returns `{ rules: FilterRule[], warnings: string[] }`.
- Vitest coverage for AND-unwrap, OR-of-same-field collapse, mixed cases.

### A3. SavedList CRUD routes

**Files:**
- `src/app/api/lists/route.ts` — GET (list), POST (create)
- `src/app/api/lists/[id]/route.ts` — GET, PATCH, DELETE
- `src/app/api/lists/[id]/hide/route.ts` — POST

**Auth pattern:** Supabase `getUser()` per existing `src/lib/auth.ts` / `src/lib/supabase/server.ts`. Visibility: owner sees their own + shared lists from anyone in the same workspace; per-user hidden filtered out unless `?showHidden=1`.

**Acceptance:**
- All four standard auth/visibility states tested (unauth → 401, not owner on patch/delete → 403, owner → 200, shared visibility → seen by others).
- Filter-tree input validated with shared Zod schema; bad input → 400.
- POST returns 201 with full record including computed `count` (initial).

### A4. Preview endpoint

**Files:**
- `src/app/api/lists/preview/route.ts` — POST

**Body:** `{ source, filterTree, scopeMode, scopeFilterTree?, scopeRefKind?, scopeRefId? }` — same shape as a list, minus name/shared.

**Behavior:**
- Builds a SQL query for the given source + filter tree against the readonly pool (`@/lib/db-readonly`).
- Returns `{ count: number, sample: [3 items with kind-specific fields] }`.
- Cap evaluation cost: hard limit of 5s timeout; on hit, return `{ count: null, sample: [], truncated: true }`.

**Filter→SQL strategy:**
- Switch on source → known table + known column allowlist.
- `kind: 'rule'`: emit `column op value` (parameterized).
- `kind: 'any'`: emit `column IN (?,?,?...)`.
- `kind: 'and'`: AND-join children.
- Scope `mode: 'rules'`: emit a CTE filtering districts, then JOIN.
- Scope `mode: 'reference'`: emit `district_lea_id IN (SELECT district_lea_id FROM plan_districts WHERE plan_id = ?)` (or analogous for list reference; for list reference, run the referenced list's filter tree as a CTE).

**Acceptance:**
- One Vitest integration test per source.
- One integration test confirming scope `mode: 'reference'` actually joins correctly.
- 400 on unknown source/field/op.

### A5. AI list-builder route (SSE, terminal-tool fork)

**Files:**
- `src/features/reports/lib/agent/agent-loop.ts` — add `terminalTool` + `agentVariant` params (backwards-compatible — defaults preserve current behavior)
- `src/features/views/lib/ai-list-builder/system-prompt.ts` — new prompt describing entity schemas + filter-tree shape
- `src/features/views/lib/ai-list-builder/tools.ts` — `describe_entity`, `sample_values`, `emit_list_spec` schemas
- `src/app/api/lists/ai-build/route.ts` — POST, SSE response

**Behavior:**
- Reuses the existing agent loop with `agentVariant: 'list-builder'` and `terminalTool: emit_list_spec`.
- Streams `trace` events (mirroring reports) and a final `result` event with the structured spec.
- On `result`, response stream closes.
- Hard tool-call cap: 6 (5 explorations + 1 terminal). If exceeded, emit `error` event.

**Acceptance:**
- Mocked agent integration test (uses Anthropic-SDK mock harness already in `src/features/reports/lib/agent/__tests__/`).
- E2E unit test with a stubbed terminal call → `result` event payload matches Zod schema.

### A6. Plan stats — extend `GET /api/plans`

**Files:**
- `src/app/api/plans/route.ts` — modify GET handler

**Computed fields per plan:**
- `progress: number` — bookings / target (clamp 0-100, null if target null)
- `pipelineValue: number` — sum of `Opportunity.value` for plan-district opps in current FY where stage != closed-lost
- `contactsCount: number` — count of `Contact` linked to plan's districts
- `oppsCount: number` — count of open opps in plan's districts

**Implementation:**
- Use a single `LEFT JOIN LATERAL` per plan against `Opportunity` / `Contact` aggregates, or a CTE + GROUP BY.
- Reuse current FY resolution from `src/lib/fiscal-year.ts`.
- Hide computed fields behind `?stats=1` so legacy callers can opt out.

**Acceptance:**
- A test plan with known opps/contacts returns exact counts.
- Without `?stats=1`, response shape unchanged.
- Query plan inspected; uses indexes (add `Opportunity(planId, status)` index if absent — flagged in A1's migration).

### A7. Plan per-user hide

**Files:**
- `src/app/api/plans/[id]/hide/route.ts` — POST

**Acceptance:**
- Sets/unsets row in `TerritoryPlanHidden` (idempotent).
- `GET /api/plans` filters hidden out unless `?showHidden=1`.

### A8. Entity detail-panel endpoints

**Files (new where missing — see backend context):**
- `src/app/api/opportunities/[id]/route.ts` — GET (new)
- `src/app/api/news/[id]/route.ts` — GET (new)
- `src/app/api/rfps/[id]/route.ts` — GET (new)
- `src/app/api/vacancies/route.ts` — GET list (new; per-district filter)

Districts and contacts have existing detail endpoints — verify in implementation and extend only if a field on the prototype's panel isn't already returned.

**Acceptance:**
- Each route returns 200 with shape matching the prototype panel fields (cross-reference `design_handoff_saved_views/district-panel.jsx` and `detail-panel.jsx`).
- 404 if not found; 401/403 per existing patterns.

**Phase A test gate:**
```
npx vitest run src/lib/saved-views src/app/api/lists src/app/api/plans src/app/api/opportunities src/app/api/news src/app/api/rfps src/app/api/vacancies
npx prisma migrate status
npm run typecheck
```
All green → commit "feat(saved-views): backend foundations".

---

## Phase B — Frontend Foundations (parallel with A)

**Owner agent:** general-purpose with `frontend-design` skill loaded.

### B1. Feature directory + types

**Files:**
- `src/features/views/index.ts` — re-exports
- `src/features/views/lib/view-types.ts` — `ViewId`, `ViewSpec`, view-icon map
- `src/features/views/lib/store.ts` — Zustand store for sidebar UI state

**Store slices:**
- `expandedGroups: Record<string, boolean>`
- `hoverId: string | null`
- `menuGroupId: string | null`
- `showHidden: boolean`
- `density: 'compact' | 'comfortable'` (persisted via `zustand/middleware persist`)
- `builderOpen: boolean`
- `builderSeed: { filters?: ListSpec, name?: string } | null`

**Acceptance:** Compiles, Vitest of store actions.

### B2. URL parsing hook

**Files:**
- `src/features/views/hooks/useViewsRouter.ts`

**API:**
```ts
useViewsRouter(): {
  isPortfolio: boolean,
  groupKind: 'plan' | 'list' | null,
  groupId: string | null,
  viewId: ViewId | null,
  detail: { kind: DetailKind, id: string } | null,
  showArchived: boolean,
  goToGroup: (kind, id, viewId?) => void,
  goToPortfolio: (showArchived?) => void,
  openDetail: (kind, id) => void,
  closeDetail: () => void,
}
```

**Acceptance:** Unit tests for every URL shape in spec.

### B3. App Router segments

**Files:**
- `src/app/views/layout.tsx` — wraps with the new `ViewsSidebar`
- `src/app/views/page.tsx` — portfolio entry (`<PortfolioView />`)
- `src/app/views/plans/[planId]/page.tsx` — redirects to default view
- `src/app/views/plans/[planId]/[viewId]/page.tsx` — renders `<GroupCanvas kind="plan" />`
- `src/app/views/lists/[listId]/page.tsx` — redirects to default view
- `src/app/views/lists/[listId]/[viewId]/page.tsx` — renders `<GroupCanvas kind="list" />`

**Acceptance:** Each route returns 200 and renders the right shell.

### B4. Replace `Sidebar.tsx` mount in main app

**Files:**
- `src/app/page.tsx` — for non-`/views` routes, keep using existing `Sidebar`; for `/views/*`, the new layout handles its own sidebar (handled by App Router layout nesting — no change to page.tsx).
- Decision: leave existing `Sidebar.tsx` exactly as-is for legacy routes. The `/views` segment owns its own sidebar via `app/views/layout.tsx`.

Note: This is a smaller blast radius than rewriting the global sidebar. Rep can still hit `/?tab=plans` etc. for legacy. New entry is `/views`.

### B5. Queries

**Files:**
- `src/features/views/lib/queries.ts` — TanStack Query hooks:
  - `usePlansWithStats()` → GET `/api/plans?stats=1`
  - `useLists()` → GET `/api/lists`
  - `useList(id)` → GET `/api/lists/[id]`
  - `useCreateList()`, `useUpdateList()`, `useDeleteList()`, `useHideList()`, `useHidePlan()`, `useUnhideList()`, `useUnhidePlan()`
  - `useListPreview(spec)` → POST `/api/lists/preview` (debounced 300ms)
  - `useEntity(kind, id)` → routes to the right detail endpoint
- `src/features/views/lib/ai-list-builder/client.ts` — SSE client for `/api/lists/ai-build`

**Query-key conventions** (per CLAUDE.md):
- All keys use serialized primitives. For filter trees: `['list-preview', source, JSON.stringify(filterTree), scopeMode, scopeRefId ?? null]`.

**Acceptance:** Compiles; manual smoke-test against a dev DB seed.

### B6. ViewsSidebar shell

**Files:**
- `src/features/views/components/ViewsSidebar.tsx`
- `src/features/views/components/SidebarTopNav.tsx`
- `src/features/views/components/MyViewsSection.tsx`

The shell at this phase is non-interactive — renders the layout with placeholder rows. Real plan/list rows ship in Phase C.

**Acceptance:**
- Layout matches prototype at viewport 1280px.
- Pinned width: 252px (compact) / 268px (comfortable).
- Reads `density` from store; toggling re-renders padding.
- Tokens match `Documentation/UI Framework/tokens.md`.

**Phase B test gate:**
```
npx vitest run src/features/views
npm run typecheck
npm run build  # smoke
```
Commit "feat(saved-views): frontend foundations + /views routing".

---

## Phase C — Group Canvas + 8 View Bodies

**Owner agent:** general-purpose with `frontend-design` skill.

### C1. Plan/List rows + expand/collapse

**Files:**
- `src/features/views/components/PlansSubsection.tsx`
- `src/features/views/components/ListsSubsection.tsx`
- `src/features/views/components/GroupRow.tsx`
- `src/features/views/components/GroupViewList.tsx`

**Acceptance:**
- Caret rotates -90° on collapse (150ms).
- Mini progress ring renders correctly per `Display/progress.md`.
- Active group/view highlighted per URL.
- Pixel-faithful indentation (30px from left for view list).

### C2. GroupCanvas wrapper

**Files:**
- `src/features/views/components/GroupCanvas.tsx`
- `src/features/views/components/GroupHeader.tsx`
- `src/features/views/components/ViewTabsStrip.tsx`

**Acceptance:**
- Header eyebrow + title + view-type + stats grid (plans only) renders correctly.
- For lists: filter chips replace stats grid.
- Progress bar (plans only): 4px tall, color-coded by progress%.
- View tabs strip: horizontal scrollable, active tab has 2px plum bottom border.
- "+ View" affordance at end.

### C3. The 8 view bodies

Each view component lives in `src/features/views/components/views/`:

1. **MapViewContainer** — mounts `MapV2Container` with a `districtLeaidsFilter` prop. **Action item:** add this prop to `MapV2Container` if it doesn't already accept one (probably needs to be threaded through to the layer manager).
2. **TableView** — `DataGrid` configured for districts with signal-dot + tier badge + stage pill.
3. **KanbanView** — 240px columns grouped by stage; click cards routes to detail.
4. **ContactsView** — table of contacts in the plan/list's district set.
5. **OppsView** — table of opportunities.
6. **VacanciesView** — vacancies in the scope.
7. **NewsView** — card feed.
8. **RfpsView** — RFP table.

**Click routing for detail panel:**
- `GroupCanvas` wraps the active view body in a `<CanvasBody onSelect={openDetail}>` that uses event delegation to detect row clicks. Each view renders rows with `data-row-kind` and `data-row-id` attributes.

**Acceptance:**
- Each view paginates at 50 with "Show more" (per CLAUDE.md).
- Each view has loading + empty + error states.
- Row click → URL updates with `?detail=[kind]:[id]`.
- All views render correctly at narrow widths (per CLAUDE.md narrow-width resilience).
- Map view scoping verified: only plan/list districts visible.

**Phase C test gate:**
```
npx vitest run src/features/views/components
npm run build
```
Commit "feat(saved-views): group canvas + 8 view bodies".

---

## Phase D — Detail Panel System

**Owner agent:** general-purpose with `frontend-design` skill.

### D1. DetailPanel shell

**Files:**
- `src/features/views/components/detail/DetailPanel.tsx`
- `src/features/views/components/detail/DetailPanelHeader.tsx`
- `src/features/views/components/detail/DetailPanelTabs.tsx` (districts only)

**Acceptance:**
- 380px wide, absolutely positioned right inside main content area.
- Slide-in: 250ms cubic-bezier(0.16, 1, 0.3, 1), translateX(20→0) + opacity 0→1.
- Box shadow: `-12px 0 32px rgba(64,55,112,0.08)`.
- Close: X button OR click outside the panel area.
- Routes content dispatch based on `detail.kind`.

### D2. Six detail content components

**Files:** `src/features/views/components/detail/{District,Contact,Opp,Vacancy,News,Rfp}DetailContent.tsx`

Each fetches via `useEntity(kind, id)` and renders the prototype-specified fields.

**Acceptance:**
- District panel reuses field structure from existing `DistrictDetailPanel` queries.
- Each panel matches prototype: header (eyebrow + H2 + meta + actions), body (stats grid + sections + items + notes blocks).
- All `Log activity` / `Save` / share buttons wired (or stubbed with TODO comment + tracked issue).

**Phase D test gate:**
```
npx vitest run src/features/views/components/detail
npm run build
```
Commit "feat(saved-views): detail panels for 6 entity kinds".

---

## Phase E — List Builder Modal + AI Agent Fork

**Owner agent:** general-purpose, full-stack (touches frontend + backend).

### E1. Modal shell + manual editor

**Files:** `src/features/views/components/builder/*` (see spec)

**Acceptance:**
- 880px max-width modal with backdrop, fade+slide animation.
- Two-column layout with sticky right preview pane.
- Source picker switches conditions/scope UI appropriately.
- ConditionRow handles both `rule` and `any` kinds; chip-pills with × delete for `any`.
- Scope tab strip with 3 options; reference dropdown lists all plans + lists.

### E2. Live preview wiring

**Files:** `src/features/views/components/builder/LivePreviewPane.tsx`

**Acceptance:**
- Debounced 300ms on rule changes.
- Shows count + 3 sample items.
- `Scoped to {name}` callout when scope=reference.
- Loading skeleton on the count number.

### E3. AI prompt block + agent fork

This is the most complex slice — needs Phase A's `/api/lists/ai-build` to be done.

**Files:**
- `src/features/views/components/builder/AiPromptBlock.tsx`
- `src/features/views/lib/ai-list-builder/client.ts` (SSE client; from B5)

**Acceptance:**
- Click "Build" → SSE call to `/api/lists/ai-build`.
- On `trace` events: show subtle progress dots.
- On `result`: populate fields, run client-side `flattenForUi`, show amber notice if `warnings.length > 0`.
- On `error`: red error notice; chips remain clickable.
- Suggested chip click → fill prompt + submit.

**Phase E test gate:**
```
npx vitest run src/features/views/components/builder src/app/api/lists/ai-build
npm run build
```
Manual test: Build each suggested chip end-to-end against a dev environment.
Commit "feat(saved-views): list builder modal + AI build".

---

## Phase F — Portfolio + Context Menus + Polish

**Owner agent:** general-purpose with `frontend-design` skill.

### F1. PortfolioView

**Files:**
- `src/features/views/components/PortfolioView.tsx`
- `src/features/views/components/PlanCardPortfolio.tsx`

**Acceptance:**
- Card grid `repeat(auto-fill, minmax(320px, 1fr))`, 14px gap.
- Tab strip "Active · N" / "Archived · N".
- New plan card on Active tab only (dashed border + plus icon).
- Click card → navigates to `/views/plans/[id]`.
- Archived card has "Unarchive" link.

### F2. Context menu (⋯) + hide/archive flows

**Files:**
- `src/features/views/components/GroupContextMenu.tsx`
- `src/features/views/components/HiddenFooter.tsx`

**Acceptance:**
- Hover row → ⋯ button fades in (120ms).
- Click ⋯ → popover with appropriate actions (Pin/Rename/Share + Hide/Archive/Delete).
- Mutation calls fire optimistic UI updates.
- Hidden footer toggles `showHidden` store flag.

### F3. SidebarFooter

**Files:** `src/features/views/components/SidebarFooter.tsx`

**Acceptance:**
- + New list dashed button → `openBuilder()`.
- 28px avatar (robin's-egg bg, plum initials).
- Name + pod text.

### F4. Mobile pass

**Acceptance per CLAUDE.md:**
- Below 768px viewport: sidebar collapses behind a hamburger.
- Scroll panel uses `pan-y` (not on map wrappers).
- `overscroll-behavior: none` on body.
- Tested in Safari Responsive Design Mode + on physical iPhone.

### F5. Tab-switching perf

Reading `src/features/views/lib/store.ts`'s subscriptions — confirm each component uses narrow selectors. Add memoization where flagged.

**Phase F test gate:**
```
npx vitest run
npm run build
```
Commit "feat(saved-views): portfolio + context menus + polish".

---

## Test Strategy Summary

Each phase commits with its own Vitest suite. Final full sweep:

| Layer | What we test |
|---|---|
| **Unit (Vitest)** | filter-tree flatten, useViewsRouter, store actions, ConditionRow operators, debouncing, AI client SSE parsing |
| **Integration (Vitest)** | All new API routes — auth, validation, happy path, edge cases (zero results, missing scope ref, malformed filter tree). AI route with mocked Anthropic SDK |
| **Build/Type** | `npm run typecheck` + `npm run build` clean at each phase gate |
| **Manual (mandatory)** | iPhone Safari smoke on new sidebar + table view + map view. AI build with each suggested chip. Hide/archive cycle |
| **Regression** | Confirm legacy `/?tab=plans` still loads `PlansView`. Confirm existing Map tab unaffected |

## Risk Register

| Risk | Mitigation |
|---|---|
| Two MapV2 instances mount simultaneously (legacy Map tab + new Map view) | `/views/*` is a separate App Router segment, not an overlay. Confirmed in spec |
| `/api/plans` slowdown with stats | Add index `Opportunity(planId, status)` in A1 migration |
| AI agent overruns tool-call budget | Hard cap at 6 (5 explorations + 1 terminal). Test |
| Filter-tree schema lock-in | `schemaVersion: 1` field per spec; migrate path documented if/when needed |
| Detail panel collides with MapV2 right panel | Mounted at `/views/*` only, not on legacy map. No collision |
| 45+ new files = code review fatigue | Phase-by-phase commits; each phase is independently reviewable |

## Dependencies Map

```
A1 (Prisma) ──┬─→ A3 (CRUD) ──┬─→ A4 (Preview)
              │               ├─→ A5 (AI route)
              │               ├─→ A7 (plan hide)
              ├─→ A6 (plans stats)
              └─→ A8 (entity detail)
A2 (filter-tree) ──→ A4, A5, E1, E2

B1, B2, B3 ──→ B4, B5
B5 ──→ B6
B6 + Phase A done ──→ C (Group canvas + views)
C done ──→ D (Detail panel)
A5 + E1 ──→ E2, E3
C done ──→ F (Portfolio + menus)
```

A and B run in parallel. Then C, D, E sequential. F can fan-out partially with D, E.

## Deferred / Out of Scope (logged for v1.1)

- Drag-to-reorder in sidebar groups
- Multi-source lists
- Cross-plan/list bulk operations
- CSV export of list contents
- Real-time collaborative updates
- Mobile-optimized portfolio card grid
- Sharing UI beyond `shared` boolean
