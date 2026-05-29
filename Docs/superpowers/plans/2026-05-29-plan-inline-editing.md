# Plan District Inline Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TARGET column expansion chevron to the plan Table view (GridView) so reps can inline-edit renewal/expansion/winback/new-biz targets directly in the grid without opening the row panel.

**Architecture:** A `▶` chevron in the TARGET column header toggles `targetExpanded` state in `GridView`. When expanded, `tanCols` (via `flatMap`) replaces the single sum column with 4 sub-columns, each cell rendered by a new `TargetSubCell` component. `TargetSubCell` handles click-to-edit inline with autosave on blur/Enter. The views data route is extended to carry the 4 individual target fields. `useUpdateDistrictTargets` gains a `["views","data"]` cache invalidation.

**Tech Stack:** React 19, TypeScript, Tailwind 4, TanStack Table v8, TanStack Query v5, Vitest + Testing Library, Next.js App Router API routes, Prisma raw SQL.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/features/views/components/grid/cells/TargetSubCell.tsx` | Inline-editable currency cell for each sub-target field |
| Create | `src/features/views/components/grid/cells/__tests__/TargetSubCell.test.tsx` | Unit tests |
| Modify | `src/app/api/views/data/route.ts` | Add 4 individual target fields to `TargetRow` SQL + `DistrictEnrichmentEntry` |
| Modify | `src/features/plans/lib/queries.ts` | Add `["views","data"]` invalidation to `useUpdateDistrictTargets.onSettled` |
| Modify | `src/features/views/components/grid/GridView.tsx` | `targetExpanded` state, `flatMap` tanCols, chevron headers, `colCount` fix |

---

## Task 1: Extend views data route — include individual target fields

**Files:**
- Modify: `src/app/api/views/data/route.ts`

The `fetchDistrictPlanEnrichment` function currently fetches only the sum (`target`). We need the 4 sub-fields so each `TargetSubCell` can pre-fill its input and pass sibling values in the mutation.

- [ ] **Step 1.1: Extend `TargetRow` type and SQL query**

Find this block (around line 510):

```ts
type TargetRow = {
  district_leaid: string;
  target: number;
};
```

Replace with:

```ts
type TargetRow = {
  district_leaid: string;
  target: number;
  renewal_target: number | null;
  winback_target: number | null;
  expansion_target: number | null;
  new_business_target: number | null;
};
```

Then find the SQL query that computes `target`:

```sql
SELECT district_leaid,
       COALESCE(renewal_target, 0)
         + COALESCE(winback_target, 0)
         + COALESCE(expansion_target, 0)
         + COALESCE(new_business_target, 0) AS target
FROM territory_plan_districts
WHERE plan_id = ${planId}
  AND district_leaid = ANY(${leaids})
```

Replace with:

```sql
SELECT district_leaid,
       COALESCE(renewal_target, 0)
         + COALESCE(winback_target, 0)
         + COALESCE(expansion_target, 0)
         + COALESCE(new_business_target, 0) AS target,
       renewal_target,
       winback_target,
       expansion_target,
       new_business_target
FROM territory_plan_districts
WHERE plan_id = ${planId}
  AND district_leaid = ANY(${leaids})
