# Copilot Query → Districts on the Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Copilot answer's result contains district `leaid`s, the map isolates + zooms to exactly those districts and switches to the Map tab — no filter-building, no save, no confirm click.

**Architecture:** First revert the four (unpushed) filter-based map-view commits. Then: a pure helper turns an answer's result rows into a capped, de-duped leaid set + their state abbreviations; the existing Focus Map mechanism (generalized as a `focusDistricts` store action sharing `focusPlan`'s body) isolates + zooms; `CopilotPanel`'s `onComplete` handler calls it; the result table hides id columns so raw leaids never show; a system-prompt line tells the model to `SELECT leaid, name` for district questions.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Zustand (`useMapV2Store`), MapLibre, Vitest + Testing Library.

**Branch rule:** commits on `feat/ai-copilot-core-objects` must contain **no model identifiers** (no Claude co-author trailer / generated-with footer).

---

## File Structure

- **Revert** (Task 1): restores 12 files to base `5febaa89`, deletes 4 added files.
- `src/features/map/lib/state-bbox.ts` — **new**, pure `STATE_BBOX` constant extracted from `MapV2Container` so the always-mounted Copilot rail can compute bounds without pulling MapLibre.
- `src/features/reports/lib/result-columns.ts` — **new**, `isIdColumn` extracted from `ResultsTable.tsx` (shared by the reports table and the Copilot table).
- `src/features/copilot/lib/plot-districts.ts` — **new**, pure `extractDistrictLeaids` + `statesForLeaids` + `MAX_PLOTTED_DISTRICTS`.
- `src/features/map/lib/store.ts` — **modify**, add `focusDistricts` action + shared `buildFocusUpdate` helper.
- `src/features/copilot/components/CopilotPanel.tsx` — **modify**, auto-plot in `onComplete`; hide id columns in the result table.
- `src/features/copilot/lib/system-prompt.ts` — **modify**, add the `SELECT leaid` nudge.

---

## Task 1: Revert the filter-based map-view feature

**Files:** restores to base `5febaa89`; deletes 4 added files.

- [ ] **Step 1: Restore modified files to their pre-feature state**

```bash
cd /Users/sierraarcega/territory-plan/.claude/worktrees/feat+ai-copilot-core-objects
git checkout 5febaa89 -- \
  src/app/api/copilot/actions/execute/route.ts \
  src/app/api/copilot/chat/stream/route.ts \
  src/app/api/map-views/route.ts \
  src/features/copilot/components/CopilotPanel.tsx \
  src/features/copilot/hooks/useExecuteCopilotAction.ts \
  src/features/copilot/lib/__tests__/action-registry.test.ts \
  src/features/copilot/lib/action-registry.ts \
  src/features/copilot/lib/system-prompt.ts \
  src/features/copilot/lib/tools.ts \
  src/features/copilot/lib/types.ts \
  src/features/map/lib/map-view-queries.ts \
  src/features/map/lib/store.ts
```

- [ ] **Step 2: Delete the files the feature added**

```bash
git rm src/features/map/lib/__tests__/map-view-queries.test.ts \
       src/features/map/lib/__tests__/map-view-service.test.ts \
       src/features/map/lib/map-view-service.ts \
       src/features/map/lib/view-defaults.ts
```

- [ ] **Step 3: Verify the tree matches base for these paths**

Run: `git diff --stat 5febaa89 -- src/features/copilot src/features/map src/app/api/map-views src/app/api/copilot`
Expected: **no output** (working tree for those paths now equals base; only the staged revert remains).

- [ ] **Step 4: Typecheck + copilot/map tests pass at base state**

Run: `npx tsc --noEmit 2>&1 | grep -E "copilot|map/lib|map-view" || echo CLEAN`
Expected: `CLEAN`
Run: `npx vitest run src/features/copilot src/features/map/lib/__tests__/store 2>&1 | tail -5`
Expected: all pass (the map-view tests are gone; the `New chat` CopilotPanel test passes).

- [ ] **Step 5: Commit the revert**

```bash
git add -A src/features/copilot src/features/map src/app/api/map-views src/app/api/copilot
git commit -m "revert(copilot): remove filter-based map views in favor of query plotting"
```

---

## Task 2: Extract `STATE_BBOX` to a pure module

So the Copilot rail can compute bounds without importing the MapLibre-heavy `MapV2Container`.

**Files:**
- Create: `src/features/map/lib/state-bbox.ts`
- Modify: `src/features/map/components/MapV2Container.tsx` (move the const out, import it back)
- Modify: `src/features/map/components/panels/PlanOverviewSection.tsx:5` (import path)

