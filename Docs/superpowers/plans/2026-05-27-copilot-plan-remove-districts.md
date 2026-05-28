# Copilot `plan.remove_districts` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Copilot `plan.remove_districts` action so a rep can say "remove these / all districts from my plan" in chat, gated behind the standard propose → confirm → execute flow.

**Architecture:** A lean `removeDistrictsFromPlan` service mirrors the existing `addDistrictsToPlan`; a new `plan.remove_districts` entry in the copilot action registry calls it inside the execute transaction; a system-prompt catalog entry teaches the model to use it (incl. "remove all" = look up membership then list); the confirm card's already-plumbed `destructive` flag gets a red Confirm button.

**Tech Stack:** TypeScript, Next.js App Router, Prisma, Zod, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-27-copilot-plan-remove-districts-design.md`

**Working dir:** the worktree `/Users/sierraarcega/territory-plan/.claude/worktrees/feat+ai-copilot-core-objects` (run all commands from there).

---

### Task 1: `removeDistrictsFromPlan` service (TDD)

**Files:**
- Modify: `src/features/plans/lib/__tests__/service.test.ts`
- Modify: `src/features/plans/lib/service.ts` (append after `addDistrictsToPlan`, ends line 165)

- [ ] **Step 1: Extend the test mock + import, then write the failing tests**

In `service.test.ts`, add `deleteMany` to the `territoryPlanDistrict` mock (line 6) so it reads:

```ts
    territoryPlanDistrict: { createMany: vi.fn(), deleteMany: vi.fn() },
