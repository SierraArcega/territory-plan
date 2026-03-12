# Dashboard Metrics Layout

Metrics display in two contexts: **KPI card grids** (Explore overlay, aggregate stats across many entities) and **signal card stacks** (district detail panel, detailed metrics for a single entity).

---

## Decision Tree: Which Metric Layout?

```
1. Showing aggregate KPIs across many entities?
   → KPI Card Grid (ExploreKPICards pattern)

2. Showing detailed metrics for a single district?
   → Signal Card Stack (DistrictDetailPanel pattern)

3. Showing a single stat inline in a card?
   → Inline stat (text-xl font-bold + label)
```

---

## KPI Card Pattern

From `ExploreKPICards.tsx` — compact stat cards with a colored accent bar.

```tsx
{/* Single KPI card */}
<div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 relative overflow-hidden">
  {/* 3px accent bar — color varies by semantic meaning */}
  <div
    className="absolute left-0 top-0 bottom-0 w-[3px]"
    style={{ backgroundColor: accent }}
  />
  <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
    {label}
  </div>
  <div className="text-xl font-bold text-[#403770] mt-1">{value}</div>
  {subtitle && (
    <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>
  )}
</div>
```

**Grid layout:** `grid gap-4 grid-cols-{n}` where `n` matches card count (4-7). Uses `gridColsClass()` helper — 4 cols for 4 cards, 5 for 5, 6 for 6, wraps at 4 for 7+.

**Skeleton (loading):** Same card shape with `animate-pulse` fills:

```tsx
<div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 relative overflow-hidden">
  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C4E7E6]/50" />
  <div className="h-3 w-16 bg-[#C4E7E6]/25 rounded animate-pulse mb-2" />
  <div className="h-5 w-20 bg-[#C4E7E6]/20 rounded animate-pulse" />
</div>
```

**Migration note:** Uses `border-gray-200` (should be `border-[#D4CFE2]`), `text-gray-500` (should be `text-[#8A80A8]`), `text-gray-400` (should be `text-[#A69DC0]`).

---

## KPI Cards by Entity

| Entity | KPI 1 | KPI 2 | KPI 3 | KPI 4 | Extra KPIs |
|--------|-------|-------|-------|-------|-----------|
| districts | Districts (`#403770`) | Total Enrollment (`#6EA3BE`) | Open Pipeline (`#FFCF70`) | Closed Won (`#8AA891`) | — |
| activities | Total Activities (`#403770`) | Completed (`#8AA891`) | Positive Outcomes (`#EDFFE3`) | Districts Touched (`#6EA3BE`) | — |
| tasks | Total Tasks (`#403770`) | Overdue (`#F37167`) | Completed (`#8AA891`) | Blocked (`#FFCF70`) | — |
| contacts | Total Contacts (`#403770`) | Districts Covered (`#6EA3BE`) | Primary Contacts (`#C4E7E6`) | Recently Active (`#8AA891`) | — |
| plans | Total Districts (`#403770`) | Total Targets (`#403770`) | FY27 Pipeline (`#F37167`) | Renewal (`#6EA3BE`) | Expansion (`#8AA891`), Win Back (`#FFCF70`), New Business (`#C4E7E6`) |

---

## Signal Card Pattern

From `SignalCard.tsx` — expandable metric cards used in the district detail panel.

| Region | Classes |
|--------|---------|
| Shell | `border border-gray-100 rounded-xl bg-white` |
| Header | `flex items-center justify-between px-3 pt-3 pb-1` |
| Icon (left) | `text-gray-400` |
| Title | `text-sm font-semibold text-[#403770]` |
| Badge (right) | `SignalBadge` or custom badge |
| Content | `px-3 pb-3` |
| Toggle button | `w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-[#403770] border-t border-gray-50 transition-colors` |
| Detail content | `px-3 pb-3 border-t border-gray-50` |

Chevron rotates `rotate-90` when expanded.

```tsx
<SignalCard
  icon={<UsersIcon className="w-4 h-4" />}
  title="Enrollment & Growth"
  badge={<SignalBadge trend={trends?.enrollmentTrend3yr ?? null} />}
  detail={
    <div className="space-y-4 pt-2">
      {/* Expanded detail content */}
    </div>
  }
>
  {/* Primary metric */}
  <div className="space-y-1">
    <div className="flex items-baseline gap-3">
      <span className="text-2xl font-bold text-[#403770]">
        {district.enrollment?.toLocaleString() ?? "N/A"}
      </span>
      <TrendArrow value={trends?.enrollmentTrend3yr ?? null} unit="percent" />
    </div>
    <div className="text-xs text-gray-500">
      Grades PK – 12 · 42 schools
    </div>
  </div>
</SignalCard>
```

**Migration note:** Shell uses `border-gray-100` (should be `border-[#E2DEEC]`), toggle uses `border-gray-50` (should be `border-[#E2DEEC]`), icon uses `text-gray-400` (should be `text-[#A69DC0]`).

### Signal Cards in DistrictDetailPanel