- [ ] **Step 1: Create the pure module**

Cut the entire `export const STATE_BBOX: Record<string, [[number, number], [number, number]]> = { … };` object from `MapV2Container.tsx` (starts line 61) into a new file:

```ts
// src/features/map/lib/state-bbox.ts
/** Per-state camera bounding boxes [[west,south],[east,north]], keyed by USPS abbrev.
 *  Pure data — kept out of MapV2Container so non-map modules can compute bounds. */
export const STATE_BBOX: Record<string, [[number, number], [number, number]]> = {
  // …exact contents moved verbatim from MapV2Container…
};
```

- [ ] **Step 2: Re-import it in `MapV2Container.tsx`**

Replace the removed declaration with an import at the top of `MapV2Container.tsx`:

```ts
import { STATE_BBOX } from "@/features/map/lib/state-bbox";
```

Keep MapV2Container's own `export { STATE_BBOX }`? No — update the one external importer instead (next step).

- [ ] **Step 3: Update `PlanOverviewSection.tsx` import**

Change `src/features/map/components/panels/PlanOverviewSection.tsx:5` from
`import { STATE_BBOX } from "@/features/map/components/MapV2Container";`
to
`import { STATE_BBOX } from "@/features/map/lib/state-bbox";`

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "state-bbox|MapV2Container|PlanOverviewSection" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 5: Commit**

```bash
git add src/features/map/lib/state-bbox.ts src/features/map/components/MapV2Container.tsx src/features/map/components/panels/PlanOverviewSection.tsx
git commit -m "refactor(map): extract STATE_BBOX to a pure module"
```

---

## Task 3: Extract `isIdColumn` to a shared util

**Files:**
- Create: `src/features/reports/lib/result-columns.ts`
- Modify: `src/features/reports/components/ResultsTable.tsx` (remove local fn, import shared)
- Test: `src/features/reports/lib/__tests__/result-columns.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/reports/lib/__tests__/result-columns.test.ts
import { describe, it, expect } from "vitest";
import { isIdColumn } from "../result-columns";

describe("isIdColumn", () => {
  it("flags id-like columns", () => {
    expect(isIdColumn("leaid")).toBe(true);
    expect(isIdColumn("district_id")).toBe(true);
    expect(isIdColumn("id")).toBe(true);
    expect(isIdColumn("uuid")).toBe(true);
  });
  it("does not flag normal columns", () => {
    expect(isIdColumn("name")).toBe(false);
    expect(isIdColumn("enrollment")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — fails (module missing)**

Run: `npx vitest run src/features/reports/lib/__tests__/result-columns.test.ts`
Expected: FAIL — cannot find `../result-columns`.

- [ ] **Step 3: Create the shared module** (move the body of `isIdColumn` out of `ResultsTable.tsx` verbatim)

```ts
// src/features/reports/lib/result-columns.ts
import { TABLE_REGISTRY } from "@/lib/district-column-metadata";

/** True for columns that are internal identifiers (leaid, *_id, uuid, or a
 *  registry column whose format is "id"). Hidden from rep-facing result tables. */
export function isIdColumn(columnName: string): boolean {
  for (const tbl of Object.values(TABLE_REGISTRY)) {
    const match = tbl.columns.find((c) => c.column === columnName);
    if (match && (match.format as string) === "id") return true;
  }
  return /^(id|leaid|.*_id|uuid)$/i.test(columnName);
}
```

- [ ] **Step 4: Update `ResultsTable.tsx`** — delete the local `isIdColumn` (lines ~14-21) and its now-unused `TABLE_REGISTRY` import if nothing else uses it; add:

```ts
import { isIdColumn } from "../lib/result-columns";
```

(Check whether `TABLE_REGISTRY` is referenced elsewhere in the file before removing its import.)

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/features/reports/lib/__tests__/result-columns.test.ts`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -E "result-columns|ResultsTable" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/lib/result-columns.ts src/features/reports/lib/__tests__/result-columns.test.ts src/features/reports/components/ResultsTable.tsx
git commit -m "refactor(reports): extract isIdColumn to a shared util"
```

---

## Task 4: `focusDistricts` store action (DRY with `focusPlan`)

**Files:**
- Modify: `src/features/map/lib/store.ts` (extract `buildFocusUpdate`; add `focusDistricts`; add to the actions interface)
- Test: `src/features/map/lib/__tests__/focus-districts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/map/lib/__tests__/focus-districts.test.ts
import { describe, it, expect } from "vitest";
import { useMapV2Store, COPILOT_FOCUS_ID } from "../store";

