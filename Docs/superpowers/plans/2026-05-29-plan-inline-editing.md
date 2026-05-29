# Plan District Inline Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click target breakdown popover to the district Target cell in the plan Table view (GridView), so reps can edit renewal/expansion/winback/new-biz targets without expanding the row panel.

**Architecture:** `TargetBreakdownPopover` is a new plan-scoped component wired into the existing `GridView` cell renderer alongside the already-wired `ChurnRiskCell`. The views data route is extended to carry the 4 individual target fields (currently only the sum is returned). `useUpdateDistrictTargets` gains a `["views","data"]` cache invalidation so the sum refreshes after save.

**Tech Stack:** React 19, TypeScript, Tailwind 4, TanStack Query v5, Vitest + Testing Library, Next.js App Router API routes, Prisma raw SQL.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/features/plans/components/TargetBreakdownPopover.tsx` | Popover with 4 currency inputs + live total + Save/Cancel |
| Create | `src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx` | Unit tests |
| Modify | `src/app/api/views/data/route.ts` | Add 4 individual target fields to `TargetRow` SQL + `DistrictEnrichmentEntry` |
| Modify | `src/features/plans/lib/queries.ts` | Add `["views","data"]` invalidation to `useUpdateDistrictTargets.onSettled` |
| Modify | `src/features/views/components/grid/GridView.tsx` | Add `c.id === "target"` cell case wiring `TargetBreakdownPopover` |

---

## Task 1: Extend views data route — include individual target fields

**Files:**
- Modify: `src/app/api/views/data/route.ts`

The `fetchDistrictPlanEnrichment` function currently fetches only the sum (`target`). We need the 4 sub-fields so the popover can pre-fill each input.

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

Then find the SQL query:

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
/** Individual target sub-fields for the breakdown popover. NULL = not set. */
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

Find the enrichment application block (around line 345–355). It currently spreads `e` into the row. Look for the line `target: e?.target ?? null,` and add the 4 fields immediately after:

```ts
target: e?.target ?? null,
renewalTarget: e?.renewalTarget ?? null,
winbackTarget: e?.winbackTarget ?? null,
expansionTarget: e?.expansionTarget ?? null,
newBusinessTarget: e?.newBusinessTarget ?? null,
```

- [ ] **Step 1.6: Verify TypeScript compiles**

```bash
cd .worktrees/feat/plan-inline-editing
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

After saving from the popover, the GridView target sum cell must re-fetch to reflect the new total.

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

## Task 3: Build `TargetBreakdownPopover`

**Files:**
- Create: `src/features/plans/components/TargetBreakdownPopover.tsx`
- Create: `src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx`

- [ ] **Step 3.1: Write the failing tests**

Create `src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TargetBreakdownPopover } from "../TargetBreakdownPopover";

const mockMutate = vi.fn();
vi.mock("@/features/plans/lib/queries", () => ({
  useUpdateDistrictTargets: () => ({ mutate: mockMutate, isPending: false }),
}));

const BASE = {
  planId: "1",
  leaid: "0601234",
  renewal: 20000,
  expansion: 5000,
  winback: 5000,
  newBusiness: null,
  onClose: vi.fn(),
};

describe("TargetBreakdownPopover", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    BASE.onClose = vi.fn();
  });

  it("renders 4 inputs pre-filled with prop values", () => {
    render(<TargetBreakdownPopover {...BASE} />);
    expect(screen.getByDisplayValue("20,000")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("5,000")).toHaveLength(2);
    // newBusiness is null → empty string
    const inputs = screen.getAllByRole("textbox");
    expect(inputs[3]).toHaveValue("");
  });

  it("live total updates as a field changes", () => {
    render(<TargetBreakdownPopover {...BASE} />);
    // Initial total: 20000 + 5000 + 5000 + 0 = 30000
    expect(screen.getByText("$30,000")).toBeInTheDocument();
    const renewalInput = screen.getByDisplayValue("20,000");
    fireEvent.change(renewalInput, { target: { value: "10000" } });
    expect(screen.getByText("$20,000")).toBeInTheDocument();
  });

  it("Save fires mutation with all 4 fields and calls onClose", () => {
    render(<TargetBreakdownPopover {...BASE} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(mockMutate).toHaveBeenCalledWith({
      planId: "1",
      leaid: "0601234",
      renewalTarget: 20000,
      expansionTarget: 5000,
      winbackTarget: 5000,
      newBusinessTarget: null,
    });
    expect(BASE.onClose).toHaveBeenCalled();
  });

  it("Cancel calls onClose without mutating", () => {
    render(<TargetBreakdownPopover {...BASE} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(BASE.onClose).toHaveBeenCalled();
  });

  it("Escape key calls onClose without mutating", () => {
    render(<TargetBreakdownPopover {...BASE} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockMutate).not.toHaveBeenCalled();
    expect(BASE.onClose).toHaveBeenCalled();
  });

  it("click-outside calls onClose without mutating", () => {
    render(<TargetBreakdownPopover {...BASE} />);
    fireEvent.mouseDown(document.body);
    expect(mockMutate).not.toHaveBeenCalled();
    expect(BASE.onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
npx vitest run src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx 2>&1 | tail -10
```

