# Page Shells

Four page-level layout containers. Each view in the app uses one of these as its root structure. See `_foundations.md` for shared rules (spacing, responsive conventions, full-height patterns).

---

## Pattern 1: App Shell (Root Layout)

The outermost container. Every view renders inside this.

```tsx
<div className="fixed inset-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
  <FilterBar activeTab={activeTab} />
  <div className="flex-1 flex overflow-hidden min-h-0">
    <Sidebar />
    <main className="flex-1 relative overflow-hidden">
      {children}
    </main>
  </div>
</div>
```

**Key classes:**

- `fixed inset-0` — viewport-filling root
- `flex flex-col` — vertical stack (FilterBar on top, content below)
- `flex-1 flex overflow-hidden min-h-0` — sidebar + content row
- `<main>`: `flex-1 relative overflow-hidden` — content area fills remaining space

File: `src/features/shared/components/layout/AppShell.tsx`

---

## Pattern 2: Standard Page Shell

Use when you need a scrollable page with header + content. The most common layout.

```tsx
<div className="h-full overflow-auto bg-[#FFFCFA]">
  <header className="bg-white border-b border-[#E2DEEC] px-6 py-4">
    <div className="max-w-6xl mx-auto flex items-center justify-between">
      {/* Title + actions */}
    </div>
  </header>
  <main className="max-w-6xl mx-auto px-6 py-8">
    {/* Content sections */}
  </main>
</div>
```

**Key classes:**

- `h-full overflow-auto` — fills AppShell content area, scrolls vertically
- `bg-[#FFFCFA]` — Off-White page background
- `max-w-6xl mx-auto` — caps content width, centers on wide screens
- Header: `bg-white border-b border-[#E2DEEC]` with `px-6 py-4`
- Content: `px-6 py-8`

> **Migration:** Existing code uses `border-gray-200` in some page headers. New code should use `border-[#E2DEEC]` (Border Subtle).

Examples: `PlansView`, `TasksView`, `ActivitiesView`

---

## Pattern 3: Dashboard Shell

Use when you need a gradient banner with negative-margin content overlap.

```tsx
<div className="h-full overflow-auto bg-[#FFFCFA]">
  <div className="px-8 pt-8 pb-28"
       style={{ background: "linear-gradient(135deg, #403770 0%, #4e3d7a 40%, #5c4785 70%, #6b5a90 100%)" }}>
    <div className="max-w-6xl mx-auto">
      {/* Greeting, date, stats */}
    </div>
  </div>
  <div className="relative -mt-20 px-8 pb-8">
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Content sections overlap the banner */}
    </div>
  </div>
</div>
```

**Key classes:**

- Banner: `px-8 pt-8 pb-28` — extra bottom padding creates overlap zone
- Content: `relative -mt-20` — pulls content up into the banner
- Sections: `space-y-6` — consistent vertical rhythm between cards
- Section cards: `bg-white rounded-2xl shadow-sm border border-gray-100`

> **Dashboard variant:** Cards here use `rounded-2xl` (not `rounded-lg`) and `border-gray-100` (not the standard `border-[#D4CFE2]`) for a softer, more prominent feel. This is intentional for the dashboard context.

Examples: `HomeView`

---

## Pattern 4: Canvas Shell (Map)

Use when you need a full-bleed canvas with floating chrome overlays.

```tsx
<div className="relative w-full h-full overflow-hidden bg-[#F8F7F4]">
  <MapV2Container />          {/* absolute inset-0, behind everything */}
  <FloatingPanel />            {/* absolute top-10 left-12 z-20 */}
  <MultiSelectChip />          {/* absolute, z-10 */}
  <SelectModePill />           {/* absolute top-right, z-10 */}
  <MapSummaryBar />            {/* absolute bottom left/right, z-10 */}
  <LayerBubble />              {/* absolute bottom-right, z-20 */}
</div>
```

**Key classes:**

- `relative w-full h-full overflow-hidden` — fills parent, no scroll
- Canvas: renders at `absolute inset-0` behind all overlays
- All chrome: absolutely positioned at various z-indices
- Z-layers: `z-10` for map chrome, `z-20` for panels/controls (see `tokens.md` Z-Index Layers)

**Rules:**

- No scrolling — canvas handles pan/zoom internally
- All UI elements float above the canvas via absolute positioning
- Dynamic panel widths: `w-[33vw] min-w-[340px] max-w-[520px]`
- Auto-collapse floating panel at `max-width: 1023px`

File: `src/features/map/components/MapV2Shell.tsx`

---

## File Reference

| Component | File |
|-----------|------|
| AppShell | `src/features/shared/components/layout/AppShell.tsx` |
| HomeView | `src/features/shared/components/views/HomeView.tsx` |
| PlansView | `src/features/shared/components/views/PlansView.tsx` |
| MapV2Shell | `src/features/map/components/MapV2Shell.tsx` |
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` |
