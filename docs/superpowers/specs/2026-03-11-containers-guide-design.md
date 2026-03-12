# Containers Guide — Design Spec

## Goal

Create a `Containers/` folder under `Documentation/UI Framework/Components/` that standardizes all container patterns in the Fullmind territory planner. The guide follows the same `_foundations.md` + individual component docs pattern used by `Tables/` and `Navigation/`. A "which container?" decision tree in foundations helps developers pick the right type. All values use plum-derived tokens from `tokens.md` — no Tailwind grays.

## Context

The codebase has ~68 files using container patterns (modals, panels, cards, popovers, tabs, accordions, flyouts, bottom bars) with significant inconsistency:

- **Borders**: `border-gray-100`, `border-gray-200`, `border-gray-200/60` used instead of plum-derived `#D4CFE2`, `#E2DEEC`
- **Radius**: `rounded-xl`, `rounded-lg`, `rounded-2xl` applied inconsistently across container types
- **Shadows**: `shadow-2xl`, `shadow-lg`, `shadow-md` mixed where tokens define only 4 levels
- **Close buttons**: Every modal/panel/popover re-implements its own X button
- **Backdrops**: `bg-black/50` vs `bg-black/20` with no clear rule
- **Dismiss behavior**: Click-outside and Escape reimplemented per component
- **Padding**: Cards range from `p-3` to `px-6 py-4` with no system

## Deliverables

1. **`Containers/_foundations.md`** — decision tree + 8 shared foundation concerns
2. **8 container type docs** — one `.md` per type
3. **Move `Navigation/collapsible-views.md`** → `Containers/accordion.md` (with updates)
4. **Paper artboard** — "Containers" on the Components page (already created)

## File Structure

```
Documentation/UI Framework/Components/
├── Navigation/
│   ├── _foundations.md
│   ├── buttons.md
│   └── breadcrumbs.md          (collapsible-views.md moved out)
├── Tables/
│   ├── _foundations.md
│   ├── data-table.md
│   ├── detail-table.md
│   └── compact-table.md
├── Containers/                  ← NEW folder
│   ├── _foundations.md          ← decision tree + shared foundations
│   ├── card.md
│   ├── modal.md
│   ├── panel.md
│   ├── popover.md
│   ├── accordion.md            ← moved from Navigation/collapsible-views.md
│   ├── tabs.md
│   ├── bottom-bar.md
│   └── flyout.md
└── forms.md
```

## Foundations: `_foundations.md`

### Decision Tree

Top of file. A sequential flowchart that routes to the right container:

1. **Does it need to block interaction with the rest of the page?** → Yes = **Modal**
2. **Is it contextual to a specific trigger element?** → Yes = **Popover** (small) or **Flyout** (large/multi-step)
3. **Does it persist as part of the page layout?** → Yes = **Panel** (navigable, multi-section) or **Card** (static content block)
4. **Does it organize content into switchable views?** → **Tabs**
5. **Does it reveal/hide sections of content in place?** → **Accordion**
6. **Does it float at the viewport edge for bulk/persistent actions?** → **Bottom Bar**

### Shared Foundations (8 concerns)

#### 1. Border Tiers

| Tier | Hex | Usage |
|------|-----|-------|
| Subtle | `#E2DEEC` | Inner dividers within containers, row separators, section borders |
| Default | `#D4CFE2` | Card edges, panel section dividers, outer container borders |
| Strong | `#C2BBD4` | Inputs inside containers, form field borders |
| Brand | `#403770` | Selected/active state borders |

#### 2. Radius Tiers

| Class | Pixel | Container types |
|-------|-------|----------------|
| `rounded-lg` | 8px | Cards, panels, buttons, inputs |
| `rounded-xl` | 12px | Popovers, dropdowns |
| `rounded-2xl` | 16px | Modals, dialogs, floating panel shell |

#### 3. Shadow Scale

| Class | Elevation | Container types |
|-------|-----------|----------------|
| `shadow-sm` | Low | Cards, panels (inline) |
| `shadow-lg` | Medium | Popovers, flyouts, floating panels |
| `shadow-xl` | High | Modals, dialogs |

No `shadow-md` or `shadow-2xl` in new code.

#### 4. Close Button

Two sizes, one pattern:

| Size | Classes | Used by |
|------|---------|---------|
| Compact | `w-6 h-6 rounded-lg` | Popovers, right panels |
| Standard | `w-8 h-8 rounded-lg` | Modals, dialogs |

Shared styling: `flex items-center justify-center hover:bg-[#EFEDF5] transition-colors`

