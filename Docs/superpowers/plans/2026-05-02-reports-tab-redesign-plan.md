# Implementation Plan: Reports Tab Redesign

**Date:** 2026-05-02
**Slug:** `reports-tab-redesign`
**Branch:** `worktree-reports-tab-redesign`
**Spec:** `Docs/superpowers/specs/2026-05-02-reports-tab-ux-redesign-design.md`
**Design handoff:** `Docs/Query.zip` (extracted at `/tmp/query_design/design_handoff_reports/`)

## Locked design decisions (from this session)

- **Builder layout:** chat-as-timeline. Two columns (chat with gutter version pills + JumpNav · results). 44px collapsed rail when user collapses chat. No separate version rail in default state.
- **Trace style:** B · Terminal (mono, `$ tool(args) ✓ Nms`, coral left-border on active step).
- **Mobile/narrow:** out of scope. Build narrow-width resilience per CLAUDE.md but skip the dedicated NarrowArtboard layout.
- **Migration:** replace in place. Old `ReportsView`, `ChatPanel`, `SavedReportsSidebar` deleted at end of slice 9.

## Existing-code touch-points

| Concern | Current state | Spec wants |
|---|---|---|
| Routes | Single `/reports` page (`ReportsView`) — sidebar + chat + results | Split: `/reports` library home, `/reports/new` builder |
| `QuerySummary` | `{ source: string }` only | Add `filters[]`, `columns[]`, `sort`, `versionLabel` |
| `SavedReport` model | has `lastRunAt`, `runCount`, `isTeamPinned`, `pinnedBy` | Add `rowCount Int?`, `description String?` |
| `GET /api/reports` | Returns flat list of `where: { userId }` | Return `{ mine, starred, team }` with owner info |
| `PATCH /api/reports/:id` | Owner-only; accepts title/sql/summary/question | Also accept `isTeamPinned` (admin-only); accept `description` |
| `GET /api/reports/:id` | Owner-only | Any authed user (for Team tab) |
| `POST /api/reports/:id/run` | Owner-only | Any authed user (for Team tab); also stores `rowCount` |
| Chat endpoint | `/api/ai/query/chat` returns full result JSON | Add streaming variant (or convert) emitting `TurnEvent`s as SSE |
| `run_sql` tool | Stores `summary.source` only | Also accept and store `filters[]`, `columns[]`, `sort`, `versionLabel` from Claude |
| `ReportDraft` | `chatHistory Json?` | Extend chatHistory schema to include cached version snapshots (rows + columns + summary + sql) keyed by tool-use ID |
| Save flow | `window.prompt` | Inline popover with Title (prefilled) + Description (optional); split button when loaded-and-refined |

## Slicing

Each slice is committable independently and leaves the app in a working state. Slices 1-2 are backend; 3-4 establish a working new UI scaffold; 5-7 fill it in; 8 adds the collapse affordance; 9 is cleanup.

After each slice, verify:
- `npx vitest run` (unit tests)
- `npx tsc --noEmit` (type-check)
- Spot-check `/reports` and `/reports/new` in the browser

---

### Slice 1 — Schema + types + agent metadata

**Files**
- `prisma/schema.prisma` — add `rowCount Int?` and `description String?` to `SavedReport`
- `prisma/migrations/<new>/migration.sql` — generated migration
- `src/features/reports/lib/agent/types.ts` — extend `QuerySummary`:
  ```ts
  interface QuerySummary {
    source: string;
    filters?: string[];      // human-readable, e.g. ["State: Texas", "Days in stage > 90"]
    columns?: string[];      // ordered list of result columns
    sort?: string | null;    // e.g. "Close date ↓"
    versionLabel?: string;   // short plain-English description for rail/chat tile
  }
  ```
- `src/features/reports/lib/tools/run-sql.ts` — accept and pass through new summary fields
- `src/features/reports/lib/agent/tool-definitions.ts` — extend `run_sql` JSONSchema input to include the new optional fields
- `src/features/reports/lib/agent/system-prompt.ts` — instruct Claude to populate `filters`, `columns`, `sort`, `versionLabel` on each `run_sql` call

**Tests**
- Update `tool-definitions.test.ts` and `run-sql.test.ts` to assert new fields are accepted and pass through.
- New summary type is backward-compatible (existing rows with `{ source }` still parse).

**Migration safety**
- `rowCount` and `description` are nullable — no backfill required.
- New `QuerySummary` fields are optional — old saved-report rows with just `{ source }` continue to render (chip strip just shows nothing for missing groups).

