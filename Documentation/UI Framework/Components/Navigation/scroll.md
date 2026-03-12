# Scroll

Scroll container rules, scrollbar styling, and scroll-based navigation patterns.

See `_foundations.md` for focus ring and transition timing. See `Layouts/_foundations.md` for full-height convention and `sidebar-and-panels.md` Pattern 7 for the three-zone scrollable container.

---

## Scrollbar Styling — Three Tiers

| Tier | Width | Thumb | Track | CSS class | Use case |
|------|-------|-------|-------|-----------|----------|
| **Page** | 8px | `var(--color-steel-blue)`, hover `var(--color-plum)` | `var(--color-robins-egg)` | Global default | Page shells, full views |
| **Panel** | 4px | `rgba(64,55,112,0.15)`, hover `0.3` | transparent | `.v2-scrollbar` | Side panels, flyouts, floating panels, modals |
| **Mini** | 2px | `rgba(64,55,112,0.12)`, hover `0.25` | transparent | `.v2-scrollbar-mini` | Dropdowns, popovers, checkbox lists, any `max-h-*` constrained area |

### Page (global default)

Already in `globals.css`. Applied automatically to all scroll containers.

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--color-robins-egg); border-radius: 4px; }
::-webkit-scrollbar-thumb { background: var(--color-steel-blue); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-plum); }
```

### Panel

Existing `.v2-scrollbar` class. Add to any panel or modal scroll container.

```css
.v2-scrollbar::-webkit-scrollbar { width: 4px; }
.v2-scrollbar::-webkit-scrollbar-track { background: transparent; }
.v2-scrollbar::-webkit-scrollbar-thumb { background: rgba(64, 55, 112, 0.15); border-radius: 2px; }
.v2-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(64, 55, 112, 0.3); }
```

### Mini

New `.v2-scrollbar-mini` class — add to `globals.css`.

```css
.v2-scrollbar-mini::-webkit-scrollbar { width: 2px; }
.v2-scrollbar-mini::-webkit-scrollbar-track { background: transparent; }
.v2-scrollbar-mini::-webkit-scrollbar-thumb { background: rgba(64, 55, 112, 0.12); border-radius: 1px; }
.v2-scrollbar-mini::-webkit-scrollbar-thumb:hover { background: rgba(64, 55, 112, 0.25); }
```

---

## Scroll Container Rules

### Canonical setup

```
overflow-y-auto min-h-0
```

Applied to the scrollable child inside a `flex flex-col` parent. The parent must have a constrained height (`h-full`, `max-h-*`, or be inside a flex layout).

### Max-height conventions

| Container type | Max height | Example |
|----------------|-----------|---------|
| Dropdown / popover | `max-h-48` (192px) | Filter dropdowns, select menus |
| Menu / list panel | `max-h-64` (256px) | Sort menus, column picker |
| Large popover | `max-h-[60vh]` | Layer bubble expanded content |

### Three-zone pattern

Fixed header + scrollable body + fixed footer. Reference: `sidebar-and-panels.md` Pattern 7.

```tsx
<div className="flex flex-col h-full">
  <div className="px-4 py-3 border-b border-[#E2DEEC]">
    {/* Fixed header */}
  </div>
  <div className="flex-1 overflow-y-auto v2-scrollbar">
    {/* Scrollable content */}
  </div>
  <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]">
    {/* Fixed footer (optional) */}
  </div>