Icon: `stroke="#A69DC0"` default, `hover:stroke="#403770"`.

Code snippet provided in foundations.

#### 5. Backdrop

| Context | Classes |
|---------|---------|
| Modal | `fixed inset-0 z-40 bg-black/40` |
| Flyout (optional) | `fixed inset-0 z-40 bg-black/20` |
| Mobile drawer | `absolute inset-0 z-10 bg-black/20` |

All backdrops are click-to-dismiss.

#### 6. Dismiss Behavior

| Container | Escape | Click-outside | Close button |
|-----------|--------|---------------|--------------|
| Modal | Yes | Yes (backdrop) | Yes |
| Popover | Yes | Yes | No |
| Flyout | Yes | Yes | Yes |
| Panel | No | No | Yes |
| Bottom Bar | No | No | Yes (dismiss X) |

Canonical dismiss hook pattern provided (useEffect + mousedown + keydown).

#### 7. Padding Rhythm

| Container | Padding | Notes |
|-----------|---------|-------|
| Card (standard) | `p-4` | 16px all sides |
| Card (compact) | `p-3` | 12px all sides |
| Modal header/footer | `px-6 py-4` | Generous horizontal |
| Modal body | `p-6` | 24px content area |
| Popover | `px-3 py-2` | Tight contextual |
| Panel content | `p-3` (tight) or `p-4` (standard) | Context-dependent |
| Accordion trigger | `px-4 py-3` | Consistent with table cells |
| Accordion content | Inherits parent padding | No extra wrapper padding |

#### 8. Header Pattern

Canonical layout for containers with headers:

```
flex items-center justify-between [padding] border-b border-[#E2DEEC]
```

- Title left: `text-lg font-semibold text-[#403770]` (modal) or `text-xs font-medium uppercase tracking-wider text-[#A69DC0]` (panel)
- Actions right: close button, optional secondary actions
- Border separator on modals and panels, not on cards (cards use padding instead)

## Per-File Template

Each container `.md` follows this structure:

```markdown
# [Container Name]

[One-line description]

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when...
- Don't use when... (use [other container] instead)

## Canonical Styling

[Complete Tailwind class string]

## Anatomy

[Header/body/footer zones with code snippets]

## Variants

[Named variants with code snippets, if applicable]

## States

[Default, hover, loading, error, empty — as applicable]

## Keyboard

[Keyboard interactions specific to this container]

## Responsive Behavior

[Breakpoint-specific patterns, if applicable]

## Codebase Examples

| Component | File | Conformance |
[Existing components and whether they match the guide]
```

## Container Type Summaries

### 1. Card (`card.md`)

**Purpose:** Self-contained content unit — an entity the user can view, click, or act on.

**Canonical:** `bg-white rounded-lg shadow-sm border border-[#D4CFE2]`

**Variants:**
- Standard (p-4): SignalCard, dashboard metric cards
- Compact (p-3): CalendarEventCard, list items
- Interactive: adds `hover:border-[#C4E7E6] hover:shadow-lg transition-all cursor-pointer`
- With expandable footer: border-t trigger for details (SignalCard pattern)

**Key codebase examples:** SignalCard, CalendarEventCard, DistrictCard (right panel)

### 2. Modal (`modal.md`)

**Purpose:** Focused overlay — forms, confirmations, detail views. Blocks page interaction.

**Canonical wrapper:** `fixed inset-0 z-50 flex items-center justify-center`

**Content:** `bg-white rounded-2xl shadow-xl w-full max-w-{size} mx-4 max-h-[85vh] flex flex-col`

**Size variants:** `max-w-sm` (confirmation), `max-w-md` (standard form), `max-w-lg` (complex form)

**Sub-pattern — Confirmation Dialog:** No header/footer split; single `p-6` content area.

**Key codebase examples:** PlanFormModal, TaskFormModal, GoalFormModal, ActivityFormModal, OutcomeModal

### 3. Panel (`panel.md`)

**Purpose:** Persistent navigation surface alongside main content. Not an overlay — part of the layout.

**Desktop:** `bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg`

**Mobile (bottom drawer):** `bg-white/95 backdrop-blur-sm rounded-t-2xl shadow-lg max-h-[70vh]`

**Key rules:**
- No outer border — shadow + blur provide separation
- Close button only (no auto-dismiss)
- Auto-collapse on tablet via media query
- Widths are context-dependent

**Key codebase examples:** FloatingPanel, RightPanel, PlanDistrictPanel

### 4. Popover (`popover.md`)

**Purpose:** Contextual floating content anchored to a trigger — dropdowns, menus, metric details.

**Canonical:** `bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60`

