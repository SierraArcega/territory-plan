# Navigation Components Guide — Design Spec

## Purpose

Create a comprehensive navigation component guide for the Fullmind territory planning product, documenting the ideal-state design system for 9 navigation component types. The guide prescribes plum-derived token usage throughout — the codebase will be migrated to match.

Also: restructure the existing `tables.md` into the same subfolder pattern, and create a skill that enforces this methodology when adding new component guides.

## Decisions

1. **Ideal state, not current** — document target patterns using plum-derived tokens; flag codebase deviations for migration
2. **Full specs for all 9 components** — including ones not yet built (Steps, Tree View, Breadcrumbs)
3. **Subfolder structure** — `Navigation/` with `_foundations.md` + individual component files
4. **Tables restructure** — split `tables.md` into `Tables/` subfolder with same pattern
5. **Standardized active states** — coral accent system across all nav components
6. **3-tier size scale** — small/medium/large for buttons and icons
7. **Heavy foundations, light components** — shared patterns in `_foundations.md`, component files reference it
8. **New skill** — enforces subfolder + foundations + component file methodology

## File Structure

```
Documentation/UI Framework/Components/
├── Navigation/
│   ├── _foundations.md
│   ├── buttons.md
│   ├── breadcrumbs.md
│   ├── collapsible-views.md
│   ├── facets.md
│   ├── links.md
│   ├── pagination.md
│   ├── side-nav.md
│   ├── steps.md
│   ├── tabs.md
│   └── tree-view.md
├── Tables/
│   ├── _foundations.md
│   ├── data-table.md
│   ├── detail-table.md
│   └── compact-table.md
```

Pagination lives canonically in `Navigation/pagination.md`. Tables docs reference it rather than duplicating the spec.

---

## Navigation Foundations (`_foundations.md`)

### Active State System — Coral Accent

All navigation components use the same active/selected indicator pattern.

**Vertical navigation (sidebar, icon bar, tree view):**
- Active: `border-l-3 border-[#F37167]` + `bg-[#fef1f0]` + `text-[#F37167]`
- Inactive: `text-[#6E6390]` + `border-l-3 border-transparent`
- Hover (inactive): `bg-[#EFEDF5]` + `text-[#403770]`

**Horizontal navigation (tabs):**
- Active: `h-0.5 bg-[#F37167]` bottom indicator + `text-[#F37167]`
- Inactive: `text-[#8A80A8]`
- Hover (inactive): `text-[#403770]`

**Transition:** `transition-colors duration-100` on all state changes.

### Focus Ring

Standard across all interactive nav elements:

```
focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
```

Applied to: buttons, tabs, links, tree nodes, sidebar items, pagination controls, filter controls.

### Size Scale

Three tiers. Every button, tab, and nav item uses one of these.

| Tier | Text | Padding | Icon | Use case |
|------|------|---------|------|----------|
| Small | `text-xs font-medium` | `px-3 py-1.5` | `w-3.5 h-3.5` | Row actions, inline controls, filter chips |
| Medium | `text-sm font-medium` | `px-4 py-2` | `w-4 h-4` | Standard buttons, tabs, toolbar controls |
| Large | `text-sm font-medium` | `px-5 py-2.5` | `w-5 h-5` | Page-level nav, sidebar items, hero CTAs |

### Icon Conventions

- Stroke-based only: `fill="none" stroke="currentColor"`
- Stroke width: `strokeWidth={2}`
- Line caps: `strokeLinecap="round" strokeLinejoin="round"`
- ViewBox: `viewBox="0 0 24 24"` (sized via Tailwind `w-` / `h-` classes)
- Color: inherits from parent via `currentColor`
- Gap from label text: `gap-2`

### Transition Timing

| Context | Classes |
|---------|---------|
| Color/background changes | `transition-colors duration-100` |
| Expand/collapse | `transition-all duration-150` |
| Panel slide | `transition-all duration-200` |
| Chevron rotation | `transition-transform duration-150` |
| Opacity reveal | `transition-opacity duration-150` |