Expected: `FAIL` with "Cannot find module" or similar — component doesn't exist yet.

- [ ] **Step 3.3: Implement `TargetBreakdownPopover`**

Create `src/features/plans/components/TargetBreakdownPopover.tsx`:

```tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useUpdateDistrictTargets } from "@/features/plans/lib/queries";

interface Props {
  planId: string;
  leaid: string;
  renewal: number | null;
  expansion: number | null;
  winback: number | null;
  newBusiness: number | null;
  onClose: () => void;
}

type FieldKey = "renewal" | "expansion" | "winback" | "newBusiness";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "renewal",     label: "Renewal"   },
  { key: "expansion",   label: "Expansion" },
  { key: "winback",     label: "Win Back"  },
  { key: "newBusiness", label: "New Biz"   },
];

function toDisplayString(val: number | null): string {
  if (val == null || val === 0) return "";
  return val.toLocaleString("en-US");
}

function parseField(raw: string): number | null {
  const stripped = raw.replace(/[^0-9.]/g, "");
  if (!stripped) return null;
  const n = parseFloat(stripped);
  return Number.isFinite(n) ? n : null;
}

export function TargetBreakdownPopover({
  planId, leaid, renewal, expansion, winback, newBusiness, onClose,
}: Props) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    renewal:     toDisplayString(renewal),
    expansion:   toDisplayString(expansion),
    winback:     toDisplayString(winback),
    newBusiness: toDisplayString(newBusiness),
  });
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mutation = useUpdateDistrictTargets();

  // Flip upward if near viewport bottom
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 200) setOpenUpward(true);
    }
  }, []);

  // Click-outside → discard
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  // Escape → discard
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const total = FIELDS
    .map(({ key }) => parseField(values[key]) ?? 0)
    .reduce((a, b) => a + b, 0);

  function handleSave() {
    mutation.mutate({
      planId,
      leaid,
      renewalTarget:     parseField(values.renewal),
      expansionTarget:   parseField(values.expansion),
      winbackTarget:     parseField(values.winback),
      newBusinessTarget: parseField(values.newBusiness),
    });
    onClose();
  }

  return (
    <div
      ref={containerRef}
      className={[
        "absolute z-20 w-56 rounded-xl border border-[#C4B5D8] bg-white p-3 shadow-[0_8px_28px_rgba(45,31,94,0.18)]",
        openUpward ? "bottom-full mb-1" : "top-full mt-1",
        "left-0",
      ].join(" ")}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#9B8FC0]">
        Targets
      </p>

      {FIELDS.map(({ key, label }) => (
        <div key={key} className="mb-1.5 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap text-xs text-[#4A3770]">{label}</span>
          <div className="flex items-center rounded border border-[#D4CCE8] bg-[#FAFAF8] px-2 py-1 focus-within:border-[#7C5CDB] focus-within:bg-white transition-colors">
            <span className="text-xs text-[#9B8FC0]">$</span>
            <input
              type="text"
              inputMode="numeric"
              className="w-20 bg-transparent text-right text-xs font-semibold text-[#1A1228] outline-none"
              value={values[key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [key]: e.target.value }))
              }
            />
          </div>
        </div>
      ))}

      <div className="mt-2 flex items-center justify-between border-t border-[#EFEDF5] pt-2">
        <span className="text-xs font-semibold text-[#6B5FA0]">Total</span>
        <span className="text-sm font-bold text-[#1A1228]">
          ${total.toLocaleString("en-US")}
        </span>
      </div>

      <div className="mt-2 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-[#EFEDF5] px-2.5 py-1 text-xs font-semibold text-[#6B5FA0] hover:bg-[#E0DBF0] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={mutation.isPending}
          className="rounded bg-[#5B3FC8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4A31A8] disabled:opacity-50 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.4: Run tests — confirm they pass**

```bash
npx vitest run src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx 2>&1 | tail -10
```

Expected: `6 passed`.

- [ ] **Step 3.5: Commit**

```bash
git add src/features/plans/components/TargetBreakdownPopover.tsx \
        src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx
