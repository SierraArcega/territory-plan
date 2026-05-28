# Copilot: Link Existing Activities to Plans — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the copilot a confirm-flow action to attach existing activities to a plan (and unlink them), so a bulk audit collapses to one confirm card.

**Architecture:** Clone the existing `plan.add_districts` / `plan.remove_districts` path onto the activity↔plan junction. New service functions `addActivitiesToPlan` / `removeActivitiesFromPlan` write the `ActivityPlan` junction; two new copilot actions (`plan.add_activities` / `plan.remove_activities`) call them; plumbing exposes the ops to the model. Additive semantics, existence checks only (no ownership gate), no migration.

**Tech Stack:** TypeScript, Prisma, Zod, Vitest. Anthropic tool-use copilot.

**Spec:** `Docs/superpowers/specs/2026-05-28-copilot-link-activities-to-plans-design.md`

**Working dir:** `/Users/sierraarcega/territory-plan/.claude/worktrees/feat+ai-copilot-core-objects` (branch `feat/ai-copilot-core-objects`).

**Commit convention (this repo):** commit with explicit identity and plain messages (no AI/Co-Authored-By trailer). Every commit command below already includes:
`git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`. Stage files by exact path — never `git add -A` (concurrent sessions share this tree).

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/features/plans/lib/service.ts` | Plan domain service | Add `addActivitiesToPlan` / `removeActivitiesFromPlan` (after `removeDistrictsFromPlan`, ~line 193) |
| `src/features/plans/lib/__tests__/service.test.ts` | Service unit tests | Extend prisma mock; add two `describe` blocks |
| `src/features/copilot/lib/action-registry.ts` | Copilot action catalog | Import new service fns; add `missingActivityIds`/`activityIdErrors` helpers; register `plan.add_activities` / `plan.remove_activities` |
| `src/features/copilot/lib/__tests__/action-registry.test.ts` | Registry unit tests | Add `describe("plan activity-link actions")` |
| `src/features/copilot/lib/types.ts` | Copilot types | Extend `CopilotOperation` union (line 13) |
| `src/features/copilot/lib/tools.ts` | `propose_actions` tool schema | Add ops to `operation` enum (line 26); update `targetId` description |
| `src/features/copilot/lib/__tests__/tools.test.ts` | Tool-schema test | **Create** — assert enum includes the new ops |
| `src/features/copilot/lib/system-prompt.ts` | Model action catalog | Add `### plan.add_activities` / `### plan.remove_activities` entries after the `plan.remove_districts` entry (~line 83) |

---

## Task 1: Service — `addActivitiesToPlan` / `removeActivitiesFromPlan`

**Files:**
- Modify: `src/features/plans/lib/__tests__/service.test.ts` (prisma mock at top, lines 3–10; append describes after line 130)
- Modify: `src/features/plans/lib/service.ts` (append after `removeDistrictsFromPlan`, ~line 193)

- [ ] **Step 1: Extend the prisma mock to cover the activity junction**

In `src/features/plans/lib/__tests__/service.test.ts`, replace the existing `vi.mock("@/lib/prisma", …)` block (lines 3–10) with:

```ts
vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    territoryPlanDistrict: { createMany: vi.fn(), deleteMany: vi.fn() },
    district: { findMany: vi.fn() },
    activity: { findMany: vi.fn() },
    activityPlan: { createMany: vi.fn(), deleteMany: vi.fn() },
  },
}));
```

Then update the service import (line 15) to add the two new functions:

```ts
import {
  createPlan,
  updatePlan,
  addDistrictsToPlan,
  removeDistrictsFromPlan,
  addActivitiesToPlan,
  removeActivitiesFromPlan,
} from "../service";
```

- [ ] **Step 2: Write the failing tests**

Append to `src/features/plans/lib/__tests__/service.test.ts` (after line 130, the close of the `removeDistrictsFromPlan` describe):