### Disabled State

```
opacity-50 cursor-not-allowed pointer-events-none
```

No hover or focus effects. Applied identically across all components.

### Keyboard Conventions

| Key | Behavior |
|-----|----------|
| `Enter` / `Space` | Activates buttons, toggles, selects options |
| `Escape` | Closes menus/popovers/dropdowns, returns focus to trigger |
| Arrow keys | Navigates within a group (tabs, menu items, tree nodes) |
| `Tab` | Moves between distinct control groups |
| `Home` / `End` | Jumps to first/last item in a group (tabs, tree) |

---

## Component Specs

### Buttons (`buttons.md`)

6 variants, each available in all 3 size tiers from foundations.

**Primary:**
- `bg-[#403770] text-white rounded-lg hover:bg-[#322a5a]`
- Use: Main actions — Create Plan, Save, Submit

**Secondary (Outlined):**
- `border border-[#403770] text-[#403770] rounded-lg hover:bg-[#403770] hover:text-white`
- Use: Edit, secondary actions alongside a primary button

**Destructive:**
- `border border-[#F37167] text-[#F37167] rounded-lg hover:bg-[#F37167] hover:text-white`
- Use: Delete, Remove, destructive actions

**Ghost:**
- `text-[#403770] hover:bg-[#EFEDF5] rounded-lg`
- Use: Cancel, toolbar actions, low-emphasis controls

**Icon-only:**
- `p-[tier] text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5]`
- Destructive variant: `hover:text-[#F37167] hover:bg-[#fef1f0]`
- Always include `aria-label` and `title`
- Use: Table row actions, close buttons, collapse toggles

**Chip/Toggle:**
- Inactive: `rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white px-3 py-1 text-xs font-medium`
- Active: `rounded-full bg-[#403770] text-white border-transparent px-3 py-1 text-xs font-medium`
- Optional count badge: `text-[10px] font-bold bg-white/20 rounded-full px-1.5 ml-1`
- Use: Filter chips, view toggles, category selectors

**Loading state:** Spinner replaces icon (or appears before label). Button stays `disabled` during loading. Spinner: `w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin`.

**Button groups:** When buttons are grouped horizontally, use `gap-2` (small), `gap-3` (medium/large). Right-align action groups in modals and toolbars with `flex justify-end`.

### Breadcrumbs (`breadcrumbs.md`)

New component — not yet in codebase.

**Anatomy:** `Home > Section > Subsection > Current Page`

**Items:**
- Clickable ancestors: `text-sm text-[#6EA3BE] hover:text-[#403770] hover:underline`
- Current page (last item): `text-sm font-medium text-[#403770]` — not clickable
- Separator: chevron-right icon `w-3 h-3 text-[#A69DC0]`, `gap-1.5` between items

**Truncation:** When path exceeds 4 levels, middle items collapse to an ellipsis button (`...`) that expands on click to show full path in a dropdown.

**Container:** `flex items-center gap-1.5 text-sm` — no background, no border. Sits in page headers.

**Keyboard:** Each ancestor link is focusable via Tab. Ellipsis button opens dropdown on Enter/Space.

**Codebase note:** PlansView currently uses a back-button chevron. Breadcrumbs replace this when navigation depth > 1 level.

### Collapsible Views (`collapsible-views.md`)

Based on existing SignalCard pattern, standardized.

**Trigger anatomy:**
- Chevron: `w-3 h-3` pointing right (collapsed) / down (expanded)
- Rotation: `transition-transform duration-150`
- Label: `text-xs font-medium text-[#8A80A8] hover:text-[#403770]`
- Layout: `flex items-center gap-1.5`

**Expand trigger placement — 2 patterns:**

1. **Card section expand** (SignalCard style): Trigger sits as a footer row below card content, separated by `border-t border-[#E2DEEC]`. Label text: "View details" / "Hide details".