**Variants:**
- Menu: list of clickable items with hover states
- Metric: small data display (DonutMetricPopover pattern)

**Key rules:**
- Positioned relative to trigger
- Menu items: `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]`
- Selected item: `bg-[#EFEDF5] text-[#403770] font-medium`
- Destructive: `text-[#F37167] hover:bg-[#fef1f0]`

**Key codebase examples:** DonutMetricPopover, BulkActionBar sort/tag/plan popovers

### 5. Accordion (`accordion.md`)

**Purpose:** Reveal/hide sections of content in place. Moved from `Navigation/collapsible-views.md`.

**Trigger anatomy:** Chevron (`w-3 h-3`) + label, `transition-transform duration-150` rotation.

**Variants:**
- Section header expand: heading is the trigger
- Card section expand: footer trigger below card content (SignalCard pattern)
- Mutex accordion: one section open at a time

**Key rules:**
- Chevron points right (collapsed), rotated 90° (expanded)
- Dividers: `border-[#E2DEEC]`
- Keyboard: Enter/Space toggles

**Key codebase examples:** SignalCard detail expand, sidebar collapse

### 6. Tabs (`tabs.md`)

**Purpose:** Organize content into switchable views within a single container.

**Horizontal variant (text tabs):**
- Active: `text-[#F37167]` + `h-0.5 bg-[#F37167]` bottom indicator
- Inactive: `text-[#8A80A8]`
- Hover: `text-[#403770]`

**Icon variant (compact):**
- Active: `bg-plum/10 text-plum`
- Inactive: `text-[#A69DC0] hover:text-[#6E6390] hover:bg-[#F7F5FA]`

**Key rules:**
- Badge on tab: `bg-plum text-white rounded-full` pill
- Keyboard: Arrow keys navigate tabs, Enter/Space activates
- Tab strip separated by `border-b border-[#E2DEEC]`

**Key codebase examples:** DistrictTabStrip, PlanWorkspace icon tabs

### 7. Bottom Bar (`bottom-bar.md`)

**Purpose:** Floating action bar at viewport bottom for bulk operations on selected items.

**Canonical:** `bg-[#403770] rounded-xl shadow-lg shadow-[#403770]/20`

**Key rules:**
- Fixed `bottom-4 left-1/2 -translate-x-1/2 z-30`
- Action buttons: `bg-white/10 hover:bg-white/20 rounded-lg`
- Active action (has queued value): `bg-white/20 ring-1 ring-inset ring-white/25`
- Dividers: `w-px h-5 bg-white/20`
- Animate in: `animate-slide-up` on first selection

**Key codebase examples:** BulkActionBar

### 8. Flyout (`flyout.md`)

**Purpose:** Slide-in panel from edge for contextual detail. Larger than a popover, doesn't block like a modal.

**Desktop:** Slides from right edge. `bg-white border-l border-[#E2DEEC]` with `box-shadow: -4px 0 15px rgba(0,0,0,0.08)`.

**Mobile:** Bottom drawer, same pattern as Panel mobile variant: `rounded-t-2xl shadow-lg max-h-[70vh]`.

**Key rules:**
- Optional backdrop: `bg-black/20`
- Dismiss: Escape + click-outside
- Close button: compact (w-6 h-6)
- Transition: `transition-all duration-200 ease-out` (panel-v2-enter animation)

**Key codebase examples:** RightPanel narrow mode (task form, contact detail, activity form)

## Migration: `collapsible-views.md` → `accordion.md`

- Move `Documentation/UI Framework/Components/Navigation/collapsible-views.md` to `Containers/accordion.md`
- Rename and restructure to match the per-file template
- Keep the sidebar collapse pattern as a cross-reference back to Navigation/ (that's a navigation pattern, not a container)
- Update any internal cross-references in `Navigation/_foundations.md`

## Paper Artboard

Already created during brainstorming: "Containers" artboard on the Components page of the Mapomatic Paper file (1440×4800px), showing:
- Decision tree flowchart
- Shared foundations reference table
- Visual examples for all 8 container types with token-correct annotations

## Prerequisites / Follow-Up

- **Update `tokens.md` Standard Pairings table** — add Panel, Bottom Bar, and Flyout entries
- **Update `tables.md`** — align any confirmation dialog snippets to `rounded-2xl`
- **Update `forms.md`** — reference containers guide as canonical source for modal shell styling

## Out of Scope

- Code migration (separate task per container type)
- Reusable React component extraction (documentation first, components later)
- Focus trapping and ARIA patterns (add incrementally per container doc)
- Resizable container (no codebase usage yet — add when built)