```ts
describe("addActivitiesToPlan", () => {
  it("rejects an empty activity list", async () => {
    await expect(addActivitiesToPlan("plan-1", [])).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(addActivitiesToPlan("plan-x", ["act-1"])).rejects.toMatchObject({ status: 404 });
  });

  it("400s when an activity does not exist", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activity.findMany.mockResolvedValue([{ id: "act-1" }]);
    await expect(
      addActivitiesToPlan("plan-1", ["act-1", "ghost"]),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.activityPlan.createMany).not.toHaveBeenCalled();
  });

  it("inserts junction rows (skipDuplicates) and returns the added count", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activity.findMany.mockResolvedValue([{ id: "act-1" }, { id: "act-2" }]);
    mockPrisma.activityPlan.createMany.mockResolvedValue({ count: 2 });
    const result = await addActivitiesToPlan("plan-1", ["act-1", "act-2"]);
    expect(result.added).toBe(2);
    const arg = mockPrisma.activityPlan.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toEqual([
      { planId: "plan-1", activityId: "act-1" },
      { planId: "plan-1", activityId: "act-2" },
    ]);
  });
});

describe("removeActivitiesFromPlan", () => {
  it("rejects an empty activity list", async () => {
    await expect(removeActivitiesFromPlan("plan-1", [])).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the plan is missing", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    await expect(removeActivitiesFromPlan("plan-x", ["act-1"])).rejects.toMatchObject({ status: 404 });
    expect(mockPrisma.activityPlan.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the matching junction rows and returns the removed count", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activityPlan.deleteMany.mockResolvedValue({ count: 2 });
    const result = await removeActivitiesFromPlan("plan-1", ["act-1", "act-2"]);
    expect(result).toEqual({ removed: 2, planId: "plan-1" });
    const arg = mockPrisma.activityPlan.deleteMany.mock.calls[0][0];
    expect(arg.where).toEqual({ planId: "plan-1", activityId: { in: ["act-1", "act-2"] } });
  });

  it("no-ops (removed: 0) when no activity is a member", async () => {
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.activityPlan.deleteMany.mockResolvedValue({ count: 0 });
    const result = await removeActivitiesFromPlan("plan-1", ["ghost"]);
    expect(result.removed).toBe(0);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/plans/lib/__tests__/service.test.ts`
Expected: FAIL — `addActivitiesToPlan` / `removeActivitiesFromPlan` are not exported (import error / not a function).

- [ ] **Step 4: Implement the service functions**

Append to `src/features/plans/lib/service.ts` after `removeDistrictsFromPlan` (after line 193):

```ts
/**
 * Link existing activities to a plan (the activity↔plan junction) — the
 * activity counterpart to addDistrictsToPlan. Validates the plan and that every
 * activity id exists, then inserts junction rows (skipDuplicates → idempotent).
 */
export async function addActivitiesToPlan(
  planId: string,
  activityIds: string[],
  db: DbClient = prisma,
): Promise<{ added: number; planId: string }> {
  if (!Array.isArray(activityIds) || activityIds.length === 0) {
    throw new ServiceError("provide at least one activity", 400);
  }

  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ServiceError("Territory plan not found", 404);
  }

  const existing = await db.activity.findMany({
    where: { id: { in: activityIds } },
    select: { id: true },
  });
  const existingSet = new Set(existing.map((a) => a.id));
  const invalid = activityIds.filter((id) => !existingSet.has(id));
  if (invalid.length > 0) {
    throw new ServiceError(`Activities not found: ${invalid.join(", ")}`, 400);
  }

  const result = await db.activityPlan.createMany({
    data: activityIds.map((activityId) => ({ planId, activityId })),
    skipDuplicates: true,
  });
  return { added: result.count, planId };
}

/**
 * Remove activities from a plan (the activity↔plan junction) — counterpart to
 * addActivitiesToPlan. Validates the plan, then deletes the junction rows for
 * the given activity ids; removing one that isn't linked is a harmless no-op.
 */
export async function removeActivitiesFromPlan(
  planId: string,
  activityIds: string[],
  db: DbClient = prisma,
): Promise<{ removed: number; planId: string }> {
  if (!Array.isArray(activityIds) || activityIds.length === 0) {
    throw new ServiceError("provide at least one activity", 400);
  }

  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ServiceError("Territory plan not found", 404);
  }

  const result = await db.activityPlan.deleteMany({
    where: { planId, activityId: { in: activityIds } },
  });
  return { removed: result.count, planId };
}
```

