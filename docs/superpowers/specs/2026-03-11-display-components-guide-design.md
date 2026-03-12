# Display Components Guide — Design Spec

## Purpose

Create a comprehensive display component guide for the Fullmind territory planning product, documenting the ideal-state design system for 8 display component categories. The guide prescribes plum-derived token usage throughout — the codebase will be migrated to match.

Several existing components use Tailwind grays (`gray-100`, `gray-400`, `gray-500`) and non-standard border radius (`rounded-xl` on cards). This guide establishes the correct patterns and flags deviations for migration.

## Decisions

1. **Ideal state, not current** — document target patterns using plum-derived tokens; flag codebase deviations for migration
2. **Full specs for all 8 categories** — badges, stats, progress, loading, tooltips, empty states, callouts, cards
3. **Subfolder structure** — `Display/` with `_foundations.md` + individual component files (mirrors Navigation/ and Tables/)
4. **Abstract pattern + concrete examples** — each guide defines the canonical pattern first, then maps to codebase implementations (same approach as `buttons.md`)
5. **Semantic color application** — foundations define how tokens.md semantic colors map to display-specific use cases (badge fills, progress bars, callout backgrounds, dot indicators)
6. **Standardized container** — all display cards use `bg-white rounded-lg border border-[#D4CFE2] shadow-sm` (corrects `border-gray-*` drift). `rounded-xl` is reserved for floating/popover containers per `tokens.md`
7. **Number formatting conventions** — standardized null/K/M formatting across stats and KPI displays
8. **Migration flags** — each component guide notes where existing code deviates from the prescribed pattern

## File Structure

```
Documentation/UI Framework/Components/
├── Display/
│   ├── _foundations.md
│   ├── badges.md
│   ├── stats.md
│   ├── progress.md
│   ├── loading.md
│   ├── tooltips.md
│   ├── empty-states.md
│   ├── callouts.md
│   └── cards.md
```

Paper artboard: "Display" in the Mapomatic > Components file.

---

## Display Foundations (`_foundations.md`)

### Semantic Color Application

Maps the semantic colors from `tokens.md` to display component use cases. Every display component that uses color for meaning (success, warning, error, info) references this table.

| Semantic | Badge fill | Badge text | Callout bg | Progress bar | Dot indicator |
|----------|-----------|------------|------------|-------------|---------------|
| Error | `bg-[#fef1f0]` | `text-[#c25a52]` | `bg-[#fef1f0]` | `bg-[#F37167]` | `bg-[#F37167]` |
| Warning | `bg-[#FFCF70]/20` | `text-[#997c43]` | `bg-[#fffaf1]` | `bg-[#D4A84B]` | `bg-[#FFCF70]` |
| Success | `bg-[#EDFFE3]` | `text-[#5f665b]` | `bg-[#F7FFF2]` | `bg-[#69B34A]` | `bg-[#8AA891]` |
| Info | `bg-[#6EA3BE]/15` | `text-[#4d7285]` | `bg-[#e8f1f5]` | `bg-[#6EA3BE]` | `bg-[#6EA3BE]` |

### Display Container

The standard card shell used across stats, metric cards, and callouts:

```
bg-white rounded-lg border border-[#D4CFE2] shadow-sm
```

This corrects drift in the codebase where some components use `rounded-xl`, `border-gray-100`, or `border-gray-200`.

### Status Dot

Reusable indicator dot pattern:

```
w-2 h-2 rounded-full flex-shrink-0
```

Color comes from the semantic table above or from plan/vendor accent colors.

### Number Formatting Conventions

Standardized across all stat and KPI displays:

| Input | Output | Currency |
|-------|--------|----------|
| `null` / `undefined` | `"—"` | `"—"` |
| 1,000,000+ | `"1.2M"` | `"$1.2M"` |
| 1,000+ | `"12K"` | `"$12K"` |
| Below 1,000 | `"1,234"` | `"$1,234"` |

Use `toLocaleString()` for comma separation. Strip trailing `.0` from M/K abbreviations.

### Transition Timing

| Context | Classes |
|---------|---------|
| Progress bar fill | `transition-all duration-500` |
| Tooltip enter | `tooltip-enter` (150ms, defined in globals.css) |
| Tooltip exit | `tooltip-exit` (80ms, defined in globals.css) |
| Skeleton pulse | `animate-pulse` |
| Color/state changes | `transition-colors duration-100` |
| Expand/collapse | `transition-all duration-150` |