describe("focusDistricts", () => {
  it("isolates to the given districts, stashes filters, queues bounds, and restores on exit", () => {
    const store = useMapV2Store.getState();
    useMapV2Store.setState({ filterStates: ["CA"], filterOwner: "rep-1" });

    store.focusDistricts(["1900001", "1900002"], ["IA"], [[-96, 40], [-90, 44]]);
    const s = useMapV2Store.getState();
    expect(s.focusLeaids).toEqual(["1900001", "1900002"]);
    expect(s.filterStates).toEqual(["IA"]);
    expect(s.focusPlanId).toBe(COPILOT_FOCUS_ID);
    expect(s.pendingFitBounds).toEqual([[-96, 40], [-90, 44]]);
    expect(s.preFocusFilters?.filterStates).toEqual(["CA"]);
    expect(s.preFocusFilters?.filterOwner).toBe("rep-1");

    useMapV2Store.getState().unfocusPlan();
    const after = useMapV2Store.getState();
    expect(after.focusLeaids).toEqual([]);
    expect(after.filterStates).toEqual(["CA"]);
    expect(after.filterOwner).toBe("rep-1");
  });
});
```

- [ ] **Step 2: Run it — fails (`focusDistricts`/`COPILOT_FOCUS_ID` undefined)**

Run: `npx vitest run src/features/map/lib/__tests__/focus-districts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Refactor `focusPlan` to share a builder, add `focusDistricts`**

In `store.ts`, above the store, add a sentinel + a module-level builder that returns the focus state partial (its body is the exact object `focusPlan` currently sets):

```ts
/** Sentinel focusPlanId for a Copilot query-driven focus (matches no real plan,
 *  so the exit-focus control in MapV2Shell still shows and unfocusPlan restores). */
export const COPILOT_FOCUS_ID = "__copilot_query__";

function buildFocusUpdate(
  s: MapV2State,
  focusId: string,
  stateAbbrevs: string[],
  leaids: string[],
  bounds: [[number, number], [number, number]] | null,
) {
  return {
    focusPlanId: focusId,
    focusLeaids: leaids,
    preFocusFilters: {
      filterStates: s.filterStates,
      filterPlanId: s.filterPlanId,
      filterOwner: s.filterOwner,
      filterAccountTypes: s.filterAccountTypes,
      fullmindEngagement: s.fullmindEngagement,
      competitorEngagement: s.competitorEngagement,
    },
    filterStates: stateAbbrevs,
    filterOwner: null,
    filterAccountTypes: [],
    fullmindEngagement: [
      "new_business_pipeline",
      "winback_pipeline",
      "renewal_pipeline",
      "expansion_pipeline",
      "first_year",
      "multi_year_growing",
      "multi_year_flat",
      "multi_year_shrinking",
      "lapsed",
    ],
    competitorEngagement: {},
    pendingFitBounds: bounds,
  };
}
```

Replace the existing `focusPlan` body with:

```ts
  focusPlan: (planId, stateAbbrevs, leaids, bounds) =>
    set((s) => buildFocusUpdate(s, planId, stateAbbrevs, leaids, bounds)),
  focusDistricts: (leaids, stateAbbrevs, bounds) =>
    set((s) => buildFocusUpdate(s, COPILOT_FOCUS_ID, stateAbbrevs, leaids, bounds)),
```

