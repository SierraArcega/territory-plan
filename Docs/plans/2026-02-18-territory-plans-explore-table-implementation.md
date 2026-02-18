# Territory Plans Explore Table — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Plans" entity tab to the Explore overlay with KPI cards (total districts, renewal/expansion/winback/new business rollups), a sortable/filterable table, and expandable rows showing per-district target breakdowns.

**Architecture:** Follows the existing entity-polymorphic pattern — add `"plans"` to the `ExploreEntity` type, create column definitions, wire into the store/API/UI. The expandable row feature is new UI behavior in ExploreTable, toggled via a chevron on plans rows.

**Tech Stack:** Next.js, React, Prisma, Zustand, TanStack Table, TanStack Query

---

### Task 1: Add `"plans"` to ExploreEntity type and update Zustand store defaults

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Add "plans" to the ExploreEntity union type**

At line 30, change:
```ts
export type ExploreEntity = "districts" | "activities" | "tasks" | "contacts";
```
to:
```ts
export type ExploreEntity = "districts" | "activities" | "tasks" | "contacts" | "plans";
```

**Step 2: Add `plans` key to all `Record<ExploreEntity, ...>` initial values**

In the store initial state (~line 344), add `plans` entries:

```ts
exploreColumns: {
  districts: [...],
  activities: [...],
  tasks: [...],
  contacts: [...],
  plans: ["name", "status", "fiscalYear", "ownerName", "districtCount", "renewalRollup", "expansionRollup", "winbackRollup", "newBusinessRollup", "createdAt", "updatedAt"],
},
exploreFilters: {
  districts: [], activities: [], tasks: [], contacts: [],
  plans: [],
},
exploreSort: {
  districts: [], activities: [], tasks: [], contacts: [],
  plans: [],
},
exploreSavedViews: {
  districts: [], activities: [], tasks: [], contacts: [],
  plans: [],
},
activeViewId: {
  districts: null, activities: null, tasks: null, contacts: null,
  plans: null,
},
```

**Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | head -30`
Expected: No type errors related to ExploreEntity

**Step 4: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "feat(explore): add plans to ExploreEntity type and store defaults"
```

---

### Task 2: Create plan column definitions

**Files:**
- Create: `src/components/map-v2/explore/columns/planColumns.ts`

**Step 1: Create the column definitions file**

```ts
// Column definitions for the Plans entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/plans.

import type { ColumnDef } from "./districtColumns";

export const planColumns: ColumnDef[] = [
  // ---- Core ----
  { key: "name", label: "Plan Name", group: "Core", isDefault: true, filterType: "text" },
  { key: "status", label: "Status", group: "Core", isDefault: true, filterType: "enum", enumValues: ["planning", "working", "stale", "archived"] },
  { key: "fiscalYear", label: "Fiscal Year", group: "Core", isDefault: true, filterType: "number" },
  { key: "ownerName", label: "Owner", group: "Core", isDefault: true, filterType: "text" },
  { key: "districtCount", label: "Districts", group: "Core", isDefault: true, filterType: "number" },
  { key: "description", label: "Description", group: "Core", isDefault: false, filterType: "text" },
  { key: "stateCount", label: "States", group: "Core", isDefault: false, filterType: "number" },
  { key: "color", label: "Color", group: "Core", isDefault: false, filterType: "text" },

  // ---- Targets ----
  { key: "renewalRollup", label: "Renewal Rollup ($)", group: "Targets", isDefault: true, filterType: "number" },
  { key: "expansionRollup", label: "Expansion Rollup ($)", group: "Targets", isDefault: true, filterType: "number" },
  { key: "winbackRollup", label: "Win Back Rollup ($)", group: "Targets", isDefault: true, filterType: "number" },
  { key: "newBusinessRollup", label: "New Business Rollup ($)", group: "Targets", isDefault: true, filterType: "number" },

  // ---- Dates ----
  { key: "createdAt", label: "Created", group: "Dates", isDefault: true, filterType: "date" },
  { key: "updatedAt", label: "Updated", group: "Dates", isDefault: true, filterType: "date" },
];
```

**Step 2: Commit**

```bash
git add src/components/map-v2/explore/columns/planColumns.ts
git commit -m "feat(explore): add plan column definitions"
```

---

### Task 3: Add `PLANS_FIELD_MAP` to explore-filters.ts

**Files:**
- Modify: `src/lib/explore-filters.ts`

**Step 1: Add the field map after `DISTRICT_FIELD_MAP`**

