# Home Sidebar Collapse — Design Spec

**Date:** 2026-05-12
**Feature:** Collapsible ProfileSidebar on the Home tab
**Scope:** `src/features/home/components/ProfileSidebar.tsx` only

---

## Problem

The `ProfileSidebar` (289px fixed width) compresses the Feed/Activities/Plans content area on narrower viewports and smaller screens, making the right-hand panel crowded and harder to use.

## Solution

Add a collapse toggle to the `ProfileSidebar` that shrinks it to a 44px icon strip, giving the right panel the space it needs. The strip keeps the four quick-action buttons reachable without re-expanding.

---

## Behaviour

### Expanded state (default)

- Sidebar renders at its current 289px width with all existing content unchanged.
- A collapse chevron button (`‹`) sits at the top-right of the sidebar header area.
- Clicking it collapses the sidebar.

### Collapsed state (icon strip)

The sidebar narrows to 44px and shows:

1. **Avatar** at the top — click re-expands the sidebar.
2. **Thin horizontal divider.**
3. **Four quick-action icon buttons** (top to bottom): Create Plan, Log Activity, Create Task, Create Opp.
   - The `LeaderboardHomeWidget` and all other expanded-only content are unmounted in this state.
   - Each uses its existing Lucide icon (`Map`, `FileEdit`, `ListPlus`, `ExternalLink`).
   - Hovering shows a tooltip to the right of the icon (label text, same pattern as `IntegrationChip`).
   - Clicking fires the same modal as in the expanded state — the strip stays collapsed.
4. **Expand chevron** (`›`) below the icons — click re-expands the sidebar.

### Animation

CSS `transition-[width] duration-200 ease-in-out` on the `<aside>` element. Content inside fades or clips as the width changes — no layout jump.

---

## Persistence

- `localStorage` key: `home-sidebar-collapsed`
- Value: `"true"` or `"false"` (string).
- Read on mount to initialise `collapsed` state.
- Write on every toggle.
- Default when key is absent: expanded (`false`).

---

## Architecture

All changes are **contained within `ProfileSidebar.tsx`**. No changes needed to `HomeView`, the Zustand store, or any other file.

```
ProfileSidebar
  ├── collapsed: boolean  (useState, init from localStorage)
  ├── <aside>             (width transitions between w-[289px] and w-11)
  │   ├── [expanded]  full existing content + collapse chevron at top-right
  │   └── [collapsed] icon strip: avatar → divider → 4 action icons → expand chevron
  └── modals              (unchanged — PlanFormModal, ActivityFormModal, etc.)
```

### State

```ts
const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("home-sidebar-collapsed") === "true";
});

const toggle = () => {
  setCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem("home-sidebar-collapsed", String(next));
    return next;
  });
};
```

### Tooltip pattern

Reuse the same inline tooltip already used in `IntegrationChip`:

```tsx
<span className="absolute left-full ml-2 px-2 py-1 rounded-lg bg-plum text-[10px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none">
  {label}
</span>
```

### `<aside>` width

```tsx
<aside
  className={`shrink-0 border-r border-[#E2DEEC] bg-white h-full transition-[width] duration-200 ease-in-out ${
    collapsed ? "w-11 overflow-hidden" : "w-[289px] overflow-y-auto"
  }`}
>
```

---

## Out of scope

- No Zustand store changes.
- No changes to the right-hand panel or `HomeView`.
- No changes to any other sidebar (app nav sidebar is a separate component).
- No auto-collapse on narrow viewports (that already exists at the app-shell level).
