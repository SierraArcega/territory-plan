# Pattern Foundations

Patterns are reusable solutions that combine multiple components to solve a specific UX problem. Component docs describe _what_ a piece is; pattern docs describe _how_ pieces compose together.

All values come from `tokens.md`. All containers follow `Containers/_foundations.md`.

---

## Which Pattern?

1. **User clicks something on the map and needs to see details?**
   -> [Map-to-Panel Interaction](map-to-panel-interaction.md)

2. **Building a detail view for a district, plan, or account?**
   -> [Detail Views](detail-views.md)

3. **Adding filtering, sorting, or faceted search to a view?**
   -> [Filter and Facets](filter-and-facets.md)

4. **Building a create/edit form that opens in a panel?**
   -> [Forms and Editing](forms-and-editing.md)

5. **Displaying KPIs, stats, metrics, or signal cards?**
   -> [Dashboard Metrics Layout](dashboard-metrics-layout.md)

---

## State Management

All panel state lives in `useMapV2Store` (zustand). Never introduce local `useState` for panel-level visibility or selection — read/write these store fields:

| Field | Type | Purpose |
|-------|------|---------|
| `panelState` | enum | Which panel is open (none, detail, form, etc.) |
| `selectedLeaid` | `string \| null` | Currently selected district LEAID |
| `rightPanelContent` | enum | What the right panel renders |
| `activePlanId` | `string \| null` | Currently active plan for detail/edit |
| `planSection` | enum | Sub-section within a plan view |

---

## Loading States

Skeleton pattern using `animate-pulse` fills.

| Element | Classes |
|---------|---------|
| Text line | `h-3 rounded bg-[#C4E7E6]/20 animate-pulse` |
| Heading line | `h-4 w-1/2 rounded bg-[#C4E7E6]/20 animate-pulse` |
| Card skeleton | `h-24 rounded-lg bg-[#C4E7E6]/20 animate-pulse` |
| Metric value | `h-6 w-16 rounded bg-[#C4E7E6]/20 animate-pulse` |

Always use `bg-[#C4E7E6]/20` (Robin's Egg at 20%) for skeleton fills — never Tailwind grays.

---

## Error States

Centered inline message. Minimal — no illustration, no retry button unless the pattern doc specifies one.

```tsx
<div className="flex items-center justify-center p-6">
  <p className="text-sm text-[#c25a52]">Failed to load data.</p>
</div>
```

**Migration note:** Existing code uses `text-red-400` for error text. Migrate to `text-[#c25a52]` per `Display/_foundations.md` semantic text colors.

---

## Text Styling

All text follows the `tokens.md` type scale — 5 tiers only:

| Context | Classes |
|---------|---------|
| Section label | `text-xs font-medium uppercase tracking-wider text-[#A69DC0]` |
| Body text | `text-sm font-normal text-[#6E6390]` |
| Heading | `text-lg font-semibold text-[#403770]` |
| Metric value | `text-xl font-bold text-[#403770]` |
| Compact label | `text-[10px] font-medium text-[#8A80A8]` |

Never introduce arbitrary sizes (`text-[13px]`, `text-base`). If a component needs a size not in this table, it doesn't belong.

---

## Responsive Behavior

Patterns use the same 3-tier breakpoint system from `tokens.md`:

| Breakpoint | Panel behavior |
|------------|---------------|
| Base (mobile) | Panels render as bottom drawer or full-screen sheet |
| `sm:` (640px+) | Right panel slides in, map stays visible |
| `xl:` (1280px+) | Full layout — side panels + map at comfortable widths |

---

## Cross-Pattern Conventions

| Convention | Rule |
|------------|------|
| Borders | Follow `Containers/_foundations.md` border tiers — `#E2DEEC` subtle, `#D4CFE2` default |
| Radius | `rounded-lg` for cards/inputs, `rounded-xl` for popovers, `rounded-2xl` for modals |
| Shadows | `shadow-sm` inline, `shadow-lg` floating, `shadow-xl` modal — no `shadow-md` |
| Dismiss | Panels use close button only; modals use Escape + backdrop + close button |
| Padding | `p-3` compact, `p-4` standard, `p-6` modal — follow `Containers/_foundations.md` |
| Colors | All hex values from `tokens.md` — no Tailwind grays (`gray-*`, `slate-*`, `zinc-*`) |

---

## Pattern Docs

| Pattern | File | Covers |
|---------|------|--------|
| Map-to-Panel Interaction | `map-to-panel-interaction.md` | Click/hover on map -> panel open, selection sync, panel transitions |
| Detail Views | `detail-views.md` | District, plan, account detail layouts, section navigation |
| Filter and Facets | `filter-and-facets.md` | Filter bars, faceted search, sort controls, active filter chips |
| Forms and Editing | `forms-and-editing.md` | Create/edit flows in panels, validation, save/cancel patterns |
| Dashboard Metrics Layout | `dashboard-metrics-layout.md` | KPI cards, stat grids, signal indicators, metric grouping |