```ts
// External column key → Prisma field name for plans
export const PLANS_FIELD_MAP: Record<string, string> = {
  name: "name",
  status: "status",
  fiscalYear: "fiscalYear",
  ownerName: "ownerName", // virtual — handled in route
  description: "description",
  color: "color",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  // Computed fields (districtCount, rollups) are not filterable via Prisma directly
};
```

**Step 2: Commit**

```bash
git add src/lib/explore-filters.ts
git commit -m "feat(explore): add PLANS_FIELD_MAP for plan filtering"
```

---

### Task 4: Add `handlePlans()` to the explore API route

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`

**Step 1: Import `PLANS_FIELD_MAP`**

Add to the import at the top:
```ts
import {
  type FilterDef,
  buildWhereClause,
  DISTRICT_FIELD_MAP,
  PLANS_FIELD_MAP,
} from "@/lib/explore-filters";
```

**Step 2: Add handlePlans function**

Add before the route handler (~line 560):

```ts
// ---------------------------------------------------------------------------
// PLANS handler
// ---------------------------------------------------------------------------

async function handlePlans(req: NextRequest, userId: string) {
  const { filters, sorts, page, pageSize } = parseQueryParams(req);

  // Build where — filter out virtual/computed fields that Prisma can't handle
  const prismaFilters = filters.filter((f) => PLANS_FIELD_MAP[f.column]);
  const where: Record<string, unknown> = {
    ...buildWhereClause(prismaFilters, PLANS_FIELD_MAP),
    userId,
  };

  // Build orderBy
  const orderBy: Record<string, unknown>[] = [];
  for (const s of sorts) {
    if (s.column === "ownerName") {
      orderBy.push({ ownerUser: { fullName: s.direction } });
    } else {
      const field = PLANS_FIELD_MAP[s.column];
      if (field) orderBy.push({ [field]: s.direction });
    }
  }
  if (orderBy.length === 0) orderBy.push({ updatedAt: "desc" });

  const [rows, total] = await Promise.all([
    prisma.territoryPlan.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        fiscalYear: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        ownerUser: { select: { fullName: true } },
        districts: {
          select: {
            districtLeaid: true,
            renewalTarget: true,
            expansionTarget: true,
            winbackTarget: true,
            newBusinessTarget: true,
            notes: true,
            district: { select: { name: true, leaid: true } },
          },
        },
        states: { select: { stateFips: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.territoryPlan.count({ where }),
  ]);

  // Reshape rows and compute rollups
  const data = rows.map((p) => {
    let renewalRollup = 0;
    let expansionRollup = 0;
    let winbackRollup = 0;
    let newBusinessRollup = 0;

    const planDistricts = p.districts.map((d) => {
      const renewal = d.renewalTarget ? Number(d.renewalTarget) : 0;
      const expansion = d.expansionTarget ? Number(d.expansionTarget) : 0;
      const winback = d.winbackTarget ? Number(d.winbackTarget) : 0;
      const newBiz = d.newBusinessTarget ? Number(d.newBusinessTarget) : 0;
      renewalRollup += renewal;
      expansionRollup += expansion;
      winbackRollup += winback;
      newBusinessRollup += newBiz;
      return {
        leaid: d.districtLeaid,
        name: d.district.name,
        renewalTarget: renewal,
        expansionTarget: expansion,
        winbackTarget: winback,
        newBusinessTarget: newBiz,
        notes: d.notes,
      };
    });

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      fiscalYear: p.fiscalYear,
      color: p.color,
      ownerName: p.ownerUser?.fullName ?? null,
      districtCount: p.districts.length,
      stateCount: p.states.length,
      renewalRollup,
      expansionRollup,
      winbackRollup,
      newBusinessRollup,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      // Nested district data for expandable rows
      _districts: planDistricts,
    };
  });

  // Compute aggregates across ALL matching plans (not just current page)
  // Use raw SQL for efficiency on large result sets
  const aggResult = await prisma.$queryRaw<
    [{ total_districts: number; renewal_sum: number; expansion_sum: number; winback_sum: number; new_business_sum: number }]
  >`
    SELECT
      COUNT(DISTINCT tpd.district_leaid)::int AS total_districts,
      COALESCE(SUM(tpd.renewal_target), 0)::float AS renewal_sum,
      COALESCE(SUM(tpd.expansion_target), 0)::float AS expansion_sum,
      COALESCE(SUM(tpd.winback_target), 0)::float AS winback_sum,
      COALESCE(SUM(tpd.new_business_target), 0)::float AS new_business_sum
    FROM territory_plan_districts tpd
    JOIN territory_plans tp ON tp.id = tpd.plan_id
    WHERE tp.user_id = ${userId}::uuid
  `;

  const agg = aggResult[0];

  return {
    data,
    aggregates: {
      totalDistricts: agg.total_districts,
      renewalSum: agg.renewal_sum,
      expansionSum: agg.expansion_sum,
      winbackSum: agg.winback_sum,
      newBusinessSum: agg.new_business_sum,
    },
    pagination: { page, pageSize, total },
  };
}
```

**Step 3: Register "plans" as a valid entity**

Change `VALID_ENTITIES`:
```ts
const VALID_ENTITIES = new Set(["districts", "activities", "tasks", "contacts", "plans"]);
```

Add the case to the switch:
```ts
case "plans":
  result = await handlePlans(req, user.id);
  break;
```

**Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/app/api/explore/[entity]/route.ts src/lib/explore-filters.ts
git commit -m "feat(explore): add handlePlans API handler with rollup aggregates"
```

---

### Task 5: Wire Plans tab into ExploreOverlay

**Files:**
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Import planColumns**

Add after the other column imports:
```ts
import { planColumns } from "./columns/planColumns";
```

**Step 2: Add Plans tab to ENTITY_TABS**

Add to the `ENTITY_TABS` array (use a clipboard/document icon path):
```ts
{ key: "plans", label: "Plans", path: "M4 2H12L14 4V14H4V2ZM6 6H12M6 8H12M6 10H10", stroke: true },
```

**Step 3: Add plans to DEFAULT_COLUMNS**

```ts
const DEFAULT_COLUMNS: Record<ExploreEntity, string[]> = {
  districts: districtColumns.filter((c) => c.isDefault).map((c) => c.key),
  activities: activityColumns.filter((c) => c.isDefault).map((c) => c.key),
  tasks: taskColumns.filter((c) => c.isDefault).map((c) => c.key),
  contacts: contactColumns.filter((c) => c.isDefault).map((c) => c.key),
  plans: planColumns.filter((c) => c.isDefault).map((c) => c.key),
};
```

**Step 4: Add "plans" to ALL_ENTITIES**

```ts
const ALL_ENTITIES: ExploreEntity[] = ["districts", "activities", "tasks", "contacts", "plans"];
```

**Step 5: Commit**

```bash
git add src/components/map-v2/explore/ExploreOverlay.tsx
git commit -m "feat(explore): wire Plans tab into ExploreOverlay"
```

---

### Task 6: Add Plans KPI cards

**Files:**
- Modify: `src/components/map-v2/explore/ExploreKPICards.tsx`

**Step 1: Add plans case to getCardsForEntity**

Add after the `contacts` case:
```ts
case "plans":
  return [
    { label: "Total Districts", value: formatNumber(agg.totalDistricts), accent: "#403770" },
    { label: "Renewal Rollup", value: formatCurrency(agg.renewalSum), accent: "#6EA3BE" },
    { label: "Expansion Rollup", value: formatCurrency(agg.expansionSum), accent: "#8AA891" },
    { label: "Win Back Rollup", value: formatCurrency(agg.winbackSum), accent: "#FFCF70" },
    { label: "New Business Rollup", value: formatCurrency(agg.newBusinessSum), accent: "#C4E7E6" },
  ];
```

**Step 2: Update the loading skeleton grid**

Plans has 5 KPI cards, so update the loading skeleton to use `grid-cols-5` when entity is plans. Change the loading return:
```tsx
if (isLoading || !aggregates) {
  const count = entity === "plans" ? 5 : 4;
  return (
    <div className={`grid gap-4 ${count === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
      {Array.from({ length: count }).map((i, idx) => (
        <div key={idx} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C4E7E6]/50" />
          <div className="h-3 w-16 bg-[#C4E7E6]/25 rounded animate-pulse mb-2" />
          <div className="h-5 w-20 bg-[#C4E7E6]/20 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
```

And update the rendered grid too:
```tsx
const cards = getCardsForEntity(entity, aggregates);
return (
  <div className={`grid gap-4 ${cards.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
    {cards.map((card) => (
      <KPICard key={card.label} {...card} />
    ))}
  </div>
);
```

**Step 3: Commit**

```bash
git add src/components/map-v2/explore/ExploreKPICards.tsx
git commit -m "feat(explore): add plans KPI cards with 5-column layout"
```

---

### Task 7: Add planColumns to ExploreTable label map

**Files:**
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

**Step 1: Import planColumns and add to ALL_COLUMN_DEFS**

Add the import:
```ts
import { planColumns } from "./columns/planColumns";
```

Add to `ALL_COLUMN_DEFS`:
```ts
const ALL_COLUMN_DEFS = [
  ...districtColumns,
  ...activityColumns,
  ...taskColumns,
  ...contactColumns,
  ...planColumns,
];
```

**Step 2: Commit**

```bash
git add src/components/map-v2/explore/ExploreTable.tsx
git commit -m "feat(explore): register planColumns in ExploreTable label map"
```

---

### Task 8: Add expandable rows for plans in ExploreTable

**Files:**
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

**Step 1: Add expanded row state**

Inside the `ExploreTable` component, add state for tracking expanded plan rows:
```ts
const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());
const togglePlanExpand = useCallback((id: string) => {
  setExpandedPlanIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}, []);
const isPlanEntity = entityType === "plans";
```

**Step 2: Add chevron column for plans**

In the `columns` useMemo, after the `showCheckboxes` unshift block, add:
```ts
if (isPlanEntity) {
  dataCols.unshift({
    id: "__expand",
    header: () => null,
    cell: () => null, // rendered manually
    size: 36,
  });
}
```

**Step 3: Render chevron cell and expanded district sub-table**

In the data rows rendering section (inside `table.getRowModel().rows.map`), add handling for the `__expand` column and the expanded sub-table row.

For the `__expand` cell in the `row.getVisibleCells().map`:
```tsx
if (cell.column.id === "__expand") {
  const isExpanded = expandedPlanIds.has(rowId);
  return (
    <td key={cell.id} className="w-9 px-2 py-3">
      <button
        onClick={(e) => { e.stopPropagation(); togglePlanExpand(rowId); }}
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
      >
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
        >
          <path d="M6 4L10 8L6 12" />
        </svg>
      </button>
    </td>
  );
}
```

After each plan data row `</tr>`, render the expanded sub-table:
```tsx
{isPlanEntity && expandedPlanIds.has(rowId) && (
  <tr className="bg-gray-50/50">
    <td colSpan={visibleColumns.length + 1} className="px-0 py-0">
      <div className="px-10 py-3">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-gray-400 uppercase tracking-wider">
              <th className="pb-2 font-semibold">District</th>
              <th className="pb-2 font-semibold text-right">Renewal</th>
              <th className="pb-2 font-semibold text-right">Expansion</th>
              <th className="pb-2 font-semibold text-right">Win Back</th>
              <th className="pb-2 font-semibold text-right">New Business</th>
              <th className="pb-2 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {((row.original._districts as Array<{
              leaid: string; name: string;
              renewalTarget: number; expansionTarget: number;
              winbackTarget: number; newBusinessTarget: number;
              notes: string | null;
            }>) || []).map((d) => (
              <tr key={d.leaid} className="border-t border-gray-100">
                <td className="py-1.5 text-[#403770] font-medium">{d.name}</td>
                <td className="py-1.5 text-right text-gray-600">{d.renewalTarget ? `$${d.renewalTarget.toLocaleString()}` : "\u2014"}</td>
                <td className="py-1.5 text-right text-gray-600">{d.expansionTarget ? `$${d.expansionTarget.toLocaleString()}` : "\u2014"}</td>
                <td className="py-1.5 text-right text-gray-600">{d.winbackTarget ? `$${d.winbackTarget.toLocaleString()}` : "\u2014"}</td>
                <td className="py-1.5 text-right text-gray-600">{d.newBusinessTarget ? `$${d.newBusinessTarget.toLocaleString()}` : "\u2014"}</td>
                <td className="py-1.5 text-gray-500 max-w-[200px] truncate">{d.notes || "\u2014"}</td>
              </tr>
            ))}
            {(!row.original._districts || (row.original._districts as unknown[]).length === 0) && (
              <tr>
                <td colSpan={6} className="py-3 text-center text-gray-400 italic">
                  No districts in this plan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </td>
  </tr>
)}
```

**Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/components/map-v2/explore/ExploreTable.tsx
git commit -m "feat(explore): add expandable plan rows with district target breakdown"
```

---

### Task 9: Smoke test in browser

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Manual verification checklist**

- [ ] Plans tab appears in the explore sidebar
- [ ] Clicking Plans loads the table with plan data
- [ ] KPI cards show 5 cards: Total Districts, Renewal, Expansion, Win Back, New Business
- [ ] Table shows default columns: Name, Status, FY, Owner, District Count, rollups, dates
- [ ] Clicking chevron on a plan row expands to show districts with targets + notes
- [ ] Filtering works (try filtering by status = "planning")
- [ ] Sorting works (click a column header)
- [ ] Switching between tabs preserves state for each entity
- [ ] Column picker includes plan columns grouped correctly

**Step 3: Final commit if any fixes needed**
