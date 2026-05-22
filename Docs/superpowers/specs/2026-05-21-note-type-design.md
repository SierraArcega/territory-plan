# Note Type — Design Spec

**Date:** 2026-05-21
**Status:** Approved (design); pending implementation plan
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/district-notes-log`
**Branch:** `feat/district-notes-log` (district notes log + merged saved-views features)
**Builds on:** `Docs/superpowers/specs/2026-05-21-district-notes-log-design.md` (Phase 1, shipped)

## Summary

Add a **type** to each district note. A note has exactly one type from a fixed set
of five. The type is chosen in the composer via a single compact picker button
(default **General update**), rendered as a colored badge on each entry, surfaced
as a tint on the grid cell's count badge, and usable as a grid **filter** ("show
districts with a note of type X").

## The five types

Stored as snake_case; rendered with the status palette already used by
`ChurnRiskCell` (plum-derived, no Tailwind grays):

| Value | Label | Pill bg / text |
|---|---|---|
| `general_update` | General update *(default)* | `#EFEDF5` / `#6E6390` |
| `good_news` | Good news | `#E5F5EC` / `#1F7A3F` |
| `risk_flag` | Risk flag | `#FFE0DC` / `#A8281C` |
| `next_step` | Next step | `#FFF1D6` / `#8A5C00` |
| `meeting_recap` | Meeting recap | `#E2E8F7` / `#3B5BA5` |

The canonical list lives in one module (`note-types.ts`) consumed by the composer,
the entry badge, the API validator, and the filter widget — single source of truth.

## Decisions

- **D1 — Single-select, always set.** One type per note. Column is `NOT NULL
  DEFAULT 'general_update'`, so logging stays one-click and there are no nulls.
- **D2 — Single-button picker (not 5 visible chips).** The composer shows one
  compact button displaying the current type (defaults to General update); clicking
  it opens a menu of the five. Keeps the composer clean.
- **D3 — District-scoped filter.** Filtering by type means "districts that have at
  least one note of type X" — an `EXISTS` subquery on `district_notes`. Unlike
  `churn_risk` (per-plan), note type is district-scoped, so the filter needs no plan
  context.
- **D4 — Reuse the churn/status palette** for visual consistency.

## Data model

One column on the existing `district_notes` table:

```sql
ALTER TABLE "district_notes"
  ADD COLUMN "note_type" VARCHAR(20) NOT NULL DEFAULT 'general_update';

ALTER TABLE "district_notes"
  ADD CONSTRAINT "district_notes_note_type_check"
  CHECK ("note_type" IN ('general_update','good_news','risk_flag','next_step','meeting_recap'));
```

Prisma: `noteType String @default("general_update") @map("note_type") @db.VarChar(20)`
on `model DistrictNote`.

**Migration is applied manually** (`prisma db execute` + committed migration SQL),
matching this repo's pattern — `prisma migrate dev` does not work here (no
`migration_lock.toml`; Supabase pooler can't create a shadow DB).

## API

- `serialize()` in `src/app/api/districts/[leaid]/notes/route.ts` returns `noteType`.
- `POST` accepts `noteType`; if absent, defaults to `general_update`; if present,
  validates against the five (400 otherwise).
- `PATCH` (`[noteId]/route.ts`) accepts and validates `noteType` when provided;
  preserves the existing value when omitted.
- A shared `isValidNoteType()` guard reads the canonical list.

## Frontend

- **`note-types.ts`** (new, in `components/notes/`): exports `NOTE_TYPES` (ordered
  `{ value, label, pillClass }[]`), `DEFAULT_NOTE_TYPE = "general_update"`, and an
  `isNoteType()` guard.
- **`NoteTypePicker.tsx`** (new): the single button + dropdown menu. Props
  `{ value, onChange }`. Button shows the current type's label in its pill color
  with a caret; menu lists the five; closes on select / outside-click / Esc.
- **`NoteComposer.tsx`**: holds `noteType` state (default `general_update`), renders
  `NoteTypePicker` above the editor, includes `noteType` in the emitted `NoteDraft`,
  resets to default after submit.
- **`NoteEntry.tsx`**: renders the type as a colored pill in the header row next to
  author + relative time.
- **`DistrictNotesCell.tsx`**: tints the count badge using the latest note's type
  color (needs the latest type from the row — see enrichment below). Empty cells
  unchanged ("+ Add note").
- **`queries.ts`**: `DistrictNoteEntry` gains `noteType: string`; create/update
  mutation args gain `noteType`.

## Grid enrichment + filtering

- **`district-notes-summary.ts`**: the summary query also returns the latest note's
  type. `ARRAY_AGG(note_type ORDER BY created_at DESC))[1] AS latest_type`; the
  `NoteSummary` gains `latestType`. The route exposes `notes_latest_type` on the row
  (camelized to `notesLatestType`), consumed by the cell tint.
- **`src/lib/saved-views/source-fields.ts`**: add a `note_type` virtual field to the
  `districts` source — `type: "text"`, `ops: ["is","is any of"]`, `virtual: true`,
  `requiresPlanContext: false`, with a multiselect widget over the five values.
- **`src/lib/saved-views/sql-compiler.ts`** (`compileVirtualField`): add a
  `note_type` branch →
  ```sql
  EXISTS (SELECT 1 FROM district_notes dn
          WHERE dn.district_leaid = <alias>."leaid"
            AND dn.note_type = ANY(<values>::text[]))
  ```
  Validates values against the five. No plan context required.
- The filter then appears automatically in the grid's filter picker (it reads
  `source-fields`), as a multi-select chip.
- **The multi-select renders the human labels** ("General update", "Risk flag", …)
  mapped from `NOTE_TYPES`, never the raw `snake_case` values — reps never see
  `general_update`. (Per project convention: no raw identifiers in user-facing UI.)

## Out of scope

- Per-type counts or grouping/timeline views (filtering is enough for now).
- Reminders driven by `next_step` (future; the type just labels the note).
- Editing the type set at runtime — it's a fixed code-level list.

## Testing

- API: POST defaults to `general_update` when omitted; rejects a bogus type (400);
  PATCH updates the type; GET returns it.
- DB: CHECK constraint rejects an invalid value.
- `note-types.ts`: `isNoteType` guard accepts the five, rejects others.
- `NoteTypePicker`: renders current type, opens menu, calls `onChange` on select.
- `NoteComposer`: emits `noteType` in the draft; defaults to `general_update`.
- `NoteEntry`: renders the correct pill label/color per type.
- `district-notes-summary`: `summarizeNoteRows` maps `latest_type`.
- `sql-compiler`: `note_type` filter compiles to the `EXISTS` subquery; rejects
  bogus values.