```

- [ ] **Step 1.2: Extend `DistrictEnrichmentEntry` interface**

Find `interface DistrictEnrichmentEntry` (around line 428). Add 4 fields after `target: number | null;`:

```ts
/** Individual target sub-fields for inline editing. NULL = not set. */
renewalTarget: number | null;
winbackTarget: number | null;
expansionTarget: number | null;
newBusinessTarget: number | null;
```

- [ ] **Step 1.3: Update `blank()` factory**

Find the `blank` function (returns a `DistrictEnrichmentEntry` with all nulls). Add the 4 new fields:

```ts
renewalTarget: null,
winbackTarget: null,
expansionTarget: null,
newBusinessTarget: null,
```

- [ ] **Step 1.4: Map the new fields in the `for (const r of targetRows)` loop**

Find this block (around line 597):

```ts
for (const r of targetRows) {
  const cur = byLeaid.get(r.district_leaid) ?? blank();
  cur.target = r.target == null ? null : Number(r.target);
  byLeaid.set(r.district_leaid, cur);
}
```

Replace with:

```ts
for (const r of targetRows) {
  const cur = byLeaid.get(r.district_leaid) ?? blank();
  cur.target = r.target == null ? null : Number(r.target);
  cur.renewalTarget = r.renewal_target == null ? null : Number(r.renewal_target);
  cur.winbackTarget = r.winback_target == null ? null : Number(r.winback_target);
  cur.expansionTarget = r.expansion_target == null ? null : Number(r.expansion_target);
  cur.newBusinessTarget = r.new_business_target == null ? null : Number(r.new_business_target);
  byLeaid.set(r.district_leaid, cur);
}
```

- [ ] **Step 1.5: Expose the fields in the row enrichment mapping**

Find the enrichment application block (around line 345–355). Look for the line `target: e?.target ?? null,` and add the 4 fields immediately after:

```ts
target: e?.target ?? null,
renewalTarget: e?.renewalTarget ?? null,
winbackTarget: e?.winbackTarget ?? null,
expansionTarget: e?.expansionTarget ?? null,
newBusinessTarget: e?.newBusinessTarget ?? null,
```

- [ ] **Step 1.6: Verify TypeScript compiles**

```bash
cd /Users/astonfurious/The\ Laboratory/territory-plan/.worktrees/feat/plan-inline-editing
npx tsc --noEmit 2>&1 | grep "views/data" | head -10
```

Expected: no errors from `route.ts`.

- [ ] **Step 1.7: Commit**

```bash
git add src/app/api/views/data/route.ts
git commit -m "feat(views): include individual target fields in district enrichment"
```

---

## Task 2: Add `["views","data"]` cache invalidation to `useUpdateDistrictTargets`

**Files:**
- Modify: `src/features/plans/lib/queries.ts`

After inline-editing a sub-target cell, the GridView target sum must re-fetch to reflect the new total.

- [ ] **Step 2.1: Find `onSettled` in `useUpdateDistrictTargets`**

Locate this block (around line 530):

```ts
onSettled: (_, _err, variables) => {
  // Background-refresh the single district detail (lightweight)
  queryClient.invalidateQueries({ queryKey: ["planDistrict", variables.planId, variables.leaid] });
  // Refresh dashboards that aggregate target data
  queryClient.invalidateQueries({ queryKey: ["teamProgress"] });
  queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
},
```

Add one line after `["leaderboard"]`:

```ts
queryClient.invalidateQueries({ queryKey: ["views", "data"] });
```

So the full `onSettled` becomes:

```ts
onSettled: (_, _err, variables) => {
  queryClient.invalidateQueries({ queryKey: ["planDistrict", variables.planId, variables.leaid] });
  queryClient.invalidateQueries({ queryKey: ["teamProgress"] });
  queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
  queryClient.invalidateQueries({ queryKey: ["views", "data"] });
},
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "plans/lib/queries" | head -5
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/features/plans/lib/queries.ts
git commit -m "feat(plans): invalidate views data cache after target update"
```

---

## Task 3: Build `TargetSubCell`

**Files:**
- Create: `src/features/views/components/grid/cells/TargetSubCell.tsx`
- Create: `src/features/views/components/grid/cells/__tests__/TargetSubCell.test.tsx`

`TargetSubCell` is an inline-editable cell: click to edit, blur/Enter autosaves, Escape cancels.

- [ ] **Step 3.1: Write the failing tests**

Create `src/features/views/components/grid/cells/__tests__/TargetSubCell.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TargetSubCell } from "../TargetSubCell";

const mockMutate = vi.fn();
vi.mock("@/features/plans/lib/queries", () => ({
  useUpdateDistrictTargets: () => ({ mutate: mockMutate, isPending: false }),
}));

const SIBLING_VALUES = {
  renewalTarget:     20000,
  expansionTarget:   5000,
  winbackTarget:     5000,
  newBusinessTarget: null,
};

const BASE = {
  planId: "1",
  leaid: "0601234",
  field: "renewalTarget" as const,
  value: 20000,
  siblingValues: SIBLING_VALUES,
};

