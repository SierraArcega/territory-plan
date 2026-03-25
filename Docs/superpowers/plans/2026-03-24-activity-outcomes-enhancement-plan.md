# Implementation Plan: Activity Outcomes Enhancement

**Date:** 2026-03-24
**Spec:** docs/superpowers/specs/2026-03-24-activity-outcomes-enhancement-spec.md
**Backend Context:** docs/superpowers/specs/2026-03-24-activity-outcomes-enhancement-backend-context.md
**Branch:** worktree-activity-outcomes-enhancement

## Task Overview

| # | Task | Type | Dependencies | Est. Files |
|---|------|------|-------------|------------|
| 1 | Schema migration | Backend | — | 2 |
| 2 | Opportunity API | Backend | 1 | 1 |
| 3 | Calendar attendees API | Backend | 1 | 1 |
| 4 | District domain lookup API | Backend | — | 1 |
| 5 | Task assignment (schema + API) | Backend | 1 | 2 |
| 6 | Activity PATCH (rating + opp link) | Backend | 1, 2 | 1 |
| 7 | StarRating component | Frontend | — | 1 |
| 8 | OpportunitySearch component | Frontend | 2 | 2 |
| 9 | CalendarAttendeesSection component | Frontend | 3, 4 | 2 |
| 10 | TaskRowList component | Frontend | 5 | 2 |
| 11 | OutcomeModal integration | Frontend | 6-10 | 1 |
| 12 | Playwright e2e tests | Test | 11 | 4 |

---

## Backend Tasks

### Task 1: Schema Migration

**Files:**
- `prisma/schema.prisma`
- New migration file (via `npx prisma migrate dev`)

**Changes:**
1. Add `rating Int?` to `Activity` model
2. Create `ActivityOpportunity` model:
   ```prisma
   model ActivityOpportunity {
     activityId    String
     opportunityId String
     createdAt     DateTime @default(now())
     activity      Activity    @relation(fields: [activityId], references: [id], onDelete: Cascade)
     opportunity   Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
     @@id([activityId, opportunityId])
   }
   ```
3. Add `assignedToUserId String? @db.Uuid` to `Task` model + relation to UserProfile
4. Add relation arrays to Activity, Opportunity, Task, UserProfile models
5. Run `npx prisma migrate dev --name add-outcome-enhancements`
6. Run `npx prisma generate`

**Test:** `npx prisma validate` passes

---

### Task 2: Opportunity API

**File:** `src/app/api/opportunities/route.ts` (new)

**Endpoint:** `GET /api/opportunities?search={query}&limit={10}`

**Logic:**
- Auth check via `getUser()`
- Search `Opportunity` by `id ILIKE` or `name ILIKE` with query
- Return: `id`, `name`, `stage`, `netBookingAmount`, `districtName`, `districtLeaId`, `closeDate`
- Limit to 10 results, ordered by relevance (exact ID match first, then name match)

**Test:** Manual curl or Vitest unit test

---

### Task 3: Calendar Attendees API

**File:** `src/app/api/activities/[id]/calendar-attendees/route.ts` (new)

**Endpoint:** `GET /api/activities/{id}/calendar-attendees`

**Logic:**
1. Auth check — verify activity belongs to user
2. Fetch activity, get `googleEventId`
3. If no `googleEventId`, return `{ attendees: [] }`
4. Get user's Google Calendar integration, decrypt tokens
5. Call Google Calendar API: `GET /calendars/primary/events/{googleEventId}` to get `attendees[]`
6. Filter out internal domain emails (using integration metadata `companyDomain`)
7. For each external attendee:
   - Extract email domain
   - Query `District` where `websiteUrl` ILIKE `%{domain}%` to auto-match
   - Check if attendee email already exists in `Contact` table
8. Return:
   ```json
   {
     "attendees": [
       {
         "email": "jane@springfield.k12.us",
         "displayName": "Jane Smith",
         "responseStatus": "accepted",
         "matchedDistrict": { "leaid": "1234567", "name": "Springfield USD" } | null,
         "existingContact": { "id": 1, "name": "Jane Smith" } | null
       }
     ]
   }
   ```

**Test:** Vitest with mocked Google API call

---

### Task 4: District Domain Lookup API

