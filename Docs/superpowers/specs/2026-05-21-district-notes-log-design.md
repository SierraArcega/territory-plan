# District Notes Log — Design Spec

**Date:** 2026-05-21
**Status:** Approved (design); pending implementation plan
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar`
**Branch:** `worktree-saved-views-sidebar`

## Summary

Replace the free-text **Notes** column in the districts grid (Saved Views) with a
**district-scoped, rich-text note log**. One log per district, shared across every
plan that district appears in. Each entry is authored, timestamped, formatted via a
WYSIWYG editor (bold / italic / lists / links), and can reference four record types
as clickable chips through trigger characters:

| Trigger | Mentions | Suggestion source |
|---|---|---|
| `@` | Contacts | `/api/contacts` (this district's contacts first, then global) |
| `/` | Districts | `/api/districts/search` |
| `*` | Opportunities | `/api/opportunities?search=` |
| `#` | Activities | `/api/activities?search=` *(title search param to be added)* |

The log is the foundation for a future combined relationship **timeline** (notes
interleaved with district-scoped activities), which is why entries are
district-scoped and mentions are stored as structured references.

## Goals

- Turn the Notes cell from a single editable string into a chronological log of
  discrete, timestamped, authored entries.
- Support rich text (bold, italic, bullet/numbered lists, links).
- Let reps link related records inline (`@` contact, `/` district, `*` opp,
  `#` activity) as chips that render names (never IDs) and click through to the
  record.
- Keep the rep in the grid — logging a note should be fast and not require leaving
  the row.
- Persist structured mention references so we can later (a) build a timeline and
  (b) answer "show every note that mentions this contact/opp/activity".

## Non-Goals (this spec)

- Building the combined timeline view itself (notes + activities interleaved). The
  data model enables it; the view is a separate future feature.
- Migrating existing per-plan `territory_plan_districts.notes` values into the new
  district log (they are scoped differently — see Decision D7).
- Turning notes into Activities. Explicitly rejected (see Decision D1).
- Cross-rep privacy controls / private notes. Logs are team-visible (see D6).

## Decisions Log

These were resolved during brainstorming (visual companion + Q&A).

- **D1 — Standalone log, not Activities.** A note is its own lightweight record,
  mirroring the existing `ActivityNote` pattern (one row per author entry, shown as
  a chronological feed). Notes do **not** become `Activity` rows. Rationale: avoids
  inflating activity counts / leaderboard / calendar sync; fast to build; still
  mergeable into a timeline later.
- **D2 — District-scoped (shared).** The log is keyed by `district_leaid`, not by
  `(plan_id, district_leaid)`. The same history shows in every plan the district is
  in, and lines up with district-scoped activities for a future timeline. This
  deliberately diverges from how churn risk / targets are scoped (those stay
  per-plan-district).
- **D3 — Popover surfacing.** Clicking the Notes cell opens a roomy floating
  popover over the grid (composer on top, newest-first feed below). Chosen over a
  detail-panel tab for speed (fewest clicks while scanning a list).
- **D4 — Rich text via real editor.** TipTap WYSIWYG (not a markdown textarea).
  Chosen because mentions (D5) require a real editor to be done well; a
  textarea-based `@`-mention is deceptively fragile (caret tracking, non-atomic
  chips). TipTap also delivers true type-and-see WYSIWYG.
- **D5 — Four mention types** with the trigger mapping in the table above. Chips
  carry structured references and render names, never IDs. `#` and `*` markdown
  input rules are disabled so those characters are free as triggers.
- **D6 — Team-visible; author owns their entries.** Anyone who can see the district
  sees the log; any signed-in user can add. Authors can edit and delete their own
  entries; edited entries show an "edited" marker; other authors' entries are
  read-only.
- **D7 — Leave legacy per-plan notes in place.** The
  `territory_plan_districts.notes` column is not dropped and not auto-migrated. The
  grid's Notes column now reads the new district log instead.

