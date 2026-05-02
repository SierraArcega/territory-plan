# Activities Filter Chip Cleanup — Design Spec

**Date:** 2026-04-28
**Status:** Approved by user, ready for implementation
**Implementation skill:** `/frontend-design`
**Files affected:** `src/features/activities/components/page/ActivitiesFilterChips.tsx` (only)

---

## Problem

The Activities page filter chip bar renders one pill per active filter value across nine underlying filter arrays (`categories`, `types`, `statuses`, `owners`, `attendeeIds`, `districts`, `inPerson`, `states`, `territories`, `tags`). When a section is broadly selected — most commonly via the "All" button shipped earlier today — the bar dumps 25+ identical-shaped pills into a wrapping row.

Three issues compound:

1. **Volume.** Selecting "All creators" produces 28 chips like `By Sierra ×`, `By Andrew ×`, `By Anurag ×`. The bar visually drowns the rest of the page.
2. **No visual hierarchy.** Every chip looks the same, so a user can't tell at a glance which filter category dominates.
3. **Repeated prefixes.** "By X · By Y · By Z" is verbose noise — the prefix should appear once per group, not once per value.

---

## Solution: One summary chip per section

Replace the flat per-value chip list with a per-section summary chip. Each section that has at least one selected value renders as a single chip carrying its section label, a compressed item summary, and a clear button.

### Visual shape

```
┌──────────────────────────────────────────┐
│ Created by · Me, Andrew +23           ×  │
└──────────────────────────────────────────┘
```

