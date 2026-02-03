# Flexible Activities System

**Date:** 2026-02-03
**Status:** Draft
**Author:** Sierra Holstad

## Overview

Transform the activity system from plan-centric (one activity → one plan) to flexible (one activity → many plans, districts, contacts, states). This enables reps to log conferences, road trips, and other multi-entity activities while maintaining clear visibility into what needs plan association.

### Goals

- Activities can be tied to multiple plans, districts, contacts, and states
- Plans become optional (activities can exist unassigned)
- Clear flags surface activities needing attention
- Organized by category (Events, Outreach, Meetings) with dedicated views
- Single creation modal with smart context-aware pre-filling

---

## Git Workflow

### Branch Setup

Before starting implementation:

```bash
# Ensure you're starting from latest main
git fetch origin
git checkout -b feature/flexible-activities origin/main
```

### Commit Strategy

Commit frequently after each meaningful change:

1. **After schema changes** — `git commit -m "Add Activity schema with junction tables"`
2. **After each API endpoint** — `git commit -m "Add GET /api/activities endpoint"`
3. **After each UI component** — `git commit -m "Add ActivityCard component"`
4. **After each integration** — `git commit -m "Integrate Activities tab into sidebar"`

Keep commits small and focused. If something breaks, it's easy to revert or bisect.

### Push Regularly

Push to remote at least once per implementation phase:

```bash
git push -u origin feature/flexible-activities
```

---

## Data Model

### Activity Table (replaces PlanActivity)

```
Activity
├── id: uuid (PK)
├── type: string (conference, road_trip, email_campaign, etc.)
├── title: string (max 255)
├── notes: string?
├── startDate: datetime
├── endDate: datetime?
├── status: string (planned, completed, cancelled)
├── createdByUserId: uuid
├── createdAt: datetime
└── updatedAt: datetime
```

### Junction Tables (all many-to-many)

```
ActivityPlan
├── activityId: uuid (FK → Activity)
└── planId: uuid (FK → TerritoryPlan)

ActivityDistrict
├── activityId: uuid (FK → Activity)
├── districtLeaid: string (FK → District)
└── warningDismissed: boolean (default false)

ActivityContact
├── activityId: uuid (FK → Activity)
└── contactId: int (FK → Contact)

ActivityState
├── activityId: uuid (FK → Activity)
├── stateFips: string (FK → State)
└── isExplicit: boolean (default false)
```

### Computed Flags

These are computed at query time, not stored:

```typescript
needsPlanAssociation: activityPlans.length === 0

hasUnlinkedDistricts: activityDistricts.some(district =>
  !activityPlans.some(plan =>
    plan.districts.includes(district.leaid)
  )
)
```

### State Derivation Logic

- Adding a district auto-creates an `ActivityState` with `isExplicit = false`
- Explicitly adding a state creates `ActivityState` with `isExplicit = true`
- Removing a district removes its state only if:
  - `isExplicit = false` AND
  - No other linked districts share that state

---

## Activity Types & Categories

### Category Structure

Each activity type belongs to exactly one category. Category is derived from type (not stored).

**EVENTS** (multi-day, often multi-district)
- `conference` — Industry conferences, state association meetings
- `road_trip` — Multi-stop district visits
- `trade_show` — Vendor exhibitions
- `school_visit_day` — On-site school/district tours

**OUTREACH** (single touchpoints)
- `email_campaign` — Targeted email sends
- `phone_call` — Individual calls
- `linkedin_message` — Social outreach

**MEETINGS** (scheduled conversations)
- `sales_meeting` — Discovery, relationship building
- `demo` — Product demonstrations
- `proposal_review` — Contract/pricing discussions

### Type-to-Category Mapping

```typescript
const ACTIVITY_CATEGORIES = {
  events: ['conference', 'road_trip', 'trade_show', 'school_visit_day'],
  outreach: ['email_campaign', 'phone_call', 'linkedin_message'],
  meetings: ['sales_meeting', 'demo', 'proposal_review'],
} as const;

type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;
type ActivityType = typeof ACTIVITY_CATEGORIES[ActivityCategory][number];
```

---

## Navigation & UI Structure

### Top-Level Activities Tab

New tab in main sidebar (between Plans and Goals). Shows all activities across all plans, organized by category sub-tabs.

```
Sidebar                    Main Content
┌─────────────┐           ┌────────────────────────────────────┐
│ Map         │           │ [Events] [Outreach] [Meetings]     │
│ Plans       │           │────────────────────────────────────│
│ Activities  │ ← new     │ ┌──────────────────────────────┐   │
│ Goals       │           │ │ SC Education Conference      │   │
│ Data        │           │ │ Mar 15-17 · 3 plans · 5 dist │   │
│ Profile     │           │ │ ⚠ 2 districts need plan      │   │
└─────────────┘           │ └──────────────────────────────┘   │
                          └────────────────────────────────────┘
```

