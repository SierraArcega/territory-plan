# Containers Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `Containers/` documentation folder with `_foundations.md` + 8 individual container type docs, following the same pattern as `Tables/` and `Navigation/`.

**Architecture:** Documentation-only deliverable — 9 new markdown files in `Documentation/UI Framework/Components/Containers/`, one file moved from `Navigation/`, and 4 cross-reference updates to existing docs. All styling values come from `tokens.md`. Each doc follows the per-file template defined in the spec.

**Tech Stack:** Markdown documentation, Tailwind CSS class strings, TSX code snippets

**Spec:** `docs/superpowers/specs/2026-03-11-containers-guide-design.md`

---

## File Structure

```
Documentation/UI Framework/Components/Containers/   ← NEW folder
├── _foundations.md          ← decision tree + 8 shared foundation concerns
├── card.md                  ← self-contained content units
├── modal.md                 ← focused overlay dialogs
├── panel.md                 ← persistent layout surfaces
├── popover.md               ← contextual floating content
├── accordion.md             ← moved from Navigation/collapsible-views.md
├── tabs.md                  ← tab container shell
├── bottom-bar.md            ← floating action bar
└── flyout.md                ← slide-in contextual panels
```

**Files modified:**
- `Documentation/UI Framework/Components/Navigation/_foundations.md` — add cross-ref to Containers/accordion.md
- `Documentation/UI Framework/tokens.md` — add Panel, Bottom Bar, Flyout to Standard Pairings table
- `Documentation/UI Framework/Components/forms.md` — add cross-ref to Containers/ for modal shell styling

**Files removed:**
- `Documentation/UI Framework/Components/Navigation/collapsible-views.md` — moved to `Containers/accordion.md`

---

## Chunk 1: Folder Setup + Foundations

### Task 1: Create the Containers folder and `_foundations.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/_foundations.md`

This is the most important file — it contains the decision tree and all 8 shared foundation concerns that every individual container doc references.

- [ ] **Step 1: Create the Containers directory**

```bash
mkdir -p "Documentation/UI Framework/Components/Containers"
```

- [ ] **Step 2: Write `_foundations.md`**

Create `Documentation/UI Framework/Components/Containers/_foundations.md` with the following content. This file mirrors the structure of `Tables/_foundations.md` and `Navigation/_foundations.md`.

```markdown
# Container Foundations

Shared patterns for all container components. Every container guide in this folder
references these foundations. If a pattern is defined here, the component guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in container components.

---

## Which Container?

Use this decision tree to pick the right container type:

1. **Does it need to block interaction with the rest of the page?**
   → Yes = [Modal](modal.md)

2. **Is it contextual to a specific trigger element?**
   → Small/single-purpose = [Popover](popover.md)
   → Large/multi-step = [Flyout](flyout.md)

3. **Does it persist as part of the page layout?**
   → Navigable, multi-section = [Panel](panel.md)
   → Static content block = [Card](card.md)

4. **Does it organize content into switchable views?**
   → [Tabs](tabs.md)

5. **Does it reveal/hide sections of content in place?**
   → [Accordion](accordion.md)

6. **Does it float at the viewport edge for bulk/persistent actions?**
   → [Bottom Bar](bottom-bar.md)

---

## Border Tiers

| Tier | Hex | Usage |
|------|-----|-------|
| Subtle | `#E2DEEC` | Inner dividers within containers, row separators, section borders |
| Default | `#D4CFE2` | Card edges, panel section dividers, outer container borders |
| Strong | `#C2BBD4` | Inputs inside containers, form field borders |
| Brand | `#403770` | Selected/active state borders |

---

## Radius Tiers

| Class | Pixel | Container types |
|-------|-------|-----------------|
| `rounded-lg` | 8px | Cards, panels, buttons, inputs |
| `rounded-xl` | 12px | Popovers, dropdowns |
| `rounded-2xl` | 16px | Modals, dialogs, floating panel shell |

Do not use `rounded-sm` or `rounded-md` in new code.

---

## Shadow Scale

| Class | Elevation | Container types |
|-------|-----------|-----------------|
| `shadow-sm` | Low | Cards, panels (inline) |
| `shadow-lg` | Medium | Popovers, flyouts, floating panels |
| `shadow-xl` | High | Modals, dialogs |

No `shadow-md` or `shadow-2xl` in new code.