- **Section label** (uppercase, muted plum tone) on the left
- `·` separator
- **Item summary** following the rules in [Item summary rules](#item-summary-rules)
- **`×` button** on the right that clears every value in the section

Styling matches existing chips: white background, `#D4CFE2` border, plum text, `#F7F5FA` hover background, rounded-full pill shape, `fm-focus-ring` on interactive elements.

### Item summary rules

For a section with N selected values:

| State | Render |
|-------|--------|
| All values selected (where total is bounded — see below) | `Created by · All` |
| 1 value | `Created by · Me` |
| 2 values | `Created by · Me, Andrew` |
| 3+ values | `Created by · Me, Andrew +23` |

"All" detection per section:
- **Type** — all 6 categories in `ACTIVITY_CATEGORIES` selected. The `types` array is irrelevant for All-detection because picking all 6 categories already covers every type. (See [Special-case: Type section](#special-case-type-section).)
- **Status** — all 7 entries from `VALID_ACTIVITY_STATUSES` selected
- **In person?** — both `yes` and `no` selected
- **Created by** / **Attendees** — `selectedIds.length === users.length` (where `users` is from `useUsers()`)
- **District** — never shows "All" (the universe is unbounded — there are 13k+ districts and the popover is search-paginated, so we can't know what "All" would mean)
- **States, territories, tags** — out of scope for this redesign; their existing chip behavior is preserved if any are added in the future

The first 2 items shown for the 3+ case use the same human labels as the existing chip code (e.g. "Me" for the current user, full name for others, district name for leaids).

### Special-case: Type section

Today, `categories` and `types` are two separate filter arrays — but to the user they answer the same conceptual question: "what kind of activity?" Showing them as two adjacent chips ("Type · Conference" and "Category · Events") doubles the noise.

For chip rendering, **merge** the two into one `Type` group:
- Items in the summary = the union of selected categories (rendered with `CATEGORY_LABELS`) and selected types (rendered with `ACTIVITY_TYPE_LABELS`). Order: categories first in their canonical `ACTIVITY_CATEGORIES` key order, then types in the order they appear inside their parent category. This makes the visible item list deterministic without sorting.
- "All" detection uses categories only (per above)
- The `×` clears both `categories` and `types`
- Click-to-edit opens the popover scrolled to the Type section, which already houses both controls

### Section ordering

Chips render in a stable order matching the popover layout, so visual scanning matches the popover scanning:

1. Type (merged categories + types)
2. Status
3. In person?
4. Created by (`owners`)
5. Attendees (`attendeeIds`)
6. District (`districts`)

`states`, `territories`, `tags` are not in the popover today and remain unchanged — keep their existing per-value chip rendering as a fallback. They're rarely populated; this is a minor inconsistency to revisit later.

---

## Interactions

### Click on chip body (anywhere except `×`)

- If the popover is closed, opens it and expands the corresponding section.
- If the popover is already open, just adds the section to the `expanded` set without closing/reopening.
- Other sections retain their current expansion state from prior popover sessions.

To support this, the `expanded` `Set<SectionId>` state currently local to `AddFilterPopover` must be lifted into the parent `ActivitiesFilterChips` (or shared via a small context). Lifting is the cleaner option since the popover open state already needs to be triggered externally.

### Click on `×`

Clears every value in the section's underlying filter arrays via `patchFilters`. For Type, that means `patchFilters({ categories: [], types: [] })`. For others, the single field.

This converges with the existing "Reset filters" button — both call `patchFilters`, no state divergence.

### Empty state

When no sections have selections, the bar shows the existing italic "No filters active — viewing everything in this range" message. No change.

### Wrap behavior

The bar remains single-row with `flex-wrap`. With Approach 1, even the all-creators case is one chip wide — wrapping should be rare. No max-width or truncation per chip beyond the `+N` summary rule.

---

## Code changes

All changes live in `src/features/activities/components/page/ActivitiesFilterChips.tsx`. No backend, no filter-store, no API changes.

### Removed

- The `ChipSpec` type
- The `activeChips: ChipSpec[]` `useMemo` that builds per-value chips
- The `removeChip(spec)` function
- The `ActiveChip` component
- The mapping `activeChips.map((chip) => <ActiveChip ... />)` in the JSX

### Added

- A `GroupChipSpec` type:
  ```ts
  type SectionId = "type" | "status" | "inPerson" | "creators" | "attendees" | "districts";
  interface GroupChipSpec {
    id: SectionId;
    label: string;          // "Created by", "Type", etc.
    items: string[];        // human labels for the first ≤2 items
    extraCount: number;     // 0 if items.length covers the selection, else the number after the visible items
    isAll: boolean;         // when true, render `· All` instead of items
    onClear: () => void;    // patches all underlying arrays for this section to []
  }
  ```
- A `groupChips: GroupChipSpec[]` `useMemo` that produces one entry per active section
- A `<GroupChip>` component that renders the chip with section label + summary + clear button + section-click handler
- Lifted `expanded` and `open` state out of `AddFilterPopover` and into `ActivitiesFilterChips` (or use a small context). The popover accepts `expanded`, `setExpanded`, `open`, `setOpen` as props, plus an `expandSection(id)` helper that sets `open=true` and adds the id to `expanded`.

### Preserved

- `useDistricts` chip-label lookup — still needed to map district leaids to district names for the items array
- All existing fetch hooks (`useUsers`, `useStates`, `useTerritoryPlans`, `useTags`)
- Per-value chip rendering for `states`, `territories`, `tags` — these aren't in the popover redesign, leave alone
- The `Reset filters` button on the right
- The `+ Filter` button position
- The `Search…` button + ⌘K hotkey hint at the start of the bar

### Estimated diff

~150 lines removed, ~120 added, net reduction of ~30 lines. All within `ActivitiesFilterChips.tsx`.

---

## Out of scope

- States / territories / tags chip cleanup. Same flat-pill pattern remains for now since they aren't in the popover. Revisit when those filters get UI.
- Saved view tabs. Untouched.
- The popover itself (collapsible sections, "All" / "Clear" links, checkbox indicators). All shipped earlier today and stay as-is.
- Mobile chip-bar behavior. The current overflow-wrap behavior is the same; a future pass could collapse the bar into a "3 filters active" summary at narrow widths.

---

## Acceptance criteria

1. Selecting "All" on Created by produces exactly **one** chip in the bar that reads `Created by · All`, not 28 separate chips.
2. Selecting 3 specific creators produces one chip reading `Created by · <name1>, <name2> +1`.
3. Selecting 1 type and 2 categories produces one merged Type chip with items from both arrays.
4. Clicking a chip body opens the popover scrolled to that section, expanded.
5. Clicking the chip's `×` clears every value in that section.
6. The empty-state copy ("No filters active — viewing everything in this range") still appears when nothing is selected.
7. The `Reset filters` button still clears everything.
8. Visual styling matches existing chip-bar Fullmind brand tokens (no Tailwind grays, plum-derived neutrals only, Lucide icons with `currentColor`).

---

## Implementation handoff

`/frontend-design` should pick this up. The skill is the right fit because:
- The change is a UI-only chip-rendering refactor in one file
- It needs Fullmind brand-token compliance verification
- No new backend or store work
- No new design assets — visual shape is described above and matches existing chip patterns
