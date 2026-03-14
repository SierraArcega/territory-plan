# The Lineup — Build Progress & Future Revisit Items

Brainstorm started: 2026-03-14. Branch: `aston-lineup-tab`.

---

## Build Phases

### Phase 0 — Pre-build extraction ✅ Complete
Extracted shared utilities to prevent duplication across HomeView, CalendarView, and The Lineup.

- `date-utils.ts` — added `getToday`, `toDateKey`, `getMonthStart/End`, `isSameDay`, `formatTimeShort`
- `format.ts` — added `formatScope` (was inline in ActivitiesTable)
- `ActivityRow.tsx` — new shared component extracted from HomeView's inline activity rendering
- HomeView and ActivitiesTable updated to use shared imports

### Phase 1 — Backend: `assignedToUserId` ✅ Complete
Added assignee field to Activity model so activities can be assigned to team members.

- `prisma/schema.prisma` — `assignedToUserId` added with index
- `prisma/migrations/20260314_add_activity_assigned_to_user/migration.sql` — **needs to be run in Supabase**
- `GET /api/activities` — filters by `assignedToUserId` (defaults to current user); accepts `assignedToUserIds` param for multi-user Lineup view
- `POST /api/activities` — accepts `assignedToUserId`, defaults to creator
- `PATCH /api/activities/[id]` — accepts `assignedToUserId` for reassignment
- Auth: view/edit allows creator OR assignee; delete remains creator-only
- `api-types.ts` — `assignedToUserId` added to `Activity`, `ActivityListItem`, `ActivitiesParams`

### Phase 2 — ActivityFormModal: assignee dropdown ⬜ Up next
Add an "Assign to" user picker inside the existing activity create/edit modal.

- Use existing `useUsers()` hook (already fetches all UserProfile records)
- Dropdown shows avatar + full name for each user
- Defaults to current user on create; shows current assignee on edit
- Sends `assignedToUserId` on POST and PATCH

### Phase 3 — LineupView component ⬜
New view component at `src/features/lineup/components/LineupView.tsx`.

- **Date header**: large day + date display with prev/next arrow navigation
- **Person selector bar**: chip-based multi-select; logged-in user selected by default; Slack-style picker overlay to add teammates (uses `useUsers()` + `useProfile()`)
- **Activity timeline**: scrollable list grouped by hour, only populated hours shown
- **Activity row**: reuses `ActivityRow` component (already extracted); shows assignee avatar
- **Group-by toggle**: switch between Time / Category / Plan / District
- **Filters**: plan multi-select + district multi-select (independent; narrowing deferred)
- **Click row**: opens existing `ActivityFormModal`

### Phase 4 — Navigation wiring ⬜
Wire The Lineup into the app shell as the default landing experience.

- `Sidebar.tsx` — add "Lineup" tab entry and icon; update `TabId` type
- `AppShell.tsx` / `page.tsx` — Lineup becomes the default tab on load
- Existing Home dashboard moves to a sub-tab within the same view (toggle: "Lineup" | "Dashboard")

---

## Future Revisit Items

These are intentional deferments — decisions made with awareness of the tradeoff.

---

### Plan → District Filter Narrowing

**Current decision**: When a plan is selected in the filter multi-select, it SHOULD narrow the available districts shown in the district filter to only those districts linked to the selected plan(s).

**Why deferred**: This requires understanding the plan-district relationship at filter render time, which may need an additional API call or a data shape change in how district options are fetched. Building this correctly matters more than building it fast.

**What to revisit**:
- Should the district multi-select options update reactively as plans are selected?
- Should selecting a district that belongs to multiple plans auto-select those plans too (reverse cascade)?
- How do we handle a user selecting "All Districts" — does that implicitly unset the plan filter?
- Performance: is pre-fetching all plan-district mappings on mount acceptable, or should this be lazy?

**Suggested approach when revisiting**: Pull plan-district links from the existing `ActivityPlanLink` / `ActivityDistrictLink` data shapes and build a dependency map client-side. The API already supports `planId` and `districtLeaid` as independent params — the UI-level narrowing can be additive without a backend change.

---

### Assignee Field: Open Questions

**Current decision**: Add `assignedToUserId` to the Activity model. For all existing activities, `assignedToUserId` defaults to `createdByUserId`.

**What to revisit**:
- Should there be a distinction between "owner" (creator) and "assignee" (responsible party) in the UI? Right now these would be conflated at migration time.
- Should multiple assignees ever be supported (e.g., a joint call)?
- Should reassignment trigger a Slack notification to the new assignee?

---

### External Assignees + Unified People Model (v2)

**Current decision (v1)**: Assignee is `assignedToUserId` only — limited to internal `UserProfile` records. External people cannot be assigned yet.

**The vision (v2+)**: Assignee should support both internal users (UserProfile) and external people (Contact). The UI picker would show both in a unified list. This enables assigning activities and tasks to 3rd party contractors, agency partners, or external collaborators.

**What needs to happen**:
- `leaid` on the Contact model is currently required — every contact must belong to a school district. Contractors and external people have no district. This constraint needs to be relaxed before Contact can serve as a universal people model.
- Several downstream queries assume every contact has a district (district name joins, leaid filters). These need auditing before `leaid` becomes optional.
- Add `assignedToContactId` to Activity and Task alongside `assignedToUserId`. Only one should be populated at a time (enforced at app layer or via DB check constraint).
- The assignee UI picker needs to merge UserProfile and Contact into a single searchable list, visually differentiated (internal badge vs. external badge).

**Sentiment tracking**:
- No sentiment field exists on Contact today. The closest proxy is activity outcome trends (e.g., repeated `negative` or `follow_up_needed` outcomes linked to a contact).
- When revisiting, consider: explicit `sentiment` enum field on Contact (positive / neutral / at_risk / negative), or derive it from a rolling window of linked activity outcomes.
- Contractor relationship health and sentiment could live on Contact and surface in ContactDetail and The Lineup's activity rows.

**Suggested approach when revisiting**: Branch this as a "People Model v2" initiative separate from The Lineup. The schema change to Contact is meaningful enough to deserve its own migration, testing, and rollout.

---

### The Lineup — Grouping Flexibility

**Current decision**: Default view groups by day + hour (timeline). Can be reorganized by district, plan, or category.

**What to revisit**:
- Persist the user's last-used grouping preference (localStorage or user settings table)?
- Should the timeline view show empty time slots, or only slots with activities?
- Is there a "week view" variant worth adding later?
