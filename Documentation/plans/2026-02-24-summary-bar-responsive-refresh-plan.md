# MapSummaryBar Responsive Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make MapSummaryBar responsive on 13" laptops and refresh its visual styling to match the Fullmind brand system.

**Architecture:** Single-file edit to `MapSummaryBar.tsx`. Add compact label variants to `METRIC_CONFIG`, apply Tailwind responsive classes (`xl:` breakpoint) for spacing/sizing tiers, and replace generic grays with Fullmind brand colors (Plum, Robin's Egg, Off-white).

**Tech Stack:** React 19, Tailwind CSS 4, Zustand store (read-only — no store changes)

**Design doc:** `docs/plans/2026-02-24-summary-bar-responsive-refresh-design.md`

**Brand reference skill:** `frontend-design` — Plum `#403770`, Off-white `#FFFCFA`, Robin's Egg `#C4E7E6`

---

### Task 1: Update METRIC_CONFIG with compact labels

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx:40-53`

**Step 1: Update METRIC_CONFIG type and values**

Change METRIC_CONFIG to include both `label` (full) and `compactLabel` (abbreviated) for each metric:

```tsx
const METRIC_CONFIG: Record<MetricId, { label: string; compactLabel: string; format: (t: SummaryTotals) => string }> = {
  districts: { label: "Districts", compactLabel: "Dist", format: (t) => formatNumber(t.count) },
  enrollment: { label: "Enrollment", compactLabel: "Enroll", format: (t) => formatNumber(t.totalEnrollment) },
  pipeline: { label: "Pipeline", compactLabel: "Pipe", format: (t) => formatCurrency(t.openPipeline, true) },
  bookings: { label: "Bookings", compactLabel: "Book", format: (t) => formatCurrency(t.closedWonBookings, true) },
  invoicing: { label: "Invoicing", compactLabel: "Inv", format: (t) => formatCurrency(t.invoicing, true) },
  scheduledRevenue: { label: "Sched Rev", compactLabel: "Sched Rev", format: (t) => formatCurrency(t.scheduledRevenue, true) },
  deliveredRevenue: { label: "Deliv Rev", compactLabel: "Deliv Rev", format: (t) => formatCurrency(t.deliveredRevenue, true) },
  deferredRevenue: { label: "Def Rev", compactLabel: "Def Rev", format: (t) => formatCurrency(t.deferredRevenue, true) },
  totalRevenue: { label: "Total Rev", compactLabel: "Tot Rev", format: (t) => formatCurrency(t.totalRevenue, true) },
  deliveredTake: { label: "Deliv Take", compactLabel: "Deliv Take", format: (t) => formatCurrency(t.deliveredTake, true) },
  scheduledTake: { label: "Sched Take", compactLabel: "Sched Take", format: (t) => formatCurrency(t.scheduledTake, true) },
  allTake: { label: "All Take", compactLabel: "All Take", format: (t) => formatCurrency(t.allTake, true) },
};
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Type error in `Stat` component (it only accepts `label` string — will be fixed in Task 2)

---

### Task 2: Update Stat component — brand colors + responsive text + dual labels

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx:23-34`

**Step 1: Rewrite Stat to show compact/full labels and use brand colors**

```tsx
function Stat({ label, compactLabel }: { label: string; compactLabel: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] xl:text-[11px] font-medium text-[#403770]/50 uppercase tracking-wider leading-none">
        <span className="xl:hidden">{compactLabel}</span>
        <span className="hidden xl:inline">{label}</span>
      </span>
    </div>
  );
}
```

Wait — Stat also shows the value. The full replacement:

```tsx
function Stat({ label, compactLabel, value }: { label: string; compactLabel: string; value: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] xl:text-[11px] font-medium text-[#403770]/50 uppercase tracking-wider leading-none">
        <span className="xl:hidden">{compactLabel}</span>
        <span className="hidden xl:inline">{label}</span>
      </span>
      <span className="text-[13px] xl:text-[15px] font-semibold text-[#403770] tabular-nums leading-tight mt-0.5">
        {value}
      </span>
    </div>
  );
}
```

**Step 2: Update FinancialStats to pass compactLabel**

In FinancialStats (line ~81), change:
```tsx
<Stat label={cfg.label} value={value} />
```
to:
```tsx
<Stat label={cfg.label} compactLabel={cfg.compactLabel} value={value} />
```

**Step 3: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean (no errors)

**Step 4: Commit**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: add responsive labels and brand colors to Stat component"
```

---

### Task 3: Update Sep component — brand color

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx:36-38`

**Step 1: Replace gray separator with Plum-tinted separator**

```tsx
function Sep({ className = "h-5 xl:h-6" }: { className?: string }) {
  return <div className={`w-px bg-[#403770]/10 shrink-0 ${className}`} />;
}
```

**Step 2: Commit**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: brand-tint separators in summary bar"
```

---

### Task 4: Update Skeleton — brand loading colors

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx:10-21`

**Step 1: Replace gray skeletons with Robin's Egg tinted skeletons and responsive spacing**

```tsx
function Skeleton() {
  return (
    <div className="flex items-center gap-3 xl:gap-5 px-3 xl:px-5 py-2.5 xl:py-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-2.5 w-12 bg-[#C4E7E6]/20 rounded animate-pulse" />
          <div className="h-4 w-16 bg-[#C4E7E6]/15 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: brand-tint skeleton loading in summary bar"
```

---

### Task 5: Update VendorRow — responsive spacing + brand colors

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx:106-117`

**Step 1: Apply responsive spacing and brand color to vendor label**

```tsx
  return (
    <div className="flex items-center gap-3 xl:gap-4 px-3 xl:px-5 py-1.5 xl:py-2 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 min-w-[80px] xl:min-w-[90px]">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: palette.dotColor }}
        />
        <span className="text-xs font-medium text-[#403770]/70 truncate">{label}</span>
      </div>
      <FinancialStats t={entry.totals} unfilteredCount={unfilteredCount} height="h-4 xl:h-5" />
    </div>
  );
```

**Step 2: Commit**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: responsive spacing and brand colors for vendor rows"
```

---

### Task 6: Update MapSummaryBar main component — card + stats row + collapsed button

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx:120-199`

**Step 1: Update collapsed state button (lines 137-150)**

Replace:
```tsx
        <button
          onClick={toggleSummaryBar}
          className="bg-white/85 backdrop-blur-md rounded-lg ring-1 ring-black/[0.08] border border-white/60 px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
```
With:
```tsx
        <button
          onClick={toggleSummaryBar}
          className="bg-[#FFFCFA]/85 backdrop-blur-md rounded-lg ring-1 ring-[#403770]/[0.06] border border-white/60 px-3 py-2 text-xs font-medium text-[#403770]/50 hover:text-[#403770]/70 transition-colors"
```

**Step 2: Update main card wrapper (lines 157-159)**

Replace:
```tsx
        className="bg-white/85 backdrop-blur-md rounded-xl ring-1 ring-black/[0.08] border border-white/60"
```
With:
```tsx
        className="bg-[#FFFCFA]/85 backdrop-blur-md rounded-xl ring-1 ring-[#403770]/[0.06] border border-white/60"
```

**Step 3: Update stats row spacing (line 166)**

Replace:
```tsx
            <div className="flex items-center gap-5 px-5 py-3 overflow-x-auto">
```
With:
```tsx
            <div className="flex items-center gap-3 xl:gap-5 px-3 xl:px-5 py-2.5 xl:py-3 overflow-x-auto">
```

**Step 4: Update close button (lines 171-179)**

Replace:
```tsx
                className="ml-auto text-gray-300 hover:text-gray-500 p-0.5 rounded transition-colors shrink-0"
```
With:
```tsx
                className="ml-auto text-[#403770]/25 hover:text-[#403770]/50 p-0.5 rounded transition-colors shrink-0"
```

**Step 5: Update vendor divider (line 183)**

Replace:
```tsx
                <div className="h-px bg-gray-200/80 mx-3" />
```
With:
```tsx
                <div className="h-px bg-[#403770]/10 mx-3" />
```

**Step 6: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean

**Step 7: Commit**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: responsive spacing and brand refresh for summary bar card"
```

---

### Task 7: Visual verification

**Step 1: Start dev server if not running**

Run: `npm run dev`

**Step 2: Check at 1440px+ viewport**

Open browser, resize to >= 1280px wide. Verify:
- Full metric labels ("Districts", "Enrollment", "Pipeline", etc.)
- Larger spacing (gap-5, px-5, py-3)
- Plum-colored values and labels
- Off-white card background
- Robin's Egg skeleton pulses (toggle loading state if possible)

**Step 3: Check at ~1200px viewport**

Resize browser to ~1200px. Verify:
- Compact labels ("Dist", "Enroll", "Pipe", etc.)
- Tighter spacing (gap-3, px-3, py-2.5)
- Smaller text sizes
- All metrics still visible in single row without scrolling (or minimal scroll)
- Vendor rows also tighter

**Step 4: Final commit if any tweaks needed**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "fix: visual polish from responsive summary bar testing"
```
