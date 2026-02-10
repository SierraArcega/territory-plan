# Acuity-Style Calendar Redesign

**Date:** 2026-02-10
**Status:** Approved

## Summary

Redesign the activities calendar view to match an Acuity Scheduling-style layout:
- Week view as the only main view (remove full-page month view)
- Right panel with mini-month calendar, quick-add button, and unscheduled activities
- Acuity-style centered header navigation
- Fullmind brand colors applied throughout

## Layout

```
+----------------------------------------------+------------------+
|                HEADER BAR                    | Right Panel      |
|  < TODAY >   Week of Feb 9, 2026     [=][T] | (collapsible)    |
+----------------------------------------------+                  |
|                                              | Mini-Month Cal   |
|         WEEK VIEW (7 columns)                | [+ New Activity] |
|                                              | Unscheduled List |
|  Sun 9 | Mon 10 | Tue 11 | Wed 12 | ...     |                  |
+----------------------------------------------+------------------+
```

## Design Decisions

1. **Week view only** — mini-month handles month-level navigation
2. **Right panel** — replaces current unscheduled sidebar with stacked sections
3. **Collapsible** — toggle button in header to show/hide right panel
4. **Acuity-style header** — centered nav with arrows around "TODAY", week title
5. **Quick-add button** — opens existing ActivityFormModal (no new form needed)

## Brand Colors Applied

- Plum (#403770): Headers, text, nav hover states
- Coral (#F37167): Today marker, add button, badge counts, dashed accents
- Robin's Egg (#C4E7E6): Current week highlight in mini-month
- Mint (#EDFFE3): Today's column subtle background tint
- Off-white (#FFFCFA): Base background

## Files Modified

- `src/components/activities/CalendarView.tsx` — Major rewrite
- `src/components/views/ActivitiesView.tsx` — Pass new props, remove calendar top bar new-activity button

## Components Changed

- **CalendarView** — Remove month mode, add onNewActivity prop
- **CalendarHeader** — Acuity-style centered layout, remove month/week toggle
- **WeekGrid** — Add brand color touches (today column tint, hover states)
- **MiniMonthCalendar** (new) — Compact month calendar for right panel navigation
- **RightPanel** (replaces UnscheduledSidebar) — Stacks mini-month + add button + unscheduled list
- **MonthGrid** — Removed
