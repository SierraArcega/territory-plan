# Navigation Foundations

Shared patterns for all navigation components. Every component guide in this folder
references these foundations. If a pattern is defined here, the component guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in navigation components.

For expand/collapse container patterns (accordion, collapsible sections), see `Containers/accordion.md`. The sidebar collapse pattern remains documented here as a navigation concern.

---

## Active State System — Coral Accent

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

---

## Focus Ring

Standard across all interactive nav elements:

```
focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
```

Applied to: buttons, tabs, links, tree nodes, sidebar items, pagination controls, filter controls.

---

## Size Scale

Three tiers. Every button, tab, and nav item uses one of these.

| Tier | Text | Padding | Icon | Use case |
|------|------|---------|------|----------|
| Small | `text-xs font-medium` | `px-3 py-1.5` | `w-3.5 h-3.5` | Row actions, inline controls, filter chips |
| Medium | `text-sm font-medium` | `px-4 py-2` | `w-4 h-4` | Standard buttons, tabs, toolbar controls |
| Large | `text-sm font-medium` | `px-5 py-2.5` | `w-5 h-5` | Page-level nav, sidebar items, hero CTAs |

---

## Icon Conventions

- Stroke-based only: `fill="none" stroke="currentColor"`
- Stroke width: `strokeWidth={2}`
- Line caps: `strokeLinecap="round" strokeLinejoin="round"`
- ViewBox: `viewBox="0 0 24 24"` (sized via Tailwind `w-` / `h-` classes)
- Color: inherits from parent via `currentColor`
- Gap from label text: `gap-2`

---

## Transition Timing

| Context | Classes |
|---------|---------|
| Color/background changes | `transition-colors duration-100` |
| Expand/collapse | `transition-all duration-150` |
| Panel slide | `transition-all duration-200` |
| Chevron rotation | `transition-transform duration-150` |
| Opacity reveal | `transition-opacity duration-150` |

---

## Disabled State

```
opacity-50 cursor-not-allowed pointer-events-none
```

No hover or focus effects. Applied identically across all components.

---

## Keyboard Conventions

| Key | Behavior |
|-----|----------|
| `Enter` / `Space` | Activates buttons, toggles, selects options |
| `Escape` | Closes menus/popovers/dropdowns, returns focus to trigger |
| Arrow keys | Navigates within a group (tabs, menu items, tree nodes) |
| `Tab` | Moves between distinct control groups |
| `Home` / `End` | Jumps to first/last item in a group (tabs, tree) |

---