2. **Section header expand** (accordion style): Trigger is the section heading itself. Chevron sits left of heading text. Heading: `text-sm font-semibold text-[#403770]`.

**Expanded container:**
- Padding: `px-3 pb-3` (card) or `px-0 pb-0` (section, inherits parent padding)
- Separator: `border-t border-[#E2DEEC]` above expanded content

**Accordion variant:** Only one section open at a time within a group. Expanding a new section collapses the previous one.

**Sidebar collapse:** Full sidebar collapse to icon-only mode.
- Expanded: `w-[140px]`, shows icon + label
- Collapsed: `w-14`, icon-only with tooltip on hover
- Toggle: chevron button at sidebar bottom, `text-[#A69DC0] hover:text-[#403770]`
- Tooltip: `bg-[#403770] text-white text-sm rounded-lg shadow-lg px-2 py-1 z-50`

**Keyboard:** `Enter`/`Space` toggles. `Tab` moves between collapsible triggers.

### Facets (`facets.md`)

3 tiers of filtering complexity.

**Tier 1 — Filter Chips:**
- Horizontal row of pill toggles: `gap-2`
- Uses chip/toggle button variant from buttons.md
- Multiple can be active simultaneously
- Keyboard: Arrow keys navigate chips, Space/Enter toggles

**Tier 2 — Dropdown Filters:**
- Trigger button: `border border-[#D4CFE2] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390]` with chevron
- Dropdown: `bg-white rounded-xl shadow-lg border border-[#D4CFE2] py-1`
- Select items: `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]`
- Multi-select variant: checkbox `w-4 h-4 rounded border-[#C2BBD4] text-[#403770]` + label
- Clear: `text-xs text-[#403770] hover:bg-[#EFEDF5]`

**Tier 3 — Advanced Filter Builder (ExploreFilters pattern):**
- 3-step picker: Column > Operator > Value
- Picker popover: `w-56 bg-white rounded-lg border border-[#D4CFE2] shadow-lg`
- Step groups: `text-[10px] font-semibold uppercase tracking-wider text-[#A69DC0]`
- Step items: `px-3 py-1.5 text-[13px] text-[#6E6390] hover:bg-[#C4E7E6]/15 hover:text-[#403770]`
- Back button: chevron left `w-3.5 h-3.5 text-[#A69DC0] hover:text-[#403770]`
- Apply button: `bg-[#403770] text-white rounded-lg text-xs font-medium`

**Active filter display:**
- Pills: `px-2.5 py-1 text-xs font-medium bg-[#C4E7E6]/30 text-[#403770] rounded-full border border-[#C4E7E6]/50`
- Remove button: `text-[#403770]/40 hover:text-[#403770]` X icon
- Clear all: `text-xs font-medium text-[#A69DC0] hover:text-[#F37167]`

**Saved views:** Save/load/delete filter+sort+group configurations. Stored in localStorage.

### Links (`links.md`)

3 types.

**Inline link:**
- `text-[#6EA3BE] hover:underline`
- Use: Within body text — email addresses, phone numbers, URLs
- Inherits surrounding font size

**Nav link:**
- `text-[#403770] hover:text-[#F37167] transition-colors`
- No underline
- Use: Action-oriented navigation — "Add Districts from Map", "View on Map"
- Often paired with icon (left): `flex items-center gap-2`

**External link:**
- Same as inline link + external-link icon `w-3 h-3` suffix
- Opens in new tab: `target="_blank" rel="noopener noreferrer"`

**All links:** Focus ring from foundations. `cursor-pointer`. Never use `text-decoration: none` on inline links — let underline appear on hover.

### Pagination (`pagination.md`)

Canonical source for pagination — referenced by table docs.

**Layout:** Flex row, `justify-between`, full width matching parent container. `mt-3` separation from content above.

**Left — Result summary:**
- `text-xs text-[#8A80A8]`
- Format: "Showing 1-25 of 142"
- Filtered: "Showing 1-25 of 42 (142 total)"

**Right — Page controls:**

