# Backend Context: Activity Outcomes Enhancement

## Existing Infrastructure

### Activity Model (`prisma/schema.prisma` line 577)
- Already has outcome tracking fields: `outcome` (VarChar 500), `outcomeType` (VarChar 30)
- Has `status` field with values: planned, requested, planning, in_progress, wrapping_up, completed, cancelled
- Has `metadata` JSON field for type-specific data
- **No `rating` or `score` field exists on Activity**
- Relations: ActivityPlan, ActivityDistrict, ActivityContact, ActivityState, ActivityExpense, ActivityAttendee, ActivityRelation, TaskActivity
- **No ActivityOpportunity junction table exists** -- there is no link between Activity and Opportunity

### Opportunity Model (`prisma/schema.prisma` line 1189)
- `id` field is `String @id @db.Text` -- this is a **Salesforce-style ID** (e.g., `006...`), synced from OpenSearch
- Has `districtLeaId` (nullable, maps to district leaid) and `districtNcesId`
- Has `stage`, `netBookingAmount`, `schoolYr`, `contractType`, financial fields
- **No relations defined** to Activity or any other model (it's an isolated sync-only model)
- No FK constraints -- it's synced externally by the opportunity scheduler

### Task Model (`prisma/schema.prisma` line 888)
- Has `createdByUserId` (UUID) but **no `assignedToUserId` field**
- Tasks are always scoped to `createdByUserId` in the API (`where: { createdByUserId: user.id }`)
- Junction tables: TaskDistrict, TaskPlan, TaskActivity, TaskContact
- Task API (`src/app/api/tasks/route.ts`): GET supports filtering by status, priority, planId, activityId, leaid, contactId, search, dueBefore/dueAfter. POST creates with title, description, status, priority, dueDate, position, planIds, activityIds, leaids, contactIds

### User Listing API (`src/app/api/users/route.ts`)
- **Already exists** at `GET /api/users`
- Returns: id, fullName, avatarUrl, email, jobTitle
- Ordered by fullName asc
- Requires authentication
- Suitable for a task assignee picker as-is

### Google Calendar Attendees
- **Already fully fetched**: `src/features/calendar/lib/google.ts` fetches attendees with email, displayName, responseStatus, self flag
- `filterExternalAttendees()` filters out internal attendees using company domain (from `@` split)
- `src/features/calendar/lib/sync.ts` stores attendees as JSON in CalendarEvent staging table
- `src/features/calendar/lib/push.ts` sends contact emails as attendees when pushing to Google Calendar
- **ActivityAttendee model** (`prisma/schema.prisma` line 701) links Activity to UserProfile (internal team members only, not external contacts)

### Contact Creation (`src/app/api/contacts/route.ts`)
- POST requires `leaid` and `name`; validates district exists
- No automatic domain-to-district matching -- caller must already know the leaid
- Clay integration at `src/app/api/contacts/clay-lookup/route.ts` does enrichment via webhook

### District Email Domain Matching
- **No existing logic** to map email domains to districts
- District model has `websiteUrl` field (VarChar 255, line 154 in schema) which could be used to extract domain
- The only domain logic is in `filterExternalAttendees()` which compares attendee email domains against the company domain (fullmindlearning.com) -- this is for internal/external filtering, not district mapping
- Contact model has `email` field but no domain extraction or matching

### Opportunity API
- **No API route exists** at `src/app/api/opportunities/` -- the directory does not exist
- Opportunities are synced from OpenSearch by a scheduler, not accessed via REST API

---

## Schema Changes Needed

### 1. ActivityOpportunity Junction Table (NEW)
Link activities to Salesforce opportunities to track which opportunities resulted from activities.
```prisma
model ActivityOpportunity {
  activityId    String   @map("activity_id")
  opportunityId String   @map("opportunity_id") @db.Text
  createdAt     DateTime @default(now()) @map("created_at")
  activity      Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  // Note: No FK to Opportunity model since it has no FK constraints (sync-only table)

  @@id([activityId, opportunityId])
  @@index([opportunityId])
  @@map("activity_opportunities")
}
```
Add `opportunities ActivityOpportunity[]` relation array to the Activity model.

**Design decision**: Whether to add a Prisma FK to Opportunity depends on data integrity needs. The Opportunity table is externally synced and IDs could disappear. A soft reference (no FK constraint) may be safer -- store the opportunityId as a plain string and look up Opportunity data at read time.

### 2. Activity Rating Field (NEW)
Add a rating/score field to Activity for post-activity evaluation.
```prisma
// On Activity model:
rating Int? @db.SmallInt // 1-5 star rating, null = not rated
```

### 3. Task Assignment Field (NEW)
Add `assignedToUserId` to the Task model for delegation.
```prisma
// On Task model:
assignedToUserId String? @map("assigned_to_user_id") @db.Uuid
// Add relation:
assignedTo UserProfile? @relation("TaskAssignee", fields: [assignedToUserId], references: [id])
```
Add corresponding `@@index([assignedToUserId])` and the inverse relation on UserProfile.

### 4. District Domain Mapping (OPTIONAL)
No schema change needed -- `websiteUrl` already exists on District. A utility function can extract domains from `websiteUrl` and match against attendee email domains. If performance is a concern, a denormalized `emailDomain` column could be added:
```prisma
// On District model (optional optimization):
emailDomain String? @map("email_domain") @db.VarChar(100)
```

---

## API Changes Needed

### 1. Opportunity Search API (NEW)
**Route**: `GET /api/opportunities`
- Query params: `search` (name/id), `leaid` (filter by district), `schoolYr`, `stage`
- Returns: id, name, stage, schoolYr, netBookingAmount, districtName, districtLeaId
- Used by the activity outcomes form to search and link opportunities

**Route**: `GET /api/opportunities/[id]`
- Returns full opportunity details for a given Salesforce ID
- Used for displaying linked opportunity info on activity cards

### 2. Task API Updates (MODIFY)
**Route**: `POST /api/tasks` and `PATCH /api/tasks/[id]`
- Add `assignedToUserId` to create/update payloads
- Update GET query to optionally filter by `assignedToUserId`
- Update the `where` clause: tasks should be visible if `createdByUserId = user.id` OR `assignedToUserId = user.id`

### 3. Activity Outcomes API (MODIFY)
**Route**: `PATCH /api/activities/[id]` (or equivalent activity update endpoint)
- Add support for `rating`, `outcome`, `outcomeType` fields in the update payload
- Add support for managing `ActivityOpportunity` links (connect/disconnect opportunity IDs)

### 4. District Domain Lookup API (NEW, optional)
**Route**: `GET /api/districts/by-domain?domain=example.k12.us`
- Extracts domain from `websiteUrl` field and matches
- Returns matching district(s)
- Useful for auto-suggesting district when creating contacts from calendar attendee emails

---

## Migration Notes

### Prisma Migrations
1. **ActivityOpportunity table**: Standard `createTable` migration. No data backfill needed since this is a new junction table.
2. **Activity.rating**: `ALTER TABLE activities ADD COLUMN rating SMALLINT` -- nullable, no backfill needed.
3. **Task.assignedToUserId**: `ALTER TABLE tasks ADD COLUMN assigned_to_user_id UUID` -- nullable, no backfill needed. Add index.
4. **District.emailDomain** (if pursued): Would need a one-time backfill script to extract domains from existing `websiteUrl` values.

### Data Considerations
- Opportunity IDs are Salesforce IDs (text strings like `006...`). The ActivityOpportunity junction should use `@db.Text` to match.
- The Opportunity table has no FK constraints by design (externally synced). The ActivityOpportunity junction should handle missing opportunities gracefully at the application level rather than relying on cascading deletes.
- Task assignment changes the visibility model: currently tasks are private to the creator. Adding assignment means the GET endpoint needs an OR condition (`createdBy OR assignedTo`), which affects the existing task kanban board.

### Backward Compatibility
- All new fields are nullable, so no breaking changes to existing API consumers.
- The task visibility change (showing assigned tasks) should be additive -- existing behavior (showing created tasks) is preserved, assigned tasks are additional.
- The `/api/users` endpoint already exists and returns the data needed for an assignee picker, so no changes needed there.

### Key Files to Modify
- `prisma/schema.prisma` -- schema changes
- `src/app/api/tasks/route.ts` -- add assignedToUserId support
- `src/app/api/tasks/[id]/route.ts` -- add assignedToUserId to PATCH
- `src/app/api/opportunities/route.ts` -- new file
- `src/app/api/opportunities/[id]/route.ts` -- new file
- Activity update endpoint (find the existing PATCH route for activities)
- `src/features/calendar/lib/sync.ts` -- potential enhancement to auto-match attendee email domains to districts
