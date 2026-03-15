# Lineup Visual Alignment & Associated Contacts — Design Spec

**Date:** 2026-03-15
**Branch:** `aston-sortable-tables` (or new branch from main post-merge)
**Status:** Design approved, pending implementation plan

---

## Overview

Three related improvements shipped together:

1. **Visual alignment** — Lineup's chrome, toolbar, and filter controls updated to match the Activities tab look and feel
2. **Table/timeline toggle** — Lineup gains a switchable table view alongside the existing timeline, using the shared `ActivitiesTable` with an Assignee column
3. **Associated person field** — Activities gain an optional "Associated person" field (one internal user OR one external contact) distinct from the owner/assignee

---

## Prerequisites

The canonical `MultiSelect` component (specified in `docs/superpowers/specs/2026-03-14-multi-select-enhancements-design.md`) must be built before or alongside this work. It does not yet exist as a standalone reusable component — the existing `MultiSelectChip.tsx` and `MultiSelectActionBar.tsx` are unrelated. The `MultiSelect` component is a hard dependency for Part 1 (filter dropdowns). Its implementation can be part of the same PR.

---

## Part 1 — Visual Alignment

### Problem

`LineupView` uses `bg-gray-50` and a different header/toolbar structure from `ActivitiesView`. The two views feel like different products despite serving related purposes.

### Changes

**Background:** `bg-gray-50` → `bg-[#FFFCFA]`

**Header:** Align to Activities pattern — white card with bottom border, `px-6 py-4`. The Lineup title stays "The Lineup"; the date/weekday display moves into the header subtitle area. The person selector bar (chips + Add person) stays in the header below the date navigation — it is Lineup-specific.

**Toolbar:** `bg-white border-b border-gray-200 px-6 py-3` strip matching Activities. "New Activity" button keeps `bg-[#403770]` pill style.

**Filters:** The current plan and state chip-based filters are replaced with canonical `MultiSelect` dropdowns — one for "Plans" and one for "States". Both use the full spec: search input, Select All row, keyboard navigation, removable chips. The `MultiSelect` component is built in `src/features/shared/components/MultiSelect.tsx`.

**Known limitation — Plan filter precision:** The existing plan filter can only distinguish "has a plan / no plan" because `ActivityListItem` does not carry `planIds`. This limitation is preserved as-is — fixing it requires a separate API change and is out of scope.

**Timeline/table toggle:** A small icon-button pair on the right side of the toolbar (list icon = timeline, table icon = table), mirroring how Activities has its calendar toggle on the right.

**Group-by toggle:** Conditionally rendered — present in timeline mode, removed from the DOM in table mode. The active group-by value is preserved in React state when switching to table mode, so switching back to timeline restores the last-used grouping. No persistence across page navigations (in-memory only).

---

## Part 2 — Lineup Table View

### Behaviour

When the table toggle is active, `LineupView` renders `ActivitiesTable` in place of the grouped timeline, passing its already-fetched and client-filtered `filteredActivities` array directly as the `activities` prop. `ActivitiesTable` is a pure presentational component — it accepts data, does not fetch its own. The same MultiSelect dropdowns (Plans, States) and the date navigation + person selector in the header apply in both views.

**Toggle persistence:** In-memory only — resets to timeline when navigating away and back.

**`ActivitiesTable` props from `LineupView`:**

`ActivitiesTable` requires `onEdit`, `onDelete`, and optional `isDeleting`. `LineupView` supplies:
- `onEdit={handleOpenEdit}` — opens the existing `ActivityFormModal` in edit mode (already implemented in `LineupView`)
- `onDelete={handleDeleteActivity}` — a new handler added to `LineupView` using `useDeleteActivity()`, following the same confirm-then-mutate pattern as `ActivitiesView`
- `isDeleting={deleteActivity.isPending}`

### Assignee Column

`ActivitiesTable` receives a new optional `showAssignee?: boolean` prop (default `false`). When `true`, an **Assignee** column is inserted between Title and Status.

**Data:** `ActivityListItem` gains a new resolved field `assignedTo: { id: string; fullName: string | null; avatarUrl: string | null } | null`. The API layer resolves this by joining `UserProfile` on `assignedToUserId`. The existing `assignedToUserId: string | null` field is retained for callers that need the raw ID.

