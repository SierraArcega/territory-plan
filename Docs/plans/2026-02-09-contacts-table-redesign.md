# Contacts Table Redesign — HubSpot-Style CRM Experience

**Date:** 2026-02-09
**Status:** Draft
**Branch:** `feature/contacts-table-redesign` (to be created)

## Problem

The current ContactsTable is functional but feels like a basic data table rather than a CRM tool. It doesn't show which district a contact belongs to, has no row selection/bulk actions, and no footer summary. The layout doesn't leave room for future activity tracing columns.

## Inspiration

Attio/HubSpot CRM contact list views — clean spreadsheet-style table with checkbox selection, bulk action toolbar, and activity columns that make it easy to see engagement at a glance.

## Goals

1. Make the contacts tab feel like a lightweight CRM, not just a data dump
2. Show which district each contact belongs to
3. Add row selection with bulk action bar
4. Structure the UX so activity tracing columns can be added later without a redesign
5. Add footer with total count

---

## Column Layout

### Current
```
Name | Title | Email | Phone | Persona | Seniority | Actions
```

### New
```
☐ | Person | Email | District | Department | Seniority | Last Activity | Actions
```

### Column Details

| Column | Width | Content | Notes |
|--------|-------|---------|-------|
| Checkbox | 40px | Row selection checkbox | Header checkbox for select-all |
| Person | flex | Name + PRIMARY badge, title as subtitle | Two-line cell: bold name on top, gray title below |
| Email | 200px | Clickable mailto link | Truncated with ellipsis |
| District | 180px | District name (resolved from `leaid`) | Clickable — navigates to district detail |
| Department | 140px | Persona badge (colored) | Existing badge styling |
| Seniority | 140px | Seniority badge (colored) | Existing badge styling |
| Last Activity | 140px | Placeholder: "No activity" (gray italic) | **Future:** date + activity type when tracing is built |
| Actions | 80px | LinkedIn, Edit, Delete | Same as current |

### Why this column order?

- **Person + Email** side by side — the two things you look at first when scanning a contact list (matches HubSpot pattern)
- **District** right after email — answers "who is this person and where are they?" in one left-to-right scan
- **Department + Seniority** — persona context grouped together
- **Last Activity** at the end before actions — future activity tracing slot. Starts as a placeholder column so the UX is already shaped for it. When activity tracing ships, this column lights up with real data without moving anything around

---

## Row Selection & Bulk Actions

### Checkbox Behavior
- Individual row checkboxes toggle selection
- Header checkbox: unchecked → selects all visible (filtered) contacts, checked → deselects all
- Partial selection shows indeterminate state (dash) in header checkbox
- Selected rows get a subtle highlight: `bg-[#C4E7E6]/20` (mint tint)

### Bulk Action Bar
Appears as a sticky bar at the bottom of the table when 1+ contacts are selected.

```
┌─────────────────────────────────────────────────────────────────┐
│  ☑ 5 selected    │  ✉ Send Email  │  ↓ Export CSV  │  ✕ Clear  │
└─────────────────────────────────────────────────────────────────┘
```

**Actions:**
- **Send Email** — opens `mailto:` with all selected contacts' emails (comma-separated)
- **Export CSV** — downloads selected contacts as CSV (name, email, title, district, department, seniority, phone)
- **Clear** — deselects all

**Styling:**
- Bar: `bg-[#403770] text-white` with rounded corners
- Buttons: white text, hover `bg-white/20` pill buttons
- Count badge: `bg-white text-[#403770]` rounded pill
- Positioned sticky at bottom of the table container, with a slight shadow

### Future Bulk Actions (when activity tracing ships)
- "Log Activity" — bulk-log an activity for all selected contacts
- "Add to Activity" — associate selected contacts with an existing activity

---

## Footer

Always visible below the table (outside the scrollable area):

```
42 contacts
```

- `text-sm text-gray-500` aligned left
- Shows filtered count if filters are active: "12 of 42 contacts"

---

## District Name Resolution

Contacts have a `leaid` field but no district name. The district name needs to come from the districts data already available in PlanTabs.

**Approach:** PlanTabs already has `districts: TerritoryPlanDistrict[]` and builds a `districtNameMap` for grouping. Pass this map (or a lookup function) to ContactsTable as a new prop.

```typescript
interface ContactsTableProps {
  contacts: Contact[];
  districtNameMap: Map<string, string>;  // leaid -> district name
  onEdit?: (contact: Contact) => void;
  onDelete?: (contactId: number) => void;
}
```

The district name cell is clickable and could navigate to the district detail panel in the future.

---

## Person Cell (Two-Line Layout)

Instead of separate Name and Title columns, combine them into a single "Person" cell like HubSpot does:

```
┌──────────────────────────────────┐
│ Dr. Jane Smith  [PRIMARY]        │
│ Director of Curriculum           │
└──────────────────────────────────┘
```

