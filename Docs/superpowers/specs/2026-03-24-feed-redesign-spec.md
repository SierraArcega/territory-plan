# Feature Spec: Feed Redesign

**Date:** 2026-03-24
**Slug:** feed-redesign
**Branch:** worktree-feed-redesign

## Requirements

Redesign the Home Base Feed to give reps a clear, actionable daily view with three stacked zones:

1. **Today's Focus** — Tasks and activities due/scheduled for the selected day
2. **Needs Attention** — Plan health alerts (districts without contacts, stale plans, incomplete activities)
3. **Coming Up** — Tasks and activities in the next 7 days, with overflow count for items beyond

The Feed should answer three questions at a glance:
- "What do I need to do today?"
- "What's falling through the cracks?"
- "What's coming up this week?"

## Visual Design

### Layout: Stacked Sections with Summary Cards

```
┌─────────────────────────────────────────┐
│  ← Tuesday, March 25, 2026 →           │  ← Day navigator (existing)
├─────────────────────────────────────────┤
│ [3 Due Today] [2 Alerts] [5 This Week] │  ← Summary cards (redesigned)
├─────────────────────────────────────────┤
│                                         │
│ ● TODAY'S FOCUS              3 items    │  ← Tasks + activities for selected day
│ ┌─────────────────────────────────────┐ │     Interleaved, sorted by time/priority
│ │ ☐ Follow up with Onamia        High │ │     Tasks show checkbox, priority, plan
│ │   Kansas Plan · due today           │ │     Activities show type, district count
│ ├─────────────────────────────────────┤ │
│ │ 🗓 Visit: Onamia Public School      │ │
│ │   School Site Visit · 1 district    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⚠ NEEDS ATTENTION             3 alerts  │  ← Plan health signals
│ ┌─────────────────────────────────────┐ │
│ │ Onamia Public Schools               │ │     Alert 1: Districts w/o contacts
│ │ Kansas Plan · No contacts           │ │     Show individual district + plan name
│ ├─────────────────────────────────────┤ │
│ │ Nebraska Plan                       │ │     Alert 2: Stale plans (no activity 30d)
│ │ No tasks or activities in 30 days   │ │
│ ├─────────────────────────────────────┤ │
│ │ MASA Dinner                         │ │     Alert 3: Completed, no outcome
│ │ Completed Mar 17 · No next steps    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📅 COMING UP                  5 items   │  ← Next 7 days + overflow count
│ ┌─────────────────────────────────────┐ │
│ │ Wed Mar 26                          │ │     Grouped by date
│ │   Lunch with Denise · Dinner        │ │     Tasks show checkbox
│ ├─────────────────────────────────────┤ │     Activities show type
│ │ Thu Mar 27                          │ │
│ │   ☐ Prepare proposal · Medium       │ │
│ └─────────────────────────────────────┘ │
│ + 1 more item beyond this week          │  ← Overflow link
│                                         │
│ ┌─ Empty state (when all zones empty) ─┐│
│ │ "You're all set — what's next?"      ││
│ │ [Create a Plan]  [Add Contacts]      ││
│ └──────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Key Architectural Decisions

- **Single scrollable view** — all three zones stack vertically, no tabs
- **Day navigator** controls "Today's Focus" zone; the other zones are date-independent
- **Summary cards** at top provide at-a-glance counts for each zone
- **Mixed rows** — Today's Focus interleaves tasks and activities by time, not separate sections
- **Needs Attention** surfaces three alert types at the individual item level

## Component Plan

### Existing Components to Reuse
- `DayNavigator` — day picker with arrow navigation (existing, no changes)
- `FeedSection` — section header with color dot + count (existing, no changes)
- `TaskRow` — task row with checkbox, priority, plan badge (existing, no changes)
- `UpcomingActivityRow` — activity row with type, district count, date (existing, no changes)
- `FeedControls` — show completed toggle + page size (existing, keep for Today zone)

### Components to Modify
- `FeedSummaryCards` — redesign to show 3 zone counts instead of 5 specific counts
- `FeedTab` — major rewrite of data logic and section rendering

### New Components Needed
- `AlertRow` — row component for Needs Attention alerts (district/plan/activity alerts)
- `ComingUpSection` — 7-day grouped view with date headers and overflow count

## Data Requirements

### Today's Focus
- **Source:** `useTasks({})` + `useActivities({})`
- **Filter tasks:** `dueDate` matches selected day (existing logic)
- **Filter activities:** `startDate` matches selected day (existing logic)
- **Overdue tasks** still pinned above Today's Focus

### Needs Attention — Three Alert Types

**1. Districts without contacts**
- **Query:** For each of the user's plans, find districts with 0 contacts
- **New API needed:** `GET /api/feed/alerts` (or compute client-side)
- **Data path:** TerritoryPlan → TerritoryPlanDistrict → District → Contact (count)
- **Display:** Individual district name + plan name

**2. Plans with no activity in 30 days**
- **Query:** Plans where no linked Activity or Task has been created/updated in 30 days
- **Data path:** TerritoryPlan → ActivityPlan (last 30d) + TaskPlan (last 30d)
- **Display:** Plan name + "No tasks or activities in 30 days"

**3. Completed activities without outcomes**
- **Source:** `useActivities({})` already fetched
- **Filter:** `status === "completed" && !outcomeType` (existing logic)
- **Display:** Activity title + completed date + "No next steps"

### Coming Up (Next 7 Days)
- **Source:** `useTasks({})` + `useActivities({})`
- **Filter tasks:** `dueDate` > today AND `dueDate` <= today + 7 days, status !== "done"
- **Filter activities:** `startDate` > today AND `startDate` <= today + 7 days, status === "planned"
- **Group by:** date, sorted ascending
- **Overflow:** Count items with dates beyond 7 days, show "+ N more items beyond this week"

## States

- **Loading:** Skeleton placeholders in each zone (reuse existing pulse pattern)
- **Empty (per zone):** Zone simply doesn't render if 0 items
- **Empty (all zones):** Show existing "You're all set" CTA
- **Error:** Standard error boundary, no special handling needed

## Out of Scope

- Calendar integration in the Feed (Meetings to Log stays as-is if calendar connected)
- Drag-and-drop reordering of items
- Filtering/sorting within zones
- Plan health scoring or weighted alerts
- Activity detail modal from Feed (click navigates to existing views)