**Display:**
- Shows assigned user's avatar (or initials fallback) + full name
- Muted `—` (em dash) when `assignedTo` is null
- Sort comparator: alphabetical by full name (ascending/descending); activities with no assignee sort last in both directions

**Column widths (table-fixed redistribution):** The existing 5 variable columns total 90% (`w-[30%]` title, `w-[15%]` type, `w-[12%]` status, `w-[18%]` date, `w-[15%]` scope). Adding the Assignee column requires redistributing those 90% across 6 columns. When `showAssignee={true}`, apply: title `w-[25%]`, type `w-[12%]`, assignee `w-[13%]`, status `w-[12%]`, date `w-[17%]`, scope `w-[11%]`. The icon (`w-[28px]`) and actions (`w-20`) columns are unchanged.

`LineupView` passes `showAssignee={true}`. `ActivitiesView` does not pass this prop and is unaffected.

---

## Part 3 — Associated Person Field

### Problem

`assignedToUserId` (the owner/rep) implies responsibility and a license requirement. There is a separate need to associate an **external contact or additional teammate** with an activity — someone involved but not the owner.

### Data Model

Two new nullable columns on the `Activity` table:

```prisma
// Direct FK to a single associated internal user — bare column, no @relation directive.
// Consistent with createdByUserId and assignedToUserId pattern.
associatedUserId    String? @map("associated_user_id") @db.Uuid

// Direct FK to a single associated external contact. Contact.id is Int.
associatedContactId Int?    @map("associated_contact_id")

// @relation object for the contact FK — needed for onDelete: SetNull and back-reference.
associatedContact   Contact? @relation("ActivityAssociatedContact", fields: [associatedContactId], references: [id], onDelete: SetNull)
```

**`associatedUserId` — bare column:** Follows the same pattern as `createdByUserId` and `assignedToUserId` — no `@relation` directive, no back-reference on `UserProfile`, no Prisma-level cascade. Deleting a `UserProfile` will orphan the UUID value (consistent with existing behavior).

**Contact relation and disambiguation:** The existing `ActivityContact` junction table creates `Activity ↔ ActivityContact` and `Contact ↔ ActivityContact` relations — not a direct `Activity ↔ Contact` relation. Adding `associatedContact` is the **first** direct `Activity ↔ Contact` relation, so no disambiguation of existing junction-table relations is required. The `@relation("ActivityAssociatedContact")` name is provided for clarity. Back-reference on `Contact`:

```prisma
// On Contact — add this field:
associatedActivities Activity[] @relation("ActivityAssociatedContact")
```

The existing `activityLinks ActivityContact[]` on `Contact` is unchanged.

**`onDelete` summary:**
- `associatedContactId` → `SetNull` via Prisma `@relation`: deleting a Contact nulls the FK
- `associatedUserId` → no Prisma cascade (bare column): consistent with existing FK columns

**Indexes:**

```prisma
@@index([associatedUserId])
@@index([associatedContactId])
```

**Migration:** Prisma-generated via `prisma migrate dev`:
- `associated_user_id UUID NULL` — no FK constraint (bare column)
- `associated_contact_id INTEGER NULL` — with `REFERENCES contacts(id) ON DELETE SET NULL`

### API Changes

**`ActivityListItem`** in `src/features/shared/types/api-types.ts` gains (re-exported automatically via `src/lib/api.ts` → `export type * from "@/features/shared/types/api-types"`, so all existing consumers pick up the new fields without any change to `src/lib/api.ts`):

```ts
assignedTo:        { id: string; fullName: string | null; avatarUrl: string | null } | null
associatedUser:    { id: string; fullName: string | null; avatarUrl: string | null } | null
associatedContact: { id: number; name: string } | null
```

The existing `assignedToUserId: string | null` field is retained.

**POST `/api/activities`** and **PATCH `/api/activities/[id]`** accept optional `associatedUserId?: string | null` and `associatedContactId?: number | null`. Omitting fields leaves existing values unchanged. Passing `null` explicitly clears the association.

**Mutual exclusivity:** The API does not enforce that only one of `associatedUserId` / `associatedContactId` is set — the UI is the sole guard. If inconsistent state exists (both set), the display rule is: show `associatedUser`; silently ignore `associatedContact` until the user edits and re-saves.

