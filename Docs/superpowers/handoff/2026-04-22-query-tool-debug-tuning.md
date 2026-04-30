# Query Tool Agent Loop — Debug & Tuning Handoff

**Date:** 2026-04-22
**Branch:** `feat/db-readiness-query-tool`
**Status:** Plan 2 backend + UI complete. Reports tab live at `/?tab=reports`. Manual tuning in progress.

## TL;DR

The Reports feature (Claude-powered query tool with chat + chips + results + saved reports) is built end-to-end and runnable locally. You are here to debug and tune the real-world behavior — the system works, but its outputs, timing, and UX need polish against live data.

**Work in the main workspace.** The branch has 40+ commits on top of `main`. Dev server is expected to be running on `:3005`.

## What's live

- **Routes:** `POST /api/ai/query/chat`, `POST /api/ai/query/edit`, `GET/POST /api/reports`, `GET/PATCH/DELETE /api/reports/:id`, `POST /api/reports/:id/run`
- **Agent loop:** `src/features/reports/lib/agent/agent-loop.ts` — Claude Opus 4.7 with adaptive thinking, 9 tools, 2-retry budget on run_sql, 20-exploratory-call cap per turn
- **UI:** Reports tab in the sidebar (between Leaderboard and Resources), 3-panel layout (saved-reports sidebar + chat + chips/results)
- **DB:** `query_log` + `saved_reports` tables (saved_reports gained `summary Json?` + `conversation_id Uuid?` this branch). Readonly pg role `query_tool_readonly` with 5s statement timeout.

## Recent relevant commits (read top-down)

```
c4e4f699 feat(nav): add Reports tab to sidebar + main router
e1986ac9 feat(reports): ReportsView top-level — chat + chips + results + sidebar
ae36bbb6 feat(reports): saved reports sidebar
a8740bad feat(reports): ChatPanel with thinking indicator
505c2af6 feat(reports): ResultsTable with hidden-ID toggle
5ef6f59e feat(reports): ChipSummaryPanel with remove-filter + remove-column edits
94693835 feat(reports): TanStack Query hooks for chat + edit + saved reports
463ca843 fix(reports): resolve type errors in agent-loop, conversation, run-sql
4a8a291c fix(reports): handle parallel tool_use blocks + harden exploration prompt
fcbd716d feat(reports): saved report CRUD + zero-Claude rerun
e603d1fc feat(reports): POST /api/ai/query/edit chip-edit route
1c74ad62 feat(reports): POST /api/ai/query/chat agent route
8c215e10 feat(reports): multi-turn agent loop with retry + bounds
… plus Tasks 1-14 for schema, tool handlers, validator, persistence
```

Plan 1 (metadata) is landing in parallel — ignore `feat(metadata):` commits; they don't affect Plan 2 behavior.

## Key files when debugging

### Where things go wrong

| Symptom | File to read |
|---|---|
| Claude picks wrong table/column | `src/features/reports/lib/agent/system-prompt.ts`, `src/lib/district-column-metadata.ts` (TABLE_REGISTRY + SEMANTIC_CONTEXT) |
| Chip/SQL alignment failures | `src/features/reports/lib/agent/summary-validator.ts` |
| Parallel tool_use / API 400s | `src/features/reports/lib/agent/agent-loop.ts` (parallel handling lives in the toolResults loop) |
| Slow turns | Adaptive thinking in `agent-loop.ts` — can set to `{ type: "disabled" }` to speed up at cost of quality |
| Timeouts | `src/lib/db-readonly.ts` (5s statement_timeout — bump if needed) |
| Rendering issues in Reports tab | `src/features/reports/components/ReportsView.tsx` and children |

### Authoritative references

- **Spec:** `docs/superpowers/specs/2026-04-21-query-tool-agentic-redesign.md` (D1–D13 decisions)
- **Plan:** `docs/superpowers/plans/2026-04-21-query-tool-agent-loop.md` (Tasks 1-30; Tasks 28-30 not yet done)
- **Tokens:** `Documentation/UI Framework/tokens.md` (Plum palette — never use Tailwind grays)
- **CLAUDE.md** at repo root for project conventions

## Known tuning targets

1. **`window.prompt()` for saving a report is ugly.** `ReportsView.tsx`'s `handleSave` uses a browser prompt. Replace with a proper modal — see `src/features/activities/components/OutcomeModal.tsx` for the roll-your-own modal pattern used elsewhere.

2. **Layout proportions fixed-pixel.** `ReportsView.tsx` hardcodes `w-64` sidebar, `w-[380px]` chat. On narrow viewports the results area can be squeezed. Consider min/max widths or a responsive grid.

3. **Chat message accumulation across exploratory turns.** `agent-loop.ts` accumulates `assistantText` from EVERY exploratory turn's text blocks into the final `result.assistantText`. For long exploration, the chat rail can show 5+ intermediate "Looking up X…" messages. Decide: only keep the final assistant text, or render each intermediate text as a timeline entry.

4. **No streaming — user sees only "Thinking…" for 20+ seconds.** v1 is request/response per the spec. Upgrading to SSE is v2 work.

5. **`ResultsTable` is bespoke (75 lines), not DataGrid.** Explicit choice — v1 just renders rows + hides ID cols. If the feature wants sortable headers, pagination, column reorder, or selection, swap to `src/features/shared/components/DataGrid/DataGrid.tsx` (668-line shared component).

