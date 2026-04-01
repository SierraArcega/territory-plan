# Activity Contact Linking

## Problem

The activity creation form has no way to link external contacts (district personnel) to activities. The backend already supports `contactIds` on activity creation and the `ActivityContact` join table exists, but the form never sends them. Users need to associate contacts with activities for all activity types, with the ability to search, filter by district, and create new contacts inline.

## Design

### New Component: `ContactSelect`

A searchable, multi-select contact picker at `src/features/activities/components/event-fields/ContactSelect.tsx`.

**Behavior:**
- Displays selected contacts as removable chips/tags
- Search input queries `GET /api/contacts?search=...&leaid=...` (name, title, email)
- Optional district filter dropdown narrows results to a single district
- District filter shows all districts in the system (not just plan-linked)
- Results list shows: contact name, title (role), district name
- Already-selected contacts show a checkmark and are de-selectable
- "Create New" row always visible at bottom of results; prominent when no matches found

**Inline Create Form:**
Clicking "Create New" expands an inline form within the dropdown:
- Name (required)
- Title (optional)
- Email (optional)
- District (required, searchable dropdown of all districts)

On save: `POST /api/contacts` creates the contact, then auto-adds it to the selected list.

### API Change

`GET /api/contacts` — add optional `leaid` query param to filter contacts by district.

### Form Integration

In `ActivityFormModal`:
- New state: `selectedContactIds: number[]`
- `ContactSelect` placed in left panel under "People & Organization", below the existing Attendees field
- Available for all activity types (not gated by category)
- `selectedContactIds` passed to `handleSubmit` as `contactIds`
- Reset in `resetForm()`

### What stays the same

- `AttendeeSelect` remains for internal Fullmind team members (users)
- `ContactSelect` is for external contacts at districts
- No changes to the `ActivityContact` model or activity creation API (both already support this)

## Files to Change

1. **`src/app/api/contacts/route.ts`** — add `leaid` filter to GET handler
2. **`src/features/activities/components/event-fields/ContactSelect.tsx`** — new component
3. **`src/features/activities/components/ActivityFormModal.tsx`** — add `selectedContactIds` state, wire up ContactSelect, pass to submit