---

## Close Button

Two sizes, one pattern:

| Size | Classes | Used by |
|------|---------|---------|
| Compact | `w-6 h-6 rounded-lg` | Popovers, right panels, flyouts |
| Standard | `w-8 h-8 rounded-lg` | Modals, dialogs |

Shared styling: `flex items-center justify-center hover:bg-[#EFEDF5] transition-colors`

Icon color: `text-[#A69DC0]` default, `hover:text-[#403770]`. SVG uses `stroke="currentColor"` to inherit. Always `rounded-lg` — never `rounded-full`.

```tsx
{/* Standard close button (modal/dialog) */}
<button
  onClick={onClose}
  aria-label="Close"
  className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>

{/* Compact close button (popover/panel/flyout) */}
<button
  onClick={onClose}
  aria-label="Close"
  className="flex items-center justify-center w-6 h-6 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

**Migration note:** `PlanFormModal` uses `rounded-full` close button, `RightPanel` uses `stroke="#9CA3AF"` (Tailwind gray). Both should migrate to this pattern.

---

## Backdrop

| Context | Classes |
|---------|---------|
| Modal | `fixed inset-0 z-40 bg-black/40` |
| Flyout (optional) | `fixed inset-0 z-40 bg-black/20` |
| Mobile drawer | `absolute inset-0 z-10 bg-black/20` |

All backdrops are click-to-dismiss.

---

## Dismiss Behavior

| Container | Escape | Click-outside | Close button |
|-----------|--------|---------------|--------------|
| Modal | Yes | Yes (backdrop) | Yes |
| Popover | Yes | Yes | No |
| Flyout | Yes | Yes | Yes |
| Panel | No | No | Yes |
| Bottom Bar | No | No | Yes (dismiss X) |

Canonical dismiss pattern:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  const handleClickOutside = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      onClose();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [onClose]);
```

---

## Padding Rhythm

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

---

## Header Pattern

Canonical layout for containers with headers:

```
flex items-center justify-between [padding] border-b border-[#E2DEEC]
```

- Title left: `text-lg font-semibold text-[#403770]` (modal) or `text-xs font-medium uppercase tracking-wider text-[#A69DC0]` (panel)
- Actions right: close button, optional secondary actions
- Border separator on modals and panels, not on cards (cards use padding instead)

```tsx
{/* Modal header */}
<div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
  <h2 className="text-lg font-semibold text-[#403770]">Modal Title</h2>
  {/* Close button — see Close Button section */}
</div>

{/* Panel header */}
<div className="flex items-center justify-between px-3 py-2 border-b border-[#E2DEEC]">
  <h3 className="text-xs font-medium uppercase tracking-wider text-[#A69DC0]">Section</h3>
  {/* Close button or actions */}
</div>
```
```

- [ ] **Step 3: Verify the file was created correctly**

```bash
ls -la "Documentation/UI Framework/Components/Containers/"
```

Expected: `_foundations.md` exists.

- [ ] **Step 4: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/_foundations.md"
git commit -m "docs: add container foundations with decision tree and shared patterns"
```

---

### Task 2: Write `card.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/card.md`

- [ ] **Step 1: Write `card.md`**

Follow the per-file template from the spec. Key source files for codebase examples:
- `src/features/map/components/panels/district/signals/SignalCard.tsx`
- `src/features/calendar/components/CalendarEventCard.tsx`
- `src/features/map/components/right-panels/DistrictCard.tsx`

Content to include:

```markdown
# Card

Self-contained content unit — an entity the user can view, click, or act on.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when displaying a discrete piece of content (a record, metric, event, or summary)
- Don't use when content needs to block the page (use [Modal](modal.md) instead)
- Don't use when content slides in from the edge (use [Flyout](flyout.md) instead)

## Canonical Styling

```
bg-white rounded-lg shadow-sm border border-[#D4CFE2]
```

## Anatomy

Cards have a single content zone with optional header and expandable footer:

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-4">
  {/* Card content */}
</div>
```

## Variants

### Standard

Full-size card with generous padding.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-4">
  <h3 className="text-sm font-medium text-[#403770]">Card Title</h3>
  <p className="text-sm text-[#6E6390] mt-1">Card content here.</p>
</div>
```

### Compact

Tighter padding for dense layouts and list items.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-3">
  {/* Compact card content */}
</div>
```

### Interactive

Adds hover effects for clickable cards.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2] p-4 hover:border-[#C4E7E6] hover:shadow-lg transition-all cursor-pointer">
  {/* Clickable card content */}
</div>
```

### With Expandable Footer

Border-t trigger for revealing additional details. See [Accordion](accordion.md) for the expand/collapse pattern.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2]">
  <div className="p-4">
    {/* Card content */}
  </div>
  <button
    onClick={toggleExpand}
    className="flex items-center gap-1.5 w-full px-3 py-2 border-t border-[#E2DEEC] text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100"
  >
    <svg
      className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
    {expanded ? 'Hide details' : 'View details'}
  </button>
  {expanded && (
    <div className="px-3 pb-3 border-t border-[#E2DEEC]">
      {/* Expanded content */}
    </div>
  )}
</div>
```

## States

| State | Visual |
|-------|--------|
| Default | Base styling as above |
| Hover (interactive) | `border-[#C4E7E6] shadow-lg` |
| Loading | Skeleton placeholder: `bg-[#E2DEEC]/60 animate-pulse rounded h-4` |
| Empty | Centered muted text: `text-sm text-[#A69DC0]` |

## Keyboard

- Interactive cards: `Enter` / `Space` activates (when rendered as `<button>` or with `role="button"`)
- Expandable footer: `Enter` / `Space` toggles detail expansion

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| SignalCard | `src/features/map/components/panels/district/signals/SignalCard.tsx` | Uses `border-gray-100` — should be `border-[#D4CFE2]` |
| CalendarEventCard | `src/features/calendar/components/CalendarEventCard.tsx` | Compact variant with left accent border |
| DistrictCard | `src/features/map/components/right-panels/DistrictCard.tsx` | Card with tabs pattern |
```

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/card.md"
git commit -m "docs: add card container component guide"
```

---

### Task 3: Write `modal.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/modal.md`

- [ ] **Step 1: Write `modal.md`**

Key source files for codebase examples:
- `src/features/plans/components/PlanFormModal.tsx`
- `src/features/tasks/components/TaskFormModal.tsx`
- `src/features/activities/components/ActivityFormModal.tsx`
- `src/features/goals/components/GoalFormModal.tsx`
- `src/features/activities/components/OutcomeModal.tsx`

Content to include:

```markdown
# Modal

Focused overlay for forms, confirmations, and detail views. Blocks page interaction.

See `_foundations.md` for shared styling foundations (backdrop, close button, dismiss behavior, header pattern).

---

## When to Use

- Use when the user needs to focus on a form or confirmation without distraction
- Use for create/edit workflows that need multiple fields
- Don't use when content can stay in context (use [Panel](panel.md) or [Flyout](flyout.md) instead)
- Don't use for small contextual info (use [Popover](popover.md) instead)

## Canonical Styling

Wrapper:
```
fixed inset-0 z-50 flex items-center justify-center
```

Content:
```
bg-white rounded-2xl shadow-xl w-full max-w-{size} mx-4 max-h-[85vh] flex flex-col
```

## Anatomy

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

{/* Modal wrapper */}
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
      <h2 className="text-lg font-semibold text-[#403770]">Modal Title</h2>
      {/* Standard close button — see _foundations.md */}
    </div>

    {/* Body (scrollable) */}
    <div className="p-6 overflow-y-auto">
      {/* Modal content */}
    </div>

    {/* Footer */}
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2DEEC]">
      <button className="px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors">
        Save
      </button>
    </div>
  </div>
</div>
```

## Variants

### Size Variants

| Size | Class | Use case |
|------|-------|----------|
| Small | `max-w-sm` | Confirmation dialogs |
| Medium | `max-w-md` | Standard forms |
| Large | `max-w-lg` | Complex forms with many fields |

### Confirmation Dialog

No header/footer split — single content area:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
  <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
    <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Item?</h3>
    <p className="text-sm text-[#6E6390] mb-6">
      Are you sure? This action cannot be undone.
    </p>
    <div className="flex justify-end gap-3">
      <button className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#F37167]/90 rounded-lg transition-colors">
        Delete
      </button>
    </div>
  </div>
</div>
```

## States

| State | Visual |
|-------|--------|
| Default | Centered overlay with backdrop |
| Loading (submit) | Submit button shows spinner, disabled — see `Navigation/buttons.md` loading state |

## Keyboard

- `Escape` closes the modal
- `Tab` cycles through focusable elements within the modal
- Click on backdrop closes the modal

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| PlanFormModal | `src/features/plans/components/PlanFormModal.tsx` | `rounded-xl shadow-2xl bg-black/50` — should be `rounded-2xl shadow-xl bg-black/40` |
| TaskFormModal | `src/features/tasks/components/TaskFormModal.tsx` | `rounded-xl` — should be `rounded-2xl` |
| ActivityFormModal | `src/features/activities/components/ActivityFormModal.tsx` | `rounded-xl` — should be `rounded-2xl` |
| GoalFormModal | `src/features/goals/components/GoalFormModal.tsx` | Audit needed |
| OutcomeModal | `src/features/activities/components/OutcomeModal.tsx` | `rounded-xl` — should be `rounded-2xl` |
```

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/modal.md"
git commit -m "docs: add modal container component guide"
```

---

### Task 4: Write `panel.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/panel.md`

- [ ] **Step 1: Write `panel.md`**

Key source files:
- `src/features/map/components/FloatingPanel.tsx`
- `src/features/map/components/RightPanel.tsx`
- `src/features/plans/components/PlanDistrictPanel.tsx`

Content to include:

```markdown
# Panel

Persistent navigation surface alongside main content. Part of the page layout — not an overlay.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when content needs to persist alongside the main view (navigation, detail views, entity lists)
- Don't use when content should block interaction (use [Modal](modal.md) instead)
- Don't use when content is temporary and contextual (use [Flyout](flyout.md) instead)

## Canonical Styling

Desktop (floating):
```
bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
```

Mobile (bottom drawer):
```
bg-white/95 backdrop-blur-sm rounded-t-2xl shadow-lg max-h-[70vh]
```

## Anatomy

```tsx
{/* Desktop floating panel */}
<div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
  {/* Header */}
  <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2DEEC]">
    <h3 className="text-xs font-medium uppercase tracking-wider text-[#A69DC0]">Panel Title</h3>
    {/* Compact close button — see _foundations.md */}
  </div>

  {/* Content */}
  <div className="p-3 overflow-y-auto">
    {/* Panel content */}
  </div>
</div>
```

## Key Rules

- No outer border on the floating panel shell — shadow + blur provide separation
- Embedded sub-panels (e.g., RightPanel) may use a directional border (`border-l border-[#E2DEEC]`) as a layout divider — this is a layout concern, not a container border
- Close button only — no auto-dismiss (Escape/click-outside)
- Auto-collapse on tablet via media query
- Widths are context-dependent

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Floating rounded panel with `rounded-2xl shadow-lg` |
| Tablet (`sm:` and below `xl:`) | Auto-collapses to hidden |
| Mobile (base) | Bottom drawer: `rounded-t-2xl shadow-lg max-h-[70vh]` |

Mobile drawer includes a backdrop: `absolute inset-0 z-10 bg-black/20`.

## Keyboard

- Close button: `Enter` / `Space` closes the panel
- `Tab` navigates through panel content

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` | Uses `border-gray-200/60`, `text-gray-400` — should use plum-derived tokens |
| RightPanel | `src/features/map/components/RightPanel.tsx` | Uses `stroke="#9CA3AF"` on close button — should be `#A69DC0` |
| PlanDistrictPanel | `src/features/plans/components/PlanDistrictPanel.tsx` | Review needed |
```

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/panel.md"
git commit -m "docs: add panel container component guide"
```

---

### Task 5: Write `popover.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/popover.md`

- [ ] **Step 1: Write `popover.md`**

Key source files:
- `src/features/goals/components/DonutMetricPopover.tsx`
- `src/features/map/components/explore/BulkActionBar.tsx` (inline popovers)

Content to include:

```markdown
# Popover

Contextual floating content anchored to a trigger — dropdowns, menus, metric details.

See `_foundations.md` for shared styling foundations (dismiss behavior).

---

## When to Use

- Use for small, contextual content anchored to a trigger element
- Use for dropdown menus, sort controls, metric details
- Don't use when content is large or multi-step (use [Flyout](flyout.md) instead)
- Don't use when content should block the page (use [Modal](modal.md) instead)

## Canonical Styling

```
bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60
```

## Anatomy

```tsx
<div className="absolute bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 py-1 z-30">
  {/* Popover content */}
</div>
```

## Variants

### Menu Popover

List of clickable items:

```tsx
<div className="absolute bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 py-1 z-30">
  <button className="w-full px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5] text-left transition-colors">
    Edit
  </button>
  <button className="w-full px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5] text-left transition-colors">
    Duplicate
  </button>
  <div className="border-t border-[#E2DEEC] my-1" />
  <button className="w-full px-3 py-2 text-sm text-[#F37167] hover:bg-[#fef1f0] text-left transition-colors">
    Delete
  </button>
</div>
```

### Metric Popover

Small data display anchored to a chart or metric element:

```tsx
<div className="absolute bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 p-3 z-30">
  <h4 className="text-xs font-medium text-[#8A80A8] mb-1">Metric Label</h4>
  <p className="text-sm font-semibold text-[#403770]">42%</p>
</div>
```

## Menu Item States

| State | Classes |
|-------|---------|
| Default | `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]` |
| Selected | `bg-[#EFEDF5] text-[#403770] font-medium` |
| Destructive | `text-[#F37167] hover:bg-[#fef1f0]` |

## Keyboard

- `Escape` closes the popover
- Click outside closes the popover
- Arrow keys navigate menu items
- `Enter` / `Space` selects an item

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| DonutMetricPopover | `src/features/goals/components/DonutMetricPopover.tsx` | `rounded-lg border-gray-100` — should be `rounded-xl border-[#D4CFE2]/60` |
| BulkActionBar popovers | `src/features/map/components/explore/BulkActionBar.tsx` | `rounded-lg border-gray-200` — should be `rounded-xl border-[#D4CFE2]/60` |
| Sort dropdown (tables) | Various table components | `rounded-xl border-gray-200` — correct radius, wrong border color |
```

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/popover.md"
git commit -m "docs: add popover container component guide"
```

---

## Chunk 2: Remaining Container Types + Cross-References

### Task 6: Move `collapsible-views.md` → `accordion.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/accordion.md` (based on `Navigation/collapsible-views.md`)
- Remove: `Documentation/UI Framework/Components/Navigation/collapsible-views.md`

- [ ] **Step 1: Write `accordion.md`**

Restructure the content from `Navigation/collapsible-views.md` to match the per-file template. Keep the sidebar collapse pattern as a cross-reference back to Navigation/ (that's a navigation pattern, not a container).

Source file: `Documentation/UI Framework/Components/Navigation/collapsible-views.md`

```markdown
# Accordion

Reveal/hide sections of content in place.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when sections of content can be shown/hidden to reduce visual noise
- Use for expandable card details, collapsible sections in panels
- Don't use for content that should always be visible (just lay it out)
- Don't use for switchable views where only one is active (use [Tabs](tabs.md) instead)

## Canonical Styling

Trigger:

```
flex items-center gap-1.5 [padding] text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100
```

Chevron: `w-3 h-3` pointing right (collapsed), rotated 90° (expanded) with `transition-transform duration-150`.

## Anatomy

```tsx
<button
  onClick={toggleSection}
  className="flex items-center gap-1.5 w-full px-4 py-3 text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
  Section Title
</button>

{expanded && (
  <div className="border-t border-[#E2DEEC]">
    {/* Section content, inherits parent padding */}
  </div>
)}
```

## Variants

### Section Header Expand

Heading is the trigger. Chevron sits left of heading text.

```tsx
<button
  onClick={toggleSection}
  className="flex items-center gap-1.5 w-full py-2 text-sm font-semibold text-[#403770] hover:text-[#322a5a] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
  Section Title
</button>
```

### Card Section Expand

Footer trigger below card content. See [Card](card.md) with expandable footer variant.

```tsx
<button
  onClick={toggleExpand}
  className="flex items-center gap-1.5 w-full px-3 py-2 border-t border-[#E2DEEC] text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
  {expanded ? 'Hide details' : 'View details'}
</button>
```

### Mutex Accordion

Only one section open at a time. Expanding a new section collapses the previous one. Manage with a single `openIndex` state.

## States

| State | Visual |
|-------|--------|
| Collapsed | Chevron points right, content hidden |
| Expanded | Chevron rotated 90°, content visible |
| Hover (trigger) | Label text shifts to `text-[#403770]` |
| Disabled | See `Navigation/_foundations.md` disabled state |

## Keyboard

- `Enter` / `Space` toggles expand/collapse
- `Tab` moves between collapsible triggers

## Related Patterns

- **Sidebar collapse** (icon-only mode): This is a navigation pattern — see `Navigation/side-nav.md`.

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| SignalCard expand | `src/features/map/components/panels/district/signals/SignalCard.tsx` | Card section expand pattern — uses `border-gray-100` dividers |
| FloatingPanel sections | `src/features/map/components/FloatingPanel.tsx` | Section header expand pattern |
```

- [ ] **Step 2: Remove the old `collapsible-views.md`**

```bash
rm "Documentation/UI Framework/Components/Navigation/collapsible-views.md"
```

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/accordion.md"
git commit -m "docs: move collapsible-views to Containers/accordion.md"
```

---

### Task 7: Write `tabs.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/tabs.md`

- [ ] **Step 1: Write `tabs.md`**

This file covers the **tab container shell** — the wrapping card/panel, padding, and content area switching. It cross-references `Navigation/tabs.md` for tab strip mechanics (active states, keyboard, indicator styling).

Key source files:
- `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx`
- `src/features/map/components/panels/PlanWorkspace.tsx`

Content to include:

```markdown
# Tabs

Organize content into switchable views within a single container.

See `_foundations.md` for shared styling foundations.

For tab strip navigation mechanics (active states, keyboard, indicator styling), see `Navigation/tabs.md`. This file covers the tab container shell.

---

## When to Use

- Use when content naturally groups into parallel views within one context
- Use when the user needs to switch between related data sets without leaving the page
- Don't use when content should be visible simultaneously (just lay it out)
- Don't use when sections can be expanded/collapsed independently (use [Accordion](accordion.md) instead)

## Tab Strip Styling

### Horizontal Text Tabs

Active: `text-[#F37167]` with `h-0.5 bg-[#F37167]` bottom indicator.
Inactive: `text-[#8A80A8]`.
Hover: `text-[#403770]`.

Strip border: `border-b border-[#E2DEEC]`

See `Navigation/tabs.md` for full tab strip anatomy and TSX snippets.

### Icon Tabs (Compact)

Active: `bg-[#403770]/10 text-[#403770]`
Inactive: `text-[#A69DC0] hover:text-[#6E6390] hover:bg-[#F7F5FA]`

```tsx
{/* Icon tab button */}
<button
  className={`p-2 rounded-lg transition-colors ${
    isActive
      ? 'bg-[#403770]/10 text-[#403770]'
      : 'text-[#A69DC0] hover:text-[#6E6390] hover:bg-[#F7F5FA]'
  }`}
  aria-label={label}
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {/* Icon path */}
  </svg>
</button>
```

## Tab Container Shell

The tab strip sits at the top of a container. Content area below switches based on active tab.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2]">
  {/* Tab strip */}
  <nav className="flex items-center border-b border-[#E2DEEC]" aria-label="Tabs">
    {/* Tab buttons — see Navigation/tabs.md */}
  </nav>

  {/* Active tab content */}
  <div className="p-4">
    {activeTab === 'overview' && <OverviewContent />}
    {activeTab === 'details' && <DetailsContent />}
  </div>
</div>
```

## Badge on Tab

Count badge sitting next to tab label:

```
bg-[#403770] text-white rounded-full px-2 py-0.5 text-xs font-semibold
```

## Keyboard

- Arrow keys navigate between tabs
- `Enter` / `Space` activates a tab
- `Home` / `End` jump to first/last tab
- `Tab` key moves focus out of the tab group

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| DistrictTabStrip | `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx` | Icon tab variant, uses `bg-[#403770]/10` — conformant |
| PlanWorkspace | `src/features/map/components/panels/PlanWorkspace.tsx` | Icon tabs for plan sections — conformant |
```

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/tabs.md"
git commit -m "docs: add tabs container component guide"
```

---

### Task 8: Write `bottom-bar.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/bottom-bar.md`

- [ ] **Step 1: Write `bottom-bar.md`**

Key source file: `src/features/map/components/explore/BulkActionBar.tsx`

Content to include:

```markdown
# Bottom Bar

Floating action bar at the viewport bottom for bulk operations on selected items.

See `_foundations.md` for shared styling foundations.

---

## When to Use

- Use when the user has selected one or more items and needs bulk action controls
- Use for persistent actions that should stay visible while scrolling
- Don't use for navigation (use a regular nav bar)
- Don't use when actions apply to a single item (use inline actions or a [Popover](popover.md))

## Canonical Styling

```
bg-[#403770] rounded-xl shadow-lg shadow-[#403770]/20
```

Positioning:

```
fixed bottom-4 left-1/2 -translate-x-1/2 z-30
```

## Anatomy

```tsx
<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[#403770] rounded-xl shadow-lg shadow-[#403770]/20 px-4 py-2.5 flex items-center gap-3 animate-slide-up">
  {/* Selection count */}
  <span className="text-sm font-medium text-white">
    {count} selected
  </span>

  {/* Divider */}
  <div className="w-px h-5 bg-white/20" />

  {/* Action buttons */}
  <button className="px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
    Assign
  </button>

  {/* Dismiss */}
  <button
    onClick={clearSelection}
    aria-label="Clear selection"
    className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/20 transition-colors"
  >
    <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```

## Action Button States

| State | Classes |
|-------|---------|
| Default | `bg-white/10 hover:bg-white/20 rounded-lg` |
| Active (has queued value) | `bg-white/20 ring-1 ring-inset ring-white/25` |

## Dividers

Vertical dividers between action groups:

```
w-px h-5 bg-white/20
```

## Animation

Slides up on first selection: `animate-slide-up` (defined in `globals.css`).

## Keyboard

- `Tab` navigates between action buttons
- `Enter` / `Space` activates an action
- Dismiss button clears selection and hides the bar

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| BulkActionBar | `src/features/map/components/explore/BulkActionBar.tsx` | Primary implementation — conformant styling |
```

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/bottom-bar.md"
git commit -m "docs: add bottom bar container component guide"
```

---

### Task 9: Write `flyout.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Containers/flyout.md`

- [ ] **Step 1: Write `flyout.md`**

Key source file: `src/features/map/components/RightPanel.tsx` (narrow mode)

Content to include:

```markdown
# Flyout

Slide-in panel from the edge for contextual detail. Larger than a popover, doesn't block like a modal.

See `_foundations.md` for shared styling foundations (backdrop, close button, dismiss behavior).

---

## When to Use

- Use for contextual detail views that are too large for a popover
- Use for forms or multi-step workflows that should stay in context
- Don't use when content should block the page (use [Modal](modal.md) instead)
- Don't use when content is a small menu or tooltip (use [Popover](popover.md) instead)
- Don't use when content is a persistent layout surface (use [Panel](panel.md) instead)

## Canonical Styling

Desktop (slides from right):

```
bg-white border-l border-[#E2DEEC]
```

With shadow: `box-shadow: -4px 0 15px rgba(0,0,0,0.08)`

Mobile (bottom drawer):

```
bg-white rounded-t-2xl shadow-lg max-h-[70vh]
```

## Anatomy

```tsx
{/* Optional backdrop */}
<div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

{/* Flyout panel */}
<div className="fixed top-0 right-0 bottom-0 z-50 w-[400px] bg-white border-l border-[#E2DEEC] shadow-[-4px_0_15px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out">
  {/* Header */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2DEEC]">
    <h3 className="text-sm font-semibold text-[#403770]">Flyout Title</h3>
    {/* Compact close button — see _foundations.md */}
  </div>

  {/* Content */}
  <div className="p-4 overflow-y-auto h-full">
    {/* Flyout content */}
  </div>
</div>
```

## Key Rules

- Optional backdrop: `bg-black/20` (lighter than modal)
- Dismiss: Escape + click-outside + close button
- Close button: compact (`w-6 h-6`)
- Transition: `transition-all duration-200 ease-out` (uses `panel-v2-enter` animation)

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Slides from right edge with left border + shadow |
| Mobile (base) | Bottom drawer: `rounded-t-2xl shadow-lg max-h-[70vh]` |

## Keyboard

- `Escape` closes the flyout
- Click outside closes the flyout
- `Tab` navigates through flyout content

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| RightPanel (narrow mode) | `src/features/map/components/RightPanel.tsx` | Task form, contact detail, activity form — uses `border-gray-200/60` instead of `border-[#E2DEEC]` |
```

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Containers/flyout.md"
git commit -m "docs: add flyout container component guide"
```

---

## Chunk 3: Cross-Reference Updates

### Task 10: Update Navigation `_foundations.md` cross-reference

**Files:**
- Modify: `Documentation/UI Framework/Components/Navigation/_foundations.md`

- [ ] **Step 1: Read the current file**

Read `Documentation/UI Framework/Components/Navigation/_foundations.md` to find the right place to add a cross-reference.

- [ ] **Step 2: Add cross-reference note**

At the top of the file, after the opening paragraph (after "No Tailwind grays (`gray-*`) in navigation components."), add:

```markdown

For expand/collapse container patterns (accordion, collapsible sections), see `Containers/accordion.md`. The sidebar collapse pattern remains documented here as a navigation concern.
```

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Navigation/_foundations.md"
git commit -m "docs: add cross-reference from Navigation to Containers/accordion"
```

---

### Task 11: Update `tokens.md` Standard Pairings table

**Files:**
- Modify: `Documentation/UI Framework/tokens.md:149-159`

- [ ] **Step 1: Read the Standard Pairings section**

Read `Documentation/UI Framework/tokens.md` around lines 149-159 to see the current table.

- [ ] **Step 2: Add Panel, Bottom Bar, and Flyout entries**

Add three new rows to the Standard Pairings table after the existing entries:

```markdown
| Panel (floating) | `rounded-2xl` | `shadow-lg` | none (blur provides separation) |
| Bottom Bar | `rounded-xl` | `shadow-lg` | none |
| Flyout | none (desktop) / `rounded-t-2xl` (mobile) | `shadow-lg` | `border-l border-[#E2DEEC]` (desktop) |
```

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/tokens.md"
git commit -m "docs: add Panel, Bottom Bar, Flyout to tokens standard pairings"
```

---

### Task 12: Update `forms.md` cross-reference

**Files:**
- Modify: `Documentation/UI Framework/Components/forms.md:1-15`

- [ ] **Step 1: Read the Modal Forms section**

Read the top of `Documentation/UI Framework/Components/forms.md`.

- [ ] **Step 2: Add cross-reference**

After the "Modal Forms" heading description, add:

```markdown
For modal shell styling (radius, shadow, backdrop, close button), see `Containers/modal.md`. This file covers form-specific patterns within modal containers.
```

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/forms.md"
git commit -m "docs: add cross-reference from forms to Containers/modal"
```

---

### Task 13: Update `data-table.md` confirmation dialog

**Files:**
- Modify: `Documentation/UI Framework/Components/Tables/data-table.md:210-229`

The confirmation dialog snippet in `data-table.md` uses `rounded-xl` and `bg-black/50`, which conflicts with the canonical modal styling defined in `Containers/modal.md`.

- [ ] **Step 1: Read the confirmation dialog section**

Read `Documentation/UI Framework/Components/Tables/data-table.md` lines 209-229.

- [ ] **Step 2: Update the confirmation dialog snippet**

Change line 213: `bg-black/50` → `bg-black/40`
Change line 214: `rounded-xl` → `rounded-2xl`

These align the existing table doc with the canonical modal/confirmation dialog styling.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Tables/data-table.md"
git commit -m "docs: align data-table confirmation dialog with container standards"
```

---

### Task 14: Final verification

- [ ] **Step 1: Verify all files exist**

```bash
ls -la "Documentation/UI Framework/Components/Containers/"
```

Expected output: 9 files — `_foundations.md`, `card.md`, `modal.md`, `panel.md`, `popover.md`, `accordion.md`, `tabs.md`, `bottom-bar.md`, `flyout.md`

- [ ] **Step 2: Verify `collapsible-views.md` was removed**

```bash
ls "Documentation/UI Framework/Components/Navigation/collapsible-views.md" 2>&1
```

Expected: "No such file or directory"

- [ ] **Step 3: Verify cross-references were added**

Check that `Navigation/_foundations.md` mentions `Containers/accordion.md`.
Check that `tokens.md` has Panel, Bottom Bar, Flyout rows.
Check that `forms.md` mentions `Containers/modal.md`.

- [ ] **Step 4: Review git log**

```bash
git log --oneline -15
```

Expected: New commits for the containers guide documentation.
