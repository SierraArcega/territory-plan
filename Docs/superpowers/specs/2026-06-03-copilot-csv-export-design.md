# Copilot result-table CSV export — design

**Date:** 2026-06-03
**Branch base:** `main` (worktree `copilot-csv-export`)
**Status:** Approved (design), pending spec review

## Problem

When the action-taking AI Copilot (`src/features/copilot/`) answers a rep's
question with a table of data, the rep has no way to take that data out of the
app. They can see it (`AnswerBlock.tsx` renders a structured table) and plot
districts on the map, but there is no "Export CSV" affordance. Reps frequently
want to drop a result set into a spreadsheet.

## Goal

Add an **"Export CSV"** button to the copilot's answer tables, reusing the
existing CSV helpers. No new utilities, no API/server changes.

## What already exists

- **Render component:** `src/features/copilot/components/AnswerBlock.tsx` — renders
  a structured `AnswerPayload` (`{ columns, rows, rowCount }`) as a native HTML
  table. Already filters ID columns out of the display via
  `isIdColumn` (`visibleColumns`). Already has a "View N on the map" button.
- **CSV helpers:** `src/features/reports/lib/csv.ts` — `rowsToCsv(columns, rows)`,
  `downloadCsv(filename, csv)`, `slugifyForFilename(s)`. RFC-4180 escaping,
  Blob + object-URL download. Already consumed by the reports `ResultsPane`.
  The copilot's table data is the exact `{ columns, rows }` shape these expect —
  zero parsing needed.
- **Data source:** `CopilotPanel.tsx` builds the `AnswerPayload` from the SSE
  `answer` result (`res.result.columns / rows / rowCount`).

## Key constraints discovered

- **Display cap (50):** `CopilotPanel.tsx:119` does `rows: res.result.rows.slice(0, 50)`
  when building the payload, **discarding the rest**. The full returned set is
  available at that moment and currently thrown away.
- **Query cap (≤500):** the agent's final `run_sql` enforces `LIMIT ≤ 500`
  (default 100) — see `reports/lib/agent/tool-definitions.ts` and `types.ts`
  (`MAX_LIMIT = 500`). So `res.result.rows` already holds **every row the query
  returned**, up to that LIMIT. There is no larger client-side set to export;
  exceeding the LIMIT would require re-querying and is out of scope.
- **No raw IDs to reps** (project rule): the CSV must use the rep-facing
  `visibleColumns`, not the hidden ID columns.

## Decisions (confirmed with user)

1. **Export scope = full returned set.** Export every row the query returned
   (up to the SQL LIMIT, ≤500), even though the table only shows the first 50.
   Keep the full rows in the payload; move the 50-row cap into the display.
2. **Columns = rep-facing only.** Export the same `visibleColumns` shown in the
   table; hidden ID columns (leaid, uuid, opportunity_id, …) stay out, honoring
   the "no raw IDs in output" rule.

## Design

### 1. `AnswerPayload` carries full rows + a filename source

`CopilotPanel.tsx` — `applyResult`, `kind === "answer"` branch:

- Stop slicing: pass the **full** `res.result.rows` (no `.slice`).
- Add `source: res.result.summary.source` to the payload for the CSV filename.

`AnswerBlock.tsx` — extend `AnswerPayload`:

```ts
export interface AnswerPayload {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  source?: string; // rep-friendly query description, used for the CSV filename
}
```

### 2. `AnswerBlock` displays 50, exports all

- Add a module-level `const DISPLAY_ROW_CAP = 50;`.
- Display rows = `answer.rows.slice(0, DISPLAY_ROW_CAP)`. The table body and the
  existing "Showing X of Y rows" note use the displayed slice vs `answer.rowCount`
  (unchanged UX — still shows the first 50 with the count note).
- Add an **"Export CSV"** button (Lucide `Download`, styled like the reports
  `ResultsPane` `HeaderButton`) in the same action row as "View N on the map".
  Handler:

  ```ts
  const handleExport = () => {
    const csv = rowsToCsv(visibleColumns, answer.rows); // full set, rep-facing cols
    downloadCsv(slugifyForFilename(answer.source ?? "copilot results"), csv);
  };
  ```

- **Visibility:** the button renders only when there is a visible table with at
  least one row — i.e. `answer.rows.length > 0 && visibleColumns.length > 0`.
  It is hidden for empty results ("No rows.") and map-only answers (districts
  plotted, no rep-facing columns), where a CSV would be empty/meaningless.

### 3. Reuse, no new code

Import `rowsToCsv`, `downloadCsv`, `slugifyForFilename` from
`@/features/reports/lib/csv`. No changes to `csv.ts`, no server changes.

## Data flow

```
SSE answer result ──> CopilotPanel.applyResult
  { columns, rows(≤500), rowCount, summary.source }
        │  (full rows + source, no slice)
        ▼
  AnswerPayload { columns, rows, rowCount, source }
        │
        ▼
  AnswerBlock
    ├─ display: rows.slice(0,50) in <table>, "Showing 50 of N" note
    └─ Export CSV: rowsToCsv(visibleColumns, rows) ──> downloadCsv(slug(source))
```

## Edge cases

| Case | Behavior |
| --- | --- |
| 0 rows | No table, no export button (existing "No rows." path). |
| Map-only answer (no visible cols) | No export button (no rep-facing columns to write). |
| `source` undefined/empty | `slugifyForFilename` falls back to `"report"`. |
| Result hit the 50 display cap but < SQL LIMIT | Table shows 50 + "Showing 50 of N"; CSV contains all N. |
| Result hit the SQL LIMIT (500) | CSV contains the 500 returned rows; not the full underlying dataset (documented limitation, out of scope). |

## Testing (`AnswerBlock.test.tsx`)

Extend the existing suite (mock `downloadCsv` from the csv module):

1. **Button present** when rows + visible columns exist.
2. **Hidden when 0 rows** and **hidden for map-only** (only ID columns).
3. **Click exports rep-facing columns only** — assert `rowsToCsv` is called with
   `visibleColumns` (no `leaid`/ID columns in the CSV).
4. **Exports the full set, not just 50** — render with 60 rows, assert the CSV
   passed to `downloadCsv` has 60 data lines (display still shows 50).
5. **Filename derives from `source`** — assert `downloadCsv` filename is the
   slugified source.

Update `CopilotPanel.test.tsx` only if an assertion depends on the removed
`.slice(0, 50)` (it builds the payload); display behavior is unchanged.

## Out of scope

- Exporting beyond the SQL LIMIT (would require re-querying).
- Copy-to-clipboard of the table.
- Export from replayed history turns (rows aren't persisted; history carries a
  `note`, not a table).
- Export for research/action turns (no tabular result).

## Files touched

- `src/features/copilot/components/AnswerBlock.tsx` (button + display cap + type)
- `src/features/copilot/components/CopilotPanel.tsx` (pass full rows + source)
- `src/features/copilot/components/__tests__/AnswerBlock.test.tsx` (tests)
- `src/features/copilot/components/__tests__/CopilotPanel.test.tsx` (if needed)