## Data Model

Two new tables. SQL is illustrative; the migration is authored during
implementation.

```sql
CREATE TABLE district_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_leaid VARCHAR(7) NOT NULL REFERENCES districts(leaid) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES user_profiles(id),
  body_json     JSONB NOT NULL,          -- TipTap/ProseMirror document
  body_text     TEXT  NOT NULL DEFAULT '', -- flattened plaintext: cell snippet + search
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX district_notes_leaid_created_idx ON district_notes (district_leaid, created_at DESC);
CREATE INDEX district_notes_author_idx ON district_notes (author_id);

CREATE TABLE district_note_mentions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID NOT NULL REFERENCES district_notes(id) ON DELETE CASCADE,
  entity_type VARCHAR(16) NOT NULL CHECK (entity_type IN ('contact','district','opportunity','activity')),
  entity_id   TEXT NOT NULL,           -- text: ids differ per type (int / varchar(7) / uuid)
  label       TEXT NOT NULL,           -- display name captured at insert time
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX district_note_mentions_note_idx ON district_note_mentions (note_id);
CREATE INDEX district_note_mentions_entity_idx ON district_note_mentions (entity_type, entity_id);
```

Prisma models `DistrictNote` and `DistrictNoteMention` added to `schema.prisma`
with the corresponding relations on `District` and `UserProfile`.

**Why `body_json` + `body_text`:** the JSON doc is the source of truth (preserves
formatting + mention nodes for read-only re-render); `body_text` is a denormalized
flattened copy maintained on write, used for the grid cell snippet and any future
text search. Mentions are re-derived from the doc on each write and the
`district_note_mentions` rows are replaced transactionally.

## API

All routes use the project's `getUser()` auth pattern. CRUD lives under the
district resource since the log is district-scoped.

- `GET /api/districts/[leaid]/notes` — list entries newest-first (paginate: recent
  50, `?cursor=` for older). Returns author `{ id, fullName, email }`, `bodyJson`,
  `createdAt`, `updatedAt`, and resolved mentions.
- `POST /api/districts/[leaid]/notes` — body `{ bodyJson, bodyText, mentions[] }`.
  Validates the doc shape, writes the note + replaces mention rows in one
  transaction. Returns the created entry.
- `PATCH /api/districts/[leaid]/notes/[noteId]` — author-only; updates
  `bodyJson` / `bodyText`, re-derives mentions, sets `updated_at`.
- `DELETE /api/districts/[leaid]/notes/[noteId]` — author-only.

**Suggestion (typeahead) endpoints** — reuse existing where possible:
- Contacts: `GET /api/contacts?search=<q>&leaid=<leaid>` — route already accepts
  `search` / `leaid` / `leaids` / `limit`. Scope the primary typeahead to the
  district's contacts via `leaid`; a secondary unscoped call (`search` only) backs
  the "search all contacts" fallback. No new endpoint needed.
- Districts: `GET /api/districts/search?q=<q>`.
- Opportunities: `GET /api/opportunities?search=<q>&limit=10` (already supported).
- Activities: `GET /api/activities?search=<q>` — **add** a free-text `title ILIKE`
  param to the existing list route.

## Frontend

New module under `src/features/views/components/notes/` (feature-local; the cell
already lives in the views grid).

- `DistrictNotesCell.tsx` — replaces the current `cells/PlanNotesCell.tsx` in the
  grid's custom-cell dispatch. Renders latest `body_text` snippet (truncated,
  `whitespace-nowrap`) + count badge; empty → faint "+ Add note". Opens the
  popover on click. Read-only/disabled state matches the existing cell contract.
- `NotesPopover.tsx` — floating panel anchored to the cell (bottom sheet < 640px).
  Lazy-mounted (conditional render, not an `enabled`-gated query). Owns the
  `useDistrictNotes` query. Composer on top, newest-first feed below, scrolls.
