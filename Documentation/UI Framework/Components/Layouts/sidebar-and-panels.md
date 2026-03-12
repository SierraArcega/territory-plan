# Sidebar and Panels

Three patterns for sidebar layouts, collapsible panels, and scrollable containers. See `_foundations.md` for shared rules (spacing, responsive conventions, full-height patterns).

---

## Pattern 5: Sidebar + Content

Two-column layout with fixed-width sidebar and flexible main area.

```tsx
<div className="flex h-full">
  <div className="flex-1 flex flex-col min-w-0">
    {/* Main content */}
  </div>
  {panelOpen && (
    <div className="w-[280px] flex-shrink-0 border-l border-[#E2DEEC] bg-white flex flex-col">
      {/* Sidebar content */}
    </div>
  )}
</div>
```

**Key classes:**

- Container: `flex h-full`
- Main: `flex-1 flex flex-col min-w-0` — stretches, prevents text overflow
- Sidebar: `w-[280px] flex-shrink-0` — fixed width, never shrinks
- `border-l border-[#E2DEEC]` — visual separator

> **Migration:** Existing code uses `border-gray-200` for sidebar borders. New code should use `border-[#E2DEEC]` (Border Subtle).

**Rules:**

- `min-w-0` on main area is critical — without it, long content overflows
- Sidebar is conditionally rendered (not hidden with CSS)
- Sidebar always on the right side in current codebase

Examples: CalendarView, PlanDetailView right panel

---

## Pattern 6: Collapsible Side Panel (Push)

Content area adjusts margin when panel opens, with transition.

```tsx
<main className={`mx-auto px-6 py-4 transition-[margin] duration-300 ${
  panelOpen ? "mr-[420px]" : "max-w-7xl"
}`}>
  {/* Content pushes left when panel opens */}
</main>
{panelOpen && <PanelComponent />}
```

**Key classes:**

- `transition-[margin] duration-300` — smooth push animation
- `mr-[420px]` — makes room for the panel
- Panel is fixed-position on the right edge

> **Composite example — PlanDetailView:** This view combines Pattern 2 (Page Shell) with Pattern 6 (Push Panel) and a tab bar. When a district panel opens, the main content transitions its right margin while the panel slides in from the right. This is the most complex layout in the app.

Example: PlanDetailView district panel

---

## Pattern 7: Scrollable Container

Three-zone panel: fixed header, scrollable body, fixed footer.

```tsx
<div className="flex flex-col h-full">
  <div className="px-4 py-3 border-b border-[#E2DEEC]">
    {/* Fixed header */}
  </div>
  <div className="flex-1 overflow-y-auto">
    {/* Scrollable content */}
  </div>
  <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]">
    {/* Fixed footer (optional) */}
  </div>
</div>
```

**Key classes:**

- Container: `flex flex-col h-full`
- Header: `border-b border-[#E2DEEC]` — stays pinned
- Body: `flex-1 overflow-y-auto` — scrolls independently
- Footer: `border-t border-[#E2DEEC] bg-[#F7F5FA]` — stays pinned

**Rules:**

- Never nest scrollable containers inside each other
- Footer is optional — omit for panels without actions
- Header and footer use plum-derived borders (`#E2DEEC`), not `gray-200`

Examples: FloatingPanel, all panel content areas, unscheduled activities list

---

## File Reference

| Component | File |
|-----------|------|
| CalendarView | `src/features/activities/components/CalendarView.tsx` |
| PlansView (PlanDetailView) | `src/features/shared/components/views/PlansView.tsx` |
| FloatingPanel | `src/features/map/components/FloatingPanel.tsx` |