Add to the actions interface (near `focusPlan`'s type, ~line 384):

```ts
  focusDistricts: (
    leaids: string[],
    stateAbbrevs: string[],
    bounds: [[number, number], [number, number]] | null,
  ) => void;
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/features/map/lib/__tests__/focus-districts.test.ts`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -E "store.ts" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 5: Commit**

```bash
git add src/features/map/lib/store.ts src/features/map/lib/__tests__/focus-districts.test.ts
git commit -m "feat(map): focusDistricts store action for query-driven map focus"
```

---

## Task 5: `plot-districts` pure helper

**Files:**
- Create: `src/features/copilot/lib/plot-districts.ts`
- Test: `src/features/copilot/lib/__tests__/plot-districts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/copilot/lib/__tests__/plot-districts.test.ts
import { describe, it, expect } from "vitest";
import { extractDistrictLeaids, statesForLeaids, MAX_PLOTTED_DISTRICTS } from "../plot-districts";

describe("extractDistrictLeaids", () => {
  it("returns [] when no leaid column", () => {
    expect(extractDistrictLeaids(["name"], [{ name: "X" }])).toEqual({ leaids: [], truncated: false });
  });
  it("dedupes leaids from rows", () => {
    const r = extractDistrictLeaids(["leaid", "name"], [
      { leaid: "1900001", name: "A" },
      { leaid: "1900001", name: "A" },
      { leaid: "1900002", name: "B" },
    ]);
    expect(r.leaids).toEqual(["1900001", "1900002"]);
    expect(r.truncated).toBe(false);
  });
  it("caps at MAX_PLOTTED_DISTRICTS and marks truncated", () => {
    const rows = Array.from({ length: MAX_PLOTTED_DISTRICTS + 5 }, (_, i) => ({
      leaid: String(1900000 + i),
    }));
    const r = extractDistrictLeaids(["leaid"], rows);
    expect(r.leaids).toHaveLength(MAX_PLOTTED_DISTRICTS);
    expect(r.truncated).toBe(true);
  });
});

describe("statesForLeaids", () => {
  it("maps leading FIPS to distinct state abbrevs", () => {
    expect(statesForLeaids(["1900001", "1900002", "0600003"]).sort()).toEqual(["CA", "IA"]);
  });
});
```

- [ ] **Step 2: Run it — fails (module missing)**

Run: `npx vitest run src/features/copilot/lib/__tests__/plot-districts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/features/copilot/lib/plot-districts.ts
import { fipsToAbbrev } from "@/lib/states";

/** Max districts to plot from one answer (keeps the MapLibre `in` filter + the
 *  camera fit cheap; the chat warns when the result is larger). */
export const MAX_PLOTTED_DISTRICTS = 200;

/** Pull distinct district leaids out of an answer's result rows, capped. */
export function extractDistrictLeaids(
  columns: string[],
  rows: Array<Record<string, unknown>>,
): { leaids: string[]; truncated: boolean } {
  if (!columns.includes("leaid")) return { leaids: [], truncated: false };
  const all = [
    ...new Set(
      rows
        .map((r) => r.leaid)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];
  return {
    leaids: all.slice(0, MAX_PLOTTED_DISTRICTS),
    truncated: all.length > MAX_PLOTTED_DISTRICTS,
  };
}

/** Distinct USPS state abbrevs for a set of leaids (first 2 chars = FIPS). */
export function statesForLeaids(leaids: string[]): string[] {
  return [
    ...new Set(
      leaids
        .map((l) => fipsToAbbrev(l.slice(0, 2)))
        .filter((a): a is string => !!a),
    ),
  ];
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/features/copilot/lib/__tests__/plot-districts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/lib/plot-districts.ts src/features/copilot/lib/__tests__/plot-districts.test.ts
git commit -m "feat(copilot): pure helper to extract plottable district leaids from a result"
```

---

## Task 6: Wire auto-plot + hide id columns in `CopilotPanel`

**Files:** Modify `src/features/copilot/components/CopilotPanel.tsx`

- [ ] **Step 1: Add imports** (top of file, with the other feature imports)

```ts
import { useMapV2Store } from "@/features/map/lib/store";
import { boundsForLeaids } from "@/features/map/lib/views-plan-bounds";
import { STATE_BBOX } from "@/features/map/lib/state-bbox";
import { extractDistrictLeaids, statesForLeaids } from "@/features/copilot/lib/plot-districts";
import { isIdColumn } from "@/features/reports/lib/result-columns";
```

- [ ] **Step 2: Subscribe to the store actions** (next to `const open = useMapStore(...)`)

```ts
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const focusDistricts = useMapV2Store((s) => s.focusDistricts);
```

- [ ] **Step 3: Plot in `onComplete`** — replace the existing `onComplete` (CopilotPanel.tsx ~178-183) with:

```ts
        onComplete: (res) => {
          setConversationId(res.conversationId);
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? applyResult(msg, res) : msg)),
          );
          // If the answer carries district leaids, show them on the map.
          if (res.kind === "answer") {
            const { leaids, truncated } = extractDistrictLeaids(
              res.result.columns,
              res.result.rows,
            );
            if (leaids.length > 0) {
              focusDistricts(leaids, statesForLeaids(leaids), boundsForLeaids(leaids, STATE_BBOX));
              setActiveTab("map");
              if (truncated) {
                setMessages((m) => [
                  ...m,
                  {
                    id: uid(),
                    role: "assistant",
                    text: `Showing the first ${leaids.length} on the map.`,
                  },
                ]);
              }
            }
          }
        },
```

- [ ] **Step 4: Add the new deps to `handleSend`'s dependency array**

Change `}, [input, stream, conversationId, getPageContext, applyResult]);` to
`}, [input, stream, conversationId, getPageContext, applyResult, focusDistricts, setActiveTab]);`

- [ ] **Step 5: Hide id columns in the result table** — in the answer-table render block (~449-483), compute visible columns once and iterate those instead of `answer.columns`:

```tsx
  const visibleColumns = answer.columns.filter((c) => !isIdColumn(c));
  if (visibleColumns.length === 0) {
    // existing empty-state branch (was `answer.columns.length === 0`)
  }
  // header: visibleColumns.map(...)   row cells: visibleColumns.map(...)
```

Replace the two `answer.columns.map(...)` usages (header + cells) and the `answer.columns.length === 0` guard with `visibleColumns`.

- [ ] **Step 6: Typecheck + existing CopilotPanel test**

Run: `npx tsc --noEmit 2>&1 | grep -E "CopilotPanel" || echo CLEAN`
Expected: `CLEAN`
Run: `npx vitest run src/features/copilot/components/__tests__/CopilotPanel.test.tsx`
Expected: PASS (the `New chat` test doesn't hit `onComplete`).

- [ ] **Step 7: Commit**

```bash
git add src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): plot answer districts on the map and hide id columns in results"
```

---

## Task 7: System-prompt nudge

**Files:** Modify `src/features/copilot/lib/system-prompt.ts`

- [ ] **Step 1: Add the guidance** — in `COPILOT_PREAMBLE`, under the answer-rail / `run_sql` guidance, add:

```
## Showing districts on the map
When the rep wants to SEE / FIND / SHOW / MAP a set of districts (not just a count or a single value), include \`leaid\` and \`name\` in the \`SELECT\` (alongside any metrics they asked about). When the result has a \`leaid\` column the app automatically highlights and zooms the map to exactly those districts — regardless of the map's current filters. The leaid drives the map; NEVER print or describe a leaid to the rep.
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "system-prompt" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 3: Commit**

```bash
git add src/features/copilot/lib/system-prompt.ts
git commit -m "feat(copilot): prompt the model to SELECT leaid so district answers plot on the map"
```

---

## Task 8: Full verification

- [ ] **Step 1: Whole suite + typecheck + lint**

Run: `npx vitest run src/features/copilot src/features/map src/features/reports/lib 2>&1 | tail -6`
Expected: all pass.
Run: `npx tsc --noEmit 2>&1 | grep -E "copilot|map/lib|state-bbox|result-columns|plot-districts" || echo CLEAN`
Expected: `CLEAN`.
Run: `npx eslint src/features/copilot/lib/plot-districts.ts src/features/map/lib/state-bbox.ts src/features/reports/lib/result-columns.ts src/features/copilot/components/CopilotPanel.tsx src/features/map/lib/store.ts` → exit 0.

- [ ] **Step 2: Manual E2E** (dev server already on :3005; refresh the tab)

  1. Map tab → open Copilot → ask *"show me the districts in my plan"* (or any district-returning question). Expect: chat lists them (name + fields, **no leaid/id column**); map switches to Map tab and zooms/highlights exactly those districts; exit-focus control restores prior filters.
  2. Ask a non-district question (*"how many activities did I log this month?"*). Expect: table/answer only, **map unchanged**.
  3. Ask something matching > 200 districts. Expect: chat note "Showing the first 200 on the map"; map plots 200.

---

## Self-Review

- **Spec coverage:** remove (T1) ✓; `focusDistricts`/Focus Map reuse (T4) ✓; auto-plot + cap (T5, T6) ✓; hide ids (T3, T6) ✓; prompt nudge (T7) ✓; tests (T3–T6, T8) ✓; STATE_BBOX-into-rail risk handled by extraction (T2) ✓.
- **Placeholders:** none — every code step has full code; the only "verbatim move" steps (STATE_BBOX, isIdColumn body) move existing, known code.
- **Type consistency:** `focusDistricts(leaids, stateAbbrevs, bounds)` signature matches its call in Task 6; `extractDistrictLeaids`/`statesForLeaids`/`MAX_PLOTTED_DISTRICTS`/`COPILOT_FOCUS_ID` names match across tasks; `boundsForLeaids(leaids, STATE_BBOX)` returns `Bbox | null`, accepted by `focusDistricts`'s `bounds` param and `pendingFitBounds`.