### Disabled / Empty Pattern

When a display element has no data:

- **Stat value**: Show `"—"` in `text-[#A69DC0]`
- **Progress bar**: Show empty track only (`bg-[#EFEDF5]`)
- **Badge**: Don't render — hide the element entirely rather than showing an empty badge

---

## Badges (`badges.md`)

### Signal Badges

4 semantic levels driven by trend data. Used in SignalBadge and similar contexts.

**Base classes:** `inline-flex items-center font-medium rounded-full`

**Size variants:**

| Variant | Padding | Text |
|---------|---------|------|
| Compact | `px-1.5 py-0.5 text-[10px]` | For inline/table use |
| Normal | `px-2 py-0.5 text-xs` | Default |

**Colors:**

| Level | Background | Text |
|-------|-----------|------|
| Growing | `bg-[#EDFFE3]` | `text-[#5f665b]` |
| Stable | `bg-[#6EA3BE]/15` | `text-[#4d7285]` |
| At Risk | `bg-[#FFCF70]/20` | `text-[#997c43]` |
| Declining | `bg-[#fef1f0]` | `text-[#c25a52]` |

### Status Badges

Application state indicators (plan status, record lifecycle).

**Base classes:** `inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full`

| Status | Background | Text |
|--------|-----------|------|
| Working / Active | `bg-[#8AA891]` | `text-white` |
| Planning / Draft | `bg-[#F7F5FA]` | `text-[#6E6390]` |
| Stale / Warning | `bg-[#FFCF70]/30` | `text-[#997c43]` |
| Archived / Disabled | `bg-[#C2BBD4]` | `text-white` |

**Migration note:** PlanCard currently uses `bg-gray-200 text-gray-700` for planning status — migrate to `bg-[#F7F5FA] text-[#6E6390]`.

### Count / Label Badges

Branded pill for identifiers and counts.

**Classes:** `inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-[#403770] text-white`

Use for: FY labels, entity counts, category identifiers.

### Recency Badges

Time-based status with dot indicator.

**Base classes:** `inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full`

| Recency | Dot color | Text color | Background |
|---------|-----------|------------|------------|
| Active (≤7d) | `#8AA891` | `#8AA891` | `#F7FFF2` |
| Slowing (≤21d) | `#D4A84B` | `#997c43` | `#fffaf1` |
| Stale (>21d) | `#F37167` | `#c25a52` | `#fef1f0` |
| No activity | `#A69DC0` | `#A69DC0` | `#F7F5FA` |

All recency colors derive from the semantic palette in foundations. Active uses Success, Slowing uses Warning, Stale uses Error.

**Migration note:** Recency badge in PlanCard uses inline styles with non-token colors (`#D97706`, `#FEF3C7`, `#EFF5F0`) — migrate to the plum-derived values above.

### Codebase Examples

| Badge | Type | File |
|-------|------|------|
| Signal level indicator | Signal | `src/features/map/components/panels/district/signals/SignalBadge.tsx` |
| Plan status badge | Status | `src/features/plans/components/PlanCard.tsx` |
| FY year badge | Count/Label | `src/features/plans/components/PlanCard.tsx` |
| Plan recency badge | Recency | `src/features/plans/components/PlanCard.tsx` |
| Calendar sync indicator | Status | `src/features/calendar/components/CalendarSyncBadge.tsx` |

---

## Stats / KPI Cards (`stats.md`)

### KPI Card Grid

Grid of metric cards with left accent bar. Used for entity-level summary views.

**Grid layout:** `grid gap-4` with responsive column count based on card count.

| Card count | Grid classes |
|------------|-------------|
| 1–4 or 7+ | `grid-cols-4` |
| 5 | `grid-cols-5` |
| 6 | `grid-cols-6` |

**Individual card:**

```
bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden
```

**Left accent bar:** `absolute left-0 top-0 bottom-0 w-[3px]` with entity-specific color.

**Typography:**
- Label: `text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider`
- Value: `text-xl font-bold text-[#403770]`
- Subtitle: `text-[11px] text-[#A69DC0]`

**Accent color palette:**

