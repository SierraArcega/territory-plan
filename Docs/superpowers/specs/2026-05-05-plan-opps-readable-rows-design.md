# Plan Opportunities Tab — Readable Rows + LMS Link

**Date:** 2026-05-05
**Status:** Approved

## Problem

In the Plan detail panel's **Opportunities** tab (`PlanOpportunitiesTab`), the row layout collapses the Name column to one or two characters and wraps the Stage pill onto two lines. There's also no way to jump from a row to the underlying LMS opportunity record — reps have to leave the panel and search the source system manually.

Root cause: the grid template `grid-cols-[1.5fr_1fr_90px_90px_90px_90px_90px_90px]` packs eight columns into a side panel of roughly 600px. The six fixed 90px columns plus the 1fr District column starve the 1.5fr Name column. Stage labels like "2 - Presentation" exceed the 90px Stage column and wrap.

## Solution

Three coordinated changes in one PR:

1. **Reclaim Name + Stage width** by switching to a fixed-width grid (`min-width: max-content`) and wrapping the row band in horizontal scroll.
2. **Pin Name** as a sticky-left column so it stays visible while the user scrolls horizontally to see money columns.
3. **Make Name a hyperlink** to the LMS opportunity (`Opportunity.detailsLink`), opening in a new tab.

## Behavior Changes

| Element | Before | After |
|---------|--------|-------|
| Name column | `1.5fr` — collapses to ~1 char in side panel | `minmax(200px, 1.5fr)` — always readable |
| Stage column | `90px` — pill wraps to 2 lines | `120px` — pill stays single line |
| Row overflow | None — columns collide | `overflow-x-auto` on row band |
| Name column scroll behavior | Scrolls with rest of row | Sticky-left, stays visible during horizontal scroll |
| Name cell | Plain text span | `<a target="_blank">` to `detailsLink` if present, plain text if null |
| LMS link affordance | None | Name underlines on hover; trailing `ExternalLink` icon next to text |
| API response | Missing `detailsLink` | Includes `detailsLink: string \| null` per row |

No columns added, removed, or reordered. Sort behavior unchanged.

## Files Changed

### 1. `src/app/api/territory-plans/[id]/opportunities/route.ts`

Add `detailsLink: true` to the Prisma `select` and pass it through in the mapped response. The `PlanOpportunityRow` type in `src/features/shared/types/api-types.ts` already declares the field (line 975), so no type change is needed.

```ts
select: {
  // ...existing fields
  closeDate: true,
  detailsLink: true,
},
// ...
const opportunities = rows.map((r) => ({
  // ...existing fields
  closeDate: r.closeDate?.toISOString() ?? null,
  detailsLink: r.detailsLink,
}));
```

### 2. `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx`

#### Shared column template

Extract the grid template into a single constant so header / body / footer never drift:

```ts
const COLUMNS = "minmax(200px,1.5fr) 140px 120px 110px 90px 90px 90px 100px";
```

Widths: Name (flex), District 140, Stage 120, Type 110, Bookings 90, Revenue 90, Take 90, Scheduled 100. Total minimum ~920px so the row will scroll horizontally inside the ~600px side panel.

#### Container

Outer container becomes `flex flex-col h-full overflow-x-auto`. The existing inner `flex-1 overflow-y-auto` keeps vertical scroll. Header, body rows, and footer all use:

```tsx
<div
  className="grid items-center px-5 ..."
  style={{ gridTemplateColumns: COLUMNS, minWidth: "max-content" }}
>
```

#### Sticky-left Name cell

The Name `<span>` / `<a>` (and its corresponding header button + footer cell) gets:

```
position: sticky; left: 0; z-index: 1;
background: <row's own background>;
border-right: 1px solid #E2DEEC;
```

Row backgrounds:
- Header row → `bg-[#FAFAFE]` (existing) — sticky cell matches.
- Body row → `bg-white` default, `bg-[#FAFAFE]` on hover — sticky cell uses the same hover transition so the sticky cell hover-tints in lockstep with its row.
- Footer row → `bg-[#FAFAFE]` (existing) — sticky cell matches.

The `border-r` provides a subtle scroll-edge cue without needing a JS scroll-shadow.

#### Stage column

`whitespace-nowrap` on the cell wrapper and on the pill `<span>` itself. Width 120px gives the longest known stage label ("2 - Presentation") room to render on one line.

#### Name as link

```tsx
{opp.detailsLink ? (
  <a
    href={opp.detailsLink}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 min-w-0 text-xs font-medium text-[#544A78] hover:underline fm-focus-ring"
    title={opp.name ?? undefined}
  >
    <span className="truncate">{opp.name ?? "Untitled"}</span>
    <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
  </a>
) : (
  <span
    className="text-xs font-medium text-[#544A78] truncate pr-2"
    title={opp.name ?? undefined}
  >
    {opp.name ?? "Untitled"}
  </span>
)}
```

`ExternalLink` from `lucide-react` (already used in `OppDrawer.tsx`). The `truncate` lives on the inner `<span>`; the icon's `shrink-0` prevents it from being clipped when the name overflows.

#### Footer

Footer reuses the same `COLUMNS` template. Order: count + 3 empty spans (Name, District, Stage, Type) + 4 right-aligned totals (Bookings, Revenue, Take, Scheduled). Today's footer renders the count under Name and 3 blanks then 4 totals — that's correct, but the misalignment risk goes away once header/body/footer share the constant.

## Out of Scope

- No mobile/tablet reflow — desktop sales tool, side panel behaves the same on tablet.
- No changes to which columns are shown or how they sort.
- No new tests beyond rendering-level coverage. There is no existing test file for `PlanOpportunitiesTab`; one will be created during implementation to cover (a) Name renders as link when `detailsLink` is present, (b) Name renders as span when `detailsLink` is null, (c) Stage pill receives `whitespace-nowrap` class.
- No change to the underlying `Opportunity` model or to the upstream sync that populates `details_link` (refreshed every 30 min by external writer).

## Risks

- **Sticky-left cell on grid items**: `position: sticky` on a CSS grid child is supported in all modern browsers, but the sticky cell must have an opaque background or scrolling cells will show through. Backgrounds are explicit per row state (default / hover / header / footer).
- **Hover state on sticky cell**: the sticky Name cell has its own background, so the row's `hover:bg-[#FAFAFE]` does not propagate to it via inheritance. The sticky cell needs a sibling `group-hover:bg-[#FAFAFE]` (with `group` on the row wrapper) to stay in sync.
- **`detailsLink` may be null** for opportunities that haven't been ingested with a source URL. Handled — fall back to plain text.