describe("TargetSubCell", () => {
  beforeEach(() => mockMutate.mockReset());

  it("renders formatted value when not editing", () => {
    render(<TargetSubCell {...BASE} />);
    expect(screen.getByText("$20K")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders — when value is null", () => {
    render(<TargetSubCell {...BASE} value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("clicking enters edit mode with raw number pre-filled", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("20000");
  });

  it("blur fires mutation with updated field and calls with all sibling values", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "15000" } });
    fireEvent.blur(input);
    expect(mockMutate).toHaveBeenCalledWith({
      planId: "1",
      leaid: "0601234",
      renewalTarget:     15000,
      expansionTarget:   5000,
      winbackTarget:     5000,
      newBusinessTarget: null,
    });
  });

  it("Enter key fires mutation", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "10000" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ renewalTarget: 10000 })
    );
  });

  it("Escape cancels without firing mutation", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(mockMutate).not.toHaveBeenCalled();
    // Returns to display mode
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("empty input saves null (clears the field)", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ renewalTarget: null })
    );
  });
});
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
npx vitest run src/features/views/components/grid/cells/__tests__/TargetSubCell.test.tsx 2>&1 | tail -10
```

Expected: `FAIL` with "Cannot find module" or similar — component doesn't exist yet.

- [ ] **Step 3.3: Implement `TargetSubCell`**

Create `src/features/views/components/grid/cells/TargetSubCell.tsx`:

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { useUpdateDistrictTargets } from "@/features/plans/lib/queries";

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

function formatDisplay(v: number | null): string {
  if (v == null || v === 0) return "—";
  if (v >= 1_000_000) return `$${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

function parseInput(raw: string): number | null {
  const stripped = raw.replace(/[^0-9.]/g, "");
  if (!stripped) return null;
  const n = parseFloat(stripped);
  return Number.isFinite(n) ? n : null;
}

export function TargetSubCell({ planId, leaid, field, value, siblingValues }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useUpdateDistrictTargets();

  function enterEdit() {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
  }

  function commit() {
    const parsed = parseInput(draft);
    mutation.mutate({
      planId,
      leaid,
      ...siblingValues,
      [field]: parsed,
    });
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  // Auto-focus + select-all when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center justify-end">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          role="textbox"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full rounded border-b border-[#7C5CDB] bg-[#EDE8FF] px-1.5 py-0.5 text-right text-[12px] font-semibold text-[#1A1228] outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEdit}
      className={[
        "w-full rounded px-1.5 py-0.5 text-right text-[12px] font-semibold transition-colors",
        value != null && value !== 0
          ? "text-[#5B3FC8] hover:bg-[#EDE8FF]"
          : "text-[#C4B5D0] font-normal hover:bg-[#EDE8FF] hover:text-[#5B3FC8]",
      ].join(" ")}
    >
      {formatDisplay(value)}
    </button>
  );
}
```

- [ ] **Step 3.4: Run tests — confirm they pass**

```bash
npx vitest run src/features/views/components/grid/cells/__tests__/TargetSubCell.test.tsx 2>&1 | tail -10
```

Expected: `8 passed`.

- [ ] **Step 3.5: Commit**

```bash
git add src/features/views/components/grid/cells/TargetSubCell.tsx \
        src/features/views/components/grid/cells/__tests__/TargetSubCell.test.tsx
git commit -m "feat(views): add TargetSubCell inline-edit component"
```

---

## Task 4: Wire column expansion into `GridView`

**Files:**
- Modify: `src/features/views/components/grid/GridView.tsx`

This task adds the `targetExpanded` state, changes `tanCols` from `.map()` to `.flatMap()` to support dynamic column count, injects the ▶/◀ chevron buttons into appropriate headers, and fixes `colCount`.

- [ ] **Step 4.1: Add import for `TargetSubCell`**

At the top of `GridView.tsx`, alongside existing cell imports:

```tsx
import { TargetSubCell, type TargetField } from "./cells/TargetSubCell";
```

- [ ] **Step 4.2: Add `SUB_TARGET_IDS` constant at module scope**

Before `export default function GridView`, add:

```tsx
const SUB_TARGET_IDS = new Set([
  "renewalTarget",
  "expansionTarget",
  "winbackTarget",
  "newBusinessTarget",
]);
```

- [ ] **Step 4.3: Add `targetExpanded` state inside `GridView`**

Inside the `GridView` function body, alongside the other `useState` calls (selection, collapsedGroups, etc.):

```tsx
const [targetExpanded, setTargetExpanded] = useState(false);
```

- [ ] **Step 4.4: Change `tanCols` from `.map()` to `.flatMap()`**

The current `tanCols` begins:
```tsx
const tanCols: TanColumnDef<Record<string, unknown>>[] = useMemo(() =>
  visibleCols.map((c) => ({
    id: c.id,
    header: c.header,
    accessorKey: c.accessor,
    cell: (info) => {
```

Change to use `.flatMap()` and wrap the entire `return` in an array, then add the target-column expansion logic **before** the existing `cell` logic. The full new `tanCols`:

```tsx
const SUB_COLS = [
  { id: "renewalTarget",     label: "Renewal",   accessor: "renewalTarget"   },
  { id: "expansionTarget",   label: "Expansion", accessor: "expansionTarget" },
  { id: "winbackTarget",     label: "Win Back",  accessor: "winbackTarget"   },
  { id: "newBusinessTarget", label: "New Biz",   accessor: "newBusinessTarget"},
] as const;

const tanCols: TanColumnDef<Record<string, unknown>>[] = useMemo(
  () =>
    visibleCols.flatMap((c) => {
      // ── Target column: expand/collapse into 4 sub-columns ──────────────────
      if (c.id === "target") {
        if (!targetExpanded) {
          // Collapsed: single sum column (read-only — sum is computed, not editable)
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

        // Expanded: 4 inline-editable sub-columns
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
                value={typeof row[sub.accessor] === "number" ? row[sub.accessor] as number : null}
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
      }

      // ── All other columns — existing logic ──────────────────────────────────
      return [{
        id: c.id,
        header: c.header,
        accessorKey: c.accessor,
        cell: (info) => {
          const v = info.getValue();
          const row = info.row.original as Record<string, unknown>;
          const leaid = typeof row.leaid === "string" ? row.leaid : null;

          if (c.id === "customer_rank") {
            return <CustomerRankCell value={typeof v === "string" ? v : null} />;
          }
          if (c.id === "churn_risk" && leaid) {
            return (
              <ChurnRiskCell
                value={typeof v === "string" ? v : null}
                planId={planId}
                leaid={leaid}
                disabled={planId == null}
              />
            );
          }
          if (c.id === "plan_notes" && leaid) {
            return (
              <DistrictNotesCell
                leaid={leaid}
                districtName={typeof row.name === "string" ? row.name : leaid}
                latest={typeof row.notesLatest === "string" ? row.notesLatest : null}
                count={typeof row.notesCount === "number" ? row.notesCount : 0}
                latestType={typeof row.notesLatestType === "string" ? row.notesLatestType : null}
              />
            );
          }
          if (c.id === "note_type") {
            const t = typeof row.notesLatestType === "string" ? row.notesLatestType : null;
            return t
              ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${noteTypeMeta(t).pill}`}>{noteTypeMeta(t).label}</span>
              : <span className="text-[#A69DC0]">—</span>;
          }
          if (c.id === "name" && showRowActions && leaid) {
            return (
              <span className="flex items-center gap-2">
                <RowActionsMenu
                  planId={planId!}
                  leaid={leaid}
                  districtName={typeof v === "string" ? v : String(row.name ?? "")}
                />
                <span className="truncate">{formatCellValue(v, c.format)}</span>
              </span>
            );
          }
          if (v == null) return <span className="text-[#A69DC0]">—</span>;
          return <span>{formatCellValue(v, c.format)}</span>;
        },
      }];
    }),
  [visibleCols, planId, targetExpanded],
);
```

> **Important:** `targetExpanded` is added to the `useMemo` dependency array — when it changes, `tanCols` recomputes and TanStack Table re-renders with the new column set.

- [ ] **Step 4.5: Fix `colCount`**

Find:
```tsx
const colCount = visibleCols.length + 1 + (showRowActions ? 1 : 0);
```

Replace with:
```tsx
const colCount = tanCols.length + 1 + (showRowActions ? 1 : 0);
```

This keeps grouped-row `colSpan` and empty-state `colSpan` correct when 4 sub-columns replace 1 column.

- [ ] **Step 4.6: Inject chevron buttons into the header render loop**

Find the header `<th>` render loop (around line 829). It currently renders all headers via `<GridHeaderCell>`. Before it, the `colDef` lookup is:

```tsx
const colDef = SOURCE_COLUMNS[source].find((c) => c.id === h.column.id);
```

Inside the `<th>`, replace the `<GridHeaderCell ...>` call with a conditional:

```tsx
<th
  key={h.id}
  style={{ width: colWidth ? `${colWidth}px` : undefined, position: "relative" }}
  className={[
    "text-[10px] font-semibold uppercase tracking-[0.06em] py-2.5 px-3.5 border-b border-[#D4CFE2] whitespace-nowrap text-left",
    SUB_TARGET_IDS.has(colId) ? "text-[#5B3FC8] bg-[#F3EFFE]" : "text-[#8A80A8]",
  ].join(" ")}
>
  {colId === "target" ? (
    // Collapsed target header — show ▶ expand button
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Expand target breakdown"
        onClick={() => setTargetExpanded(true)}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#EFEDF5] text-[9px] text-[#7C5CDB] hover:bg-[#DDD5F5] transition-colors"
      >
        ▶
      </button>
      <span className="whitespace-nowrap">Target</span>
    </div>
  ) : colId === "renewalTarget" ? (
    // First sub-column header — show ◀ collapse button
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Collapse target breakdown"
        onClick={() => setTargetExpanded(false)}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#EFEDF5] text-[9px] text-[#7C5CDB] hover:bg-[#DDD5F5] transition-colors"
      >
        ◀
      </button>
      <span className="whitespace-nowrap">Renewal</span>
    </div>
  ) : SUB_TARGET_IDS.has(colId) ? (
    // Other sub-column headers — just the label, purple-tinted
    <span className="whitespace-nowrap">{colDef?.header ?? String(flexRender(h.column.columnDef.header, h.getContext()))}</span>
  ) : (
    // All other columns — existing GridHeaderCell with sort + resize
    <GridHeaderCell
      label={colDef?.header ?? String(flexRender(h.column.columnDef.header, h.getContext()))}
      sortable={colDef?.sortable ?? false}
      sortDir={sortDir}
      sortIndex={showIndex ? sortIndexInStack + 1 : undefined}
      onSortChange={(dir, shift) => handleSortChange(h.column.id, dir, shift)}
      width={colWidth}
      onWidthChange={(w) => {
        const allColIds = SOURCE_COLUMNS[source].map((c) => c.id);
        const merged = allColIds.map((id) => {
          const existing = layout.columns.find((c) => c.id === id);
          const def = SOURCE_COLUMNS[source].find((c) => c.id === id)!;
          const base = existing ?? { id, order: def.defaultOrder, visible: def.defaultVisible };
          return id === colId ? { ...base, width: w } : base;
        });
        setLayout({ ...layout, columns: merged });
      }}
    />
  )}
</th>
```

- [ ] **Step 4.7: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | grep "GridView\|TargetSubCell" | head -10
```

Expected: no errors.

- [ ] **Step 4.8: Run the full test suite**

```bash
npx vitest run --reporter=dot 2>&1 | tail -8
```

Expected: same pass/fail count as baseline — no new failures.

- [ ] **Step 4.9: Commit**

```bash
git add src/features/views/components/grid/GridView.tsx
git commit -m "feat(views): column expansion chevron for target breakdown inline editing"
```

---

## Task 5: Smoke test

- [ ] **Step 5.1: Start dev server in the worktree**

```bash
npm run dev -- --port 3005
```

- [ ] **Step 5.2: Open a plan in the Table view**

Navigate to the Views tab → open a plan → click the Table view tab. Confirm:

1. **Collapsed state:** TARGET column shows a formatted sum (e.g. `$30K`) with a small `▶` chevron to its left in the header. The header text is "TARGET".
2. **Expand:** Click `▶`. The TARGET column splits into 4 purple-tinted columns — Renewal, Expansion, Win Back, New Biz. The first (Renewal) shows a `◀` chevron. Right-side columns shift right.
3. **Sub-cell values:** Cells show `$20K`, `$5K`, etc. for set values; `—` for unset. Verify values match the expand-row panel for the same district.
4. **Inline edit:** Click a sub-cell. An input appears with the raw number (e.g. `20000`). Edit the value. Press Enter or click elsewhere — the cell saves and shows the new formatted value.
5. **Escape:** Click a sub-cell, start editing, press Escape — edit mode cancels without saving.
6. **Target sum refresh:** After saving a sub-cell, collapse the columns (click `◀`). The TARGET sum should refresh to reflect the new total.
7. **Collapse:** Click `◀`. Returns to single TARGET column.

- [ ] **Step 5.3: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(views): smoke test fixups for target column expansion"
```