**Acceptance**
- DB migration applied locally
- Agent loop tests pass
- Type-check clean

---

### Slice 2 — API expansion (library + star toggle + permissive read/run)

**Files**
- `src/app/api/reports/route.ts` — `GET` returns `{ mine, starred, team }` with `ReportListItem` shape from spec; sorting `lastRunAt DESC NULLS LAST, updatedAt DESC`. Single round-trip.
- `src/app/api/reports/[id]/route.ts`:
  - `GET` — drop owner check; require auth only (any user can read)
  - `PATCH` — accept `isTeamPinned` (admin-only check via `UserProfile.role === "admin"`); accept `description`; owner check stays for title/sql/summary/question edits
  - `DELETE` — owner-only stays
- `src/app/api/reports/[id]/run/route.ts` — drop owner check; persist `rowCount` from `res.rowCount` to the row
- `src/app/api/reports/__tests__/route.test.ts` — extend tests to cover the three groups, admin-only star, permissive read

**Acceptance**
- `GET /api/reports` returns the three groups with realistic data
- Non-admin PATCH with `isTeamPinned` returns 403
- Admin PATCH with `isTeamPinned: true` succeeds and sets `pinnedBy`
- Test suite green

---

### Slice 3 — `/reports` library page

**Files (new)**
- `src/features/reports/components/ReportsLibrary.tsx` — page-level component
- `src/features/reports/components/library/WelcomeStrip.tsx` — eyebrow card with title, subtitle, "How does this work?" link, "+ New report" button, "Try one" example chips → navigate to `/reports/new?prompt=<encoded>`
- `src/features/reports/components/library/LibraryTabs.tsx` — Mine / Starred / Team with counts; URL param `?tab=`
- `src/features/reports/components/library/LibraryList.tsx` + `LibraryRow.tsx` — flat list with hover; star control for admins; owner avatar on Team and Starred-when-not-self
- `src/features/reports/components/library/EmptyLibrary.tsx` — three kinds (mine/starred/team)
- `src/features/reports/components/library/LibrarySkeleton.tsx` — three skeleton rows during loading
- `src/features/reports/lib/queries.ts` (new) — `useReportsLibrary`, `useToggleStar`, `useDeleteReport` (TanStack Query hooks; query keys are stable strings per CLAUDE.md performance rules)
- Routing: replace existing `/reports` route mount to render `ReportsLibrary`

**Files (changed)**
- Wherever the current `ReportsView` is mounted (currently the `progress` slot per memory) — point at `ReportsLibrary` instead
- `src/features/reports/hooks/useSavedReports.ts` — replace with the new `lib/queries.ts` hooks (move `useCreateSavedReport` / `useRunSavedReport` over). Keep behavior identical for now; the builder slice (4-6) will rewire them.

**Brand compliance**
- All colors via tokens (no Tailwind grays)
- Typography per `Documentation/UI Framework/tokens.md`
- Lucide icons only (`Sparkles`, `Plus`, `ArrowRight`, `Star`, `StarFill` (filled variant via Lucide), `Inbox`, `FileText`, `Search`, `Clock`, `ChevronRight`, `HelpCircle`)
- Avatar initials helper + hashed-color palette per spec
- `whitespace-nowrap` + overflow-x-auto on the row meta line

**Tests**
- Library renders three tabs with realistic mock data
- Empty states render per tab
- Star toggle calls PATCH and refetches
- Search input filters titles client-side
- 50-row pagination with "Show more"; banner at 200+

**Acceptance**
- Navigate to `/reports`, see welcome strip + 3 tabs + rows
- Click a row → routes to `/reports/new?report=<id>` (placeholder route until slice 4)
- Star a row as admin → row moves to Starred tab on refetch
- Empty state renders when a tab has no rows

---

### Slice 4 — `/reports/new` builder shell + chat-as-timeline (no streaming yet)

**Files (new)**
- `src/app/(app)/reports/new/page.tsx` (or whatever the existing routing pattern is) — entry point
- `src/features/reports/components/builder/ReportsBuilder.tsx` — top-level container; reads `?report=<id>` and `?prompt=<encoded>` and `?v=<n>` from URL; manages session state via existing `ReportDraft` and TanStack Query mutations
- `src/features/reports/components/builder/BuilderChat.tsx` — left column: header (eyebrow, title, JumpNav, +New, collapse-chevron) + messages scroll + composer
- `src/features/reports/components/builder/TurnBlock.tsx` — gutter pill + user bubble + assistant card with footer row
- `src/features/reports/components/builder/JumpNav.tsx` — compact pill row in chat header
- `src/features/reports/components/builder/VersionPill.tsx` — gutter version pill (selected/default/evicted variants)
- `src/features/reports/components/builder/Composer.tsx` — input + send + helper text; disabled state
- `src/features/reports/lib/version-state.ts` — derives `Version[]` from chat history; tracks selected version index in URL state