| Element | Classes |
|---------|---------|
| Container | `flex items-center gap-1` |
| Prev/Next arrows | `w-8 h-8 rounded-lg` with chevron `w-4 h-4` |
| Page numbers | `w-8 h-8 rounded-lg text-sm font-medium` |
| Inactive page | `text-[#6E6390] hover:bg-[#EFEDF5]` |
| Active page | `bg-[#403770] text-white` |
| Disabled | `text-[#A69DC0] cursor-not-allowed opacity-50` |
| Ellipsis | `text-[#A69DC0]`, shown when page count > 7 |

**Items-per-page selector:**
- `border border-[#D4CFE2] rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E6390]`
- Options: 10, 25, 50, 100
- Position: right-aligned, before page buttons, `mr-4`

**Keyboard:** Arrow keys navigate page buttons. Enter selects. Tab moves between per-page selector and page controls.

### Side Navigation (`side-nav.md`)

2 patterns for different contexts.

**App Sidebar:**
- Container: `flex flex-col bg-white border-r border-[#D4CFE2]`
- Expanded width: `w-[140px]`, collapsed: `w-14`
- Transition: `transition-all duration-200 ease-in-out`
- Nav items use Large size tier from foundations
- Active state: coral accent system (left border + tint + coral text)
- Divider between main/bottom sections: `mx-3 border-t border-[#E2DEEC]`
- Collapse toggle: chevron button at bottom, `border-t border-[#E2DEEC]`
- Collapsed tooltips: `bg-[#403770] text-white text-sm rounded-lg shadow-lg px-2 py-1 z-50`

**Icon Bar (Panel strip):**
- Container: `flex flex-col items-center py-3 gap-1 w-[56px] border-r border-[#E2DEEC]`
- Items: `w-9 h-9 rounded-xl` using Medium icon size
- Active: `bg-[#fef1f0]` tint (coral system adapted for icon-only)
- Inactive hover: `hover:bg-[#EFEDF5]`
- Tooltips: same spec as sidebar collapsed tooltips
- Quick action button (bottom): `bg-[#403770] text-white rounded-xl hover:bg-[#322a5a] shadow-sm`

**Keyboard:** Arrow keys navigate between items. Tab enters/exits the nav group.

### Steps (`steps.md`)

New component — not yet in codebase.

**Horizontal stepper anatomy:** Numbered circles connected by horizontal lines, with labels below.

**Circle states:**

| State | Circle | Text | Icon |
|-------|--------|------|------|
| Completed | `w-8 h-8 rounded-full bg-[#403770] text-white` | `text-xs font-medium text-[#403770]` | Checkmark `w-4 h-4` |
| Active | `w-8 h-8 rounded-full border-2 border-[#F37167] text-[#F37167] bg-white` | `text-xs font-semibold text-[#F37167]` | Step number |
| Upcoming | `w-8 h-8 rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white` | `text-xs font-medium text-[#8A80A8]` | Step number |

**Connector lines:**
- Default: `h-0.5 bg-[#D4CFE2] flex-1`
- Completed segment: `h-0.5 bg-[#403770] flex-1`

**Labels:** `text-xs font-medium mt-2` below each circle, centered. Color matches circle state.

**Layout:** `flex items-center` for circle+line row. `gap-0` between circles and connectors (connectors fill space with `flex-1`).

**Compact variant:** No labels, just circles and lines. For tight spaces.

**Keyboard:** Arrow keys move between steps (when steps are clickable for non-linear wizards). Enter activates a step.

### Tabs (`tabs.md`)

2 orientations, shared active state system.

**Horizontal tabs:**
- Container: `flex items-center border-b border-[#E2DEEC]` with `nav` element, `aria-label="Tabs"`
- Tab button: `relative flex items-center gap-2 px-6 py-3` using Medium size tier
- Active: coral bottom indicator `absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]` + `text-[#F37167]`
- Inactive: `text-[#8A80A8]`, hover: `text-[#403770]`
- Icon (optional): `w-4 h-4`, active: `text-[#F37167]`, inactive: `text-[#A69DC0]` hover: `text-[#6EA3BE]`
- Count badge: active `bg-[#403770] text-white px-2 py-0.5 text-xs font-semibold rounded-full`, inactive `bg-[#EFEDF5] text-[#8A80A8]`
- `aria-current="page"` on active tab