```

Change the import (line 15) to include the new function:

```ts
import { createPlan, updatePlan, addDistrictsToPlan, removeDistrictsFromPlan } from "../service";
```

Append this describe block to the end of the file:

```ts
describe("removeDistrictsFromPlan", () => {
  it("rejects an empty district list", async () => {
    await expect(removeDistrictsFromPlan("plan-1", [])).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(removeDistrictsFromPlan("plan-x", ["0601234"])).rejects.toMatchObject({ status: 404 });
    expect(mockPrisma.territoryPlanDistrict.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the matching junction rows and returns the removed count", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.territoryPlanDistrict.deleteMany.mockResolvedValue({ count: 2 });
    const result = await removeDistrictsFromPlan("plan-1", ["0601234", "4800001"]);
    expect(result).toEqual({ removed: 2, planId: "plan-1" });
    const arg = mockPrisma.territoryPlanDistrict.deleteMany.mock.calls[0][0];
    expect(arg.where).toEqual({ planId: "plan-1", districtLeaid: { in: ["0601234", "4800001"] } });
  });

  it("no-ops (removed: 0) when no leaid is a member", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.territoryPlanDistrict.deleteMany.mockResolvedValue({ count: 0 });
    const result = await removeDistrictsFromPlan("plan-1", ["ghost"]);
    expect(result.removed).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/plans/lib/__tests__/service.test.ts`
Expected: FAIL — `removeDistrictsFromPlan` is not exported (import error / undefined).

- [ ] **Step 3: Implement `removeDistrictsFromPlan`**

Append to `src/features/plans/lib/service.ts` (after `addDistrictsToPlan`, the last function):

```ts
/**
 * Remove districts from a plan (the plan↔district junction) — the counterpart to
 * addDistrictsToPlan. Validates the plan, then deletes the junction rows for the
 * given leaids; removing a leaid that isn't in the plan is a harmless no-op.
 * Lean and transaction-safe like the add core: no inline rollup/tag sync —
 * districtCount + target rollups self-heal from current membership on the plan's
 * next GET. Junction target-service rows clear via the existing onDelete: Cascade.
 */
export async function removeDistrictsFromPlan(
  planId: string,
  leaids: string[],
  db: DbClient = prisma,
): Promise<{ removed: number; planId: string }> {
  if (!Array.isArray(leaids) || leaids.length === 0) {
    throw new ServiceError("provide at least one district", 400);
  }

  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ServiceError("Territory plan not found", 404);
  }

  const result = await db.territoryPlanDistrict.deleteMany({
    where: { planId, districtLeaid: { in: leaids } },
  });
  return { removed: result.count, planId };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/plans/lib/__tests__/service.test.ts`
Expected: PASS — all `removeDistrictsFromPlan` tests green (plus the existing create/update/add tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/plans/lib/service.ts src/features/plans/lib/__tests__/service.test.ts
git commit -m "feat(plans): removeDistrictsFromPlan service (counterpart to add)"
```

---

### Task 2: `plan.remove_districts` copilot action (TDD)

**Files:**
- Modify: `src/features/copilot/lib/__tests__/action-registry.test.ts` (inside the `describe("plan actions", …)` block, before its closing `});` at line ~250)
- Modify: `src/features/copilot/lib/types.ts:13` (the `CopilotOperation` union)
- Modify: `src/features/copilot/lib/action-registry.ts` (import on line 12; register block after the `plan.add_districts` block, ends line 625)

- [ ] **Step 1: Write the failing tests**

Append these three tests inside the `describe("plan actions", …)` block in `action-registry.test.ts` (just before the block's closing `});`):

```ts
  it("plan.remove_districts needs a target plan and a non-empty leaid list", () => {
    const a = getAction("plan", "remove_districts")!;
    expect(a).toBeDefined();
    expect(a.needsTarget).toBe(true);
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ leaids: [] }).ok).toBe(false);
    expect(a.parse({ leaids: ["0601234"] }).ok).toBe(true);
  });

  it("plan.remove_districts validate flags leaids that don't exist", async () => {
    const a = getAction("plan", "remove_districts")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbNone = { district: { findMany: async () => [] } } as any;
    const errs = await a.validate!({ leaids: ["ghost"] }, { userId: "u", db: dbNone });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/leaid/i);
  });

  it("plan.remove_districts confirm card is destructive and shows a count, not raw leaids", () => {
    const a = getAction("plan", "remove_districts")!;
    const parsed = a.parse({ leaids: ["0601234", "4800001"] });
    if (!parsed.ok) throw new Error("expected valid");
    const preview = a.buildPreview(parsed.fields, { targetId: "plan-1", summary: "Remove 2 districts from Texas FY26" });
    expect(preview.destructive).toBe(true);
    expect(preview.rows.some((r) => r.value === "0601234")).toBe(false);
    expect(preview.rows.some((r) => r.value === "2")).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/copilot/lib/__tests__/action-registry.test.ts`
Expected: FAIL — `getAction("plan", "remove_districts")` is `undefined` (the `!` non-null assertion yields a runtime error / `a.needsTarget` throws).

- [ ] **Step 3: Add `"remove_districts"` to the operation union**

In `src/features/copilot/lib/types.ts`, change line 13:

```ts
export type CopilotOperation = "create" | "update" | "add_districts" | "remove_districts";
```

- [ ] **Step 4: Import the service fn in the registry**

In `src/features/copilot/lib/action-registry.ts`, line 12, add `removeDistrictsFromPlan` to the existing import:

```ts
import { createPlan, updatePlan, addDistrictsToPlan, removeDistrictsFromPlan } from "@/features/plans/lib/service";
```

- [ ] **Step 5: Register the action**

Append after the `plan.add_districts` register block (the file currently ends at line 625 with that block's closing `);`):

```ts
// ===== plan.remove_districts — unlink existing districts from a plan =====
register(
  defineAction({
    objectType: "plan",
    operation: "remove_districts",
    needsTarget: true,
    fieldsSchema: z.object({
      leaids: z.array(z.string().min(1)).min(1, "provide at least one district"),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Remove districts from plan",
      summary:
        summary ||
        `Remove ${f.leaids.length} district${f.leaids.length === 1 ? "" : "s"} from the plan`,
      rows: [{ label: "Districts", value: String(f.leaids.length) }],
      destructive: true,
    }),
    validate: async (f, { db }) => leaidErrors(await missingLeaids(f.leaids, db)),
    execute: (f, { targetId, ctx }) =>
      removeDistrictsFromPlan(String(targetId), f.leaids, ctx.db),
  }),
);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/features/copilot/lib/__tests__/action-registry.test.ts`
Expected: PASS — the three new `plan.remove_districts` tests green, all existing tests still green.

- [ ] **Step 7: Commit**

```bash
git add src/features/copilot/lib/types.ts src/features/copilot/lib/action-registry.ts src/features/copilot/lib/__tests__/action-registry.test.ts
git commit -m "feat(copilot): plan.remove_districts action (unlink districts from a plan)"
```

---

### Task 3: System-prompt catalog entry

**Files:**
- Modify: `src/features/copilot/lib/system-prompt.ts` (the `COPILOT_PREAMBLE` template, right after the `### plan.add_districts` block at lines 75–77)

- [ ] **Step 1: Add the catalog entry**

In `system-prompt.ts`, immediately after these existing lines (75–77):

```
### plan.add_districts — link existing districts to a plan
Use this when the rep says "add [district] to [plan]" / "add these districts to my plan". Set \`targetId\` to the plan id; look up each district's leaid with the read tools first.
- leaids (string[], required) — the districts to add
```

insert:

```
### plan.remove_districts — unlink districts from a plan
Use when the rep says "remove [district] from [plan]" / "remove these / all districts from my plan". Set \`targetId\` to the plan id; look up each leaid with the read tools first. To remove ALL, query the plan's current districts (territory_plan_districts joined to districts) and propose removing that explicit set. Reversible (re-add with plan.add_districts). Name the districts in the \`summary\` — the rep never sees leaids.
- leaids (string[], required) — the districts to remove
```

(Keep the backtick escaping `\`targetId\`` consistent with the surrounding template-literal lines.)

- [ ] **Step 2: Verify the file compiles and the entry is present**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep system-prompt || echo "system-prompt OK"`
Expected: `system-prompt OK` (no type errors in this file).

Run: `grep -c "plan.remove_districts" src/features/copilot/lib/system-prompt.ts`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/features/copilot/lib/system-prompt.ts
git commit -m "feat(copilot): document plan.remove_districts in the action catalog"
```

---

### Task 4: Destructive confirm-card cue

**Files:**
- Modify: `src/features/copilot/components/CopilotPanel.tsx` — the Confirm `<button>` in `ProposedActionCard` (currently lines ~555–567)

This is a presentational change. The *logic* of which actions are destructive is already
covered by Task 2 (`preview.destructive === true`). The className ternary is verified
manually in Step 2 — no unit test (asserting Tailwind classes for a style-only change is brittle).

- [ ] **Step 1: Make the Confirm button red when the action is destructive**

Replace the Confirm `<button>`'s static `className` with a conditional one. Change:

```tsx
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#403770] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a] disabled:opacity-50"
```

to:

```tsx
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
              action.preview.destructive
                ? "bg-[#A8281C] hover:bg-[#8C2117]"
                : "bg-[#403770] hover:bg-[#322a5a]"
            }`}
```

`#A8281C` is the destructive color already used in this file (the error bubble + error text); `#8C2117` is its hover-darkened shade. Confirm both against `Documentation/UI Framework/tokens.md` and swap to a named destructive/coral token if one exists.

- [ ] **Step 2: Manually verify the cue + that existing tests still pass**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotPanel.test.tsx`
Expected: PASS (the New-chat regression test is unaffected).

Manual: with the dev server running (Task 5), propose a removal in chat and confirm the **Confirm** button renders red on the `plan.remove_districts` card, while a non-destructive card (e.g. add districts) stays plum.

- [ ] **Step 3: Commit**

```bash
git add src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): red Confirm button for destructive action cards"
```

---

### Task 5: Full verification (suites + end-to-end)

**Files:** none (verification only)

- [ ] **Step 1: Run the affected suites**

Run: `npx vitest run src/features/copilot src/features/plans/lib`
Expected: PASS — all copilot + plans-lib tests green (includes the new service + action-registry tests).

- [ ] **Step 2: Typecheck the touched files**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "service\.ts|action-registry\.ts|types\.ts|system-prompt\.ts|CopilotPanel\.tsx" || echo "touched files type-clean"`
Expected: `touched files type-clean` (pre-existing errors in unrelated test files may still print; only the listed files matter).

- [ ] **Step 3: End-to-end in the running app**

Ensure the dev server runs from the worktree (`npm run dev`, port 3005). Open a plan that has districts, open Copilot, and ask: **"remove all districts from my test plan."**
Expected:
- One confirm card titled "Remove districts from plan", naming the districts in the summary, showing a "Districts: N" row, with a **red** Confirm button.
- Clicking Confirm clears the plan's districts; the plan's district count updates on next view.
- The removal appears in the Copilot activity log.
- Asking to "remove the West ISD district from my plan" produces a single-district card and works the same way.

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test(copilot): verify plan.remove_districts end-to-end" || echo "nothing to commit"
```

---

## Notes for the implementer
- Run everything from the worktree dir, not the main tree.
- Helpers `missingLeaids` and `leaidErrors` already exist in `action-registry.ts` (used by `plan.add_districts`) — reuse them, don't redefine.
- Don't touch the existing REST `DELETE /api/territory-plans/[id]/districts/[leaid]` route or any plan-table UI — out of scope.