**Files (changed)**
- Removed: nothing yet. Old `ReportsView` is no longer routed to but the file stays until slice 9.

**Wire-up**
- Submit a follow-up → call existing `/api/ai/query/chat` non-streaming endpoint (slice 7 swaps to streaming)
- Each `run_sql` becomes a "version" — derive from the chat history's tool-use IDs
- Selected version: URL `?v=<n>`; defaults to latest
- `+ New` button clears `ReportDraft` and routes to `/reports/new`
- Loading from `?report=<id>`: hit `/api/reports/:id/run` to rerun the saved SQL and seed the rail with v1
- Empty state: empty chat with composer focused; show a hint card

**Brand compliance**
- Coral selected pill (`#F37167`) with double box-shadow halo per `RailTileStates`
- User bubble plum, assistant card surface-raised, selected card white-border-plum
- ResizeObserver-based pill alignment per `builder-chat-timeline.jsx` `TurnBlock`
- Continuous gutter connector line (dashed-plum)

**Tests**
- TurnBlock renders with gutter pill aligned to user bubble
- Click pill → URL `?v=<n>` updates and selected style applies
- Composer disabled when `inFlight === true`
- `+ New` button clears draft and routes correctly
- Submitting follow-up posts to chat endpoint and renders new turn block

**Acceptance**
- Navigate to `/reports/new`, ask a question, see response with version pill
- Submit follow-up → new turn block appears with v2 pill
- Click v1 pill → URL changes, selected styling moves (results pane wired in slice 5)

---

### Slice 5 — Results pane: header, chip strip, table

**Files (new)**
- `src/features/reports/components/builder/ResultsPane.tsx` — right column: header + chip strip + table
- `src/features/reports/components/builder/ResultsHeader.tsx` — eyebrow line, title, action buttons (View SQL, Export CSV, Save split button placeholder for slice 6)
- `src/features/reports/components/builder/ChipStrip.tsx` — inline metadata row; respects 8+ columns rule (`+N more`); flex-wrap for narrow width
- `src/features/reports/components/builder/ResultsTable.tsx` — table with sticky header, narrow-width horizontal scroll, footer row (row count · column count · execution time)
- `src/features/reports/components/builder/StageChip.tsx` — color-coded chip per opportunity stage

**Files (changed)**
- `src/features/reports/components/SqlPreviewModal.tsx` — keep as-is; reused
- `src/features/reports/lib/csv.ts` — keep as-is; reused for Export CSV

**Wire-up**
- Reads selected version from URL `?v=<n>` and renders that version's snapshot from the chat history
- Header eyebrow shows `RESULT · v3 · 9 ROWS · [DB] FROM SAVED REPORT · refined` when applicable
- Chip strip parses `summary.filters[] / columns[] / sort` and renders inline; renders nothing for missing groups
- Table cell typography per spec — district plum-medium, state body-color, days right-aligned tabular (red if >120), amount right-aligned tabular plum-bold
- StageChip color mapping: Discovery / Proposal / Negotiation / Closed Won

**Tests**
- ChipStrip renders all three groups; collapses 8+ columns to "+N more"
- ResultsTable renders sticky header, footer with counts and execution time
- Long titles ellipsis-truncate per `StatesArtboard` long-title example

**Acceptance**
- Submit a query → result pane renders title, chip strip, full table
- Resize narrow → table scrolls horizontally; chip strip wraps; header truncates title
- View SQL opens existing modal
- Export CSV downloads the rows

---

### Slice 6 — Save flow (split button + popover)

**Files (new)**
- `src/features/reports/components/builder/SavePopover.tsx` — anchored to button group; Title (prefilled from `summary.source`) + Description (optional, multi-line, max 500 chars)
- `src/features/reports/components/builder/SaveButton.tsx` — single Save (fresh) | split Update + chevron (loaded + refined) | Edit details + Delete (loaded + unmodified)

**Files (changed)**
- `src/features/reports/components/builder/ResultsHeader.tsx` — wire SaveButton in
- `src/features/reports/lib/queries.ts` — add `useUpdateSavedReport`, `useSaveAsNew`, `useDeleteReport`, `useEditDetails`
- `src/app/api/reports/[id]/route.ts` — confirm PATCH accepts `description`