git commit -m "feat(plans): add TargetBreakdownPopover component"
```

---

## Task 4: Wire `TargetBreakdownPopover` into `GridView`

**Files:**
- Modify: `src/features/views/components/grid/GridView.tsx`

- [ ] **Step 4.1: Add the import**

At the top of `GridView.tsx`, alongside existing cell imports, add:

```tsx
import { TargetBreakdownPopover } from "@/features/plans/components/TargetBreakdownPopover";
```

- [ ] **Step 4.2: Add a `TargetCell` helper at module scope**

`TargetCell` uses `useState` so it must be a proper component defined at **module scope** (outside `GridView`'s function body — React forbids defining components with hooks inside other component bodies). Add it just before the `export default function GridView` line:

```tsx
/** Wrapper that manages open/closed state for the target breakdown popover. */
function TargetCell({
  planId,
  leaid,
  row,
}: {
  planId: string;
  leaid: string;
  row: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const total = typeof row.target === "number" ? row.target : null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-1.5 py-0.5 text-xs font-semibold text-[#1A1228] hover:bg-[#EDE8FF] hover:text-[#5B3FC8] transition-colors"
      >
        {total != null && total > 0
          ? `$${total >= 1000 ? `${Math.round(total / 1000)}K` : total}`
          : <span className="text-[#A69DC0] italic text-[10px]">Not set</span>
        }
      </button>
      {open && (
        <TargetBreakdownPopover
          planId={planId}
          leaid={leaid}
          renewal={typeof row.renewalTarget === "number" ? row.renewalTarget : null}
          expansion={typeof row.expansionTarget === "number" ? row.expansionTarget : null}
          winback={typeof row.winbackTarget === "number" ? row.winbackTarget : null}
          newBusiness={typeof row.newBusinessTarget === "number" ? row.newBusinessTarget : null}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
```

> **Why module scope:** Defining a component that calls `useState` inside another component body causes a React error ("rendered more hooks than during the previous render"). Module scope is stable and correct here.

- [ ] **Step 4.3: Add the `target` case to the cell renderer**

In the `cell` callback inside `tanCols`, find the `churn_risk` block:

```tsx
if (c.id === "churn_risk" && leaid) {
  return (
    <ChurnRiskCell ... />
  );
}
```

Add directly after it:

```tsx
if (c.id === "target" && planId != null && leaid) {
  return <TargetCell planId={planId} leaid={leaid} row={row} />;
}
```

- [ ] **Step 4.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "GridView\|TargetBreakdownPopover" | head -10
```

Expected: no errors.

- [ ] **Step 4.5: Run the full test suite**

```bash
npx vitest run --reporter=dot 2>&1 | tail -8
```

Expected: same pass/fail count as baseline (3267 passed, 3 pre-existing failures). No new failures.

- [ ] **Step 4.6: Commit**

```bash
git add src/features/views/components/grid/GridView.tsx
git commit -m "feat(views): wire TargetBreakdownPopover into GridView target cell"
```

---

## Task 5: Smoke test

- [ ] **Step 5.1: Start dev server in the worktree**

```bash
npm run dev -- --port 3005
```

- [ ] **Step 5.2: Open a plan in the Table view**

Navigate to the Views tab → open a plan → click the Table view tab. Confirm:
- Rows with a target set show a clickable chip (e.g. `$30K`)
- Rows with no target show `Not set` in italic
- Clicking the chip opens the breakdown popover
- The 4 fields are pre-filled with correct values (verify against the expand-row panel on the same district)
- Editing a field updates the live total
- Clicking Save dismisses the popover and the target cell refreshes to the new total
- Clicking Cancel/Escape discards changes

- [ ] **Step 5.3: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(plans): smoke test fixups for target breakdown popover"
```
