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

## Part 1 — Visual Alignment

### Problem

The Lineup (`LineupView.tsx`) uses `bg-gray-50` and a different header/toolbar structure from the Activities tab (`ActivitiesView.tsx`). The two views feel like different products despite serving related purposes.

### Changes

**Background:** `bg-gray-50` → `bg-[#FFFCFA]`

**Header:** Align to Activities pattern — white card with bottom border, `px-6 py-4`. The Lineup title stays "The Lineup"; the date/weekday display moves into the header subtitle area. The person selector bar (chips + Add person) stays in the header below the date navigation — it is Lineup-specific.

**Toolbar:** `bg-white border-b border-gray-200 px-6 py-3` strip matching Activities. "New Activity" button keeps `bg-[#403770]` pill style.

**Filters:** The current plan and state chip-based filters are replaced with canonical **MultiSelect dropdowns** (per `docs/superpowers/specs/2026-03-14-multi-select-enhancements-design.md`) — one dropdown for "Plans" and one for "States". Both support search, Select All, keyboard navigation, and removable chips.

**Timeline/table toggle:** A small icon-button pair on the right side of the toolbar (list icon = timeline, table icon = table), mirroring how Activities has its calendar toggle on the right. Group-by toggle is hidden in table mode — grouping only applies to the timeline.

---

## Part 2 — Lineup Table View

### Behaviour

When the table toggle is active, `LineupView` renders `ActivitiesTable` in place of the grouped timeline. The same MultiSelect dropdowns (Plans, States) apply in both views. The date navigation and person selector remain visible in the header regardless of view mode.

### Assignee Column

`ActivitiesTable` receives a new optional `showAssignee?: boolean` prop (default `false`). When `true`, an **Assignee** column is inserted between Title and Status:

- Shows assigned user's avatar (or initials fallback) + full name
- Muted "—" when no assignee is set
- Sort comparator: alphabetical by full name (ascending/descending)

`LineupView` passes `showAssignee={true}`. `ActivitiesView` (Activities tab) does not pass this prop and is unaffected.

---

## Part 3 — Associated Person Field

### Problem

`assignedToUserId` (the owner/rep) implies responsibility and a license requirement. There is a separate need to associate an **external contact or additional teammate** with an activity — someone involved but not the owner. Conflating both concepts in a single field creates confusion.

### Data Model

Two new nullable columns on the `Activity` table:

```prisma
associatedUserId    String?  @map("associated_user_id") @db.Uuid
associatedContactId String?  @map("associated_contact_id") @db.Uuid

associatedUser    UserProfile? @relation("ActivityAssociatedUser", fields: [associatedUserId], references: [id], onDelete: SetNull)
associatedContact Contact?     @relation(fields: [associatedContactId], references: [id], onDelete: SetNull)
```

- Both default to null
- No mutual exclusivity constraint — an activity may have both an associated user and an associated contact
- Existing activities are unaffected (both columns null by default)
- `onDelete: SetNull` — deleting a user or contact does not cascade-delete the activity

### API Changes

**`ActivityListItem`** gains two new optional fields:

```ts
associatedUser:    { id: string; fullName: string | null; avatarUrl: string | null } | null
associatedContact: { id: string; name: string } | null
```

**POST `/api/activities`** and **PATCH `/api/activities/[id]`** accept optional `associatedUserId?: string | null` and `associatedContactId?: string | null`. Omitting these fields leaves existing values unchanged. Passing `null` explicitly clears the association.

### UI — Associated Person Picker

A new optional field in `ActivityFormModal`, labelled **"Associated person"**, placed below the existing Assignee ("Owner") field.

**Picker behaviour:**
- A single search input that queries both `UserProfile` and `Contact` simultaneously
- Results render in two labelled sections: **"Team"** (internal users) and **"Contacts"** (external contacts)
- Each result: name + type indicator (initials avatar for users, person icon for contacts)
- When no contacts exist in the system, the "Contacts" section renders with its header and an empty state: "No contacts yet" — so users know the option exists
- Only one person can be associated at a time (matching the two-column model)
- Once selected: person's name shown as a removable chip; clicking × clears the association
- Empty state placeholder: "Add a contact or teammate"

**Data queries:**
- Uses existing `useUsers()` hook for team members
- Uses existing contacts query hook (or `useContacts()` if one exists) for external contacts

---

## Files Changed

### New files
None — all work is modifications to existing files.

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `associatedUserId` + `associatedContactId` nullable FKs to `Activity`; add inverse relations on `UserProfile` and `Contact` |
| `prisma/migrations/YYYYMMDD_add_activity_associated_person/migration.sql` | New migration: two nullable columns |
| `src/lib/api-types.ts` | Add `associatedUser` and `associatedContact` optional fields to `ActivityListItem` |
| `src/app/api/activities/route.ts` | POST: include `associatedUserId`, `associatedContactId` in create payload; return in response |
| `src/app/api/activities/[id]/route.ts` | PATCH: accept and apply `associatedUserId`, `associatedContactId`; return in response |
| `src/features/activities/components/ActivityFormModal.tsx` | Add associated person picker field below Assignee |
| `src/features/plans/components/ActivitiesTable.tsx` | Add optional `showAssignee` prop; insert Assignee column with sort comparator |
| `src/features/lineup/components/LineupView.tsx` | Visual alignment (bg, header, toolbar); replace chip filters with MultiSelect dropdowns; add timeline/table toggle; render `ActivitiesTable` with `showAssignee={true}` in table mode |

---

## Out of Scope

- Multiple associated people per activity (single association only for now)
- Showing associated person in `ActivityRow` (timeline row) — table view only
- Contact creation flow from within the picker
- Assignee Slack notifications
- Plan → district filter narrowing in Lineup filters
