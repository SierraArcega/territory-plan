# Plan District Inline Editing — Design Spec

**Date:** 2026-05-29  
**Branch:** `feat/plan-inline-editing`  
**Status:** Approved (revised 2026-05-29 — column expansion replaces popover)

## Problem

Editing per-district targets and churn risk in the plan detail table requires two steps today: click the row to expand a full panel, then click an individual card to edit. For the most common action — updating a target or flagging churn risk — this is one click too many, and the expanded panel takes up significant vertical space.

## Scope

**`GridView` (the plan Table view)** — the full-page plan workspace reachable from the portfolio, with Map/Table/Kanban/Signals tabs. `TableView` is a thin wrapper over `GridView`; all changes land in `GridView`. The plan detail modal's Districts tab (`PlanDistrictsTab`) is out of scope.

> **Correction from initial brainstorm:** The screenshot targets the views GridView, not `PlanDistrictsTab`. `ChurnRiskCell` is already wired in `GridView` — zero new work needed for churn risk.

| Cell | Before | After |
|---|---|---|
| Target (`c.id === "target"`) | Static formatted sum | Chevron in header expands into 4 inline-editable sub-columns |
| Churn Risk | ✅ Already inline-editable via `ChurnRiskCell` | No change |

## Design

### Column Expansion — overview

The TARGET column header contains a small ▶ chevron button. Clicking it:

- Sets `targetExpanded = true` in GridView state
- The `tanCols` `useMemo` (which currently uses `.map()`) switches to `.flatMap()` so it can replace the single `target` column with 4 consecutive sub-columns: **Renewal**, **Expansion**, **Win Back**, **New Biz**
- Right-side columns shift right naturally as the table grows wider; the outer container already has `overflow: auto` so it handles the extra width
- The ◀ chevron in the first sub-column header (Renewal) collapses back to 1 column

Total table width increases when expanded — this is intentional. Right-side columns are not hidden; they scroll into view. The table container already handles horizontal scroll.

### `targetExpanded` state

```ts
const [targetExpanded, setTargetExpanded] = useState(false);
```

Lives in `GridView`, alongside existing `useState` calls (selection, collapsedGroups, etc.).

### `tanCols` — flatMap for dynamic columns

Change `visibleCols.map(...)` to `visibleCols.flatMap(...)`. When a column is `c.id === "target"`:

**Collapsed (`!targetExpanded`):** return one column definition — same as today, but the header includes a `data-target-expand` attribute so the header render loop can attach the chevron button.

**Expanded (`targetExpanded`):** return 4 column definitions with IDs `"renewalTarget"`, `"expansionTarget"`, `"winbackTarget"`, `"newBusinessTarget"`. Each cell renders `<TargetSubCell>`.

```tsx
const SUB_TARGET_IDS = new Set(["renewalTarget", "expansionTarget", "winbackTarget", "newBusinessTarget"]);

const tanCols: TanColumnDef<Record<string, unknown>>[] = useMemo(
  () =>
    visibleCols.flatMap((c) => {
      if (c.id !== "target") {
        // ... existing cell renderer logic, unchanged ...
        return [{ id: c.id, header: c.header, accessorKey: c.accessor, cell: ... }];
      }

      if (!targetExpanded) {
        return [{
          id: "target",
          header: c.header,
          accessorKey: c.accessor,
          cell: (info) => {
            const v = info.getValue();
            if (v == null) return <span className="text-[#A69DC0]">—</span>;
            return <span>{formatCellValue(v, c.format)}</span>;
          },
        }];
      }

      const SUB_COLS = [
        { id: "renewalTarget",     label: "Renewal",   accessor: "renewalTarget"   },
        { id: "expansionTarget",   label: "Expansion", accessor: "expansionTarget" },
        { id: "winbackTarget",     label: "Win Back",  accessor: "winbackTarget"   },
        { id: "newBusinessTarget", label: "New Biz",   accessor: "newBusinessTarget"},
      ];

      return SUB_COLS.map((sub) => ({
        id: sub.id,
        header: sub.label,
        accessorKey: sub.accessor,
        cell: (info) => {
          const row = info.row.original as Record<string, unknown>;
          const leaid = typeof row.leaid === "string" ? row.leaid : null;
          if (!planId || !leaid) return <span className="text-[#A69DC0]">—</span>;
          return (
            <TargetSubCell
              planId={planId}
              leaid={leaid}
              field={sub.id as TargetField}
              value={typeof row[sub.accessor] === "number" ? (row[sub.accessor] as number) : null}
              siblingValues={{
                renewalTarget:     typeof row.renewalTarget     === "number" ? row.renewalTarget     as number : null,
                expansionTarget:   typeof row.expansionTarget   === "number" ? row.expansionTarget   as number : null,
                winbackTarget:     typeof row.winbackTarget     === "number" ? row.winbackTarget     as number : null,
                newBusinessTarget: typeof row.newBusinessTarget === "number" ? row.newBusinessTarget as number : null,
              }}
            />
          );
        },
      }));
    }),
  [visibleCols, planId, targetExpanded],
);
```

### Header rendering — chevron injection

`GridHeaderCell` takes a `label: string` and renders it. For the expansion chevron, we special-case the target-related column IDs in the header `<th>` render loop (around line 829 in GridView). Replace `GridHeaderCell` with inline JSX for those columns:

**Collapsed target header** (`colId === "target"`):
```tsx
<div className="flex items-center gap-1">
  <button
    type="button"
    aria-label="Expand target breakdown"
    onClick={() => setTargetExpanded(true)}
    className="flex h-4 w-4 items-center justify-center rounded bg-[#EFEDF5] text-[9px] text-[#7C5CDB] hover:bg-[#DDD5F5]"
  >
    ▶
  </button>
  <span className="whitespace-nowrap">Target</span>
</div>
```

