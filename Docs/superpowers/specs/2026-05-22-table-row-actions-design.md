# Table View — Inline Row Actions — Design Spec

**Date:** 2026-05-22
**Status:** Approved (design); pending implementation plan
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar`
**Branch:** `worktree-saved-views-sidebar`

## Summary

Give reps inline, per-row actions in the Saved Views **Table view** so they can act on
a district without leaving the grid. A trailing kebab (`⋯`) menu on each row exposes
five actions:

1. **Log activity** — log an activity for the district.
2. **Add note** — append an entry to the district's note log.
3. **Set targets** — set/edit the four revenue targets for the district on this plan.
4. **Create opportunity** — deep-link out to the external LMS to create an opp.
5. **Remove from plan** — remove the district from the current plan.

The menu is **additive** — clicking a row still opens the detail panel as today.

## Scope & gating

The kebab column renders **only when the Table view is a plan's district list**:
`parentKind === "plan" && source === "districts"`. It does not appear in Lists, nor for
`opps` / `contacts` sources. This matches the Views-first release (Lists are being held
back) and the wording of every action (all assume a plan + a district).

## Non-Goals (this spec)

- District Notes Log **Phase 2 (mentions)** — `@`/`/`/`*`/`#` typeahead chips and the
  `district_note_mentions` table. Phase 1 (rich text, no mentions) is in scope; mentions
  are deferred (see the notes-log design doc).
- In-app opportunity **creation**. The app has no opp-write API; opps are created in the
  external LMS. "Create opportunity" is a click-out (see Decision D4).
- Bulk / multi-row actions. Each menu acts on a single district row.
- Actions for non-district sources (opps/contacts) or for Lists.

## Decisions Log

Resolved during brainstorming (visual companion + Q&A).

- **D1 — Trailing kebab menu.** A pinned `⋯` button per row opens a dropdown of the five
  actions. Chosen over hover-revealed icons (broken on touch — CLAUDE.md treats iPhone as
  first-class) and a right-click-only context menu (undiscoverable). A kebab works on
  touch and leaves room to add a right-click menu later.
- **D2 — "Add note" IS the District Notes Log.** "Add note" and the user's "show inline"
  requirement map exactly onto the already-designed **District Notes Log** feature
  (`Docs/superpowers/specs/2026-05-21-district-notes-log-design.md`), whose backend shipped
  but whose frontend is unbuilt. We **build that feature's Phase 1 frontend as part of this
  work**; the kebab "Add note" opens its composer, and the inline cell is its
  `DistrictNotesCell` (replacing `PlanNotesCell`).
- **D3 — "Set targets", not "reset".** The action opens an editor where the rep can set any
  value in any of the four target fields (renewal / expansion / winback / new business),
  prefilled with current values. Saving writes via the existing
  `useUpdateDistrictTargets`. Reversible — no destructive confirmation.
- **D4 — "Create opportunity" is an LMS click-out.** There is no in-app opp-write endpoint;
  opps are created in the LMS (the app's existing `+Opp` pattern). The action opens the LMS
  opp board in a new tab, scoped to the district's LMS account (`accountLmsId` /
  `districtLmsId`) if the LMS URL accepts an account param, else the generic board.
- **D5 — Plan + district rows only (v1).** See Scope & gating.

## Affordance & GridView integration

- A new trailing **actions column** is added to `GridView` (replacing / alongside the
  existing `width:100%` spacer cell), rendered only when gated per Scope.
- Each row's cell renders `RowActionsMenu` (the kebab button). The dropdown is **portaled**
  so it escapes the table's `overflow:auto` clip, reusing the positioning pattern already
  used by `GroupContextMenu` / `GridColumnMenu`.
- The kebab cell and the dropdown call `stopPropagation` on click so the row→detail-panel
  click delegation in `GroupCanvas` (`data-row-kind` / `data-row-id`) does not also fire.
- Mobile: kebab is tap-friendly; the dropdown renders as an anchored menu (or bottom sheet
  on < 640px). No `overflow:hidden` on `html/body`; `touch-action: pan-y` on scrollable
  popover bodies, never on a map ancestor.

## Components

New module: `src/features/views/components/grid/actions/`

- `RowActionsMenu.tsx` — kebab button + portaled dropdown. Props
  `{ planId: string; leaid: string; districtName: string }`. Owns which action surface is
  currently open (none / activity / note / targets / remove-confirm). Renders menu items;
  selecting one opens the corresponding surface. Names only — never raw IDs in any label.
- `SetTargetsPopover.tsx` — compact popover with four money inputs (Renewal / Expansion /
  Winback / New business) prefilled with the district's current targets; **Cancel** /
  **Save targets**. Save → `useUpdateDistrictTargets({ planId, leaid, renewalTarget,
  winbackTarget, expansionTarget, newBusinessTarget })` (single mutation). Reuses
  `TargetCard`'s money parse/format behavior. Blank input → `null` (unset).
- Remove confirm — inline two-step ("Remove?" → "Yes"), matching the existing
  `PlanDistrictsTab` remove pattern; no separate modal.

Reused as-is:

- **Log activity** → `src/features/plans/components/ActivityFormModal.tsx`, passed
  `districts=[{ leaid, name }]` (pre-selected) and the district's contacts; `onSubmit`
  wired to the existing plan activity-create mutation (mirror how the plan page wires it).