> Note: `DbClient`, `ServiceError`, and `prisma` are already imported in this file (used by `addDistrictsToPlan`). No new imports needed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/plans/lib/__tests__/service.test.ts`
Expected: PASS (all `addActivitiesToPlan` / `removeActivitiesFromPlan` cases green, existing cases still green).

- [ ] **Step 6: Commit**

```bash
git add src/features/plans/lib/service.ts src/features/plans/lib/__tests__/service.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(plans): add/removeActivitiesToPlan over the ActivityPlan junction"
```

---

## Task 2: Copilot actions — `plan.add_activities` / `plan.remove_activities`

**Files:**
- Modify: `src/features/copilot/lib/action-registry.ts` (import line 12; helpers after line 127; register actions after line 648)
- Modify: `src/features/copilot/lib/__tests__/action-registry.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing tests**

Append to `src/features/copilot/lib/__tests__/action-registry.test.ts` (after the final `});` that closes the last top-level describe):

```ts
describe("plan activity-link actions", () => {
  it("exposes plan.add_activities and plan.remove_activities, both needing a target", () => {
    const add = getAction("plan", "add_activities");
    const remove = getAction("plan", "remove_activities");
    expect(add).toBeDefined();
    expect(remove).toBeDefined();
    expect(add!.needsTarget).toBe(true);
    expect(remove!.needsTarget).toBe(true);
  });

  it("requires a non-empty activityIds array", () => {
    const a = getAction("plan", "add_activities")!;
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ activityIds: [] }).ok).toBe(false);
    expect(a.parse({ activityIds: ["act-1", "act-2"] }).ok).toBe(true);
  });

  it("add is non-destructive, remove is destructive", () => {
    const add = getAction("plan", "add_activities")!;
    const remove = getAction("plan", "remove_activities")!;
    const parsedAdd = add.parse({ activityIds: ["act-1", "act-2"] });
    const parsedRemove = remove.parse({ activityIds: ["act-1"] });
    expect(parsedAdd.ok && parsedRemove.ok).toBe(true);
    if (!parsedAdd.ok || !parsedRemove.ok) return;
    expect(add.buildPreview(parsedAdd.fields, { targetId: "plan-1" }).destructive).toBe(false);
    expect(remove.buildPreview(parsedRemove.fields, { targetId: "plan-1" }).destructive).toBe(true);
  });

  it("validate rejects activity ids with no matching activity", async () => {
    const a = getAction("plan", "add_activities")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbNone = { activity: { findMany: async () => [] } } as any;
    const errs = await a.validate!({ activityIds: ["ghost"] }, { userId: "u", db: dbNone });
    expect(errs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/copilot/lib/__tests__/action-registry.test.ts`
Expected: FAIL — `getAction("plan", "add_activities")` returns `undefined` (actions not registered yet).

- [ ] **Step 3: Add the service import**

In `src/features/copilot/lib/action-registry.ts`, line 12, extend the plans-service import:

```ts
import {
  createPlan,
  updatePlan,
  addDistrictsToPlan,
  removeDistrictsFromPlan,
  addActivitiesToPlan,
  removeActivitiesFromPlan,
} from "@/features/plans/lib/service";
```

- [ ] **Step 4: Add the validation helpers**

In `src/features/copilot/lib/action-registry.ts`, immediately after `leaidErrors` (after line 127), add:

```ts
/** Returns the subset of activity ids that don't exist in `activity` (read-only). */
async function missingActivityIds(
  ids: ReadonlyArray<string> | undefined,
  db: DbClient,
): Promise<string[]> {
  const list = (ids ?? []).filter(Boolean);
  if (list.length === 0) return [];
  const found = await db.activity.findMany({
    where: { id: { in: [...list] } },
    select: { id: true },
  });
  const have = new Set(found.map((a) => a.id));
  return list.filter((id) => !have.has(id));
}

/** Propose-time error guiding the model to look up real activity ids, never guess. */
function activityIdErrors(missing: string[]): string[] {
  if (missing.length === 0) return [];
  return [
    `No activity found for id(s): ${missing.join(", ")}. Look up real activity ids with ` +
      `run_sql (e.g. SELECT id, title FROM activities WHERE …) and use only a returned ` +
      `value. Do not guess.`,
  ];
}
```

- [ ] **Step 5: Register the two actions**

In `src/features/copilot/lib/action-registry.ts`, after the `plan.remove_districts` registration (after line 648), add:

```ts
// ===== plan.add_activities — link existing activities to a plan =====
register(
  defineAction({
    objectType: "plan",
    operation: "add_activities",
    needsTarget: true,
    fieldsSchema: z.object({
      activityIds: z.array(z.string().min(1)).min(1, "provide at least one activity"),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Add activities to plan",
      summary:
        summary ||
        `Add ${f.activityIds.length} activit${f.activityIds.length === 1 ? "y" : "ies"} to the plan`,
      rows: [{ label: "Activities", value: String(f.activityIds.length) }],
      destructive: false,
    }),
    validate: async (f, { db }) => activityIdErrors(await missingActivityIds(f.activityIds, db)),
    execute: (f, { targetId, ctx }) =>
      addActivitiesToPlan(String(targetId), f.activityIds, ctx.db),
  }),
);

// ===== plan.remove_activities — unlink existing activities from a plan =====
register(
  defineAction({
    objectType: "plan",
    operation: "remove_activities",
    needsTarget: true,
    fieldsSchema: z.object({
      activityIds: z.array(z.string().min(1)).min(1, "provide at least one activity"),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Remove activities from plan",
      summary:
        summary ||
        `Remove ${f.activityIds.length} activit${f.activityIds.length === 1 ? "y" : "ies"} from the plan`,
      rows: [{ label: "Activities", value: String(f.activityIds.length) }],
      destructive: true,
    }),
    validate: async (f, { db }) => activityIdErrors(await missingActivityIds(f.activityIds, db)),
    execute: (f, { targetId, ctx }) =>
      removeActivitiesFromPlan(String(targetId), f.activityIds, ctx.db),
  }),
);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/features/copilot/lib/__tests__/action-registry.test.ts`
Expected: PASS (new `plan activity-link actions` block green; existing registry tests still green).

- [ ] **Step 7: Commit**

```bash
git add src/features/copilot/lib/action-registry.ts src/features/copilot/lib/__tests__/action-registry.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(copilot): plan.add_activities / plan.remove_activities actions"
```

---

## Task 3: Plumbing — operation type, tool enum, system prompt

**Files:**
- Modify: `src/features/copilot/lib/types.ts` (line 13)
- Modify: `src/features/copilot/lib/tools.ts` (enum line 26; `targetId` description)
- Create: `src/features/copilot/lib/__tests__/tools.test.ts`
- Modify: `src/features/copilot/lib/system-prompt.ts` (after the `plan.remove_districts` catalog entry, ~line 83)

- [ ] **Step 1: Write the failing tool-schema test**

Create `src/features/copilot/lib/__tests__/tools.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { COPILOT_TOOLS, PROPOSE_ACTIONS_TOOL_NAME } from "../tools";

describe("propose_actions tool schema", () => {
  it("exposes the plan activity-link operations in the operation enum", () => {
    const tool = COPILOT_TOOLS.find((t) => t.name === PROPOSE_ACTIONS_TOOL_NAME)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = tool.input_schema as any;
    const ops = schema.properties.actions.items.properties.operation.enum as string[];
    expect(ops).toEqual(
      expect.arrayContaining(["add_activities", "remove_activities"]),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/tools.test.ts`
Expected: FAIL — enum does not yet contain `"add_activities"` / `"remove_activities"`.

- [ ] **Step 3: Extend the `CopilotOperation` type**

In `src/features/copilot/lib/types.ts`, line 13, replace:

```ts
export type CopilotOperation = "create" | "update" | "add_districts" | "remove_districts";
```

with:

```ts
export type CopilotOperation =
  | "create"
  | "update"
  | "add_districts"
  | "remove_districts"
  | "add_activities"
  | "remove_activities";
```

- [ ] **Step 4: Extend the tool `operation` enum and `targetId` description**

In `src/features/copilot/lib/tools.ts`, line 26, replace:

```ts
              enum: ["create", "update", "add_districts", "remove_districts"],
```

with:

```ts
              enum: [
                "create",
                "update",
                "add_districts",
                "remove_districts",
                "add_activities",
                "remove_activities",
              ],
```

Then update the `targetId` property `description` (the block describing when `targetId` is required) to read:

```ts
              description:
                "Required for update (the id of the record to change — task id, contact id as a string, plan id, etc.) and for add_districts / remove_districts / add_activities / remove_activities (the plan id). Omit for create.",
```

- [ ] **Step 5: Run the tool-schema test to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/tools.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the system-prompt catalog entries**

