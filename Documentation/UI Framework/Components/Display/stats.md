# Stats / KPI Cards

Grid-based metric displays for entity-level summary views, surfacing key numbers — counts, totals, and rates — at a glance across territories, activities, and goals.

See _foundations.md for number formatting conventions and display container.

---

## KPI Card Grid

A responsive grid of individual stat cards. Column count is determined by how many cards are present:

| Card count | Grid classes |
|------------|-------------|
| 1–4 or 7+ | `grid gap-4 grid-cols-4` |
| 5 | `grid gap-4 grid-cols-5` |
| 6 | `grid gap-4 grid-cols-6` |

**Use case:** Entity-level summary headers — district detail pages, explore panels, progress dashboards.

### Individual Card

```
bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden
```

A left accent bar is positioned absolutely to signal entity type:

```
absolute left-0 top-0 bottom-0 w-[3px]
```

**Typography:**

| Element | Classes |
|---------|---------|
| Label | `text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider` |
| Value | `text-xl font-bold text-[#403770]` |
| Subtitle | `text-[11px] text-[#A69DC0]` |

**Accent color palette:**

| Entity | Accent color |
|--------|-------------|
| Primary / Districts | `#403770` |
| Activities | `#6EA3BE` |
| Revenue / Goals | `#FFCF70` |
| Contacts / Plans | `#8AA891` |
| Tasks | `#F37167` |

**TSX example:**

```tsx
// Single KPI card — Activities variant
<div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden">
  {/* Left accent bar */}
  <div
    className="absolute left-0 top-0 bottom-0 w-[3px]"
    style={{ backgroundColor: '#6EA3BE' }}
  />

  <p className="text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
    Activities
  </p>
  <p className="text-xl font-bold text-[#403770]">142</p>
  <p className="text-[11px] text-[#A69DC0]">last 90 days</p>
</div>
```

**Full grid TSX example:**

```tsx
const kpis = [
  { label: 'Districts', value: '24', subtitle: 'in territory', accent: '#403770' },
  { label: 'Activities', value: '142', subtitle: 'last 90 days', accent: '#6EA3BE' },
  { label: 'Pipeline', value: '$1.8M', subtitle: 'open opportunities', accent: '#FFCF70' },
  { label: 'Contacts', value: '318', subtitle: 'active', accent: '#8AA891' },
];

// 4 cards → grid-cols-4
<div className="grid gap-4 grid-cols-4">
  {kpis.map((kpi) => (
    <div
      key={kpi.label}
      className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden"
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: kpi.accent }}
      />
      <p className="text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
        {kpi.label}
      </p>
      <p className="text-xl font-bold text-[#403770]">{kpi.value}</p>
      <p className="text-[11px] text-[#A69DC0]">{kpi.subtitle}</p>
    </div>
  ))}
</div>
```

---

## Stat with Trend Indicator

An inline stat value paired with a directional badge showing percentage change. Used inside KPI cards or standalone stat rows.

**Trend badge classes:** `inline-flex items-center gap-0.5 text-[11px] font-medium`

| Direction | Arrow color | Text color |
|-----------|-------------|------------|
| Up (positive) | `#8AA891` | `#8AA891` |
| Down (negative) | `#F37167` | `#F37167` |
| Flat | — | `#A69DC0` |

**Use case:** Period-over-period comparisons on activity counts, revenue totals, or task completion rates.

**TSX example:**

```tsx
type TrendDirection = 'up' | 'down' | 'flat';

interface TrendBadgeProps {
  direction: TrendDirection;
  pct: number; // e.g. 12 for "12%"
}

function TrendBadge({ direction, pct }: TrendBadgeProps) {
  const color =
    direction === 'up' ? '#8AA891' :
    direction === 'down' ? '#F37167' :
    '#A69DC0';

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-medium"
      style={{ color }}
    >
      {direction === 'up' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 2L9 8H1L5 2Z" fill={color} />
        </svg>
      )}
      {direction === 'down' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 8L1 2H9L5 8Z" fill={color} />
        </svg>
      )}
      {direction === 'flat' ? '—' : `${pct}%`}
    </span>
  );
}

// Usage inside a KPI card
<div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden">
  <div
    className="absolute left-0 top-0 bottom-0 w-[3px]"
    style={{ backgroundColor: '#6EA3BE' }}
  />
  <p className="text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
    Activities
  </p>
  <div className="flex items-baseline gap-2">
    <p className="text-xl font-bold text-[#403770]">142</p>
    <TrendBadge direction="up" pct={12} />
  </div>
  <p className="text-[11px] text-[#A69DC0]">vs. prior 90 days</p>
</div>
```

---

## Migration Notes

- `ExploreKPICards` uses `border-gray-200` — migrate to `border-[#D4CFE2]` to match the canonical display container defined in `_foundations.md`.

---

## Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Explore KPI grid | KPI Card Grid | `src/features/map/components/explore/ExploreKPICards.tsx` |
| Activity category stats | Stat Group | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Trend badge | Stat + Trend | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Academic metrics | Stat Display | `src/features/districts/components/AcademicMetrics.tsx` |
| Finance data | Stat Display | `src/features/districts/components/FinanceData.tsx` |
