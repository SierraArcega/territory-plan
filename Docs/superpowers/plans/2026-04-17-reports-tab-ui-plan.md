# Reports Tab UI — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-17-reports-tab-ui-spec.md`
**Branch:** `worktree-reports-tab-ui`
**Tickets:** FD-7 (platform deep links — separate), FD-8 (agentic actions follow-up)

## Phase ordering

```
Phase 1 (backend) ─┐
                   ├─▶ Phase 2 (UI foundations) ─▶ Phases 4,5,6,7 (parallel) ─▶ Phase 8 (integration) ─▶ Phase 9 (tests)
Phase 3 (primitives) ─┘
```

Phases 4–7 are sibling trees with no inter-dependency and may be built in parallel by separate subagents.

---

## Phase 1: Backend foundations

### 1.1 `report_drafts` migration + Prisma model

**Files:**
- `prisma/migrations/20260417_report_drafts/migration.sql` (create)
- `prisma/schema.prisma` (modify)

**Migration SQL:**
```sql
CREATE TABLE "report_drafts" (
  "user_id"          UUID PRIMARY KEY REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "params"           JSONB NOT NULL,
  "conversation_id"  UUID,
  "chat_history"     JSONB,
  "last_touched_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Prisma additions:**
- `ReportDraft` model with `userId @id`, `params Json`, `conversationId String?`, `chatHistory Json?`, `lastTouchedAt @updatedAt`, `createdAt @default(now())`, relation `user UserProfile @relation("UserReportDraft", fields: [userId], references: [id], onDelete: Cascade)`, `@@map("report_drafts")`.
- `UserProfile`: add inverse `draft ReportDraft? @relation("UserReportDraft")`.

**Run:** `npx prisma format && npx prisma validate && npx prisma migrate dev --name report_drafts && npx prisma generate`.

### 1.2 Update excludedTables + readonly role

**Files:**
- `src/lib/district-column-metadata.ts` (modify `SEMANTIC_CONTEXT.excludedTables` — add `"report_drafts"`)
- `prisma/migrations/manual/create-readonly-role.sql` (add `report_drafts` to the explicit REVOKE list — the query tool must never see user drafts)

### 1.3 Saved-reports CRUD routes

All under `src/app/api/ai/query/reports/`. Auth via `getUser()` from `@/lib/supabase/server`. Prisma (not readonly pool) for mutations.

| Route | Method | Path | Body | Response | Auth |
|---|---|---|---|---|---|
| List | `GET` | `/api/ai/query/reports` | query: `tab, search, sort` | `{ reports: SavedReportListItem[] }` | any user |
| Create | `POST` | `/api/ai/query/reports` | `{ title, description?, params, conversationId? }` | `SavedReport` | any user |
| Get | `GET` | `/api/ai/query/reports/[id]` | — | `SavedReport` | any user |
| Update | `PATCH` | `/api/ai/query/reports/[id]` | `{ title?, description?, params?, isTeamPinned? }` | `SavedReport` | owner OR (admin if changing `isTeamPinned`) |
| Delete | `DELETE` | `/api/ai/query/reports/[id]` | — | 204 | owner OR admin |
| Run | `POST` | `/api/ai/query/reports/[id]/run` | — | `QueryResult` from `compileParams` | any user |

For `PATCH` pin-toggle: load `user.role` and reject with 403 if not `'admin'`. For `Run`: load the saved report's `params`, run `validateParams` → `compileParams` → `readonlyPool.query` (same as existing `/run`); update `lastRunAt` and increment `runCount` in a post-success `prisma.savedReport.update`.

Extract the shared run logic out of `src/app/api/ai/query/run/route.ts` into `src/features/reports/lib/execute-query.ts` so both routes call the same function.

### 1.4 Draft routes

`src/app/api/ai/query/draft/route.ts`:
- `GET` → find by `userId`, return `ReportDraft | null`.
- `PUT` → `{ params, conversationId?, chatHistory? }`, upsert via `prisma.reportDraft.upsert({ where: { userId }, create, update })`.
- `DELETE` → hard delete (no soft-delete needed).

**Tests (co-located `src/app/api/ai/query/__tests__/reports.test.ts`, `draft.test.ts`):**
- Auth: 401 when no user.
- Pin-toggle: 403 when non-admin.
- Validation: invalid params rejected (400) with errors array.
- Draft upsert idempotent.

---

## Phase 2: UI foundations

### 2.1 Zustand slice

**File:** `src/features/reports/lib/store.ts` (create).

Shape per spec. Narrow selectors. Single `set()` per public action (CLAUDE.md performance rule). Key pieces:

```ts
interface ReportsState {
  chatOpen: boolean;
  activePopover: string | null;
  lastRunSnapshot: QueryParams | null;
  dirty: boolean;
  // public actions each call set() exactly once
  toggleChat(): void;
  openPopover(id: string): void;
  closePopover(): void;
  markDirty(): void;
  snapshotRun(params: QueryParams): void;
  reset(): void;
}
```

Derived `isDirty(current, snapshot)` helper lives next to the store.

### 2.2 TanStack Query hooks

**File:** `src/features/reports/lib/queries.ts` (create).

Follow the pattern from `src/features/leaderboard/lib/queries.ts` (import `fetchJson`, `API_BASE`, explicit `staleTime`). Hooks enumerated in the spec, keys are arrays of primitives only — never pass the params object directly as a key segment (serialize to JSON string if needed, matching CLAUDE.md guidance). Mutations invalidate only the specific query keys they affect.

Draft mutation should be debounced in the calling component (not in the hook) — 500ms on chip edits and chat sends; immediate on discard.

### 2.3 Types + constants

**File:** `src/features/reports/lib/ui-types.ts` (create).

UI-only types: `ReportCardData`, `ChatMessageRole`, `ChipKind` (`"source"|"join"|"filter"|"columns"|"sort"`). Keep server types in `types.ts` (already exists).

---

## Phase 3: UI primitives

### 3.1 `ChipEditorPopover.tsx`

Floating popover, portal-rendered, closes on outside-click or Escape. Accepts `{ anchor, children, onClose }`. Used by every chip that needs inline editing.

### 3.2 Skeleton + icon primitives

**Files:**
- `src/features/reports/components/ui/SkeletonRow.tsx` — for the DataTable loading state
- `src/features/reports/components/ui/icons.tsx` — source/join/filter/sort dots, send arrow, etc. Match figma's hex-dot and play-triangle shapes. Use Lucide where possible per CLAUDE.md.

---

## Phase 4: Builder strip (parallel sibling)

**Dependencies:** Phase 2.

**Files (all under `src/features/reports/components/builder/`):**
- `BuilderStrip.tsx` — the horizontal container, composition only
- `SourceChip.tsx` — single-select table picker; lists registered tables from `TABLE_REGISTRY`
- `IncludingChips.tsx` — joined-table chips; "+ Add data" opens table picker filtered to valid joins (via `TABLE_REGISTRY[root].relationships`)
- `FilterChips.tsx` — filter rendering + "+ Add filter" opens column→op→value flow in `ChipEditorPopover`. Value input type switches on column's `format` from `ColumnMetadata`
- `ColumnsChip.tsx` — summary chip → popover with multi-select of table columns
- `SortChip.tsx` — summary chip → popover with column + direction toggle
- `StatusChip.tsx` — multi-state: "Ready to start" / "Setup changed — Run" / "Running…" / "Up to date"

Each chip reads from and writes back to the TanStack Query draft via `useUpsertDraftMutation` (debounced). Marks `dirty` in Zustand when params change after a run.

**Tests:** per-chip: chip renders correctly for populated/empty states; clicking "+ Add" opens popover; editing commits to the draft.

---

## Phase 5: Chat panel (parallel sibling)

**Dependencies:** Phase 2.

**Files:**
- `src/features/reports/components/ChatPanel.tsx` — container, collapsible header
- `src/features/reports/components/ChatMessage.tsx` — user/assistant bubble; renders optional "receipt" card for chip-fills
- `src/features/reports/components/ChatInput.tsx` — textarea + ↑ send, Shift+Enter for newline

Chat sends call `useSuggestMutation()` with the current question. On success, replace the draft's `params` (via `useUpsertDraftMutation`) with the returned params, append the receipt message to `chatHistory`, mark `dirty`. Loading state: 3-dot pulse bubble.

**Tests:** user send → suggest mutation → params update + receipt renders. Error path renders red-bordered bubble.

---

## Phase 6: Results area (parallel sibling)

**Dependencies:** Phase 2.

**Files:**
- `src/features/reports/components/ResultsArea.tsx` — state switcher
- `src/features/reports/components/EmptyHero.tsx` — first-open hero
- `src/features/reports/components/PreRunCard.tsx` — center card + Run CTA
- `src/features/reports/components/DataTable.tsx` — TanStack Table wrapper, sticky header, pagination footer, format cells via `src/features/shared/lib/format.ts`. **No checkbox column** (that's FD-8).
- `src/features/reports/components/ErrorBanner.tsx` — inline error with Retry button

ResultsArea reads a discriminated state from `useRunQueryMutation()` + Zustand `dirty`:
- mutation idle + no snapshot + no draft params → EmptyHero
- mutation idle + draft params ready + no snapshot → PreRunCard
- mutation pending → skeleton DataTable (12 rows)
- mutation success → DataTable with data
- mutation error → ErrorBanner over last-good rows (if any)

**Tests:** state machine transitions render correct child. DataTable renders row data with formatted currency.

---

## Phase 7: Library + Save (parallel sibling)

**Dependencies:** Phase 2.

**Files:**
- `src/features/reports/components/Library.tsx` — top-level library view
- `src/features/reports/components/LibraryTabs.tsx` — All/Mine/Team/Pinned tab bar with counts
- `src/features/reports/components/ReportCard.tsx` — single row with icon, title, badges, chip preview, meta, Run button, ⋯ menu
- `src/features/reports/components/SaveModal.tsx` — name + description + Private/Team radio + admin-gated pin checkbox

Library calls `useSavedReportsQuery({tab, search, sort})`. Run button: `useRunReportMutation(id)` then `router.push('/reports?report=' + id)` to open. ⋯ menu: Rename (inline), Duplicate (create new with same params), Delete (confirm modal).

SaveModal: on save, call `useSaveReportMutation()`, close modal, toast success, update breadcrumb to saved title, flip badge from "Draft" to "Saved". Pin checkbox: `role === 'admin'` check comes from a new `useCurrentUser()` hook backed by an existing session endpoint (or inline via Supabase user's app_metadata — find what exists).

**Tests:** Library filters correctly by tab. SaveModal disables Save until title filled. Pin checkbox hidden for non-admins.

---

## Phase 8: Page + integration

**Dependencies:** Phases 4, 5, 6, 7.

### 8.1 Page route

**File:** `src/app/reports/page.tsx` (create).

```tsx
export default function ReportsPage() {
  return <ReportsView />;
}
```

With a `"use client"` wrapper module because `ReportsView` uses Zustand + TanStack.

### 8.2 `ReportsView.tsx` composition

**File:** `src/features/reports/components/ReportsView.tsx`.

- Reads `useSearchParams()` for `report` and `view` params.
- If `view === 'library'` → render `<Library />`.
- Else render Builder+Chat+Results layout.
- If `report` param present → fetch via `useSavedReportQuery(id)`, hydrate Zustand + draft on first render.
- Copy-link button in TopBar → `navigator.clipboard.writeText(absoluteUrl + '?report=' + id)` + toast.

### 8.3 Sidebar nav addition

**File:** `src/features/shared/components/navigation/Sidebar.tsx` (modify).

Add `"reports"` to the `TabId` union. Add a `ReportsIcon` component (Lucide `BarChart3` or similar). Add the tab entry to the main nav list — placed between "tasks" and "leaderboard" to sit in a logical "data & analytics" cluster. Clicking it navigates to `/reports`.

Note: no "Progress" item currently exists in the sidebar (verified during planning), so this is a net-add, not a swap. Update the user's memory note about "Replace Progress with Reports" — no action needed beyond adding the new nav entry.

### 8.4 Deep link tests

Unit test: rendering `<ReportsView />` with `?report=42` calls `useSavedReportQuery(42)` and hydrates the store. Integration test via Playwright (if time allows — otherwise defer).

---

## Phase 9: Tests

Tests co-located in `__tests__/` next to source files per CLAUDE.md.

### Summary of new test files

| Test file | What it covers |
|---|---|
| `src/app/api/ai/query/__tests__/reports.test.ts` | All 6 saved-report routes: auth, owner-only delete, admin-only pin, validation |
| `src/app/api/ai/query/__tests__/draft.test.ts` | GET/PUT/DELETE draft routes |
| `src/features/reports/lib/__tests__/store.test.ts` | Zustand state transitions (`markDirty`, `snapshotRun`, `reset`) |
| `src/features/reports/lib/__tests__/queries.test.ts` | Query key stability — same inputs → same key string |
| `src/features/reports/lib/__tests__/execute-query.test.ts` | Extracted execute-query helper (reused by run + saved-report-run) |
| `src/features/reports/components/__tests__/BuilderStrip.test.tsx` | Renders populated state; "+ Add filter" opens popover |
| `src/features/reports/components/__tests__/ChatPanel.test.tsx` | Suggest flow; error bubble on fail |
| `src/features/reports/components/__tests__/ResultsArea.test.tsx` | State switcher transitions |
| `src/features/reports/components/__tests__/DataTable.test.tsx` | Renders rows; format helper integration; pagination controls |
| `src/features/reports/components/__tests__/Library.test.tsx` | Tab filter; empty state; Run button wiring |
| `src/features/reports/components/__tests__/SaveModal.test.tsx` | Disabled-when-empty; pin hidden for non-admins |
| `src/features/reports/components/__tests__/ReportsView.test.tsx` | Deep-link hydration; Library vs Builder view branching |

**Target:** 80%+ statement coverage on new code. Run existing tests to confirm nothing regressed. `npm run build` must succeed.

---

## Execution strategy

- **Solo implementer path:** execute phases sequentially. Estimated 2-3 days focused work.
- **Subagent-parallel path** (recommended):
  1. Agent A: Phase 1 (backend routes + migration + test) — blocking.
  2. After A completes: Agents B, C, D, E in parallel:
     - Agent B: Phase 2 + 3 (foundations + primitives) — blocks 4-7
     - Agent C: Phase 4 (builder strip) — depends on B
     - Agent D: Phase 5 + 6 (chat + results) — depends on B
     - Agent E: Phase 7 (library + save) — depends on B
  3. Main agent: Phase 8 + 9 (integration + tests) — depends on all above.

## Success checkpoints

- After Phase 1: `npx prisma validate` clean, routes typecheck, `vitest run src/app/api` passes.
- After Phase 2: hooks typecheck; Zustand tests pass.
- After Phase 6: `ResultsArea` renders all 5 states in isolation (Storybook or raw test render).
- After Phase 8: `npm run dev` → open `/reports` → fill builder via chat → Run → see rows → Save → reopen via `/reports?report=<id>` → matches.
- After Phase 9: full test suite green, build clean.