- **Line 1:** `text-sm font-medium text-[#403770]` — salutation + name + optional PRIMARY badge
- **Line 2:** `text-xs text-gray-500` — title (job title)
- This saves a column and gives a cleaner visual hierarchy

---

## Last Activity Column (Future-Ready Placeholder)

For now, this column shows:
- Gray italic text: "No activity" for all contacts
- Column header: "Last Activity"

**When activity tracing ships**, this column will show:
- Date of most recent activity involving this contact
- Small subtitle with activity type (e.g., "Feb 4 — Discovery Call")
- Color-coded by recency (green = recent, yellow = stale, red = cold)

The column exists from day one so the layout is stable when the feature arrives.

---

## Phone Number

Phone moves out of the main table columns to reduce width. Instead:
- Phone is accessible via the Person cell hover tooltip, or
- Phone is visible in the edit/detail panel
- This matches HubSpot's approach — phone isn't usually in the default view

---

## Implementation Plan

### Commit 1: Update ContactsTable with new column layout

**Files:**
- Modify: `src/components/plans/ContactsTable.tsx`

Changes:
- Add `districtNameMap` prop
- Restructure columns: Checkbox, Person (name+title combined), Email, District, Department, Seniority, Last Activity (placeholder), Actions
- Add checkbox state management (local `useState<Set<number>>`)
- Add select-all checkbox in header
- Add selected row highlighting
- Add footer with contact count

### Commit 2: Add bulk action bar

**Files:**
- Modify: `src/components/plans/ContactsTable.tsx`

Changes:
- Add sticky bulk action bar component at bottom of table
- Implement "Send Email" (mailto: with selected emails)
- Implement "Export CSV" (generate and download CSV blob)
- Implement "Clear" (deselect all)
- Bar appears/disappears based on selection count

### Commit 3: Pass districtNameMap from PlanTabs

**Files:**
- Modify: `src/components/plans/PlanTabs.tsx`

Changes:
- Pass the existing `districtNameMap` to ContactsTable
- Already computed on line 629: `const districtNameMap = new Map(districts.map(d => [d.leaid, d.name]))`
- Just needs to be passed as a prop instead of only used for grouping

### Commit 4: Update ContactCard with district name

**Files:**
- Modify: `src/components/plans/ContactCard.tsx`

Changes:
- Accept `districtName` prop
- Show district name in card layout
- Keep card layout consistent with table data

---

## Files Changed

| File | Action |
|------|--------|
| `src/components/plans/ContactsTable.tsx` | **MODIFY** — New column layout, checkboxes, bulk actions, footer |
| `src/components/plans/PlanTabs.tsx` | **MODIFY** — Pass districtNameMap to ContactsTable and ContactCard |
| `src/components/plans/ContactCard.tsx` | **MODIFY** — Add district name display |

---

## Design Decisions

1. **Phone removed from default columns** — Reduces table width, phone is secondary info. Still accessible in edit panel. Matches HubSpot's default.
2. **Person = Name + Title combined** — Saves a column, gives better visual hierarchy, matches CRM conventions.
3. **Last Activity as day-one placeholder** — Avoids a layout shift when activity tracing ships. Users see the column exists, and it naturally fills in later.
4. **District as clickable** — Sets up navigation to district detail, making the contacts table a useful entry point into district exploration.
5. **Bulk actions start simple** — Send Email + Export CSV are useful immediately. More actions (Log Activity, Add to Activity) come with activity tracing.
6. **Selection is local state** — No need to persist selection across tab switches or page reloads. Simple `useState<Set<number>>`.

---

## Color Reference

| Element | Color | Token |
|---------|-------|-------|
| Selected row bg | `#C4E7E6` at 20% opacity | Robin's egg tint |
| Bulk action bar bg | `#403770` | Plum |
| Bulk action bar text | `#FFFFFF` | White |
| Count badge in bar | `bg-white text-[#403770]` | Inverted plum |
| District link | `#403770` hover `#F37167` | Plum → Coral |
| Footer text | `text-gray-500` | Gray |
| Last Activity placeholder | `text-gray-400 italic` | Light gray italic |

---

## Testing

- [ ] Contacts table renders with new column order
- [ ] District name resolves correctly from leaid
- [ ] Checkbox selection works (individual and select-all)
- [ ] Bulk action bar appears when contacts selected
- [ ] "Send Email" opens mailto with correct emails
- [ ] "Export CSV" downloads valid CSV file
- [ ] "Clear" deselects all contacts
- [ ] Footer shows correct count (filtered and total)
- [ ] Last Activity column shows placeholder text
- [ ] Person cell shows name + title in two lines
- [ ] PRIMARY badge still renders correctly
- [ ] Persona/seniority badges use correct colors from contactTypes.ts
- [ ] Works in card view (district name passed to ContactCard)
