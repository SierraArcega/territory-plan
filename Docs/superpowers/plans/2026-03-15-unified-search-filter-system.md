# Unified Search & Filter System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Layers/Demographics/CRM dropdowns with 5 domain-specific filter dropdowns (Fullmind, Competitors, Finance, Demographics, Academics) plus a gear icon for the Layers panel, and fix the results panel to correctly filter districts.

**Architecture:** The SearchBar index.tsx is rewritten to show 5 filter domain buttons + gear icon. Each domain gets its own dropdown component with simple range inputs, toggle chips, and selects. The existing LayerBubble content moves into a LayersPanel accessed via gear icon. FilterPills is updated with labels for all new columns. The SearchResults panel and `/api/districts/search` endpoint remain unchanged.

**Tech Stack:** React 19, Zustand, TailwindCSS v4, Next.js 16 API routes, Prisma

**Spec:** `docs/superpowers/specs/2026-03-15-unified-search-filter-system-design.md`

---

## Chunk 1: Shared Filter Controls + FilterPills Update

### Task 1: Create reusable filter control components

These are the building blocks used by all 5 domain dropdowns.

**Files:**
- Create: `src/features/map/components/SearchBar/controls/RangeFilter.tsx`
- Create: `src/features/map/components/SearchBar/controls/ToggleChips.tsx`
- Create: `src/features/map/components/SearchBar/controls/FilterSelect.tsx`
- Create: `src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx`

- [ ] **Step 1: Create RangeFilter component**

A simple min/max number input pair with Apply button. Used for enrollment, revenue, percentages, etc.

```tsx
// src/features/map/components/SearchBar/controls/RangeFilter.tsx
"use client";

import { useState } from "react";

interface RangeFilterProps {
  label: string;
  column: string;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  onApply: (column: string, min: number, max: number) => void;
}

export default function RangeFilter({ label, column, min = 0, max = 999999, step = 1, format, onApply }: RangeFilterProps) {
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");

  const handleApply = () => {
    const lo = minVal ? Number(minVal) : min;
    const hi = maxVal ? Number(maxVal) : max;
    if (!isNaN(lo) && !isNaN(hi) && lo <= hi) {
      onApply(column, lo, hi);
      setMinVal("");
      setMaxVal("");
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={minVal}
          onChange={(e) => setMinVal(e.target.value)}
          placeholder="Min"
          step={step}
          className="w-20 px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-plum/30"
        />
        <span className="text-gray-400 text-xs">–</span>
        <input
          type="number"
          value={maxVal}
          onChange={(e) => setMaxVal(e.target.value)}
          placeholder="Max"
          step={step}
          className="w-20 px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-plum/30"
        />
        <button
          onClick={handleApply}
          className="px-2 py-1 rounded text-[10px] font-bold text-white bg-plum hover:bg-plum/90 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ToggleChips component**

Clickable chip buttons that immediately add a filter. Used for Customer/Prospect, Yes/No toggles, Urbanicity.

```tsx
// src/features/map/components/SearchBar/controls/ToggleChips.tsx
"use client";

interface ChipOption {
  label: string;
  column: string;
  op: string;
  value: any;
}

interface ToggleChipsProps {
  label: string;
  options: ChipOption[];
  onSelect: (option: ChipOption) => void;
}

export default function ToggleChips({ label, options, onSelect }: ToggleChipsProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt)}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-plum/10 hover:text-plum transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create FilterSelect component**

A `<select>` that adds a filter on selection. Used for Sales Executive, Plan Membership.

```tsx
// src/features/map/components/SearchBar/controls/FilterSelect.tsx
"use client";

interface FilterSelectProps {
  label: string;
  column: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  onSelect: (column: string, value: string) => void;
}

export default function FilterSelect({ label, column, options, placeholder = "Select...", onSelect }: FilterSelectProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1.5 block">{label}</label>
      <select
        onChange={(e) => {
          if (e.target.value) {
            onSelect(column, e.target.value);
            e.target.value = "";
          }
        }}
        defaultValue=""
        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-plum/30"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Create FilterMultiSelect component**

Checkboxes in a scrollable list. Used for Tags.

```tsx
// src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx
"use client";