**Vertical tabs:**
- Container: `flex flex-col gap-1`
- Active state: coral left border system from foundations
- Otherwise same styling as sidebar items (Large size tier)

**Keyboard:** Arrow keys navigate between tabs. Home/End jump to first/last. Tab key moves focus out of the tab group.

### Tree View (`tree-view.md`)

New component — not yet in codebase.

**Node anatomy:**
- `flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-[#6E6390]`
- Hover: `bg-[#EFEDF5]`
- Selected: coral accent system — `bg-[#fef1f0] text-[#F37167] border-l-3 border-[#F37167]`

**Expand/collapse:**
- Chevron: `w-3.5 h-3.5 text-[#8A80A8]` (right-pointing collapsed, down expanded)
- Rotation: `transition-transform duration-150`
- Leaf nodes: no chevron, indent aligns with parent's text (chevron width as spacer)

**Indentation:** `pl-6` per nesting level. Applied to node container.

**Connector lines (optional):**
- Vertical: `border-l border-[#E2DEEC]` running down from parent
- Horizontal: short `border-t border-[#E2DEEC]` stub connecting to node

**Node icon (optional):** `w-4 h-4` between chevron and label. Color inherits from text.

**Keyboard:**
- Arrow Up/Down: move between visible nodes
- Arrow Right: expand collapsed node, or move to first child
- Arrow Left: collapse expanded node, or move to parent
- Home/End: first/last visible node
- Enter: select/activate node

---

## Tables Restructure

Split existing `tables.md` (640 lines) into `Tables/` subfolder:

**`Tables/_foundations.md`** — extracted from "Shared Foundations" section:
- Wrapper pattern, cell text sizing (4-tier), cell padding, brand colors reference

**`Tables/data-table.md`** — the "Data Table" section:
- Header, rows, actions column, footer, checkbox selection, inline editing, empty state, confirmation modals, toolbar, sorting indicators, pagination (reference to `Navigation/pagination.md`), row actions + overflow, loading state, error state, truncation, expanding rows

**`Tables/detail-table.md`** — the "Detail Table" section:
- Two-column key-value layout, editable variant, read-only variant

**`Tables/compact-table.md`** — the "Compact/Inline Table" section:
- Embedded in card/panel, nested sub-table, keyboard

File Reference section goes in `_foundations.md`.

---

## New Skill: `add-component-guide`

A skill that enforces the subfolder + foundations + individual file methodology when adding new component documentation.

**Trigger:** When user asks to add a new component guide or documentation to the UI Framework.

**Behavior:**
1. Determine which component category the new component belongs to (existing subfolder or new one)
2. If new category: create subfolder with `_foundations.md`
3. If existing category: read `_foundations.md` to understand shared patterns
4. Generate component file following the established structure:
   - "Use when" section
   - Anatomy/variants
   - Styling specs with exact Tailwind classes and token hex values
   - States (default, hover, active, disabled, focus)
   - Keyboard interactions
   - Codebase file references
5. Cross-reference `tokens.md` and category `_foundations.md` — no values that aren't in those files
6. Validate: no Tailwind grays where plum tokens should be used

---

## Paper Artboard

Create a navigation components artboard in the Mapomatic components page in Paper. Showcases all 9 component types with their key states (default, hover, active, disabled) using the Fullmind token system. Organized as a reference sheet — not a full page design, but a component specimen page.

---

## Out of Scope

- Actual codebase migration (this spec drives future migration work)
- Component library / React abstractions (this is documentation, not code)
- Mobile-specific navigation patterns beyond what's noted (responsive behavior is documented per-component where relevant)