| Entity | Color |
|--------|-------|
| Primary / Districts | `#403770` |
| Activities | `#6EA3BE` |
| Revenue / Goals | `#FFCF70` |
| Contacts / Plans | `#8AA891` |
| Tasks | `#F37167` |

**Migration note:** ExploreKPICards uses `border-gray-200` — migrate to `border-[#D4CFE2]`.

### Stat with Trend Indicator

Inline stat with directional arrow and percentage change.

**Trend badge classes:** `inline-flex items-center gap-0.5 text-[11px] font-medium`

| Direction | Arrow color | Text color |
|-----------|-------------|------------|
| Up (positive) | `#8AA891` | `#8AA891` |
| Down (negative) | `#F37167` | `#F37167` |
| Flat | — | `#A69DC0` |

### Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Explore KPI grid | KPI Card Grid | `src/features/map/components/explore/ExploreKPICards.tsx` |
| Activity category stats | Stat Group | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Trend badge | Stat + Trend | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Academic metrics | Stat Display | `src/features/districts/components/AcademicMetrics.tsx` |
| Finance data | Stat Display | `src/features/districts/components/FinanceData.tsx` |

---

## Progress Bars (`progress.md`)

### Standard Progress Bar

Simple fill bar for coverage, engagement, and plan metrics.

**Track:** `h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden`

**Fill:** `h-full rounded-full transition-all duration-500` with width set as percentage.

**Default fill color:** `bg-[#403770]` (plum)

### Goal Progress Bar

Thicker bar with semantic color coding based on completion percentage.

**Track:** `h-2 bg-[#EFEDF5] rounded-full overflow-hidden`

**Fill colors by threshold:**

| Percentage | Fill color | Status label | Status color |
|------------|-----------|-------------|-------------|
| 100%+ | `bg-[#69B34A]` | "Goal achieved!" | `text-[#69B34A]` |
| 75–99% | `bg-[#6EA3BE]` | "On track" | `text-[#6EA3BE]` |
| 50–74% | `bg-[#D4A84B]` | "Needs attention" | `text-[#D4A84B]` |
| <50% | `bg-[#F37167]` | "Behind target" | `text-[#F37167]` |

**Status indicator:** `flex items-center gap-1.5 text-xs` with matching dot and label.

### Label Row

Progress bars include a label row above:

```
flex items-center justify-between
```

- Left: `text-xs text-[#8A80A8] font-medium` (metric name)
- Right: `text-xs font-medium` with color matching fill

### Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Plan coverage bar | Standard | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Engagement progress | Standard | `src/features/plans/components/PlanCard.tsx` |
| Goal progress | Goal | `src/features/goals/components/GoalProgress.tsx` |
| Progress card | Goal | `src/features/goals/components/ProgressCard.tsx` |

---

## Loading / Skeletons (`loading.md`)

### Skeleton Cards

Placeholder cards shown while data loads. Mirror the layout of the component they replace.

**Skeleton bar classes:** `bg-[#EFEDF5] rounded animate-pulse`

**Standard sizes for skeleton bars:**

| Simulates | Height | Width |
|-----------|--------|-------|
| Label text | `h-2.5` | `50-60%` |
| Value / heading | `h-5` | `30-40%` |
| Subtitle / secondary | `h-2` | `65-80%` |

**Card shell:** Same as display container (`bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4`) with `gap-2.5` between bars.

**Grid:** Match the loaded component's grid (e.g., 3 skeleton cards for a 3-card KPI row).

### Inline Spinner

For button loading states and inline refresh indicators.

**Classes:** `w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin`

Uses `border-current` to inherit parent text color.

**Migration note:** LeadingIndicatorsPanel and ExploreKPICards skeleton patterns should use `bg-[#EFEDF5]` instead of Tailwind grays.

### Codebase Examples

| Component | Type | File |
|-----------|------|------|
| KPI skeleton grid | Skeleton Cards | `src/features/map/components/explore/ExploreKPICards.tsx` |
| Activity panel skeleton | Skeleton Cards | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Button spinner | Inline Spinner | (shared pattern, see `Navigation/buttons.md`) |

---

## Tooltips (`tooltips.md`)

### Map Tooltip (Rich)

Context-aware tooltip for map entity hover. Shows entity name, metadata, and category indicator.

**Container:**

```
absolute pointer-events-none z-20
bg-white/95 backdrop-blur-sm rounded-xl shadow-lg
px-3 py-2 max-w-[220px]
```