In `src/features/copilot/lib/system-prompt.ts`, immediately after the `plan.remove_districts` entry paragraph (the line ending `…the rep never sees leaids.`, ~line 83) and before the `## Style` heading, insert:

```ts

### plan.add_activities — link existing activities to a plan
Use when the rep says "add / tie these activities to [plan]" / "link this meeting to my plan". Set \`targetId\` to the plan id; look up each activity id with the read tools first (e.g. \`SELECT id, title FROM activities WHERE created_by_user_id = '<rep>' AND …\`). To find activities missing a plan link, query activities with no matching row in \`activity_plans\` and propose adding that set. Additive — it never removes existing links. Name the activities + plan in the \`summary\` — the rep never sees ids.
- activityIds (string[], required)

### plan.remove_activities — unlink activities from a plan
Use when the rep says "remove / unlink [activity] from [plan]". Set \`targetId\` to the plan id; look up each activity id first. Reversible (re-add with plan.add_activities). Name them in the \`summary\` — the rep never sees ids.
- activityIds (string[], required)
```

> The surrounding `COPILOT_PREAMBLE` is a backtick-delimited template literal, so the `\`…\`` escapes above are required exactly as written (matching the existing entries).

- [ ] **Step 7: Run typecheck to confirm the new operations are consistent**

Run: `npx tsc --noEmit 2>&1 | grep -E "tools.ts|types.ts|system-prompt.ts|action-registry.ts" || echo "clean (no new errors in changed files)"`
Expected: `clean (no new errors in changed files)`. (The repo has ~21 pre-existing tsc errors in unrelated test files; the grep filters to the files this plan touches.)

- [ ] **Step 8: Commit**

```bash
git add src/features/copilot/lib/types.ts src/features/copilot/lib/tools.ts src/features/copilot/lib/__tests__/tools.test.ts src/features/copilot/lib/system-prompt.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(copilot): expose plan.add_activities / remove_activities to the model"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run all touched test suites**

Run:
```bash
npx vitest run src/features/plans/lib/__tests__/service.test.ts src/features/copilot/lib/__tests__/action-registry.test.ts src/features/copilot/lib/__tests__/tools.test.ts src/features/copilot/lib/__tests__/agent-loop-copilot.test.ts
```
Expected: all PASS.

- [ ] **Step 2: Lint the changed source files**

Run:
```bash
npx eslint src/features/plans/lib/service.ts src/features/copilot/lib/action-registry.ts src/features/copilot/lib/types.ts src/features/copilot/lib/tools.ts src/features/copilot/lib/system-prompt.ts src/features/plans/lib/__tests__/service.test.ts src/features/copilot/lib/__tests__/action-registry.test.ts src/features/copilot/lib/__tests__/tools.test.ts
```
Expected: exit 0, no errors.

- [ ] **Step 3: Confirm tsc introduced no new errors**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `21` (the pre-existing count; no new errors). If higher, inspect the new errors and fix.

- [ ] **Step 4: Manual smoke test (copilot live)**

The dev server already runs on `http://localhost:3005` from this worktree (hot-reloads). In the copilot:
1. Ask: *"which of my activities aren't linked to any plan?"* → expect an answer turn (run_sql).
2. Ask: *"tie those to <plan name>"* → expect ONE confirm card titled "Add activities to plan" with an "Activities: N" row. Confirm it.
3. Verify in the UI (plan's activities / the activity's plan chips) that the links now exist.
4. Ask to *"unlink <activity> from <plan>"* → expect a "Remove activities from plan" card (destructive styling). Confirm and verify removal.

> This step needs your auth session — it's a human check, not automatable here.

---

## Self-Review (completed by plan author)

- **Spec coverage:** service add/remove → Task 1; copilot actions + propose-time validation → Task 2; `CopilotOperation` + tool enum + system-prompt catalog → Task 3; tests across all three + live smoke → Tasks 1–4. ✓
- **Placeholders:** none — every code/step has concrete content and commands. ✓
- **Type consistency:** `addActivitiesToPlan(planId, activityIds, db)` / `removeActivitiesFromPlan(...)` signatures match between service (Task 1), registry `execute` (Task 2), and tests; field name `activityIds` is consistent across schema, preview, service, and prompt; junction accessor `activityPlan` and columns `{ planId, activityId }` match `prisma/schema.prisma` `ActivityPlan` (`@@id([activityId, planId])`). ✓
