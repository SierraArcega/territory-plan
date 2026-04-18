# Reports Tab UI — Feature Spec

**Date:** 2026-04-17
**Slug:** reports-tab-ui
**Branch:** `worktree-reports-tab-ui` (worktree of `feat/db-readiness-query-tool`)
**Linear follow-ups:** [FD-7](https://linear.app/fullmindlearning/issue/FD-7) (platform deep links), [FD-8](https://linear.app/fullmindlearning/issue/FD-8) (MAP-3 agentic actions)

## Summary

A builder-primary chat+builder hybrid query tool for Fullmind sales reps. Replaces the existing Progress nav item. Users ask natural-language questions that populate a structured builder (source/filters/columns/sort chips); the builder drives an explicit Run action that executes a read-only query and displays results in a sortable table. Saved reports are library-browsable by the whole team; admins pin to Team Reports. No SQL is ever shown to the user.

## Requirements (from Stage 1 Q&A)

| Question | Decision |
|---|---|
| Saved-report sharing | All users see all saved reports; admins pin to Team Reports |
| Empty state | Builder + chat (no suggested prompts), breadcrumb "New report" |
| Agentic actions | **Out of scope this PR** (moved to FD-8) |
| Form factors | Desktop + tablet (≥768px); no phone |
| Draft retention | No retention — drafts persist until user explicitly discards |
| Navigation | Replace "Progress" sidebar item with "Reports" |

## Visual Design

**Layout** (desktop, 1440×900 reference in figma):
- Existing app sidebar (220px, plum `#403770`), Reports replaces Progress as active nav item.
- Main area (1220px) vertically stacked: TopBar (76px) → Builder Strip (97px) → Content Split (rest).
- Content Split: Results (840px, flexes) + Chat Panel (380px, collapsible).

**Builder Strip**: horizontal sections separated by 1px plum-300 dividers: SOURCE | INCLUDING | FILTERS | COLUMNS | SORT | (flex) | STATUS/RUN.
- SOURCE: single table selector chip.
- INCLUDING: joined-table chips with × remove + "+ Add data" filler.
- FILTERS: per-filter chip ("State: Ohio" with ×) + "+ Add filter" filler.
- COLUMNS: summary chip ("6 columns ▾") → popover to pick.
- SORT: summary chip ("Pipeline ↓ ▾") → popover.
- STATUS: dynamic — "Ready to start" / "Setup changed" / "Up to date" / prominent "▶ Run" when dirty.

**Chat Panel** (380px):
- Header with pulse-dot + "Ask about your territory" + collapse caret.
- Messages: user bubbles right-aligned plum-bg white-text; assistant bubbles left-aligned plum-50-bg dark-text; "Populated builder: 2 filters, 4 columns" receipt cards when Claude fills chips; loading state shows 3-dot pulse + "Updating chips…".
- Input pinned to bottom with ↑ send button; "Shift + Enter for a new line" hint.

**Results Area**:
- Pre-run: centered card w/ amber play icon, "Ready to run", expected row count, big "▶ Run query" CTA.
- Ready: row count header ("47 districts joined with 2 sources") + Export/More actions + DataTable with sticky header, alternating row backgrounds, pagination.
- Empty (initial): centered hero, "Let's build your first report" + breadcrumb = "New report".

**Library View**:
- Header: "Reports" + search input + "+ New report" CTA.
- Tab bar: All (N) | My reports (N) | Team (N) | Pinned (N) with sort dropdown on right.
- Report cards: pinned-star or default-hex icon + title + Team/Private/Pinned badges + description + source-chip preview + row count + "Xh ago · by Name" + Run button + ⋯ menu.

**Save Modal**:
- 520px wide, rounded-2xl, shadow-xl, with 45% plum backdrop.
- Fields: NAME (autofocus), DESCRIPTION (optional), VISIBILITY (Private/Team radio cards), Pin-as-team-default checkbox (admins only, hidden for non-admins).
- Footer: "Re-running this report is free — SQL runs without Claude" helper + Cancel + Save Report buttons.

**Colors/typography/radii**: all from `Documentation/UI Framework/tokens.md`. Plum palette only (no Tailwind grays). Plus Jakarta Sans, 5-tier scale. `rounded-full` chips, `rounded-lg` cards/buttons, `rounded-2xl` modal. `shadow-sm` cards, `shadow-xl` modal.

## Component Plan

### New components (all under `src/features/reports/components/`)

| Component | Role |
|---|---|
| `ReportsView.tsx` | Page-level container. Reads URL params, dispatches between Builder+Chat+Results view and Library view. |
| `TopBar.tsx` | Breadcrumbs, Draft/Saved badge, More menu, Save button. |
| `BuilderStrip.tsx` | Horizontal strip hosting the chip sections. |
| `builder/SourceChip.tsx` | Table picker. |
| `builder/IncludingChips.tsx` | Join-table chips + add. |
| `builder/FilterChips.tsx` | Filter chips + add. |
| `builder/ColumnsChip.tsx` | Column-picker popover trigger. |
| `builder/SortChip.tsx` | Sort selector. |
| `builder/StatusChip.tsx` | Status + Run CTA. |
| `ChipEditorPopover.tsx` | Shared inline-edit popover for any chip. |
| `ChatPanel.tsx` | Chat pane container (collapsible). |
| `ChatMessage.tsx` | User/assistant message bubble. |
| `ChatInput.tsx` | Text input + send button. |
| `ResultsArea.tsx` | State switcher: EmptyHero \| PreRunCard \| DataTable \| ErrorBanner (+ skeleton). |
| `DataTable.tsx` | TanStack Table wrapper, sticky headers, pagination. **Read-only this PR** — checkbox column is FD-8. |
| `EmptyHero.tsx` | "Let's build your first report" initial state. |
| `PreRunCard.tsx` | Center card with Run CTA. |
| `Library.tsx` | Library view container. |
| `LibraryTabs.tsx` | All/Mine/Team/Pinned tab bar. |
| `ReportCard.tsx` | Individual saved-report row. |
| `SaveModal.tsx` | Save-as-report dialog. |
| `DeepLinkButton.tsx` | Copy `/reports?report=<id>` to clipboard with toast. |

### State (Zustand slice — `src/features/reports/lib/store.ts`)

```ts
interface ReportsState {
  // UI-only state
  chatOpen: boolean;
  activePopover: string | null;
  dirty: boolean;                      // draft differs from last-run snapshot
  lastRunSnapshot: QueryParams | null; // for dirty check

  // setters use a single set() call per action (CLAUDE.md convention)
  toggleChat, setActivePopover, markDirty, markClean, snapshotRun, reset
}
```

URL (`/reports` with `?report=<id>` / `?view=library`) is the source of truth for `selectedReportId` and `viewMode`. TanStack Query keys derive from URL.

### Queries/mutations (`src/features/reports/lib/queries.ts`)

| Hook | Route | Purpose |
|---|---|---|
| `useDraftQuery()` | `GET /api/ai/query/draft` | Current user's single draft. |
| `useUpsertDraftMutation()` | `PUT /api/ai/query/draft` | Debounced 500ms on chip edits / chat sends. |
| `useDiscardDraftMutation()` | `DELETE /api/ai/query/draft` | Discard current draft. |
| `useSavedReportsQuery({tab,search,sort})` | `GET /api/ai/query/reports` | Library list. |
| `useSavedReportQuery(id)` | `GET /api/ai/query/reports/[id]` | Hydrate from URL param. |
| `useSaveReportMutation()` | `POST /api/ai/query/reports` | From Save Modal. |
| `useUpdateReportMutation(id)` | `PATCH /api/ai/query/reports/[id]` | Rename, edit params, pin. |
| `useDeleteReportMutation(id)` | `DELETE /api/ai/query/reports/[id]` | Owner or admin only. |
| `useRunReportMutation(id)` | `POST /api/ai/query/reports/[id]/run` | Replay saved params via existing `/run` internals. |
| `useRunQueryMutation()` | `POST /api/ai/query/run` | Already exists. Use for draft params. |
| `useSuggestMutation()` | `POST /api/ai/query/suggest` | Already exists. Use from chat send. |

### Reused from shared

- `src/features/shared/components/layout/` — app shell and sidebar.
- `src/features/shared/components/navigation/Sidebar.tsx` — modify to swap Progress → Reports.
- `src/features/shared/lib/format.ts` — currency/number formatting for DataTable cells.
- `src/features/shared/lib/cn.ts` — Tailwind merge.
- `@tanstack/react-table` — DataTable (already installed).

## Backend Design

### New API routes (all under `src/app/api/ai/query/`)

Pattern: auth via `getUser()`, Prisma for reads/writes, standard NextResponse JSON envelope matching `src/app/api/leaderboard/route.ts`.

- `GET /api/ai/query/reports?tab=<all|mine|team|pinned>&search=<q>&sort=<recent|name>` — paginated saved reports.
- `POST /api/ai/query/reports` — `{ title, description?, params, conversationId? }` → `SavedReport`.
- `PATCH /api/ai/query/reports/[id]` — `{ title?, description?, params?, isTeamPinned? }`. Pin toggle requires `role === 'admin'`.
- `DELETE /api/ai/query/reports/[id]` — owner or admin.
- `POST /api/ai/query/reports/[id]/run` — internally calls same validator + compiler + readonly execution as `/api/ai/query/run`; updates `lastRunAt`, increments `runCount`.
- `GET /api/ai/query/draft` — the current user's one active `ReportDraft` (or 404).
- `PUT /api/ai/query/draft` — `{ params, conversationId?, chatHistory? }` upsert (unique on `userId`).
- `DELETE /api/ai/query/draft` — discard.

### Data model

```prisma
model ReportDraft {
  userId         String   @id @map("user_id") @db.Uuid
  params         Json
  conversationId String?  @map("conversation_id") @db.Uuid
  chatHistory    Json?    @map("chat_history")
  lastTouchedAt  DateTime @updatedAt @map("last_touched_at")
  createdAt      DateTime @default(now()) @map("created_at")
  user UserProfile @relation("UserReportDraft", fields: [userId], references: [id], onDelete: Cascade)
  @@map("report_drafts")
}
```

New migration `prisma/migrations/20260417_report_drafts/migration.sql`:
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

Update `create-readonly-role.sql` to GRANT SELECT on `report_drafts` (admin pool is what the API uses; readonly role doesn't need write access anyway, but the registry test requires visibility consistency).

`UserProfile` gets `draft ReportDraft? @relation("UserReportDraft")` back-reference.

Both `report_drafts` and `saved_reports` should be added to `excludedTables` in `SEMANTIC_CONTEXT` (already there for `query_log` and `saved_reports`; add `report_drafts`) — we don't want Claude to be able to query user-owned persistence.

## States

### Empty State
Breadcrumb "Reports / New report". Builder strip shows empty chip placeholders ("Pick a source", "+ Add data", etc.) STATUS = "Ready to start" grey. Results area shows `EmptyHero` (dot illustration + "Let's build your first report" + 4 suggested prompt cards, optional but hidden per Q2 decision). Chat panel shows greeting bubble: "Hi {firstName} — what do you want to know about your territory? Try a question below, or describe what you're looking for."

### Draft (user sent a message)
Chat bubble appears, then 3-dot pulse "Updating chips…", then assistant bubble + "Populated builder" receipt card. Chip strip animates to filled state. STATUS turns amber: "Setup changed" with prominent plum Run button.

### Pre-Run
Results area shows `PreRunCard` (amber ⏵ icon, "Ready to run" title, description of what the query will fetch, expected row count + time, plum "▶ Run query" button, helper "Reruns of saved reports skip this step").

### Running (after Run clicked)
`DataTable` shows 12 skeleton rows. STATUS badge shows "Running…" pulse. Run button disabled with spinner.

### Results
Header: row count + "joined with N sources" + Export/Actions/More. DataTable populated. Pagination footer. STATUS = "Up to date" green.

### Dirty (chip edited after a run)
STATUS flips to amber "Setup changed — run to see results". DataTable keeps stale results with subtle orange left-border.

### Error — chat suggest
Red-bordered bubble in chat: "I couldn't translate that — try rephrasing or edit the chips manually."

### Error — run
Red banner at top of ResultsArea: "Query failed: [message]" with Retry button. DataTable preserves last good result below.

### Library
Tabs bar, search input, card list. Empty state: "No reports yet — save your first query to build your library." Loading: 5 skeleton cards. Error: "Couldn't load reports — Retry."

### Save Modal
Open animation fade + scale. Form validation: NAME required (disable Save until present). Visibility defaults to "Team" (per figma). Pin checkbox rendered only when `user.role === 'admin'`. On save: close modal, update breadcrumb to the saved title, toast "Saved · 47 rows captured".

### Deep-link hydration
On mount, `ReportsView` reads `?report=<id>` from `useSearchParams`. If present, fetches via `useSavedReportQuery(id)`, hydrates builder + opens associated thread. If user navigates elsewhere, `?report=<id>` stays until user clicks New Report (then drops the param).

## Out of Scope

Moved to **FD-8 (Reports tab — agentic actions)**:
- DataTable checkbox column
- `BulkActionToolbar`
- Per-row `ActionMenu`
- `ActionConfirmation` modal
- `POST /api/ai/query/action` dispatcher
- The 9 MAP-3 action handlers
- Chat-proposed actions

Moved to **FD-7 (platform deep links)**:
- Deep links for Map / Plans / Activities / Contacts views (Reports uses deep links as its inaugural example).

Not in this PR and not scheduled:
- Chart/visualization result types — results are DataTable only.
- Row-level security — all authenticated users see all reports and all queryable data.
- Cross-browser export for large datasets (>500 rows) — MAX_LIMIT stays at 500.
- Undo for saved-report deletions.
- Scheduled/emailed reports.

## Success Criteria

- [ ] All 8 new API route files land and type-check.
- [ ] All 23 new component files land and render without console errors.
- [ ] `npm test` passes — existing 40 tests + new tests for: routes (auth/validation/pin-gating), Zustand slice (state transitions), hooks (query keys stable).
- [ ] `npm run build` succeeds.
- [ ] Navigation swap: clicking Reports in sidebar lands at `/reports`; Progress is gone.
- [ ] End-to-end manual smoke: chat a NL question → chips populate → Run → see rows → Save → reopen from Library via `?report=<id>` → matches.
- [ ] Tablet breakpoint (~768px) renders without layout breaks.