Uses `z-20` (Panels tier) per `tokens.md` z-index layers. `rounded-xl` is intentional — tooltips are floating elements, which use `rounded-xl` per `tokens.md`.

**Migration note:** MapV2Tooltip currently uses `z-[15]` — migrate to `z-20`.

**Positioning:** Offset from cursor: `left: x + 12; top: y - 8; transform: translateY(-100%)`

**Typography:**
- Entity name: `text-sm font-medium text-[#403770]`
- Metadata: `text-xs text-[#8A80A8]`
- Category label: `text-xs text-[#6E6390]`

**Divider:** `border-t border-[#E2DEEC]`

**Category indicator:** Status dot (`w-2 h-2 rounded-full`) + label, color from vendor/category palette.

**Animation:** `tooltip-enter` / `tooltip-exit` classes defined in `globals.css`.

### Simple Tooltip (Dark)

For icon-only buttons and abbreviated labels.

**Container:**

```
bg-[#403770] rounded-lg px-3 py-1.5
```

**Text:** `text-xs font-medium text-white`

**Positioning:** Centered below trigger element.

### Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Map district hover | Rich | `src/features/map/components/MapV2Tooltip.tsx` |
| Icon button title | Simple | (native `title` attribute, see `Navigation/buttons.md`) |

---

## Empty States (`empty-states.md`)

### Full-Page Empty State

Centered prompt when a primary view has no data. Includes icon, heading, description, and CTA button.

**Container:** `flex flex-col items-center justify-center gap-3 py-10`

**Icon:** `w-10 h-10` stroke icon in `text-[#C2BBD4]`, `strokeWidth={1.5}`

**Heading:** `text-sm font-semibold text-[#6E6390]`

**Description:** `text-xs text-[#A69DC0] text-center max-w-[280px]`

**CTA:** Primary button (see `Navigation/buttons.md`) — typically "Create Your First [Entity]"

### Card Inline Empty State

For metric cards and panels when specific data is unavailable.

**Text:** `text-lg text-[#A69DC0]` centered in the card's content area.

Examples: "No finance data", "No ratio data", "No activities yet"

No CTA — the user can't fix missing data from this context.

### Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Plans empty state | Full-Page | `src/features/shared/components/views/PlansView.tsx` |
| Finance card empty | Card Inline | `src/features/map/components/panels/district/FinanceCard.tsx` |
| Staffing card empty | Card Inline | `src/features/map/components/panels/district/StaffingCard.tsx` |
| Tasks empty state | Full-Page | `src/features/tasks/components/TaskList.tsx` |
| Contacts empty state | Full-Page | `src/features/map/components/panels/district/ContactsTab.tsx` |

---

## Callouts / Banners (`callouts.md`)

### Promotional Banner

Full-width gradient banner for onboarding prompts and feature highlights.

**Container:**

```
flex items-center gap-4 px-5 py-4 rounded-xl overflow-hidden
background: linear-gradient(135deg, #403770 0%, #5c4785 70%, #6b5a90 100%)
```

Uses `rounded-xl` — promotional banners are large card containers per `tokens.md`.

**Icon container:** `w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0`

**Title:** `text-sm font-semibold text-white`

**Description:** `text-xs text-white/60`

**CTA button:** `px-4 py-2 text-sm font-medium text-[#403770] bg-white rounded-lg hover:bg-white/90 transition-colors`

**Dismiss button:** `absolute top-3 right-3 text-white/50 hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none`

### Accessibility

Interactive display elements (expandable card triggers, callout dismiss buttons) use the standard focus ring from `Navigation/_foundations.md`. Tooltips should use `role="tooltip"` with `aria-describedby` on the trigger element. Callouts with semantic meaning should use `role="alert"` for error/warning or `role="status"` for info/success.

### Semantic Callout

Inline alert for contextual messages. Uses semantic color system from foundations.

**Container:** `flex items-start gap-3 px-4 py-3.5 rounded-lg border`

**Icon:** `w-[18px] h-[18px] flex-shrink-0 mt-0.5` with semantic strong color as stroke.

| Semantic | Background | Border | Icon/Title color |
|----------|-----------|--------|-----------------|
| Info | `bg-[#e8f1f5]` | `border-[#8bb5cb]` | `text-[#4d7285]` |
| Warning | `bg-[#fffaf1]` | `border-[#ffd98d]` | `text-[#997c43]` |
| Error | `bg-[#fef1f0]` | `border-[#f58d85]` | `text-[#c25a52]` |
| Success | `bg-[#F7FFF2]` | `border-[#8AC670]` | `text-[#5f665b]` |