| Card | File | Key Metrics |
|------|------|------------|
| PurchasingHistoryCard | `panels/district/PurchasingHistoryCard.tsx` | Revenue by year, vendor spend |
| CompetitorSpendCard | `panels/district/CompetitorSpendCard.tsx` | Competitor spend breakdown |
| FullmindCard | `panels/district/FullmindCard.tsx` | Fullmind engagement data |
| EnrollmentCard | `panels/district/EnrollmentCard.tsx` | Student count, demographics, trends |
| StaffingCard | `panels/district/StaffingCard.tsx` | Teacher ratios, staffing data |
| StudentPopulationsCard | `panels/district/StudentPopulationsCard.tsx` | Special populations |
| AcademicCard | `panels/district/AcademicCard.tsx` | Test scores, graduation rates |
| FinanceCard | `panels/district/FinanceCard.tsx` | Per-pupil expenditure, revenue |
| DistrictDetailsCard | `panels/district/DistrictDetailsCard.tsx` | Address, NCES data, metadata |

---

## Signal Badge Pattern

From `SignalBadge.tsx` — trend indicators used in signal card headers.

| Level | Background | Text | Label |
|-------|-----------|------|-------|
| `growing` | `bg-[#EDFFE3]` | `text-[#5f665b]` | Growing |
| `stable` | `bg-[#6EA3BE]/15` | `text-[#4d7285]` | Stable |
| `at_risk` | `bg-[#FFCF70]/20` | `text-[#997c43]` | At Risk |
| `declining` | `bg-[#F37167]/15` | `text-[#c25a52]` | Declining |

**Level computation** (`getSignalLevel`):

| Condition | Level |
|-----------|-------|
| `trend > 3` (or `> 1.5` for point changes) | `growing` |
| `trend > -1` (or `> -1.5` for point changes) | `stable` |
| `trend > -5` (or `> -2.5` for point changes) | `at_risk` |
| Below thresholds | `declining` |

Set `invertDirection` for metrics where higher = worse (absenteeism, student-teacher ratio).

**Size variants:**

| Variant | Classes |
|---------|---------|
| Standard | `px-2 py-0.5 text-xs` |
| Compact | `px-1.5 py-0.5 text-[10px]` |

Shared: `inline-flex items-center font-medium rounded-full`

### TrendArrow

Directional change indicator paired with signal badges.

| Direction | Symbol | Color |
|-----------|--------|-------|
| Positive (good) | `↑` | `text-[#5f665b]` |
| Negative (bad) | `↓` | `text-[#c25a52]` |
| Neutral (`abs < 0.5`) | `—` | `text-[#4d7285]` |

Format: `{arrow} {value} over 3 years` — supports `percent` (`4.2%`), `points` (`1.3 pts`), and `ratio` unit modes. Set `invertColor` for metrics where higher = worse.

---

## Number Formatting

Reference: `Display/_foundations.md` for canonical conventions.

| Input | Output | Currency |
|-------|--------|----------|
| `null` / `undefined` | `"—"` | `"—"` |
| 1,000,000+ | `"1.2M"` | `"$1.2M"` |
| 1,000+ | `"12K"` | `"$12K"` |
| Below 1,000 | `"1,234"` | `"$1,234"` |

```tsx
function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}
```

Note: `FinanceCard` and `PlanPerfSection` use `Intl.NumberFormat` for full currency formatting — prefer the simpler helper above for KPI display.

---

## Metric Color Semantics

Accent bar and dot colors used across KPI cards and signal badges.

| Accent | Hex | Meaning |
|--------|-----|---------|
| Plum | `#403770` | Primary count/total |
| Steel Blue | `#6EA3BE` | Coverage, enrollment, info |
| Coral | `#F37167` | Pipeline, overdue, urgency |
| Golden | `#FFCF70` | Win back, blocked, warnings |
| Green | `#8AA891` | Closed won, completed, positive |
| Robin's Egg | `#C4E7E6` | Secondary, new business |
| Mint | `#EDFFE3` | Light success (positive outcomes) |

---

## Codebase Reference

| Component | File |
|-----------|------|
| KPI card grid | `src/features/map/components/explore/ExploreKPICards.tsx` |
| Signal card (expandable) | `src/features/map/components/panels/district/signals/SignalCard.tsx` |
| Signal badge (trend) | `src/features/map/components/panels/district/signals/SignalBadge.tsx` |
| Trend arrow | `src/features/map/components/panels/district/signals/TrendArrow.tsx` |
| Enrollment card | `src/features/map/components/panels/district/EnrollmentCard.tsx` |
| Finance card | `src/features/map/components/panels/district/FinanceCard.tsx` |
| Competitor spend | `src/features/map/components/panels/district/CompetitorSpendCard.tsx` |
| Purchasing history | `src/features/map/components/panels/district/PurchasingHistoryCard.tsx` |
| Plan performance | `src/features/map/components/panels/PlanPerfSection.tsx` |
| Number formatting | `Display/_foundations.md` |