**Wire-up**
- Saved-report-loaded session detection: URL has `?report=<id>`, AND `versionCount > 1` for "refined"
- Update primary action → PATCH `/api/reports/:id` with new sql/summary/question (the latest user message)
- Save as new → POST `/api/reports`
- Edit details → PATCH (title/description only)
- Delete → DELETE + redirect to `/reports`

**Tests**
- Fresh session: only "Save report" rendered; popover prefills title from `summary.source`
- Loaded + refined: split "Update" + "Save as new"
- Loaded + unmodified: "Edit details" + "Delete" only (no Update)
- Description field optional; title required; submit calls correct endpoint

**Acceptance**
- All three save-flow variants render correctly per `SaveStatesArtboard` A/B/C
- Saved report appears in `/reports` library on next visit
- Update overwrites existing row's `sql`, `summary`, `question`, `updatedAt` only

---

### Slice 7 — SSE streaming + live trace + composer in-flight state

**Files (new or heavily modified)**
- `src/app/api/ai/query/chat/route.ts` (or wherever the chat endpoint lives) — add streaming variant. Use `ReadableStream` + `text/event-stream` content type. Yield each `TurnEvent` as an SSE message; final event includes `assistantText` and `result`.
- `src/features/reports/components/builder/LiveTrace.tsx` — Style B (Terminal) renderer; dimmed-queued / coral-active / done-checkmark states; collapse to `↳ N steps · X.Xs` toggle when complete
- `src/features/reports/components/builder/TraceLine.tsx` — single line: `$ tool(arg) ✓ Nms` mono with coral left-border on active
- `src/features/reports/lib/agent/humanize-tool.ts` — labels for each tool (used in non-Terminal styles if we ever ship A/C/D, but Terminal style uses raw tool name)
- `src/features/reports/hooks/useChatTurnStream.ts` — replaces `useChatTurn` for the builder; uses `EventSource` or fetch+stream-reader; emits trace events to caller as they arrive

**Files (changed)**
- `BuilderChat.tsx` — wire up `useChatTurnStream`; render `LiveTrace` inside the in-flight `TurnBlock`
- `TurnBlock.tsx` — in-flight variant: dashed border, pulsing coral dot, "Working on vN · step X of N" header, live trace lines streaming
- `Composer.tsx` — `inFlight` state: opacity 0.55, send-button dim, placeholder "Working…", helper "Working… composer locked until response completes."

**Animation**
- `pulse` keyframe on coral dot (1.4s ease-in-out infinite)
- `blink` keyframe on cursor character if Terminal style uses one
- `shimmer` keyframe defined globally for skeletons but unused by Terminal

**Tests**
- Stream a fixture of TurnEvents → renderer shows queued/active/done states correctly
- Active step has coral left-border and `▌` cursor
- Completed turn collapses to toggle by default
- Network drop after 5s of silence → "Thinking… (refresh if stuck)" hint

**Acceptance**
- Submit a query → trace lines appear one by one in the in-flight block
- Each line shows tool name + arg + ms when done; cursor on active
- Final assistant text + result lands as the version completes
- Composer locks correctly during in-flight; reopens immediately on complete

---

### Slice 8 — Collapsed chat 44px rail

**Files (new)**
- `src/features/reports/components/builder/CollapsedChatRail.tsx` — 44px slim rail; vertical filled-plum/coral pills with dashed connector; expand chevron with breathing-ring animation; bottom send-icon button
- `src/features/reports/lib/use-chat-collapsed.ts` — localStorage hook for `chatCollapsed` boolean

**Files (changed)**
- `ReportsBuilder.tsx` — render `CollapsedChatRail` instead of `BuilderChat` when collapsed; results pane fills width

**Animation**
- `rail-breathe` keyframe (2.6s ease-out infinite, pauses on hover) — defined globally
- Hover invert + chevron 2px right-translate (180ms ease)

**Tests**
- Click chevron-left → chat collapses, rail renders, localStorage updated
- Click expand chevron or send icon → chat reopens
- Click any pill → version selects (and chat stays collapsed)
- Breathing animation pauses on rail hover

**Acceptance**
- Toggle collapse — animation plays — results pane reflows full-width
- Choice persists across reload
- Click any rail pill → results updates without expanding chat

---

### Slice 9 — Cleanup, removal, telemetry, final polish

**Removals**
- `src/features/reports/components/ReportsView.tsx`
- `src/features/reports/components/ChatPanel.tsx`
- `src/features/reports/components/SavedReportsSidebar.tsx`
- `src/features/reports/hooks/useSavedReports.ts` (replaced by `lib/queries.ts`)
- Any `window.prompt`-based save callsites
- Old test files for the removed components