**File:** `src/app/api/districts/by-domain/route.ts` (new)

**Endpoint:** `GET /api/districts/by-domain?domain={domain}`

**Logic:**
- Auth check
- Query `District` where `websiteUrl` ILIKE `%{domain}%`
- Return matching districts (leaid, name, stateAbbrev)
- Used as fallback when manual domain search is needed

**Test:** Manual or unit test

---

### Task 5: Task Assignment (Schema + API)

**Files:**
- `src/app/api/tasks/route.ts` (modify)
- `src/features/tasks/lib/queries.ts` (modify)

**Changes:**
1. `POST /api/tasks`: Accept `assignedToUserId` in body, validate it exists in UserProfile
2. `GET /api/tasks`: Include `assignedTo: { id, fullName, avatarUrl }` in response via Prisma include
3. `PATCH /api/tasks/[id]`: Accept `assignedToUserId` updates
4. Update `useCreateTask()` mutation type to include `assignedToUserId`

**Test:** Existing task tests still pass + new assignment field works

---

### Task 6: Activity PATCH (Rating + Opp Link)

**File:** `src/app/api/activities/[id]/route.ts` (modify)

**Changes:**
1. Accept `rating` (1-5 integer) in PATCH body, validate range
2. Accept `opportunityIds` (string[]) in PATCH body
3. On save: upsert `ActivityOpportunity` records (delete removed, create new)
4. Update activity queries to include opportunities in response

**Test:** PATCH with rating and opportunityIds saves correctly

---

## Frontend Tasks

### Task 7: StarRating Component

**File:** `src/features/activities/components/StarRating.tsx` (new)

**Props:** `value: number`, `onChange: (rating: number) => void`, `disabled?: boolean`

**Implementation:**
- 5 Lucide `Star` icons in a row
- Hover state: fill stars up to hovered index (preview)
- Click: commit rating
- Filled: `fill="#F37167" stroke="#F37167"` / Empty: `stroke="#C2BBD4"`
- `aria-label="Rate activity"`, each star `role="radio"`
- Size: `w-6 h-6` with `gap-1`

---

### Task 8: OpportunitySearch Component

**Files:**
- `src/features/activities/components/OpportunitySearch.tsx` (new)
- `src/features/activities/lib/queries.ts` (add `useOpportunitySearch` hook)

**Implementation:**
- Text input with debounced search (300ms)
- Dropdown results: opp name, stage badge, amount, district
- On select: show preview card with opp details + remove (✕) button
- Preview card: `border border-[#E2DEEC] rounded-lg p-3 bg-[#F7F5FA]`
- Display: Opp ID, name, stage, net booking amount (formatted currency), district name
- Single selection only

---

### Task 9: CalendarAttendeesSection Component

**Files:**
- `src/features/activities/components/CalendarAttendeesSection.tsx` (new)
- `src/features/activities/lib/queries.ts` (add `useCalendarAttendees` hook)

**Implementation:**
- Calls `GET /api/activities/{id}/calendar-attendees` on mount
- Loading: skeleton rows
- Each attendee row:
  - Checkbox (default checked for unmatched, checked + disabled for existing contacts)
  - Email + display name
  - If `matchedDistrict`: green badge with district name
  - If no match: `DistrictSearchInput` inline for manual assignment
  - If `existingContact`: "Already in database" badge, checkbox disabled
- Section header: "ATTENDEES FROM CALENDAR" + count badge
- Only renders when activity has `googleEventId`

---

### Task 10: TaskRowList Component

**Files:**
- `src/features/activities/components/TaskRowList.tsx` (new)
- `src/features/shared/lib/queries.ts` (ensure `useUsers` returns all needed fields)

**Implementation:**
- State: array of task objects `{ title, assignedToUserId, priority, dueDate }`
- Each row:
  - Title input (full width top row)
  - Bottom row: assignee dropdown (CustomSelect with useUsers), priority chips (low/med/high), date input, remove ✕
- `+ Add another task` button at bottom
- Default first task: title from activity, assignee = current user, priority = high, due = +3 days
- Remove button hidden when only one task exists
- Follows `ExpenseLineItems` / `TaskLineItems` visual pattern

---

### Task 11: OutcomeModal Integration

**File:** `src/features/activities/components/OutcomeModal.tsx` (modify)