**First sub-column header** (`colId === "renewalTarget"`):
```tsx
<div className="flex items-center gap-1">
  <button
    type="button"
    aria-label="Collapse target breakdown"
    onClick={() => setTargetExpanded(false)}
    className="flex h-4 w-4 items-center justify-center rounded bg-[#EFEDF5] text-[9px] text-[#7C5CDB] hover:bg-[#DDD5F5]"
  >
    ◀
  </button>
  <span className="whitespace-nowrap text-[#5B3FC8]">Renewal</span>
</div>
```

**Other sub-column headers** (`colId` in `{"expansionTarget", "winbackTarget", "newBusinessTarget"}`):
```tsx
<span className="whitespace-nowrap text-[#5B3FC8]">{label}</span>
```

**All other columns**: existing `<GridHeaderCell ...>` unchanged.

### `colCount` fix

`colCount` (used for `colSpan` in grouped rows and empty states) is currently:
```ts
const colCount = visibleCols.length + 1 + (showRowActions ? 1 : 0);
```
Change to use `tanCols.length` so the count reflects the actual rendered column count when expanded:
```ts
const colCount = tanCols.length + 1 + (showRowActions ? 1 : 0);
```

### New component: `TargetSubCell`

**File:** `src/features/views/components/grid/cells/TargetSubCell.tsx`

```ts
export type TargetField = "renewalTarget" | "expansionTarget" | "winbackTarget" | "newBusinessTarget";

interface Props {
  planId: string;
  leaid: string;
  field: TargetField;
  value: number | null;
  siblingValues: {
    renewalTarget:     number | null;
    expansionTarget:   number | null;
    winbackTarget:     number | null;
    newBusinessTarget: number | null;
  };
}
```

**Behaviour:**
- Default: renders formatted currency (e.g. `$20K`) or `—` if null/zero. Purple-tinted background `#FAF8FF`.
- Click → edit mode: `<input type="text" inputMode="numeric">` pre-filled with the raw number (no K-shorthand, no `$`), background `#EDE8FF`
- Blur or Enter → call `useUpdateDistrictTargets({ planId, leaid, ...siblingValues, [field]: parsedValue })` and exit edit mode
- Escape → exit edit mode without saving

No Save/Cancel buttons — autosave on blur/Enter, same feel as spreadsheet editing.

### Views data route — individual fields

The GridView row currently carries only `target` (the sum). The sub-cells need the breakdown. Extend `fetchDistrictPlanEnrichment` in `src/app/api/views/data/route.ts`:

- Extend `TargetRow` type and SQL to also `SELECT renewal_target, winback_target, expansion_target, new_business_target`
- Extend `DistrictEnrichmentEntry` with `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`
- Map them in the `for (const r of targetRows)` loop
- Include in the row data enrichment block (near `target: e?.target ?? null`)

### Cache invalidation

`useUpdateDistrictTargets.onSettled` (in `plans/lib/queries.ts`) must also invalidate the views data cache so the target sum re-fetches after a save:

```ts
queryClient.invalidateQueries({ queryKey: ["views", "data"] });
```

## Data Flow

```
TargetSubCell  →  useUpdateDistrictTargets()   (plans/lib/queries.ts:431)
                  mutate({ planId, leaid, renewalTarget, expansionTarget,
                            winbackTarget, newBusinessTarget })
                  onSettled: invalidates ["territoryPlan"], ["planDistrict"],
                             ["teamProgress"], ["leaderboard"], ["views","data"]

Churn dropdown  →  ChurnRiskCell already wired in GridView — no changes
```

API route: existing `PUT /api/territory-plans/[id]/districts/[leaid]`. No schema changes.

## Error Handling

`useUpdateDistrictTargets` uses TanStack Query's `onError` callback with optimistic rollback already implemented. No additional error handling needed in `TargetSubCell`.

## Files Changed

| Action | File |
|---|---|
| **Create** | `src/features/views/components/grid/cells/TargetSubCell.tsx` |
| **Create** | `src/features/views/components/grid/cells/__tests__/TargetSubCell.test.tsx` |
| **Modify** | `src/app/api/views/data/route.ts` — extend TargetRow + DistrictEnrichmentEntry |
| **Modify** | `src/features/plans/lib/queries.ts` — add `["views","data"]` invalidation |
| **Modify** | `src/features/views/components/grid/GridView.tsx` — targetExpanded state, flatMap tanCols, chevron headers, colCount fix |

No Prisma schema changes, no migrations. No `TargetBreakdownPopover` — superseded by column expansion.

## Testing

### `TargetSubCell.test.tsx`
- Renders formatted value when not editing (e.g. `$20K`)
- `—` when value is null
- Clicking the cell switches to edit mode with input pre-filled with raw number
- Blur fires mutation with updated field merged into sibling values
- Enter fires mutation
- Escape cancels without firing mutation

### `GridView` / `views data route`
Existing tests unchanged. No new integration test needed — `ChurnRiskCell` and `useUpdateDistrictTargets` already have unit coverage.

## What We Explicitly Did Not Do

- No `TargetBreakdownPopover` — superseded by column expansion
- No generic `<InlineEditCell>` abstraction — YAGNI
- No custom-styled dropdown for churn — `ChurnRiskCell` is already the pattern and already wired
- No changes to `PlanDistrictsTab` or its expand-row panel
- No keyboard navigation beyond Escape-to-cancel and Tab between sub-columns
- No new API endpoints or schema changes