**New: tokens audit**
- Verify all colors, type, radius, shadow, motion tokens from `colors_and_type.css` exist in `Documentation/UI Framework/tokens.md` / `tailwind.config.*`
- If Plus Jakarta Sans isn't already loaded, add it (likely already is — confirm)
- Add `.fm-scrollbar` and `.fm-focus-ring` global classes if missing

**Telemetry (per spec)**
- Add lightweight wrappers around the load-bearing interactions:
  - `report:trace_first_line` and `report:trace_complete` (ms)
  - `report:trace_toggle` (expand/collapse)
  - `report:rail_pill_click` (in-session version flip)
  - `report:library_tab_view` and `report:library_search`
  - `report:save_as_new_after_load` (conversion of loaded → saved-as-new)
  - `report:admin_star_toggle`
- Use the existing app telemetry channel (TBD during this slice — confirm or skip if no channel exists)

**Architecture doc**
- `docs/architecture.md` — add `reports` to the Feature Directory Map; note the two routes; add cross-feature dependency on `agent` if relevant
- `Documentation/.md Files/TECHSTACK.md` — add `/api/reports/[id]/run` and the streaming chat endpoint to the API Route Structure if missing
- Memory updates: review `feedback_no_id_strings_in_output.md` and `feedback_reports_chat_builder_hybrid.md` to confirm they still apply, update if needed (View SQL is now opt-in per spec D13 — that contradicts an earlier "never show SQL" stance; the spec already addresses it)

**Final pass**
- `npx vitest run` — full suite green
- `npm run build` — production build clean
- `/design-review` skill — audit `.tsx` files for spec compliance
- Manual: open `/reports` and `/reports/new`, walk through golden path, edge cases (empty library, loaded saved report, refine, save-as-new, collapse chat, rerun saved that fails)

**Acceptance**
- No references to deleted components remain in src/
- All tests green; build clean
- Manual walkthrough passes for both routes
- Architecture docs updated

---

## Risks & open questions

1. **Streaming endpoint approach** — Next.js App Router supports SSE via `ReadableStream`. Need to confirm there's no existing SSE pattern in this codebase (if there is, follow it). If not, this is the first one — keep it tightly scoped to this route.

2. **`UserProfile.role` enum values** — confirmed exists, but need to grep for `UserRole` enum to verify `admin` is a valid value before slice 2.

3. **`/reports` route currently mounted under** — backend discovery summary says it's tab-switched in `src/app/page.tsx`. Need to confirm in slice 3 whether that's still the case (memory says "Replace Progress nav with Reports/query builder feature"). If `/reports` is a real route, this is straightforward; if it's only a tab in a larger page, slice 3 needs to add the actual `/reports` and `/reports/new` route files.

4. **Plus Jakarta Sans font** — assumed already loaded. Slice 9 verifies and falls back to system fonts if not (acceptable since most type tokens use the same family).

5. **`ReportDraft.chatHistory` schema extension** — adding cached version snapshots increases row size. Cap at MAX_VERSIONS_PER_SESSION=20 per spec; oldest get evicted. Need to define the JSON shape carefully so old drafts don't break parsing.

6. **Owner avatar on Starred tab** — spec says "starred report owned by current user appears in BOTH Mine and Starred (intentional)" but only show owner avatar on Team and Starred-when-not-self. Easy edge case but document in component.

7. **Bringing back QuerySummary backwards-compat** — existing saved reports have `{ source }` only. Slice 5 chip strip must render gracefully (just `source` as the title, no chips below). Confirmed in slice 1 design.

## Slicing rationale

- **1-2 (backend)** unblock everything else — schema and types are foundational
- **3 (library)** is independent of the builder and ships visible value first; users can browse saved reports immediately
- **4 (builder shell)** + **5 (results pane)** + **6 (save flow)** form a complete builder without streaming — usable but with a "Thinking..." placeholder during turns
- **7 (streaming)** is the highest-effort slice but isolated to one endpoint + the LiveTrace component; can be tested independently
- **8 (collapsed rail)** is pure presentation; minimal risk
- **9 (cleanup)** is gating and can spill into a follow-up if needed

## Out of scope (explicit)

- Mobile / NarrowArtboard layout (deferred per user decision)
- Folders, tags, favorites beyond admin starring
- Branching/forking versions (tab-switcher only per D2)
- Removing the View SQL affordance (kept per D13)
- Magazine-style briefing dashboard (`Reports — dashboard exploration.html` parked per handoff README)