6. **`format === "id"` on ColumnMetadata is inactive.** `DataFormat` in `district-column-metadata.ts` doesn't include `"id"` as a literal — all ID columns use `"text"` or `"integer"`. `ResultsTable.isIdColumn` falls back to a regex on column names (leaid, `*_id`, uuid, id). Works today; flag if a new ID-like column gets introduced with a non-matching name.

7. **System prompt currently pushes hard for exploration.** After a failure where Claude guessed `d.state` (column doesn't exist), the prompt was hardened to demand `describe_table` + `get_column_values` before `run_sql`. This adds ~10-15s to happy-path queries. Consider: make it adaptive — only demand exploration if Claude hasn't already explored in prior turns of the same conversation.

8. **5s pg statement_timeout** in `src/lib/db-readonly.ts` may be aggressive for complex aggregate queries over 13K districts × multiple joins. Observe if real queries trip it; bump to 10-15s if needed.

9. **Summary validator is strict on filter-value literal matching.** If Claude emits a chip "State: Texas" but SQL filters `states.abbreviation = 'TX'`, validator rejects. Current system prompt tells Claude to pick the SQL path matching the chip language (e.g. join to `states.name` if chip says "Texas"). If this causes friction at scale, loosen the validator to accept common name↔abbreviation mappings (NO — harder than it sounds; keep Claude's side of the contract instead).

10. **Saved report `sql` is empty when loaded from sidebar.** `ReportsView.handleLoadReport` sets `current.sql = ""` because the `/reports/:id/run` endpoint doesn't return SQL (zero-Claude rerun only returns rows + summary). This means re-saving a loaded report would POST an empty SQL. Either (a) change the `/run` endpoint to also return SQL, or (b) disable the save button when SQL is empty, or (c) fetch the full saved report via `/api/reports/:id` on load.

## How to test

### Dev server

```bash
npm run dev   # port 3005
# Log in via browser
# Click Reports tab
```

### From DevTools console (faster than full UI debugging)

```js
// New conversation
const r1 = await fetch('/api/ai/query/chat', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({ message: 'YOUR QUESTION' })
}).then(r => r.json());
console.log(r1);

// Follow-up
const r2 = await fetch('/api/ai/query/chat', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({ conversationId: r1.conversationId, message: 'FOLLOWUP' })
}).then(r => r.json());

// Chip edit
const e1 = await fetch('/api/ai/query/edit', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({
    conversationId: r1.conversationId,
    action: { type: "remove_filter", chipId: "f1", label: "State: Texas" }
  })
}).then(r => r.json());

// Save + rerun
const saved = await fetch('/api/reports', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({
    title: 'Test', question: 'Q', sql: r1.result.sql, summary: r1.result.summary
  })
}).then(r => r.json());
await fetch(`/api/reports/${saved.report.id}/run`, {method:'POST'}).then(r => r.json());
```

### Tests

```bash
npx vitest run src/features/reports src/app/api/ai src/app/api/reports   # ~200 tests
npx tsc --noEmit 2>&1 | grep -E "reports/lib"   # should be clean
```

### Watching the agent loop

`agent-loop.ts` has a `console.error("[agent-loop] run_sql failed", ...)` log on every retry. Tail the dev server output to see exactly what SQL Claude tried, what validation or pg error fired, and what chip summary was paired with it.

## Gotchas

- **Don't use `prisma migrate dev`.** The shadow DB has drift from pre-existing migrations. Use `prisma db execute --file path/to/migration.sql` manually. See `prisma/migrations/20260422_saved_report_summary/migration.sql` for the pattern.
- **Don't render SQL anywhere in the UI.** Tested invariant — `ChipSummaryPanel` and `ResultsTable` tests explicitly check the DOM never contains "sql". The `sql` string travels server→client for save flows only, never into markup.
- **Next.js 16 dynamic route params are `Promise<{ id: string }>`.** Always `await params`.
- **`getAnthropic()`** is lazy — don't call it at module scope or you'll crash tests that don't have `ANTHROPIC_API_KEY` set.
- **Readonly role** is the real safety boundary; in-code DML regexes in `count-rows.ts` / `sample-rows.ts` are UX-level guards only.
- **Parallel tool_use.** When Claude emits 2+ tool_use blocks in a single response, ALL must have tool_results in the next turn. `agent-loop.ts` does this correctly now — do not revert to `.find()` pattern.

## Open Plan 2 tasks not yet shipped

- **Task 28** — Delete legacy `params-to-sql.ts`, `params-validator.ts`, `schema-prompt.ts`, `run-query-tool.ts`, old `suggest`/`run` routes. Should be safe; no references outside the reports feature. Verify with grep before rm.
- **Task 29** — Manual integration test walkthrough (documented as checklist in the plan).
- **Task 30** — Update `docs/architecture.md` with Reports feature section + PR prep.

## Suggested opening move for the new conversation

> "I'm debugging the Reports tab at `/?tab=reports` on branch `feat/db-readiness-query-tool`. Start by reading `docs/superpowers/handoff/2026-04-22-query-tool-debug-tuning.md`, then I'll tell you what's broken or what I want to tune."