</div>
```

### Anti-patterns

- **Nested scroll containers** — only one scrollable area per view. If a panel scrolls, its parent must not also scroll.
- **`overflow-scroll`** — always use `overflow-y-auto` (shows scrollbar only when content overflows).
- **Missing `min-h-0`** — flex children with `overflow-y-auto` must have `min-h-0` on the flex parent or content won't scroll.
- **`overflow-auto` without height constraint** — the container must have a bounded height for scrolling to engage.

---

## Back-to-Top Button

Appears after scrolling past 300px from top of the scroll container.

### Styling

```
w-9 h-9 rounded-full bg-[#403770] text-white shadow-lg
hover:bg-[#322a5a]
focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
transition-all duration-150
```

Icon: Lucide `ArrowUp`, `w-4 h-4`.

### Positioning

| Context | Position | Placement |
|---------|----------|-----------|
| Page shell | `fixed` | `bottom-6 right-6` |
| Panel / modal | `absolute` | `bottom-3 right-3` |

### Visibility

Fade in/out based on scroll position:

```tsx
<button
  className={`fixed bottom-6 right-6 w-9 h-9 rounded-full bg-[#403770] text-white shadow-lg
    hover:bg-[#322a5a] transition-all duration-150
    focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
    ${scrollY > 300 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
  onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
>
  <ArrowUp className="w-4 h-4" />
</button>
```

---

## Sticky Headers

Headers that pin to the top of their scroll container when scrolled past.

### Standard header

```
sticky top-0 z-10 bg-white/95 backdrop-blur-sm
```

Border appears on scroll — `border-b border-[#E2DEEC]` added via scroll listener or IntersectionObserver sentinel:

```tsx
{/* Sentinel at top of scrollable area */}
<div ref={sentinelRef} className="h-0" />

{/* Sticky header — border appears when sentinel leaves viewport */}
<div className={`sticky top-0 z-10 bg-white/95 backdrop-blur-sm transition-colors duration-100
  ${isScrolled ? "border-b border-[#E2DEEC]" : ""}`}>
  {/* Header content */}
</div>
```

### Table header

```
sticky top-0 z-10 bg-[#F7F5FA]/80 backdrop-blur-sm
```

Applied to `<th>` cells. Already in use in ExploreTable — codified here as the standard.

---

## Smooth Scroll-to-Section

An alternative to tab-swapping: clicking a sidebar item or trigger smooth-scrolls to a section within the same scroll container.

### Container setup

Add to the scroll container:

```css
scroll-behavior: smooth;
```

Or programmatic:

```ts
document.getElementById(sectionId)?.scrollIntoView({
  behavior: "smooth",
  block: "start",
});
```

### Target offset

Sections need `scroll-mt-*` to compensate for sticky headers:

| Sticky header height | Scroll margin |
|---------------------|---------------|
| Standard (48–56px) | `scroll-mt-16` |
| With toolbar (80–96px) | `scroll-mt-24` |

```tsx
<section id="districts" className="scroll-mt-16">
  <h2>Districts</h2>
  {/* Section content */}
</section>
```

### When to use scroll-to vs tab-swap

| Use scroll-to | Use tab-swap |
|---------------|-------------|
| Sections are related, user benefits from seeing them in sequence | Sections are independent, showing one hides others |
| Content is short enough that all sections fit in DOM | Content is heavy, only one section should render at a time |
| Navigation is supplementary (sidebar anchors) | Navigation is primary (top tab bar) |

### Deep-linking (optional)

Update the URL hash for shareable section links:

```ts
history.replaceState(null, "", `#${sectionId}`);
```

---

## Keyboard

- `Home` scrolls to top of container (when focus is inside scrollable area)
- `End` scrolls to bottom
- `Page Up` / `Page Down` scroll by viewport height
- Back-to-top button is focusable and activates with `Enter` / `Space`

## Migration Notes

| File | Current | Target |
|---|---|---|
| `FloatingPanel.tsx` | `v2-scrollbar` only on some containers | Apply `v2-scrollbar` to all panel scroll areas |
| Dropdown menus | No scrollbar class | Add `v2-scrollbar-mini` to `max-h-*` containers |
| `globals.css` | Missing mini tier | Add `.v2-scrollbar-mini` class |

## Codebase Examples

| Component | File | Pattern |
|-----------|------|---------|
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` | Panel scrollbar (`v2-scrollbar`) |
| ExploreTable | `src/features/map/components/explore/ExploreTable.tsx` | Sticky table headers |
| LayerBubble | `src/features/map/components/LayerBubble.tsx` | `scrollIntoView`, `max-h-[60vh]` |
| PanelContent | `src/features/map/components/PanelContent.tsx` | Panel scroll container |
| globals.css | `src/app/globals.css` | Both scrollbar styles |