### UI — Associated Person Picker

A new optional field in `ActivityFormModal`, labelled **"Associated person"**, placed below the existing Assignee ("Owner") field.

**Structure:** A single search input. Results render in a dropdown with two labelled sections: **"Team"** (internal users) and **"Contacts"** (external contacts).

**Search behaviour:**
- `useUsers()` is loaded once on mount, filtered client-side
- `useContacts({ search: query })` fired on 300 ms debounce, minimum 2 characters. Below 2 characters the component displays its `lastResults` ref — a local ref updated each time `useContacts()` returns non-empty results. On first open before any search, `lastResults` is empty.
- A separate `useContacts({})` call on mount (no query) determines the total contact count for the "No contacts yet" vs "No contacts match" distinction

**"No contacts yet" vs "No contacts match":**
- `data?.total === 0` from the mount-time `useContacts({})` call → always show `"No contacts yet"` regardless of search (`data` is the full `ContactsResponse` object; `total` is a top-level field on it)
- `data?.total > 0` but the search call returns `data?.contacts.length === 0` → show `"No contacts match"`

**Result rows:**
- Team: initials avatar (or photo) + full name
- Contacts: person icon + name + district name (to disambiguate same-name contacts)

**States:**

| State | Team section | Contacts section |
|---|---|---|
| Loading (`useContacts` in-flight) | Immediate (client-side) | Single shimmer row: `animate-pulse bg-gray-100 rounded` |
| Error (`useContacts` errors) | Unaffected | `"Couldn't load contacts"` → `px-3 py-2 text-sm text-red-400` |
| No contacts in system | — | `"No contacts yet"` → `px-3 py-2 text-sm text-[#A69DC0] italic` |
| Search returns 0 results | — | `"No contacts match"` → `px-3 py-2 text-sm text-[#A69DC0] italic` |
| Team never empty | At least current user always present | — |

**Selection:** Once selected, person's name renders as a removable chip (`inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]`). Clicking × clears and restores the search input. Selecting a new person (either type) clears the previous selection.

**Empty state placeholder (no selection):** `"Add a contact or teammate"` in muted text.

---

## Files Changed

### New files

| File | Purpose |
|---|---|
| `src/features/shared/components/MultiSelect.tsx` | Canonical multi-select dropdown (prerequisite — per multi-select spec) |

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `associatedUserId` bare column + `associatedContactId` + `associatedContact` named relation on Activity; add `associatedActivities` back-reference on Contact; add `@@index` for both new columns |
| `prisma/migrations/<timestamp>_add_activity_associated_person/` | Prisma-generated: `associated_user_id UUID NULL` (no FK) + `associated_contact_id INTEGER NULL REFERENCES contacts(id) ON DELETE SET NULL` |
| `src/features/shared/types/api-types.ts` | Add `assignedTo`, `associatedUser`, `associatedContact` to `ActivityListItem` |
| `src/app/api/activities/route.ts` | POST: resolve `assignedTo` via join; accept + return `associatedUserId`, `associatedContactId` |
| `src/app/api/activities/[id]/route.ts` | PATCH: resolve `assignedTo` via join; accept + apply `associatedUserId`, `associatedContactId` |
| `src/features/activities/components/ActivityFormModal.tsx` | Add associated person picker field below Assignee |
| `src/features/plans/components/ActivitiesTable.tsx` | Add optional `showAssignee` prop; Assignee column using `assignedTo` resolved field; sort comparator (no assignee sorts last) |
| `src/features/lineup/components/LineupView.tsx` | Visual alignment; MultiSelect filter dropdowns; timeline/table toggle; conditional group-by toggle; `handleDeleteActivity` via `useDeleteActivity()`; render `ActivitiesTable` with `showAssignee`, `onEdit`, `onDelete`, `isDeleting` in table mode |

---

## Out of Scope

- Multiple associated people per activity (single association only for now)
- Showing associated person in `ActivityRow` (timeline row) — table view only
- Contact creation flow from within the picker
- Assignee Slack notifications
- Plan → district filter narrowing in Lineup (requires `planIds: string[]` on `ActivityListItem`)
- Toggle persistence across navigations (in-memory only)
- `onDelete` cascade for `associatedUserId` (bare column, consistent with `assignedToUserId` pattern)