**Changes:**
1. Add `rating` state, render `StarRating` between header and outcome pills
2. Add `linkedOpportunity` state, render `OpportunitySearch` after note section
3. Render `CalendarAttendeesSection` if activity has `googleEventId` (need to pass it via props or fetch)
4. Replace single task toggle with `TaskRowList`
5. Update `OutcomeModalProps` to include `googleEventId?: string`
6. Update save handler:
   - Include `rating` in activity PATCH
   - Include `opportunityIds` in activity PATCH
   - Create contacts from checked attendees (loop `useCreateContact`)
   - Create multiple tasks from `TaskRowList` state (loop `useCreateTask` with `assignedToUserId`)
7. Disable "Save & Close" until `rating >= 1` (instead of requiring outcome pill)
8. Keep existing follow-up activity toggle and add-new-contact toggle as-is

---

## Test Tasks

### Task 12: Playwright E2E Tests

**Files (in playwright-e2e-testing worktree):**
- `e2e/pages/OutcomeModalPage.ts` (new page object)
- `e2e/tests/outcome-modal.spec.ts` (new test file)
- `e2e/helpers/seed-data.ts` (add seedOpportunity, seedContact, update seedActivity)
- `e2e/fixtures/db.fixture.ts` (expose new seed functions)

**Page Object Methods:**
- `setRating(stars: number)` — click the Nth star
- `selectOutcome(label: string)` — click outcome pill by label
- `addNote(text: string)` — expand note and type
- `searchOpportunity(query: string)` — type in opp search input
- `getOppPreview()` — return preview card content
- `removeOppLink()` — click ✕ on preview card
- `getAttendeeRows()` — list of attendee row locators
- `toggleAttendee(email: string)` — check/uncheck attendee
- `assignDistrict(email: string, districtName: string)` — search and select district
- `addTask(opts: { title, assignee?, priority?, dueDate? })` — fill task row
- `removeTask(index: number)` — click ✕ on task row
- `getTaskRows()` — return task row locators
- `save()` — click "Save & Close"
- `skip()` — click "Skip"

**Test Cases:**
1. Modal opens on activity completion → title visible
2. Save disabled without star rating → click 4 stars → Save enabled
3. Select outcome pill + note → save → verify PATCH payload
4. Search opp → select → preview card shows → save → verify link persisted
5. Activity with googleEventId → attendees auto-populated
6. Auto-matched attendee shows district badge
7. Unmatched attendee → search district → assign → save → contact created
8. Add 3 tasks with different assignees → save → all 3 tasks created
9. Full happy path: 5 stars + outcome + note + opp + 2 contacts from attendees + 2 tasks → all persisted

**Seed additions:**
```typescript
export const TEST_OPPORTUNITY_ID = "e2e-OPP-001";
export const TEST_CONTACT_ID = 99901;

export async function seedOpportunity(overrides = {}) {
  return prisma.opportunity.upsert({
    where: { id: TEST_OPPORTUNITY_ID },
    update: {},
    create: {
      id: TEST_OPPORTUNITY_ID,
      name: "E2E Test Opportunity",
      stage: "Proposal",
      netBookingAmount: 45000,
      districtName: "E2E Test District",
      ...overrides,
    },
  });
}
```

---

## Execution Order

**Phase 1 — Backend (parallelizable: Tasks 1-6)**
1. Task 1: Schema migration (must be first)
2. Tasks 2, 3, 4, 5 in parallel (all depend on schema only)
3. Task 6 after Task 2 (needs opportunity relation)

**Phase 2 — Frontend (parallelizable: Tasks 7-10, then 11)**
4. Tasks 7, 8, 9, 10 in parallel (independent components)
5. Task 11: Integration (depends on all frontend components)

**Phase 3 — Tests**
6. Task 12: Playwright tests (depends on full implementation)

## Test Strategy

| Task | Test Type | Tool |
|------|-----------|------|
| 1 | Schema validation | `npx prisma validate` |
| 2-6 | API unit tests | Vitest (optional, time permitting) |
| 7-10 | Component render tests | Vitest + Testing Library (optional) |
| 11 | Integration smoke | Manual via dev server |
| 12 | E2E tests | Playwright |
| All | Build verification | `npm run build` |
