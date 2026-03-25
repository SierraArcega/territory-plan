# Feature Spec: Activity Outcomes Enhancement

**Date:** 2026-03-24
**Slug:** activity-outcomes-enhancement
**Branch:** worktree-activity-outcomes-enhancement

## Requirements

Enhance the "What happened?" outcome modal to give reps richer activity completion data:

1. **Star rating (1-5)** — Required before save. Overall activity sentiment rating.
2. **Keep existing outcome pills** — "How did it go?" category-specific pills remain unchanged.
3. **Detail note** — Existing expandable textarea, no changes.
4. **Link LMS Opportunity** — Search/enter Opp ID, persistent DB link + preview card (name, stage, amount). One opp per activity.
5. **Google Calendar attendees** — Auto-fetch on modal open if activity has `googleEventId`. Pre-populate external attendees. Domain-match to districts automatically. Manual district assignment for unmatched. Checked attendees become contacts on save.
6. **Multiple follow-up tasks** — Inline row list with + button. Each task: title, assignee (any platform user), priority, due date. Replaces single task toggle.
7. **Task assignment** — Tasks can be assigned to any user on the platform, not just the creator.

## Visual Design

**Approved approach:** Enhanced Single Modal (Direction A)

Scrollable single modal with all sections visible in order:

```
Header: "What happened?" + activity title
─────────────────────────────────────
1. Star Rating (★★★★☆) — required
2. Outcome Pills — category-specific
3. Note — expandable textarea
4. Link Opportunity — search input + preview card
5. Calendar Attendees — auto-populated, editable (conditional)
6. Follow-ups:
   a. Schedule follow-up activity (toggle, existing)
   b. Follow-up tasks (inline list, + Add another task)
   c. Add new contact (toggle, existing)
─────────────────────────────────────
Footer: Skip | Save & Close
```

**Key design decisions:**
- Modal width stays at `max-w-md`, height extends with `max-h-[85vh]` scrollable body
- Star rating uses Lucide `Star` icon — coral (#F37167) filled, #C2BBD4 empty
- Opp search uses same pattern as `DistrictSearchInput` (debounced, dropdown results)
- Calendar attendees section only renders if `googleEventId` is present
- Task rows follow `ExpenseLineItems` / `TaskLineItems` inline pattern
- Assignee picker uses `useUsers()` hook with dropdown (all platform users)

## Component Plan

### Existing components to reuse:
- `OutcomeModal` — enhance in place (src/features/activities/components/OutcomeModal.tsx)
- `DistrictSearchInput` — for manual district assignment on unmatched attendees
- `CustomSelect` — for assignee picker per task row
- `MultiSelect` / `AsyncMultiSelect` — potential for multi-select patterns
- `ExpenseLineItems` pattern — inline add/remove rows
- `TaskLineItems` pattern — task row layout
- `useUsers()` hook — fetch all platform users (src/features/shared/lib/queries.ts)
- `useCreateContact()` mutation — create contacts from attendees
- `useCreateTask()` mutation — create tasks

### New components needed:
- `StarRating` — interactive 1-5 star input (inline in OutcomeModal or extracted)
- `OpportunitySearch` — typeahead search by opp ID/name with preview card
- `CalendarAttendeesSection` — auto-fetch, domain matching, district assignment
- `TaskRowList` — inline multi-task creation with assignee picker

### Components to extend:
- `OutcomeModal` — add star rating, opp link, attendees section, multi-task support

## Backend Design

See: docs/superpowers/specs/2026-03-24-activity-outcomes-enhancement-backend-context.md

### Schema changes:
1. **Activity model** — add `rating Int?` field
2. **ActivityOpportunity junction table** — `activityId String`, `opportunityId String`
3. **Task model** — add `assignedToUserId String? @db.Uuid` field + relation to UserProfile

### New API routes:
1. `GET /api/opportunities?search=` — search opportunities by ID or name
2. `GET /api/activities/[id]/calendar-attendees` — fetch Google Calendar attendees for activity
3. `GET /api/districts/by-domain?domain=` — lookup district by email domain (match against websiteUrl)

### Modified API routes:
1. `PATCH /api/activities/[id]` — accept `rating`, `opportunityIds` fields
2. `POST /api/tasks` — accept `assignedToUserId` field
3. `GET /api/tasks` — include `assignedToUserId` and assignee profile in response

### Migration:
- Add `rating` column to Activity
- Create `ActivityOpportunity` table
- Add `assignedToUserId` column to Task with FK to UserProfile

## States

- **Loading:** Skeleton rows for calendar attendees while fetching. Other sections load instantly.
- **Empty (no Google event):** Calendar attendees section hidden entirely.
- **Empty (no external attendees):** Show "No external attendees found" message.
- **Error (attendee fetch fails):** Show "Couldn't fetch attendees — add contacts manually below."
- **Error (opp search fails):** Show inline error below search input.
- **Validation:** Save & Close disabled until star rating >= 1. All other fields optional.
- **Saving:** Button shows spinner, inputs disabled during save.

## Playwright E2E Tests

### New test file: `e2e/tests/outcome-modal.spec.ts`
1. Opens outcome modal when completing an activity
2. Star rating required — Save disabled until stars selected
3. Selecting outcome pill + adding note saves correctly
4. Linking an opportunity shows preview card and persists
5. Calendar attendees auto-populate for Google-linked activities
6. Domain-matched attendees show auto-assigned district
7. Unmatched attendees allow manual district selection
8. Creating multiple tasks with different assignees
9. Full happy path: rating + outcome + opp + contacts + tasks all saved

### New page object: `e2e/pages/OutcomeModalPage.ts`
- `setRating(stars)`, `selectOutcome(label)`, `addNote(text)`
- `searchOpportunity(query)`, `getOppPreview()`
- `getAttendeeRows()`, `assignDistrict(email, district)`
- `addTask(title, assignee, priority)`, `removeTask(index)`
- `save()`, `skip()`

### Seed data additions:
- `seedOpportunity()` — test opportunity record
- `seedContact()` — for attendee matching
- Activity with `googleEventId` for calendar attendee tests

## Out of Scope

- Editing outcomes after save (re-opening the modal to change rating/outcome)
- Bulk activity completion
- Opportunity creation (only linking existing opps)
- Calendar attendee sync outside of outcome modal
- Contact enrichment / LinkedIn lookup from attendee data
- Task notifications to assignees