- `NoteComposer.tsx` — TipTap editor + formatting toolbar (B / I / bullet /
  numbered / link) + the four mention extensions. ⌘↵ saves; Esc cancels.
- `NoteEntry.tsx` — one entry: author avatar + name + relative time + "edited"
  marker; body rendered **read-only via a TipTap renderer** (no
  `dangerouslySetInnerHTML`). Author-only edit/delete affordances.
- `mentions/` — TipTap `Mention` configs (one per type), the shared
  `SuggestionList.tsx` dropdown, chip node-views (color/icon per type), and the
  per-type fetchers.

**Editor stack:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`,
`@tiptap/suggestion`, `@tiptap/extension-link`. StarterKit configured with the
`#`-heading and `*`/`_`-bold/italic input rules disabled so trigger chars are free;
formatting via toolbar buttons + ⌘B / ⌘I keyboard shortcuts.

**Chip styling (brand tokens):** contact `#DCF0EF`/`#1F6E6A`, district
`#EFEBF7`/`#6F4C8C`, opportunity `#FBEFD9`/`#8A5C00`, activity `#E2E8F7`/`#3B5BA5`.
Lucide icons, `currentColor`. Chips click through to the record's detail
(contact/opp/activity detail panel; district detail).

**Queries/hooks** (`src/features/views/lib/queries.ts`): `useDistrictNotes(leaid)`,
`useCreateDistrictNote`, `useUpdateDistrictNote`, `useDeleteDistrictNote` with
optimistic updates; query keys use serialized primitives (`["district-notes", leaid]`).
Mention typeahead hooks are debounced and keyed by `(type, query)`.

**Grid sort:** "latest note" is a virtual sort field compiled the same way as
`customer_rank` — a `LEFT JOIN` to a CTE selecting `MAX(created_at)` per
`district_leaid` from `district_notes`, ordered `NULLS LAST`.

## Edge cases & constraints

- **Mention to a deleted record** — chip keeps its captured `label`; click target
  resolves to "not found" gracefully (no crash, no raw id shown).
- **Empty / whitespace-only doc** — composer disables Save; never persists an empty
  entry.
- **Long history** — paginate at 50; "Load older" control. Cell snippet always
  reflects the single latest entry.
- **Mobile** — popover renders as a scroll-safe bottom sheet; no `overflow:hidden`
  on `html/body`; `touch-action: pan-y` on the feed, never on a map ancestor.
- **Performance** — popover and editor mount only when opened; entries virtualize
  only if a single district exceeds the paginated window (defer unless needed).
- **No raw IDs in any user-facing output** — chips and cell render names/labels
  only (per project convention).

## Build phasing

One feature, shipped in two safe phases:

- **Phase 1 — Rich-text log (no mentions).** `district_notes` table + CRUD API +
  hooks + `DistrictNotesCell` (snippet/count/sort) + `NotesPopover` + TipTap rich
  text + read-only render. Ships a usable formatted log.
- **Phase 2 — Mentions.** Four `Mention` extensions + typeahead wiring +
  `district_note_mentions` table + chip node-views + clickable chips + the
  activities `search` param. Layered on without reworking Phase 1 storage (the
  `body_json` format already accommodates mention nodes).

## Testing

Vitest + Testing Library, co-located in `__tests__/`:

- Cell: snippet truncation, count badge, empty state, opens popover.
- Popover: lazy mount, open/close, newest-first ordering, "load older".
- Composer: ⌘↵ submit, Esc cancel, empty-doc guard, toolbar formatting.
- Mentions: each trigger opens its typeahead; selecting inserts a chip; save →
  reload round-trips the doc and mention rows; chips render label not id.
- API: each CRUD route incl. author-only PATCH/DELETE auth (403 for non-author),
  transactional mention replacement.
- SQL: latest-note virtual sort orders correctly with NULLS LAST.

## Open questions

None outstanding — all design forks resolved during brainstorming.
