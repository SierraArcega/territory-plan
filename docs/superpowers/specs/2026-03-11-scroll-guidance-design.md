# Scroll Guidance — Design Spec

**Date:** 2026-03-11
**Location:** `Documentation/UI Framework/Components/Navigation/scroll.md`
**Paper artboard:** "Scroll" on Components page of Mapomatic Design System

---

## Scope

Single file in `Navigation/` covering two domains:

1. **Scroll container rules** — scrollbar styling tiers, overflow setup, max-heights, avoiding scroll traps
2. **Scroll-based navigation** — back-to-top button, sticky headers on scroll, smooth-scroll-to-section

References `Layouts/_foundations.md` and `sidebar-and-panels.md` for structural context — does not duplicate them.

## What it won't cover

- Virtual/infinite scroll (data loading concern)
- Horizontal scroll (table-specific, stays in `Tables/_foundations.md`)

---

## Section 1: Scrollbar Styling — Three Tiers

| Tier | Width | Thumb | Track | Use case |
|------|-------|-------|-------|----------|
| **Page** | 8px | `var(--color-steel-blue)`, hover `var(--color-plum)` | `var(--color-robins-egg)` | Page shells (`overflow-auto` root containers) |
| **Panel** | 4px | `rgba(64,55,112,0.15)`, hover `0.3` | transparent | Side panels, flyouts, floating panels, modals |
| **Mini** | 2px | `rgba(64,55,112,0.12)`, hover `0.25` | transparent | Dropdowns, popovers, checkbox lists, any `max-h-*` constrained area |

CSS classes:
- Page: existing global default (`::-webkit-scrollbar` in `globals.css`)
- Panel: existing `.v2-scrollbar` class
- Mini: new `.v2-scrollbar-mini` class (to be added to `globals.css`)

## Section 2: Scroll Container Rules

### Canonical setup

```
overflow-y-auto min-h-0
```

Applied to the scrollable child inside a `flex flex-col` parent. Reference: `Layouts/_foundations.md` Full-Height Convention.

### Max-height conventions

| Container type | Max height | Example |
|----------------|-----------|---------|
| Dropdown/popover | `max-h-48` (192px) | Filter dropdowns, select menus |
| Menu/list panel | `max-h-64` (256px) | Sort menus, column picker |
| Large popover | `max-h-[60vh]` | Layer bubble expanded content |

### Anti-patterns

- **Nested scroll containers** — only one scrollable area per view (restated from Layout foundations as authoritative scroll reference)
- **`overflow-scroll`** — always use `overflow-y-auto` (shows scrollbar only when needed)
- **Missing `min-h-0`** — flex children with `overflow-y-auto` must have `min-h-0` or content won't scroll

### Three-zone pattern

Reference: `sidebar-and-panels.md` Pattern 7. Fixed header + scrollable body + fixed footer. Body uses `flex-1 overflow-y-auto`.

## Section 3: Back-to-Top Button

### Behavior

- Appears after user scrolls past 300px from top of scroll container
- Smooth-scrolls to top on click
- Fades in/out with `transition-opacity duration-150`

### Positioning

| Context | Position | Placement |
|---------|----------|-----------|
| Page shell | `fixed` | `bottom-6 right-6` |
| Panel/modal | `absolute` | `bottom-3 right-3` |

### Styling

```
bg-[#403770] text-white rounded-full shadow-lg w-9 h-9
hover:bg-[#322a5a]
focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
transition-all duration-150
```

Icon: Lucide `ArrowUp`, `w-4 h-4`.

### Container requirement

Scroll container needs `scroll-behavior: smooth` (CSS) or use `scrollTo({ top: 0, behavior: 'smooth' })` (JS).

## Section 4: Sticky Headers on Scroll

### Pattern

Headers that pin to the top of their scroll container when scrolled past.

```
sticky top-0 z-10 bg-white/95 backdrop-blur-sm
```

### Border on scroll

Optional bottom border that appears after scrolling begins:
- `border-b border-[#E2DEEC]` added via scroll listener or IntersectionObserver sentinel div
- Sentinel: a zero-height `div` placed at the top of scrollable content; when it leaves the viewport, the sticky header gains its border

### Table headers

Table `<thead>` cells use:
```
sticky top-0 z-10 bg-[#F7F5FA]/80 backdrop-blur-sm
```

Already in use in ExploreTable — codified here as the standard.

## Section 5: Smooth Scroll-to-Section

### Container setup

```css
scroll-behavior: smooth;
```

Or programmatic: `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`.

### Target offset

Sections targeted by scroll-to need `scroll-mt-*` to compensate for sticky headers:

| Sticky header height | Scroll margin |
|---------------------|---------------|
| Standard (48–56px) | `scroll-mt-16` |
| With toolbar (80–96px) | `scroll-mt-24` |

### Trigger pattern

Any external control (sidebar item, tab, button) can trigger scroll-to-section:
1. Target section has an `id` attribute on its heading or wrapper
2. Trigger calls `document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' })`
3. URL hash updates optionally for deep-linking: `history.replaceState(null, '', `#${id}`)`

### When to use scroll-to vs tab-swap

| Use scroll-to | Use tab-swap |
|---------------|-------------|
| Sections are related, user benefits from seeing them in sequence | Sections are independent, showing one hides others |
| Content is short enough that all sections fit in DOM | Content is heavy, only one section should render at a time |
| Navigation is supplementary (sidebar anchors) | Navigation is primary (top tab bar) |

---

## Paper Artboard

A "Scroll" artboard on the Components page showing:
- Scrollbar tier comparison (page / panel / mini side by side)
- Back-to-top button in both page and panel contexts
- Sticky header before/after scroll state
- Scroll-to-section trigger example

---

## Codebase References

| Component | File | Scroll pattern |
|-----------|------|----------------|
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` | Panel scrollbar (`v2-scrollbar`) |
| ExploreTable | `src/features/map/components/explore/ExploreTable.tsx` | Sticky table headers |
| LayerBubble | `src/features/map/components/LayerBubble.tsx` | `scrollIntoView`, `max-h-[60vh]` |
| PanelContent | `src/features/map/components/PanelContent.tsx` | Panel scroll container |
| globals.css | `src/app/globals.css` | Both scrollbar styles |