- **Create opportunity** → `window.open(lmsUrl, "_blank")`.
- **Remove from plan** → `useRemoveDistrictFromPlan({ planId, leaid })`.

## District Notes Log — Phase 1 frontend (in scope)

Implements the frontend described in `2026-05-21-district-notes-log-design.md`. Backend
(`district_notes` table + CRUD routes under `/api/districts/[leaid]/notes`) already shipped.

- `DistrictNotesCell.tsx` (`src/features/views/components/notes/`) — **replaces**
  `cells/PlanNotesCell.tsx` in `GridView`'s custom-cell dispatch for the notes column.
  Renders the latest `bodyText` snippet (truncated, `whitespace-nowrap`) + a count badge;
  empty → faint "+ Add note". Click opens the popover. Disabled when `planId == null`
  (same contract as the current cell).
- `NotesPopover.tsx` — floating panel anchored to the cell (bottom sheet < 640px),
  lazy-mounted (conditional render, not `enabled`-gated). Owns `useDistrictNotes(leaid)`.
  Composer on top, newest-first feed below.
- `NoteComposer.tsx` — TipTap editor + toolbar (B / I / bullet / numbered / link). ⌘↵
  saves, Esc cancels, empty-doc guard. Produces `{ bodyJson, bodyText }` for the POST.
- `NoteEntry.tsx` — author avatar + name + relative time + "edited" marker; body rendered
  **read-only via a TipTap renderer** (no `dangerouslySetInnerHTML`); author-only
  edit/delete.
- Hooks in `src/features/views/lib/queries.ts`: `useDistrictNotes`, `useCreateDistrictNote`,
  `useUpdateDistrictNote`, `useDeleteDistrictNote` (optimistic; query key
  `["district-notes", leaid]` — serialized primitives only).
- The kebab **Add note** opens the same `NotesPopover` (composer focused).
- **Latest-note virtual sort** (LEFT JOIN CTE on `MAX(created_at)`, `NULLS LAST`) — optional;
  may defer to a follow-up.

**New dependencies:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`.
StarterKit configured with `#`-heading and `*`/`_` bold/italic input rules disabled (so
those chars stay free for Phase 2 mention triggers). Mention extensions are Phase 2.

## Data flow & cache invalidation

- `useUpdateDistrictTargets` already optimistically patches the plan/district caches. Also
  invalidate the `useViewsData` grid query after a targets save so the grid's target
  columns refresh.
- `useRemoveDistrictFromPlan` currently invalidates `territoryPlans` / `territoryPlan` /
  `explore` / `teamProgress` / `leaderboard` but **not** the `useViewsData` query — so the
  removed row would linger in the grid. **Add views-data invalidation** (from the menu's
  `onSuccess` or by extending the hook) so the row disappears immediately.
- Note CRUD hooks invalidate `["district-notes", leaid]`; the `DistrictNotesCell` snippet
  reflects the latest entry on the next read.

## Build phasing

Small, focused commits (per the regular-commits convention; stage only touched files —
never `git add -A`, since parallel sessions share this branch):

- **A — Kebab column + 4 actions.** `RowActionsMenu` (gated to plan+districts) +
  `SetTargetsPopover` + Log activity (ActivityFormModal) + Create-opp click-out + Remove
  (confirm + views-data invalidation). Ships four working actions; "Add note" disabled or
  hidden until B.
- **B — District Notes Log Phase 1.** TipTap deps + `DistrictNotesCell` (replacing
  `PlanNotesCell`) + `NotesPopover` + `NoteComposer` + `NoteEntry` + the four hooks. Wire
  kebab "Add note" to the popover.
- **C — (optional) latest-note virtual sort.**

## Testing

Vitest + Testing Library, co-located in `__tests__/`:

- **Menu:** renders only when `parentKind === "plan" && source === "districts"`; hidden
  otherwise. Kebab click opens dropdown; menu/kebab `stopPropagation` (row-click /
  detail-panel delegation does not fire). Each item opens its surface.
- **Set targets:** popover prefills current values; Save calls `useUpdateDistrictTargets`
  with all four fields; blank → `null`.
- **Remove:** two-step confirm; on success the row leaves the grid (views-data invalidated).
- **Create opportunity:** opens the expected LMS URL (district-scoped when an account id is
  present, generic otherwise).
- **Notes Log Phase 1:** cell snippet/count/empty state + opens popover; popover lazy
  mount, newest-first, load-older; composer ⌘↵ submit / Esc cancel / empty guard / toolbar
  formatting; API CRUD incl. author-only PATCH/DELETE (403 for non-author).

## Open questions

- **LMS opp URL scheme** — confirm whether the LMS opportunity URL accepts an account /
  district param (`accountLmsId` / `districtLmsId`) for pre-scoping; if not, ship the
  generic board click-out and revisit. Resolve during planning.

## Concurrency note

Multiple Claude sessions commit to `worktree-saved-views-sidebar`. Before editing shared
files (`GridView.tsx`, `views/lib/queries.ts`, `package.json`) re-read them fresh — another
session may have changed them — and stage only the exact files each commit touches.
