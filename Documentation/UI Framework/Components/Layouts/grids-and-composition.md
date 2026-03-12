# Grids and Composition

Five patterns for grid layouts and inline composition (Patterns 8–12, continuing from `sidebar-and-panels.md`). See `_foundations.md` for shared rules.

## Grid Layouts

### Pattern 8: Card Grid (Responsive)

Responsive grid that adapts from 1 to 3 columns.

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>
```

**Variants**

| Variant | Classes | Example |
|---------|---------|---------|
| 3-column | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` | `PlansView` |
| 2×3 compact | `grid-cols-2 md:grid-cols-3 gap-3` | `HomeView` plan cards |
| 4-column | `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6` | Goal donut charts |

---

### Pattern 9: Asymmetric Columns

Weighted column splits for primary + secondary content.

```tsx
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <div className="lg:col-span-3">{/* Primary */}</div>
  <div className="lg:col-span-2">{/* Secondary */}</div>
</div>
```

**Ratios**

| Ratio | Classes | Example |
|-------|---------|---------|
| 3/2 split | `lg:grid-cols-5` with `col-span-3` / `col-span-2` | `HomeView` plans + tasks |
| Equal split | `lg:grid-cols-2 gap-4` | Indicator panels |
| 7-column fixed | `grid grid-cols-7` | `CalendarView` day grid |

---

## Inline Composition

### Pattern 10: Toolbar / Action Bar

Horizontal flex row with title left, actions right.

```tsx
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-base font-semibold text-[#403770]">Section Title</h2>
    <p className="text-sm text-[#8A80A8]">Description</p>
  </div>
  <div className="flex items-center gap-2">
    <button>{/* Secondary action */}</button>
    <button>{/* Primary action */}</button>
  </div>
</div>
```

**Key classes:**
- `flex items-center justify-between` — space between left and right groups
- Action group: `flex items-center gap-2`
- Tighter controls: `gap-1.5`

---

### Pattern 11: Label + Value Pairs

Inline metadata with dot separators.

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-[#403770]">Sarah Johnson</span>
  <span className="text-[#A69DC0]">&middot;</span>
  <span className="text-xs text-[#8A80A8]">3 districts</span>
  <span className="text-[#A69DC0]">&middot;</span>
  <span className="text-xs text-[#8A80A8]">FY26</span>
</div>
```

**Key classes:**
- `flex items-center gap-2` for dot-separated metadata
- `flex items-center gap-1.5` for icon + text pairs
- `min-w-0` + `truncate` on flexible text elements
- `flex-shrink-0` on fixed-size elements (icons, badges)

---

### Pattern 12: Badge / Pill Rows

Inline or wrapping lists of tags and status indicators.

```tsx
{/* Inline (no wrap) */}
<div className="flex items-center gap-1.5 flex-shrink-0">
  <Badge />
  <Badge />
</div>

{/* Wrapping */}
<div className="flex flex-wrap gap-2">
  <Pill />
  <Pill />
  <Pill />
</div>
```

**Key classes:**
- Inline: `flex items-center gap-1.5 flex-shrink-0`
- Wrapping: `flex flex-wrap gap-2`
- Each badge/pill: `rounded-full` per elevation tokens

---

## File Reference

| Component | File |
|-----------|------|
| HomeView | `src/features/shared/components/views/HomeView.tsx` |
| PlansView | `src/features/shared/components/views/PlansView.tsx` |
| CalendarView | `src/features/activities/components/CalendarView.tsx` |
