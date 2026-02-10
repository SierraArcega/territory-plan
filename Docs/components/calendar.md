# Calendar Component Guide

Standard styling and patterns for the Acuity-style week calendar view. Established during the calendar redesign (Feb 2026) in the activities section. Reuse these patterns for any scheduling, timeline, or date-based views elsewhere in the tool.

## Overall Layout

Two-panel layout: week grid on the left, collapsible right panel on the right.

```tsx
<div className="flex h-full">
  {/* Main area — fills remaining space */}
  <div className="flex-1 flex flex-col min-w-0">
    <CalendarHeader />
    <WeekGrid />
  </div>

  {/* Right panel — fixed width, collapsible */}
  {panelOpen && <RightPanel />}
</div>
```

Key classes:
- `flex h-full` — fills parent height, side-by-side layout
- `flex-1 min-w-0` — main area stretches, prevents overflow from long content
- Right panel is conditionally rendered (not hidden with CSS)

## Header (Acuity-style centered navigation)

```tsx
<div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
  {/* Left: navigation group */}
  <div className="flex items-center gap-3">
    {/* Prev arrow */}
    <button className="p-1.5 text-gray-400 hover:text-[#403770] hover:bg-gray-100 rounded-md transition-colors">
      <svg className="w-5 h-5" ...>←</svg>
    </button>

    {/* TODAY button */}
    <button className="px-3 py-1 text-sm font-semibold tracking-wide uppercase rounded-md text-[#403770] hover:bg-gray-100">
      Today
    </button>

    {/* Next arrow */}
    <button className="p-1.5 text-gray-400 hover:text-[#403770] hover:bg-gray-100 rounded-md transition-colors">
      <svg className="w-5 h-5" ...>→</svg>
    </button>

    {/* Week title */}
    <h2 className="text-lg font-bold text-[#403770] ml-2">
      Week of February 10, 2026
    </h2>
  </div>

  {/* Right: panel toggle */}
  <button className="relative p-1.5 rounded-md transition-colors text-[#403770] bg-[#403770]/10">
    <svg className="w-5 h-5" ...>{/* sidebar icon */}</svg>
  </button>
</div>
```

Rules:
- Background: `bg-white` with `border-b border-gray-200`
- Navigation arrows: `p-1.5`, icon `w-5 h-5`, gray-400 default, Plum on hover
- TODAY button: `text-sm font-semibold tracking-wide uppercase`, Plum text, gray-100 background when on current week
- Week title: `text-lg font-bold text-[#403770]`, format: "Week of [Month] [Day], [Year]"
- Panel toggle active state: `text-[#403770] bg-[#403770]/10`
- Panel toggle inactive state: `text-gray-400 hover:text-[#403770] hover:bg-gray-100`

### Badge on toggle button

When the panel is collapsed and there are unscheduled items, show a count badge:

```tsx
<span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold text-white bg-[#F37167] rounded-full flex items-center justify-center">
  {count > 9 ? "9+" : count}
</span>
```

## Week Grid (day columns)

### Day column headers

```tsx
<div className="grid grid-cols-7 border-b border-gray-200 bg-white">
  <div className="px-2 py-2 text-center border-r border-gray-100 last:border-r-0">
    {/* Day name */}
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
      Mon
    </div>
    {/* Date number */}
    <div className="inline-flex items-center justify-center w-7 h-7 mt-0.5 text-sm font-medium rounded-full text-[#403770]">
      10
    </div>
  </div>
</div>
```

Rules:
- Container: `grid grid-cols-7`, white background, bottom border
- Day name: `text-xs font-semibold text-gray-400 uppercase tracking-wider`
- Date number: `w-7 h-7 text-sm font-medium rounded-full`
- Today's date: `bg-[#F37167] text-white` (Coral circle)
- Normal date: `text-[#403770]`
- Column separator: `border-r border-gray-100 last:border-r-0`

### Day cells (columns)

```tsx
<div className="flex-1 grid grid-cols-7">
  <div className={`relative border-r border-gray-100 last:border-r-0 min-h-[400px] cursor-pointer group ${
    isToday
      ? "bg-[#EDFFE3]/30"           /* Mint tint for today */
      : "bg-white hover:bg-[#C4E7E6]/10"  /* Robin's Egg hover */
  }`}>
    <div className="px-2 space-y-1 pt-2">
      {/* Event chips go here */}
    </div>
  </div>
</div>
```