import { useState } from "react";

interface FilterMultiSelectProps {
  label: string;
  column: string;
  options: Array<{ value: string; label: string }>;
  onApply: (column: string, values: string[]) => void;
}

export default function FilterMultiSelect({ label, column, options, onApply }: FilterMultiSelectProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSelected(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        {selected.size > 0 && (
          <button
            onClick={() => { onApply(column, [...selected]); setSelected(new Set()); }}
            className="text-[10px] font-bold text-white bg-plum hover:bg-plum/90 px-2 py-0.5 rounded transition-colors"
          >
            Apply ({selected.size})
          </button>
        )}
      </div>
      <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
            <input
              type="checkbox"
              checked={selected.has(o.value)}
              onChange={() => toggle(o.value)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-plum focus:ring-plum/30"
            />
            <span className="text-xs text-gray-700">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit shared controls**

```bash
git add src/features/map/components/SearchBar/controls/
git commit -m "feat: add reusable filter control components (RangeFilter, ToggleChips, FilterSelect, FilterMultiSelect)"
```

### Task 2: Update FilterPills with all column labels

**Files:**
- Modify: `src/features/map/components/SearchBar/FilterPills.tsx`

- [ ] **Step 1: Expand COLUMN_LABELS to cover all 5 domains**

Add labels for every filterable column from the spec.

```tsx
const COLUMN_LABELS: Record<string, string> = {
  // Fullmind
  isCustomer: "Customer",
  hasOpenPipeline: "Pipeline",
  salesExecutive: "Sales Exec",
  fy26_open_pipeline_value: "FY26 Pipeline",
  fy26_closed_won_net_booking: "FY26 Bookings",
  fy26_net_invoicing: "FY26 Invoicing",
  // Competitors
  // (competitor filters use dynamic labels)
  // Finance
  expenditurePerPupil: "Expend/Pupil",
  totalRevenue: "Total Revenue",
  federalRevenue: "Federal Revenue",
  stateRevenue: "State Revenue",
  localRevenue: "Local Revenue",
  techSpending: "Tech Spending",
  titleIRevenue: "Title I",
  esserFundingTotal: "ESSER",
  // Demographics
  enrollment: "Enrollment",
  ell_percent: "ELL %",
  sped_percent: "SWD %",
  free_lunch_percent: "Poverty %",
  medianHouseholdIncome: "Median Income",
  urbanicity: "Urbanicity",
  enrollmentTrend3yr: "Enroll Trend",
  // Academics
  graduationRate: "Grad Rate",
  mathProficiency: "Math Prof",
  readProficiency: "Read Prof",
  chronicAbsenteeismRate: "Absenteeism",
  studentTeacherRatio: "S:T Ratio",
  teachersFte: "Teachers FTE",
  spedExpenditurePerStudent: "SPED $/Student",
};
```

- [ ] **Step 2: Add formatting for money columns in formatFilterValue**

Update the `between` formatting in `formatFilterValue` to handle revenue/finance columns (show as `$Xk` or `$XM`).

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchBar/FilterPills.tsx
git commit -m "feat: expand FilterPills column labels for all 5 filter domains"
```

---

## Chunk 2: Domain Dropdown Components

### Task 3: Create FullmindDropdown

**Files:**
- Create: `src/features/map/components/SearchBar/FullmindDropdown.tsx`

- [ ] **Step 1: Build FullmindDropdown**

Contains: Customer/Prospect toggle chips, Has Pipeline toggle, Sales Executive select, FY26 Pipeline range, FY26 Bookings range, FY26 Invoicing range, Plan select, Tags multi-select.

Fetches owners from `/api/sales-executives`, plans from `/api/territory-plans`, tags from `/api/tags`.

Uses the shared controls from Task 1. The `onApply`/`onSelect` callbacks call `useMapV2Store.getState().addSearchFilter(...)` with the appropriate `ExploreFilter`.

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchBar/FullmindDropdown.tsx
git commit -m "feat: add FullmindDropdown with CRM filter controls"
```

### Task 4: Create CompetitorsDropdown

**Files:**
- Create: `src/features/map/components/SearchBar/CompetitorsDropdown.tsx`

- [ ] **Step 1: Build CompetitorsDropdown**

Contains: Vendor checkboxes (Proximity, Elevate, TBT, Educere) and competitor spend range per vendor.

Reference `VENDOR_IDS` from `src/features/map/lib/layers.ts` (filter out "fullmind"). Competitor spend filters use column keys like `competitor_spend_proximity`, `competitor_spend_elevate` etc. — these may need custom handling in the search API if not already in `DISTRICT_FIELD_MAP`. For v1, include vendor checkboxes only; spend ranges can be added when the API supports them.

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchBar/CompetitorsDropdown.tsx
git commit -m "feat: add CompetitorsDropdown with vendor filter controls"
```

### Task 5: Create FinanceDropdown

**Files:**
- Create: `src/features/map/components/SearchBar/FinanceDropdown.tsx`

- [ ] **Step 1: Build FinanceDropdown**

Contains RangeFilter instances for: Expenditure/Pupil, Total Revenue, Federal Revenue, State Revenue, Local Revenue, Tech Spending, Title I Revenue, ESSER Funding.

All columns already exist in `DISTRICT_FIELD_MAP` in `src/features/explore/lib/filters.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchBar/FinanceDropdown.tsx
git commit -m "feat: add FinanceDropdown with revenue and spending filters"
```

### Task 6: Rewrite DemographicsDropdown

**Files:**
- Modify: `src/features/map/components/SearchBar/DemographicsDropdown.tsx`

- [ ] **Step 1: Rewrite to use shared controls**

Replace the histogram slider version with simple RangeFilter and ToggleChips components. Contains: Enrollment range, ELL% range, SWD% range, Poverty% range, Median Income range, Urbanicity toggle chips, Enrollment Trend range.

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchBar/DemographicsDropdown.tsx
git commit -m "refactor: rewrite DemographicsDropdown with simple range controls"
```

### Task 7: Create AcademicsDropdown

**Files:**
- Create: `src/features/map/components/SearchBar/AcademicsDropdown.tsx`

- [ ] **Step 1: Build AcademicsDropdown**

Contains RangeFilter instances for: Graduation Rate, Math Proficiency, Reading Proficiency, Chronic Absenteeism, Student-Teacher Ratio, Teacher FTE, SPED Expend/Student.

All columns already exist in `DISTRICT_FIELD_MAP`.

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchBar/AcademicsDropdown.tsx
git commit -m "feat: add AcademicsDropdown with academic metric filters"
```

---

## Chunk 3: LayersPanel + SearchBar Rewrite + Cleanup

### Task 8: Create LayersPanel from LayerBubble

**Files:**
- Create: `src/features/map/components/SearchBar/LayersPanel.tsx`
- Reference: `src/features/map/components/LayerBubble.tsx`

- [ ] **Step 1: Extract LayerBubble content into LayersPanel**

Copy the full LayerBubble component content (vendor toggles, engagement levels, signal overlays, school types, locales, palette pickers, fiscal year, compare mode, saved views) into `LayersPanel.tsx`. Change it to accept `onClose` prop and render as a dropdown panel (same positioning pattern as the filter dropdowns) instead of the bottom-right floating bubble. Remove the collapsed pill / toggle button — it's now triggered by the gear icon in the SearchBar.

Keep outside-click-to-close behavior. Keep all store subscriptions unchanged.

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchBar/LayersPanel.tsx
git commit -m "feat: extract LayerBubble into LayersPanel dropdown"
```

### Task 9: Rewrite SearchBar index.tsx

**Files:**
- Modify: `src/features/map/components/SearchBar/index.tsx`

- [ ] **Step 1: Replace dropdown buttons and imports**

Remove imports: `LayersDropdown`, old `DemographicsDropdown`, inline `CRMDropdown`.

Add imports: `FullmindDropdown`, `CompetitorsDropdown`, `FinanceDropdown`, `DemographicsDropdown` (new), `AcademicsDropdown`, `LayersPanel`.

Replace the 3 `DropdownButton` instances (Layers, Demographics, CRM) with 5 domain buttons + gear icon:

```
Fullmind | Competitors | Finance | Demographics | Academics | ⚙️
```

Each domain button shows a badge count of active filters in that domain. The gear icon toggles the LayersPanel.

- [ ] **Step 2: Update domain classification helpers**

Replace `isDemographicFilter` / `isCRMFilter` with a `getFilterDomain(column)` function that returns `"fullmind" | "competitors" | "finance" | "demographics" | "academics"`. Used for badge counts.

- [ ] **Step 3: Remove inline CRMDropdown**

Delete the `CRMDropdown` function component that was defined inline in this file.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchBar/index.tsx
git commit -m "refactor: rewrite SearchBar with 5 domain dropdowns + gear icon for layers"
```

### Task 10: Remove LayerBubble from MapV2Shell

**Files:**
- Modify: `src/features/map/components/MapV2Shell.tsx`

- [ ] **Step 1: Verify LayerBubble is already removed**

Check that `MapV2Shell.tsx` no longer imports or renders `<LayerBubble />` (it was replaced with `<SearchBar />` in the earlier implementation). If it's still there, remove it. The LayerBubble functionality now lives in `LayersPanel.tsx` accessed via the gear icon.

- [ ] **Step 2: Commit if changes needed**

```bash
git add src/features/map/components/MapV2Shell.tsx
git commit -m "chore: confirm LayerBubble removed from MapV2Shell"
```

### Task 11: Delete obsolete files

**Files:**
- Delete: `src/features/map/components/SearchBar/LayersDropdown.tsx`

- [ ] **Step 1: Remove LayersDropdown**

This file was the partial duplicate of LayerBubble created in the initial implementation. It's now replaced by `LayersPanel.tsx`.

- [ ] **Step 2: Commit**

```bash
git rm src/features/map/components/SearchBar/LayersDropdown.tsx
git commit -m "chore: remove obsolete LayersDropdown (replaced by LayersPanel)"
```

---

## Chunk 4: Fix Results Panel Filtering + Verify

### Task 12: Fix search API filter application

**Files:**
- Modify: `src/app/api/districts/search/route.ts`

- [ ] **Step 1: Add debug logging to verify filters arrive**

Temporarily add `console.log("Search filters:", JSON.stringify(filters))` and `console.log("Where clause:", JSON.stringify(filterWhere))` to the search route handler. Hit the endpoint from the browser with some filters. Verify that:
1. `filters` array is non-empty
2. `filterWhere` produces the expected Prisma where conditions

- [ ] **Step 2: Fix any type coercion issues**

If `buildWhereClause` produces conditions that don't match (e.g., string vs number for Decimal columns), add explicit type coercion. The `between` op sends `[min, max]` as numbers, but Prisma Decimal fields may need them as-is — verify by checking actual query results.

- [ ] **Step 3: Remove debug logging, commit**

```bash
git add src/app/api/districts/search/route.ts
git commit -m "fix: ensure search API correctly applies filter where clause"
```

### Task 13: Verify end-to-end

- [ ] **Step 1: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep -v '__tests__'
```

Expected: No errors in our files.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: No new test failures.

- [ ] **Step 3: Manual verification**

1. Open the map. Verify 5 domain buttons + gear icon in search bar.
2. Click Fullmind → set Customer toggle → results panel shows only customers.
3. Click Demographics → set Enrollment range 5000–20000 → results narrow.
4. Click gear icon → toggle vendor layers → map colors change, results don't change.
5. Pan map → results update with new viewport districts (still filtered).
6. Clear all filters → results panel hides.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: unified search & filter system with 5 domain dropdowns"
```
