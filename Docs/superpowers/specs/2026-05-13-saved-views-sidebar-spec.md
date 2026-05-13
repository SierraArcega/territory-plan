# Feature Spec: Saved Views — Plans & Lists Sidebar

**Date:** 2026-05-13
**Slug:** saved-views-sidebar
**Branch:** `worktree-saved-views-sidebar`
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar/`

## Source Materials
- Design handoff (in this worktree): `design_handoff_activities_calendar/design_handoff_saved_views/`
  - `README.md` — narrative spec, IA, fidelity targets, tokens, backend notes
  - `app-unified.jsx` — main shell (sidebar + group canvas + portfolio + click routing)
  - `app-shared.jsx` — Map/Table/Kanban view bodies + sample data
  - `district-feeds.jsx` — Vacancies/News/RFPs view bodies
  - `district-panel.jsx` — district right-side detail panel
  - `detail-panel.jsx` — generic detail panel (contacts/opps/vacancies/news/rfps)
  - `list-builder.jsx` — list-builder modal with AI + flat condition editor
  - `design-system/colors_and_type.css` — token reference
- Backend context: `Docs/superpowers/specs/2026-05-13-saved-views-sidebar-backend-context.md`

## Requirements

**Problem.** Reps today have a `Plans` tab (committed territory) and no first-class way to save ad-hoc filtered queries. They lose context between sessions, can't share working sets, and have to recreate filters manually.

**Solution.** Unify Plans and saved-query Lists into a single `My Views` sidebar section. Each plan/list renders through 8 view types (Map, Table, Kanban, Contacts, Opps, Vacancies, News, RFPs). A list builder modal accepts natural-language prompts (via the reports agent) and translates them to a structured filter tree. Clicking any row anywhere opens a right-side detail panel.

**Scope decisions** (locked):
1. Full handoff in one feature — sidebar, builder, portfolio, all 8 views, all 6 detail panels.
2. AI list builder reuses `/reports` agent infrastructure (system-prompt fork + `emit_list_spec` terminal tool).
3. New sidebar replaces `Sidebar.tsx`. Old `?tab=plans` URL remains accessible (legacy `PlansView` left mounted as a fallback, no UI links to it).
4. Dedicated `/views/*` routes (App Router segments), not query-param tabs.

**Success criteria.**
- A rep can browse all their plans + lists from one sidebar section.
- A rep can create a new list from natural-language prompt in under 10 seconds.
- A rep can open any plan/list and switch between 8 view types without page reload.
- Clicking any row in any view opens the detail panel without losing list state.
- Hide/archive/show-hidden flows work per user without affecting others.
- Old `/?tab=plans` URL still loads the legacy `PlansView` (compatibility hold).

## Visual Design

**Fidelity:** high. Tokens, sizes, spacing, animations all defined in the README. Production must match within Fullmind token equivalents (see `Documentation/UI Framework/tokens.md`).

**Architectural decisions.**
- Replace existing `Sidebar.tsx` with a new `ViewsSidebar.tsx` at 252px wide. Top-nav items (Home, Map, Activities, Tasks, Leaderboard, Reports, LHF, Resources, Profile, Admin) live at the top of the same column. The `Plans` tab is removed from the top nav — its role is taken by the new `My Views` section directly below.
- Group canvas (header + tabs + body) is a single shared wrapper component that all 8 views render inside.
- Detail panel is mounted at the `/views/*` route level (not inside MapV2 or any view). 380px right-side slide-in, shared across kinds.
- All measurements / colors / fonts use Fullmind tokens (plum #403770, coral #F37167, robin's-egg #C4E7E6, etc.). Per `tokens.md`, never use Tailwind grays — use plum-derived neutrals (#F7F5FA, #EFEDF5).
- Density toggle (compact / comfortable) ships per the prototype's TweaksPanel — affects sidebar row padding only. State persists to localStorage.

## URL Structure

| Path | View |
|---|---|
| `/views` | All-plans portfolio dashboard |
| `/views?archived=1` | Portfolio with Archived tab selected |
| `/views/plans/[planId]` | Plan, default view (first in the plan's views array) |
| `/views/plans/[planId]/[viewId]` | Plan, specific view |
| `/views/plans/[planId]/[viewId]?detail=[kind]:[id]` | Plan view with detail panel open |
| `/views/lists/[listId]` | List, default view |
| `/views/lists/[listId]/[viewId]` | List, specific view |
| `/views/lists/[listId]/[viewId]?detail=[kind]:[id]` | List view with detail panel open |
| `/?tab=plans` (legacy) | Legacy `PlansView` — kept mounted, no internal links |

`viewId` is one of `map | table | kanban | contacts | opps | vacancies | news | rfps`. Per-group default view persists to localStorage keyed by `group:[id]:lastView` so reopening a plan defaults to where the user left it.

## Component Plan

### New feature directory: `src/features/views/`

```
src/features/views/
├── components/
│   ├── ViewsSidebar.tsx               <- 252px unified sidebar (replaces Sidebar.tsx)
│   ├── SidebarTopNav.tsx              <- Home/Map/Activities/etc. tabs
│   ├── MyViewsSection.tsx             <- "My views" section header + All-plans + Plans + Lists
│   ├── PlansSubsection.tsx            <- "🎯 Plans" expandable list
│   ├── ListsSubsection.tsx            <- "📋 Lists" expandable list
│   ├── GroupRow.tsx                   <- Plan or List row (caret + accent + label + progress ring/icon)
│   ├── GroupContextMenu.tsx           <- ⋯ popover with Pin/Rename/Share/Hide/Archive/Delete
│   ├── GroupViewList.tsx              <- Indented view list shown when group is expanded
│   ├── HiddenFooter.tsx               <- "Show hidden (N)" + "Archived plans · N" footer affordances
│   ├── SidebarFooter.tsx              <- + New list button + profile/pod card
│   │
│   ├── GroupCanvas.tsx                <- Header + view tabs strip + body wrapper for all 8 views
│   ├── GroupHeader.tsx                <- Eyebrow + title + view-type + stats grid OR filter chips
│   ├── ViewTabsStrip.tsx              <- Horizontal scrollable tabs with + button
│   ├── PortfolioView.tsx              <- All-plans dashboard (card grid)
│   ├── PlanCardPortfolio.tsx          <- 320px+ plan card with 3px accent stripe
│   │
│   ├── views/
│   │   ├── MapViewContainer.tsx       <- Mounts MapV2Container with district filter
│   │   ├── TableView.tsx              <- District table with signal dot + tier badge + stage pill
│   │   ├── KanbanView.tsx             <- 240px columns, stage-grouped district cards
│   │   ├── ContactsView.tsx           <- Avatar + stage pill + tier letter rows
│   │   ├── OppsView.tsx               <- Title + district + stage + ARR + close date
│   │   ├── VacanciesView.tsx          <- District + role + signal pill + posted + status
│   │   ├── NewsView.tsx               <- Card feed (not table) — district block + headline
│   │   └── RfpsView.tsx               <- District + title + category + due + value
│   │
│   ├── detail/
│   │   ├── DetailPanel.tsx            <- 380px right slide-in shell (dispatches on kind)
│   │   ├── DistrictDetailContent.tsx  <- Reuses fields from existing DistrictDetailPanel
│   │   ├── ContactDetailContent.tsx
│   │   ├── OppDetailContent.tsx
│   │   ├── VacancyDetailContent.tsx
│   │   ├── NewsDetailContent.tsx
│   │   └── RfpDetailContent.tsx
│   │
│   └── builder/
│       ├── ListBuilderModal.tsx       <- 880px modal shell
│       ├── AiPromptBlock.tsx          <- Gradient prompt input + suggested chips + Build button
│       ├── SourcePicker.tsx           <- 6-card grid (Districts/Contacts/Opps/Vacancies/News/RFPs)
│       ├── ConditionsEditor.tsx       <- Flat AND list with WHERE/AND labels
│       ├── ConditionRow.tsx           <- Field/Op/Value/Trash row (handles `any` kind chip-pills)
│       ├── ScopeEditor.tsx            <- 3-tab scope (Any district / Matching rules / In a plan or list)
│       ├── SaveAsBlock.tsx            <- Name input + Share checkbox
│       └── LivePreviewPane.tsx        <- Sticky right-side preview (count + 3 sample items)
├── hooks/
│   ├── useViewsRouter.ts              <- Parse /views URL → {kind, groupId, viewId, detailKind, detailId}
│   └── useGroupDefaultView.ts         <- localStorage-backed last-view-per-group
└── lib/
    ├── store.ts                       <- Zustand store: open groups, hoverId, menuGroupId, showHidden, builderState
    ├── queries.ts                     <- TanStack Query hooks for plans, lists, view-specific entity lists
    ├── filter-tree.ts                 <- Filter tree types + flatten (AND→unwrap, OR→`any`)
    ├── view-types.ts                  <- ViewId, ViewSpec, ViewIcon mapping
    └── ai-list-builder.ts             <- Client-side SSE wrapper for /api/lists/ai-build
```

### Components to reuse (don't rebuild)

| Existing component | Reuse for |
|---|---|
| `MapV2Container` (`features/map/components/`) | Map view — mount with `districtLeaidsFilter` prop |
| `DataGrid` (`features/shared/components/DataGrid/`) | Base for Table/Contacts/Opps/Vacancies/RFPs views |
| `MultiSelect`, `AsyncMultiSelect` | ConditionRow value picker (where multi-select makes sense) |
| `EditableSelect` | Field/Op pickers in ConditionRow |
| Existing `DistrictDetailPanel` field structure | DistrictDetailContent (reuse query hook + field rendering) |
| Reports agent loop (`features/reports/lib/agent/agent-loop.ts`) | Fork target for AI list builder |
| Existing `LeaderboardNavWidget`, `LeaderboardModal` | Keep in new sidebar verbatim |

### Components to remove from main UI (kept in code as fallback)

- `Sidebar.tsx` (`features/shared/components/navigation/`) — replaced by `ViewsSidebar.tsx`. **Do not delete** — `PlansView` still imports from `TabId` type. Update `app/page.tsx` to use the new sidebar instead.
- `PlansView.tsx` — kept; reachable only via `?tab=plans` URL.

## Backend Design

See full context at `Docs/superpowers/specs/2026-05-13-saved-views-sidebar-backend-context.md`. Summary:

### New Prisma Models

```prisma
model SavedList {
  id              String   @id @default(uuid())
  ownerId         String   @map("owner_id")
  name            String
  source          String   // 'districts' | 'contacts' | 'opps' | 'vacancies' | 'news' | 'rfps'
  filterTree      Json     @map("filter_tree")        // {kind: 'and', children: [...]}
  scopeMode       String   @map("scope_mode")         // 'none' | 'rules' | 'reference'
  scopeFilterTree Json?    @map("scope_filter_tree")
  scopeRefKind    String?  @map("scope_ref_kind")     // 'plan' | 'list' when scope_mode = 'reference'
  scopeRefId      String?  @map("scope_ref_id")
  shared          Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  owner           Profile  @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  hidden          SavedListHidden[]

  @@index([ownerId])
  @@index([shared])
  @@map("saved_lists")
}

model SavedListHidden {
  listId  String @map("list_id")
  userId  String @map("user_id")
  hiddenAt DateTime @default(now()) @map("hidden_at")
  list    SavedList @relation(fields: [listId], references: [id], onDelete: Cascade)
  @@id([listId, userId])
  @@map("saved_list_hidden")
}

// Optional, per-user plan hiding (does NOT affect archive flag)
model TerritoryPlanHidden {
  planId   String @map("plan_id")
  userId   String @map("user_id")
  hiddenAt DateTime @default(now()) @map("hidden_at")
  plan     TerritoryPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@id([planId, userId])
  @@map("territory_plan_hidden")
}
```

`TerritoryPlan` already has `status` (covers `archived`). No column adds needed on `TerritoryPlan` itself for v1 — progress/pipeline/contacts/opps counts are computed on-read.

### New / Extended API Routes

| Route | Purpose |
|---|---|
| `GET /api/lists` | List all lists visible to current user (own + shared). Per-user hidden filtered unless `?showHidden=1`. |
| `POST /api/lists` | Create new list from `{name, source, filterTree, scopeMode, scopeFilterTree?, scopeRefKind?, scopeRefId?, shared}`. |
| `GET /api/lists/[id]` | Single list with computed `count` and 3-row `samplePreview`. |
| `PATCH /api/lists/[id]` | Edit name/filterTree/scope/shared. Owner only. |
| `DELETE /api/lists/[id]` | Owner only. |
| `POST /api/lists/[id]/hide` | Per-user hide; idempotent. Body: `{hidden: bool}`. |
| `POST /api/lists/preview` | Body: `{source, filterTree, scopeMode, scopeFilterTree?, scopeRefKind?, scopeRefId?}`. Returns `{count, sample: [3 items]}`. Debounced from UI (300ms). |
| `POST /api/lists/ai-build` (SSE) | Forks `/api/ai/query/stream` pipeline. Custom system prompt + `emit_list_spec` terminal tool. Returns structured `{source, filterTree, scope, name}` + amber notice if any AND/OR collapse failed. |
| `GET /api/plans` (extended) | Adds `progress` (0-100), `pipelineValue`, `contactsCount`, `oppsCount` per plan. Computed by joining `Opportunity` + `Contact` filtered to plan's districts. |
| `POST /api/plans/[id]/hide` | Per-user hide for plans. Body: `{hidden: bool}`. |
| `GET /api/opportunities/[id]` | Detail-panel data. NEW. |
| `GET /api/vacancies` | List endpoint scoped by district set. NEW. |
| `GET /api/news/[id]` | Detail-panel data. NEW. |
| `GET /api/rfps/[id]` | Detail-panel data. NEW. |

### AI List Builder — Forking the Reports Agent

The existing agent loop (`features/reports/lib/agent/agent-loop.ts`) is parameterized in v1:
- Add a `terminalTool` config to `runAgentLoop()` accepting `{name, description, schema}`.
- Add `agentVariant: 'reports' | 'list-builder'` to select system prompt.
- Add new system prompt at `features/views/lib/ai-list-builder/system-prompt.ts` describing the filter-tree schema and entity model.
- Add `emit_list_spec` tool: when the model calls it, the loop terminates and the args are streamed back to the client as a `result` event.
- Client (`ai-list-builder.ts`) parses the structured spec, runs flatten logic (AND-unwrap, OR-of-same-field → `any`), produces amber notice for anything ungrouped.

Tools available inside the list-builder loop are read-only schema introspection (no `run_sql` for now to keep blast radius small):
- `describe_entity(source)` — returns field list with types
- `sample_values(source, field, limit?)` — returns top-N enum-ish values
- `emit_list_spec` — terminal

## States

### Loading
- Sidebar: skeleton rows (4 placeholder rows at default density) until `/api/plans` + `/api/lists` resolve.
- Group canvas header: animated pulse on title row + stat values.
- View body: each view has its own loading state (table → 6 skeleton rows; map → existing MapV2 spinner; kanban → 3 placeholder columns; cards → 3 placeholder cards).
- List builder live preview: spinner over the count while `/api/lists/preview` is in flight.
- AI Build button: shows spinner + "Thinking…" text; suggested chips disable.

### Empty
- Sidebar with no plans + no lists: "My views" section shows an inline empty state below the header: "No views yet — create your first list" with a primary button calling `openBuilder()`.
- Plan with no districts: group canvas body shows "No districts in this plan yet" empty state with primary CTA "Add districts" routing to the existing `PlanWorkspace` flow.
- List with zero matches: shows the configured filter chips + empty state "No matches — try loosening filters" with "Edit list" secondary action.

### Error
- API failure on plans/lists fetch: sidebar shows a single muted retry row "Couldn't load views — retry".
- View-body fetch error: show inline error card with retry.
- AI Build failure: show red error notice in the prompt block ("Couldn't generate — try rephrasing"). Suggested chips remain clickable.

## Interactions

(All match prototype. Highlights below for spec completeness.)

- Click group header → toggle expand/collapse (chevron rotates -90°).
- Click view inside expanded group → set active view, navigate to its route.
- Click any row in any view → push `?detail=[kind]:[id]` to URL → DetailPanel slides in.
- Click X in panel OR click outside panel area → remove `detail` param.
- Hover plan/list row → ⋯ button fades in; click opens context menu popover.
- "Hide from sidebar" → POST `/hide` mutation → row disappears; "Show hidden (N)" appears in footer.
- "Archive plan" → PATCH plan status=archived → row disappears; "Archived plans · N" footer link routes to `?archived=1`.
- "+ New list" anywhere → opens list builder modal with empty seed.
- Canvas "Save as list" → opens builder with `prefilledName` and current filters as seed (when on a List view).
- AI Build button → calls `/api/lists/ai-build` SSE → on `result` event, populate source/conditions/scope fields. Amber notice if flatten produced warnings.
- "Add condition" → append default rule.
- Trash any rule → remove from list.
- "Create list" → POST `/api/lists` → close modal → push `/views/lists/[newId]/[defaultView]`.

## Performance & UX Defaults

Per `CLAUDE.md`:
- **Pagination:** Each entity view (Table, Contacts, Opps, Vacancies, News, RFPs) paginates at 50; "Show more" appends in 50s. Filter-hint banner appears at 200+ results.
- **Stable query keys:** All TanStack Query keys use serialized primitives — list filter trees are JSON-stringified into the key.
- **Default owner = current user:** List builder pre-fills `owner_id` from `useProfile()`. Plan filter dropdowns on the canvas header default to current user.
- **Show loading state, don't hide UI:** Filter dropdowns render disabled placeholders during load.
- **Conditional rendering > conditional fetching:** Each view component owns its own query. Switching tabs mounts/unmounts the view (gc-cached by TanStack).
- **Clean up on unmount:** Detail panel and builder modal reset their internal state on close.

## Mobile

- New sidebar collapses behind a hamburger trigger at viewport widths under 768px. Per `CLAUDE.md`, never set `overflow: hidden` on body; use `overscroll-behavior: none`.
- Inner panel scroll uses `touch-action: pan-y` + `-webkit-overflow-scrolling: touch` (handled in `globals.css`).
- Sidebar overlay does NOT wrap the map — `pan-y` must not be applied to MapV2 containers.
- Smoke-test the Map view after AppShell layout change.

## Out of Scope (v1)

- Deleting legacy `PlansView` or `Sidebar.tsx` — both kept for compatibility.
- Mobile-optimized layout for portfolio cards (responsive grid auto-fits; no special mobile design).
- Real-time updates for plan stats (computed on read; refetch reflects updates).
- Sharing permissions UI beyond `shared` boolean (no per-user grants for v1).
- Multi-kind lists (one source per list for v1).
- Cross-plan/list bulk operations.
- Drag-to-reorder in sidebar groups (defer to v1.1).
- Export of list contents to CSV.

## Risk Notes

1. **MapV2 mounting twice.** If a user has the Map tab open AND opens a Plan's Map view in `/views`, two MapLibre instances would mount simultaneously. We mitigate by routing `/views/*` as a full-page route (replaces `Map` tab content), not as an overlay. Confirm in spec review.
2. **`/api/plans` heavier with new computed fields.** Mitigate with index on `Opportunity(planId, status)` and `Contact.districtLeaid`. Backend agent will validate query plans.
3. **List builder AI cost.** Each Build invocation runs the agent loop. We cap at a single tool call (`emit_list_spec`) for terminal — schema intros + emit only. Should keep cost <$0.01 per build.
4. **Filter tree schema lock-in.** Once persisted in DB, changing the JSON shape requires migration. Define schema strictly in `filter-tree.ts` with a `schemaVersion: 1` field per row.
5. **Detail panel state collision with MapV2's existing right panel.** Since `/views/*` is full-page and not overlaid on the map, no collision in v1.

## Tests

Unit:
- `filter-tree.ts` flatten logic — AND-unwrap, OR→`any`, amber-notice cases.
- `useViewsRouter` URL parsing — every URL shape from the table above.
- ConditionRow renders the right operator menu per field type.
- LivePreviewPane debounces correctly (uses fake timers).

Integration:
- API: `POST /api/lists/preview` returns count + sample for a known filter.
- API: `POST /api/lists/ai-build` end-to-end with a mocked agent response.
- API: extended `GET /api/plans` includes the four computed fields and matches a known plan's aggregates.
- E2E (Playwright if existing harness available): create a plan → expand it → switch views → click a row → see detail panel → close.

Manual:
- iPhone Safari smoke test on the new sidebar + a plan's Table view (per `CLAUDE.md` mobile testing).
- AI Build with each of the 4 suggested prompt chips.
- Hide / show-hidden / archive / unarchive cycle.

## File Inventory (estimate)

- **New files:** ~45 (37 components + 4 hooks + 4 lib files)
- **Modified files:** ~10 (`app/page.tsx`, `Sidebar.tsx` replaced, plans queries extended, `agent-loop.ts` parameterized, `next.config.ts` route segment additions, `prisma/schema.prisma`, 1 new migration)
- **API routes:** 10 new + 1 extended

This is large. Expect 2-3 implementer-agent passes split by surface (sidebar+routes, list-builder+AI, detail panels, backend models+routes).

## Compliance Checklist
- [ ] Read `Documentation/UI Framework/tokens.md` before frontend implementation.
- [ ] Use plum-derived neutrals; never Tailwind gray.
- [ ] Lucide icons (`currentColor`) only.
- [ ] `whitespace-nowrap` on text in flex/grid; narrow-width resilience per tokens.md.
- [ ] All new API routes use Supabase auth + return `NextResponse.json`.
- [ ] All new Zustand subscriptions use narrow selectors.
- [ ] Test on iPhone Safari before claiming done.