Rules:
- Container: `flex-1 grid grid-cols-7`
- Each cell: `min-h-[400px]`, `cursor-pointer`, `group` (for hover children)
- Base background: Off-white `bg-[#FFFCFA]` on the grid container
- Today's column: `bg-[#EDFFE3]/30` (Mint at 30% — subtle, not overwhelming)
- Normal column: `bg-white` with `hover:bg-[#C4E7E6]/10` (Robin's Egg at 10%)
- Column separator: `border-r border-gray-100 last:border-r-0`
- Activity chips padding: `px-2 space-y-1 pt-2`

## Event Chips

Activity items displayed inside day cells:

```tsx
<div
  data-event-chip
  className="group/chip flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-all hover:shadow-sm text-xs"
  style={{
    borderLeft: `3px solid ${statusColor}`,
    backgroundColor: statusBgColor,
  }}
  title={`${typeLabel}: ${title} (${statusLabel})`}
>
  <span className="text-sm flex-shrink-0">{typeIcon}</span>
  <span className="truncate font-medium text-gray-700">{title}</span>
  <span className="ml-auto text-gray-400 text-[10px] uppercase tracking-wide flex-shrink-0">
    {typeLabel}
  </span>
</div>
```

Rules:
- Left border: `3px solid` in the activity status color (blue for planned, green for completed, gray for cancelled)
- Background: status-specific light tint (from `ACTIVITY_STATUS_CONFIG`)
- Text: `text-xs`, title in `font-medium text-gray-700`, type label in `text-[10px] text-gray-400 uppercase`
- Icon: emoji from `ACTIVITY_TYPE_ICONS`, `text-sm flex-shrink-0`
- Hover: `hover:shadow-sm`
- Must include `data-event-chip` attribute — used to prevent day-cell click-through
- Must call `e.stopPropagation()` on click to avoid triggering the day cell

### Status colors

| Status | Border color | Background |
|---|---|---|
| Planned | `#6EA3BE` (Steel Blue) | light blue tint |
| Completed | `#8AA891` (Sage) | light green tint |
| Cancelled | `#9CA3AF` (Gray) | light gray tint |

These come from `ACTIVITY_STATUS_CONFIG` in `src/lib/activityTypes.ts`.

## Quick-Add Form (inline)

Appears when clicking an empty area of a day cell:

```tsx
<div className="absolute z-20 left-1 right-1 top-8 bg-white rounded-lg shadow-xl border border-gray-200 p-3">
  <form>
    {/* Date label */}
    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
      Monday, Feb 10
    </div>

    {/* Title input */}
    <input className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent mb-2" />

    {/* Type selector */}
    <select className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent mb-3" />

    {/* Actions */}
    <div className="flex items-center justify-end gap-2">
      <button className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
        Cancel
      </button>
      <button className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50 transition-colors">
        Add
      </button>
    </div>
  </form>
</div>
```

Rules:
- Position: `absolute z-20`, anchored inside the day cell
- Container: `shadow-xl border border-gray-200 rounded-lg p-3`
- Date label: `text-[10px] font-medium text-gray-400 uppercase tracking-wider`
- Inputs: `border-gray-300 rounded-md`, focus ring in Plum (`focus:ring-[#403770]`)
- Submit button: Plum background (`bg-[#403770]`), not Coral (Coral is for primary CTAs, Plum for form submits)
- Close on Escape key and click-outside

## Right Panel (280px)

Fixed-width collapsible panel on the right side. Stacks three sections vertically:

```tsx
<div className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
  <MiniMonthCalendar />    {/* Top: month navigation */}
  <AddButton />            {/* Middle: create action */}
  <UnscheduledList />      {/* Bottom: scrollable list */}
</div>
```

Rules:
- Width: `w-[280px] flex-shrink-0` (never shrinks)
- Border: `border-l border-gray-200`
- Background: `bg-white`
- Each section separated by `border-b border-gray-200`

### Mini-Month Calendar

Compact month grid for navigating to different weeks.

```tsx
<div className="px-4 py-3 border-b border-gray-200">
  {/* Month title + arrows */}
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-[#403770]">February 2026</h3>
    <div className="flex items-center gap-1">
      <button className="p-1 text-gray-400 hover:text-[#403770] rounded transition-colors">
        <svg className="w-3.5 h-3.5" ...>←</svg>
      </button>
      <button className="p-1 text-gray-400 hover:text-[#403770] rounded transition-colors">
        <svg className="w-3.5 h-3.5" ...>→</svg>
      </button>
    </div>
  </div>

  {/* Day-of-week headers */}
  <div className="grid grid-cols-7 mb-1">
    <div className="text-center text-[10px] font-semibold text-gray-400 uppercase">S</div>
    ...
  </div>

  {/* Date grid */}
  <div className="grid grid-cols-7 gap-y-0.5">
    <button className="flex items-center justify-center w-7 h-7 mx-auto text-xs rounded-full transition-colors ...">
      10
    </button>
  </div>
</div>
```

Date states:

| State | Classes |
|---|---|
| Today | `bg-[#F37167] text-white font-bold` (Coral circle) |
| Active week (in-month) | `bg-[#C4E7E6] text-[#403770] font-medium` (Robin's Egg) |
| Normal in-month | `text-[#403770] hover:bg-gray-100` |
| Out-of-month | `text-gray-300` |

Rules:
- Month title: `text-sm font-semibold text-[#403770]`
- Nav arrows: `w-3.5 h-3.5` (smaller than header arrows)
- Day-of-week headers: `text-[10px] font-semibold text-gray-400 uppercase`, single letter (S M T W T F S)
- Date buttons: `w-7 h-7 text-xs rounded-full`
- Clicking any date navigates the main week view to that date's week
- Mini-month auto-syncs to the week view's month, but can be navigated independently

### Add Button Section

```tsx
<div className="px-4 py-3 border-b border-gray-200">
  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0605a] transition-colors">
    <svg className="w-4 h-4" ...>+</svg>
    New Activity
  </button>
  {/* Signature dashed line accent */}
  <div className="mt-3 border-t border-dashed border-[#6EA3BE]" />
</div>
```

Rules:
- Button: Coral (`bg-[#F37167]`), full-width, white text, `rounded-lg`
- This is the primary CTA — always Coral per brand guidelines
- Dashed line: `border-dashed border-[#6EA3BE]` (Steel Blue — Fullmind brand element)
- Opens the full ActivityFormModal (not an inline form)

### Unscheduled Activities List

```tsx
{/* Header */}
<div className="px-4 py-3 border-b border-gray-200">
  <div className="flex items-center gap-2">
    <h3 className="text-sm font-semibold text-[#403770]">Unscheduled</h3>
    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#F37167] rounded-full min-w-[18px]">
      3
    </span>
  </div>
  <p className="text-xs text-gray-400 mt-0.5">Click to assign a date</p>
</div>

{/* Scrollable list */}
<div className="flex-1 overflow-y-auto">
  <button className="w-full px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors text-left">
    <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-700 truncate">{title}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[11px] text-gray-400">{typeLabel}</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
      </div>
    </div>
  </button>
</div>
```

Rules:
- Section header: `text-sm font-semibold text-[#403770]`
- Count badge: Coral (`bg-[#F37167]`), `text-[10px] font-bold`, `rounded-full min-w-[18px]`
- Helper text: `text-xs text-gray-400`
- List items: full-width buttons, `hover:bg-gray-50`
- Item title: `text-sm font-medium text-gray-700 truncate`
- Item metadata: `text-[11px] text-gray-400` + small status dot (`w-1.5 h-1.5 rounded-full`)
- List scrolls independently: `flex-1 overflow-y-auto`
- Empty state: centered icon + `text-xs text-gray-400` message

## Brand Colors Reference

| Token | Value | Calendar usage |
|---|---|---|
| Plum | `#403770` | Header title, date numbers, nav hover, form submit buttons |
| Coral | `#F37167` | Today marker, "New Activity" CTA, count badges |
| Steel Blue | `#6EA3BE` | Dashed line accent, planned status border |
| Robin's Egg | `#C4E7E6` | Active week highlight in mini-month, day column hover |
| Mint | `#EDFFE3` | Today's column background tint (at 30% opacity) |
| Off-white | `#FFFCFA` | Week grid base background |

## Reuse Patterns

These calendar patterns can be applied to other date-based views:

- **Mini-month navigation** — anywhere you need month-level date picking in a sidebar
- **Week grid layout** — timelines, scheduling views, availability grids
- **Event chips** — any list of items with status colors and type icons
- **Collapsible right panel** — reusable panel pattern with toggle in header
- **Quick-add inline forms** — contextual creation forms that appear on click

## File Reference

| Component | File |
|---|---|
| CalendarView (main) | `src/components/activities/CalendarView.tsx` |
| ActivitiesView (parent) | `src/components/views/ActivitiesView.tsx` |
| Activity types/config | `src/lib/activityTypes.ts` |
| Brand guidelines | `Docs/fullmind-brand.md` |
