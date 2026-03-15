# The Lineup — Feature Brief

**Date:** 2026-03-14
**Branch:** `aston-lineup-tab`
**Status:** All 4 phases built. PR #15 open against `main`. Supabase migration pending.

---

## The Problem

The current Home dashboard is high-level and aggregated — it's a bird's-eye view of territory health. But when Aston or a teammate opens the app at the start of the day, they need to answer a different question: **"What am I actually doing today, and what is everyone else doing?"**

The Home tab doesn't answer that. It shows trends and counts, not a personal daily agenda. There's also no concept of who is responsible for a given activity — everything is attributed to the creator, which breaks down as the team grows.

---

## The Vision

**The Lineup** is a daily operations view — the first thing you see when you open the app. Think of it as a day-level schedule that shows what's happening, who's doing it, and when.

Design references used during brainstorm:
- **Tiimo iOS** — scrollable time-based activity list, hour-grouped, clean visual hierarchy
- **Slack iOS member picker** — chip-based multi-select for choosing which teammates to include

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tab strategy | Option C — The Lineup replaces Home as the default landing; Home stays accessible as a sub-tab | Keeps existing Home intact for users who rely on it; new users land on the more useful daily view |
| Person selector | Multi-select chip UI (Slack iOS-style), defaults to logged-in user | Feels lightweight; lets a manager quickly pull up their whole team |
| Assignee model | Add `assignedToUserId` to Activity; existing activities migrate with `assignedToUserId = createdByUserId` | Simplest model that enables filtering without breaking history |
| Grouping default | Time (hour-based timeline); switchable to District / Plan / Category | Timeline is the most natural "what's happening now" view |
| Activity detail | Click row → opens existing `ActivityFormModal` | No new modal needed; consistent with existing UX |
| Plan → district filter narrowing | Intentionally deferred | Requires data shape work that shouldn't block the core view |

---

## What Was Built

### Phase 0 — Shared utilities extracted
To avoid duplication across HomeView, CalendarView, and The Lineup, shared code was pulled out:
- `date-utils.ts` — `getToday`, `toDateKey`, `getMonthStart/End`, `isSameDay`, `formatTimeShort`
- `format.ts` — `formatScope`
- `ActivityRow.tsx` — shared activity row component (was inline in HomeView)

### Phase 1 — Backend: `assignedToUserId`
- `assignedToUserId` added to Activity in Prisma schema
- Migration SQL written (needs to be run in Supabase — **not yet applied**)
- `GET /api/activities` — filters by assignee; accepts `assignedToUserIds[]` for multi-user view
- `POST` and `PATCH` both accept `assignedToUserId`
- Auth: view/edit allows creator OR assignee; delete stays creator-only
- `api-types.ts` updated

### Phase 2 — Assignee dropdown in ActivityFormModal
- "Assign to" picker added to existing create/edit modal
- Uses existing `useUsers()` hook
- Shows avatar + full name; defaults to current user on create

### Phase 3 — LineupView component
- `src/features/lineup/components/LineupView.tsx`
- Date header with prev/next navigation
- Person selector bar (chip-based multi-select, Slack-style overlay)
- Hour-grouped activity timeline (only populated hours shown)
- Group-by toggle: Time / Category / Plan / District
- Plan + district multi-select filters
- Click row → opens `ActivityFormModal`

### Phase 4 — Navigation wiring
- "Lineup" added as first entry in `MAIN_TABS` in `Sidebar.tsx`
- `page.tsx` updated so Lineup is the default landing tab

---

## What's Still Pending

### Must do before merging to main
- [ ] Run Supabase migration: `prisma/migrations/20260314_add_activity_assigned_to_user/migration.sql`
- [ ] Merge PR #15

### Future Revisit (intentionally deferred)
1. **Lineup Plan Filter — Specific Plan Matching**: `ActivityListItem` doesn't carry `planIds`, so the plan filter can only distinguish "has a plan / no plan." Fix: add `planIds: string[]` to `ActivityListItem` in the API response.
2. **Plan → District Filter Narrowing**: Selecting a plan should narrow the district options shown. Requires understanding the plan-district relationship at render time.
3. **Assignee Open Questions**: Should there be a distinction between "owner" and "assignee"? Multiple assignees? Reassignment Slack notifications?
4. **External Assignees (v2)**: Long-term, assignees should support Contacts (external people) alongside internal UserProfiles. Blocked by `leaid` being required on Contact.
5. **Grouping Preference Persistence**: Persist last-used grouping (localStorage or user settings table).
6. **Week View**: Possible future variant of the timeline.