**Title:** `text-[13px] font-semibold` with semantic title color.

**Description:** `text-xs text-[#6E6390]`

### Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Calendar connect banner | Promotional | `src/features/calendar/components/CalendarConnectBanner.tsx` |
| Plan performance alerts | Semantic | `src/features/map/components/panels/PlanPerfSection.tsx` |

---

## Cards (`cards.md`)

This guide covers **card content patterns** — how to lay out metrics, badges, metadata, and detail rows inside cards. For the card shell itself (container, radius, shadow, padding variants), see `Containers/card.md` (canonical source for card containers).

### Card Shell (Base)

For quick reference, the standard card container from `Containers/card.md`:

```
bg-white rounded-lg border border-[#D4CFE2] shadow-sm overflow-hidden
```

Standard cards use `rounded-lg`. Larger floating card containers (e.g., popover-like cards) may use `rounded-xl` per `tokens.md`.

### Metric Card

Displays a single key metric with optional badge and expandable detail.

**Header:** `flex items-center justify-between px-4 py-3 border-b border-[#E2DEEC]`
- Title: `text-sm font-semibold text-[#403770]`
- Badge: Signal or status badge (see `badges.md`)

**Body:** `px-4 py-3`
- Value: `text-2xl font-bold text-[#403770]`
- Context: `text-xs text-[#8A80A8]`

### Content Card

Rich card with multiple badges, metadata, and embedded progress.

**Body:** `px-4 py-3`
- Badge row: `flex items-center gap-2`
- Title: `text-sm font-semibold text-[#403770]`
- Metadata: `text-xs text-[#8A80A8]`

**Embedded progress:** Same as standard progress bar pattern (see `progress.md`), rendered in a `px-4 pb-3` footer section.

### Expandable Card

Card with collapsible detail section.

**Expand trigger:** `w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#A69DC0] hover:text-[#403770] border-t border-[#E2DEEC] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none`

**Chevron:** `w-3 h-3 transition-transform duration-150` — rotates 90° when expanded.

**Detail section:** `px-4 pb-3 border-t border-[#E2DEEC]`

**Detail rows (key-value):**

```
flex justify-between text-sm
```

- Label: `text-[#6E6390]`
- Value: `font-medium text-[#403770]`

### Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Plan card | Content | `src/features/plans/components/PlanCard.tsx` |
| Signal card | Expandable | `src/features/map/components/panels/district/signals/SignalCard.tsx` |
| Enrollment card | Metric | `src/features/map/components/panels/district/EnrollmentCard.tsx` |
| Finance card | Expandable | `src/features/map/components/panels/district/FinanceCard.tsx` |
| Staffing card | Metric | `src/features/map/components/panels/district/StaffingCard.tsx` |
| Task card | Content | `src/features/tasks/components/TaskCard.tsx` |
| Calendar event card | Content | `src/features/calendar/components/CalendarEventCard.tsx` |

---

## Migration Notes

Key codebase deviations to address during implementation:

| Issue | Where | Fix |
|-------|-------|-----|
| Tailwind grays instead of plum neutrals | ExploreKPICards, LeadingIndicatorsPanel, CalendarSyncBadge | Replace `gray-*` with plum-derived hex values |
| `rounded-xl` on cards | LeadingIndicatorsPanel, LaggingIndicatorsPanel, SignalCard | Change to `rounded-lg` |
| `border-gray-100/200` on cards | ExploreKPICards, SignalCard | Change to `border-[#D4CFE2]` |
| `bg-green-400`/`bg-red-400` for status dots | CalendarSyncBadge | Use semantic colors from foundations |
| Inline styles for recency badge colors | PlanCard | Convert to plum-derived Tailwind classes |
| Non-token recency colors (`#D97706`, `#FEF3C7`) | PlanCard | Use semantic Warning/Error palette from foundations |
| `bg-gray-200 text-gray-700` for planning status | PlanCard | Use `bg-[#F7F5FA] text-[#6E6390]` |
| `z-[15]` arbitrary z-index | MapV2Tooltip | Use `z-20` (Panels tier) |