### Within Plan View

When viewing a specific territory plan, add three category tabs scoped to that plan:

```
Plan: "SC FY26"
[Districts] [Events] [Outreach] [Meetings]
```

### Activity Card Display

Each activity card shows:
- Title and date range
- Linked plans count (or "No plan" warning badge)
- Linked districts/states summary
- Status indicator (planned/completed/cancelled)
- Warning badge if `hasUnlinkedDistricts`

---

## Activity Creation Modal

### Entry Points & Pre-filling

| Entry Point | Pre-fills |
|-------------|-----------|
| Activities tab → Events | Category = events |
| Activities tab → Outreach | Category = outreach |
| Activities tab → Meetings | Category = meetings |
| Plan view → Events tab | Category = events, Plan = current plan |
| Plan view → Outreach tab | Category = outreach, Plan = current plan |
| Plan view → Meetings tab | Category = meetings, Plan = current plan |
| District side panel | District, State (derived), Plan (if district is in one) |
| Contact panel | Contact, District, State, Plan (if applicable) |

### Modal Layout

```
┌─────────────────────────────────────────────────────┐
│ New Activity                                    [X] │
├─────────────────────────────────────────────────────┤
│ Type:     [conference ▾]          ← grouped dropdown│
│ Title:    [SC Education Conference           ]      │
│                                                     │
│ Dates:    [Mar 15, 2026] → [Mar 17, 2026]          │
│           ☑ Multi-day event                         │
│                                                     │
│ ─── Associations ───────────────────────────────── │
│ Plans:    [SC FY26 ×] [+ Add plan]                 │
│ States:   [SC ×] [+ Add state]                     │
│ Districts:[Berkeley County ×] [+ Add district]     │
│ Contacts: [Jane Smith ×] [+ Add contact]           │
│                                                     │
│ Notes:    [                                    ]    │
│           [                                    ]    │
│                                                     │
│ Status:   ○ Planned  ○ Completed  ○ Cancelled      │
├─────────────────────────────────────────────────────┤
│ ⚠ Berkeley County is not in "SC FY26" plan         │
│   [Add to plan] [Ignore]                            │
├─────────────────────────────────────────────────────┤
│                              [Cancel] [Save Activity]│
└─────────────────────────────────────────────────────┘
```

### Key Interactions

- Adding a district auto-adds its state (as derived, `isExplicit = false`)
- Removing a district removes its state only if no other districts share it and it wasn't explicitly added
- Inline warning appears when districts aren't in linked plans
- Quick "Add to plan" action resolves warnings inline
- Type dropdown groups options by category

---

## Flags & Warning System

### Flag Display Locations

| Location | needsPlanAssociation | hasUnlinkedDistricts |
|----------|---------------------|----------------------|
| Activity card | "No plan" badge | "2 unlinked districts" badge |
| Activity detail | Banner with "Add to plan" CTA | List with quick-add per district |
| Activities list | Filterable toggle | Filterable toggle |
| Plan view | N/A (already scoped) | Shows which districts need adding |

### Filter Options

Activities tab supports filtering:
- All
- Needs Plan (needsPlanAssociation = true)
- Has Unlinked Districts (hasUnlinkedDistricts = true)
- Status: Planned / Completed / Cancelled
- Date range

### Resolution Flows

**For needsPlanAssociation:**
1. Click "Add to plan" on activity card or detail view
2. Plan picker opens (multi-select)
3. Link activity to selected plan(s)
4. Flag clears

**For hasUnlinkedDistricts:**
1. Activity detail shows list of unlinked districts
2. Per district options:
   - "Add to [Plan Name]" — adds district to that plan
   - "Add to different plan" — opens plan picker
   - "Dismiss" — sets `warningDismissed = true` on ActivityDistrict
3. Flag clears when all districts are linked or dismissed

---

## API Structure

### Activity Endpoints

```
GET    /api/activities
POST   /api/activities
GET    /api/activities/[id]
PATCH  /api/activities/[id]
DELETE /api/activities/[id]
```

### Association Endpoints

```
POST   /api/activities/[id]/plans
DELETE /api/activities/[id]/plans/[planId]

POST   /api/activities/[id]/districts
DELETE /api/activities/[id]/districts/[leaid]

POST   /api/activities/[id]/contacts
DELETE /api/activities/[id]/contacts/[contactId]

POST   /api/activities/[id]/states
DELETE /api/activities/[id]/states/[fips]
```

### Plan-Scoped Endpoint

```
GET    /api/territory-plans/[id]/activities
```

### Warning Dismissal

```
POST   /api/activities/[id]/dismiss-warning
Body: { districtLeaid: string }
```

### Query Parameters (GET /api/activities)

| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | events, outreach, or meetings |
| planId | uuid | Filter to specific plan |
| stateAbbrev | string | Filter by state (e.g., "SC") |
| needsPlanAssociation | boolean | Only unassigned activities |
| hasUnlinkedDistricts | boolean | Only activities with unlinked districts |
| status | string | planned, completed, or cancelled |
| startDate | date | Activities starting on or after |
| endDate | date | Activities ending on or before |

---

## Migration Strategy

### Phase 1: Create New Tables

1. Create `Activity` table with new schema
2. Create junction tables:
   - `ActivityPlan`
   - `ActivityDistrict`
   - `ActivityContact`
   - `ActivityState`
3. Keep existing `PlanActivity` and `PlanActivityContact` untouched

**Commit:** `Add Activity schema with junction tables`

### Phase 2: Migrate Data

```sql
-- 1. Copy activities
INSERT INTO Activity (id, type, title, notes, startDate, endDate, status, createdByUserId, createdAt, updatedAt)
SELECT id, type, title, notes, activityDate, activityDate, status, [userId from plan], createdAt, updatedAt
FROM PlanActivity;

-- 2. Create plan links
INSERT INTO ActivityPlan (activityId, planId)
SELECT id, planId FROM PlanActivity;

-- 3. Create district links
INSERT INTO ActivityDistrict (activityId, districtLeaid, warningDismissed)
SELECT id, districtLeaid, false FROM PlanActivity WHERE districtLeaid IS NOT NULL;

-- 4. Migrate contacts
INSERT INTO ActivityContact (activityId, contactId)
SELECT activityId, contactId FROM PlanActivityContact;

-- 5. Derive states from districts
INSERT INTO ActivityState (activityId, stateFips, isExplicit)
SELECT DISTINCT ad.activityId, d.stateFips, false
FROM ActivityDistrict ad
JOIN District d ON ad.districtLeaid = d.leaid;
```

**Commit:** `Migrate existing PlanActivity data to new schema`

### Phase 3: Switch Over

1. Update all API routes to use new tables
2. Update UI components
3. Run validation to ensure data integrity
4. Drop old tables:
   - `PlanActivity`
   - `PlanActivityContact`

**Commit:** `Remove legacy PlanActivity tables`

---

## Implementation Order

Each step should be committed separately. Push to remote after completing each phase.

### Phase 1: Schema & Migration
- [ ] Create feature branch from `origin/main`
- [ ] Update Prisma schema with new Activity model and junction tables
- [ ] Generate and run migration
- [ ] Write data migration script
- [ ] Validate migrated data
- **Commits:** Schema, migration, data migration, validation

### Phase 2: API Layer
- [ ] `GET /api/activities` with filtering
- [ ] `POST /api/activities` with associations
- [ ] `GET /api/activities/[id]`
- [ ] `PATCH /api/activities/[id]`
- [ ] `DELETE /api/activities/[id]`
- [ ] Association endpoints (plans, districts, contacts, states)
- [ ] Update `GET /api/territory-plans/[id]/activities` for new schema
- **Commits:** One per endpoint or logical group

### Phase 3: Activities Tab
- [ ] Add "Activities" to sidebar navigation
- [ ] Create ActivitiesView component
- [ ] Add Events/Outreach/Meetings sub-tabs
- [ ] Create ActivityCard component
- [ ] Add filtering UI
- [ ] Wire up to API
- **Commits:** Navigation, view shell, cards, filtering

### Phase 4: Activity Modal
- [ ] Create ActivityFormModal component
- [ ] Type selector (grouped by category)
- [ ] Date range picker
- [ ] Association pickers (plans, districts, contacts, states)
- [ ] Smart pre-fill logic based on context
- [ ] Inline warnings for unlinked districts
- **Commits:** Modal shell, each picker, pre-fill logic, warnings

### Phase 5: Plan View Integration
- [ ] Add Events/Outreach/Meetings tabs to plan detail view
- [ ] Create scoped activity lists
- [ ] Add "New Activity" button with plan pre-fill
- **Commits:** Tabs, scoped lists, creation integration

### Phase 6: Context Entry Points
- [ ] "New Activity" button on district side panel
- [ ] "New Activity" button on contact panel
- [ ] Pre-fill from context
- **Commits:** District entry point, contact entry point

### Phase 7: Flags & Warnings
- [ ] Implement computed flag logic in API responses
- [ ] Warning badges on ActivityCard
- [ ] Resolution flows (add to plan, dismiss)
- [ ] Filter by flag status
- **Commits:** Flag computation, badges, resolution UI

---

## Future Enhancements (Post-MVP)

- Attachments (agendas, notes PDFs)
- Reminders/notifications
- Activity templates for recurring events
- External calendar sync (Google, Outlook)
- Activity analytics and reporting
