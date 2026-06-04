# Copilot `plan.remove_districts` — design

## Context / problem

The AI Copilot can add districts to a territory plan (`plan.add_districts`) but
cannot remove them. A rep asked the live Copilot *"can you remove all of the
districts from my test plan?"* and it declined:

> "I can't remove districts from a plan from here — my available plan actions are
> create plan, update plan metadata, and add districts. You'll need to remove
> them directly in the plan view."

Removing a district from a plan already exists in the **UI** (per-row "Remove
district" + confirm in `DistrictsTable.tsx`/`DistrictCard.tsx`) and the **REST**
layer (`DELETE /api/territory-plans/[id]/districts/[leaid]`). The only gap is the
Copilot. This spec adds a `plan.remove_districts` Copilot action so a rep can say
"remove X / these / **all** districts from my plan" in chat.

## Goal

Give the Copilot a `plan.remove_districts` action that unlinks one or more
districts from a plan, gated behind the standard propose → confirm → execute
flow, mirroring `plan.add_districts`.

## Non-goals

- **No plan-table UI work.** No table multi-select / bulk-remove bar (explicitly
  deferred by the user — chat covers the bulk case). The one UI touch in scope is
  the Copilot confirm-card destructive cue (piece 5).
- **No new REST route.** The Copilot executes via its own action pipeline, not
  the REST DELETE. The existing per-row REST DELETE and plan UI are untouched.
- No hard-delete of districts — only the plan↔district junction row is removed
  (reversible via `plan.add_districts`).

## Design

Five small, symmetric pieces. The shape is a direct mirror of the existing
`plan.add_districts` (`action-registry.ts:606`) and `addDistrictsToPlan`
(`plans/lib/service.ts:136`).

### 1. Shared service — `removeDistrictsFromPlan`
`src/features/plans/lib/service.ts`, the counterpart to `addDistrictsToPlan`:

```ts
export async function removeDistrictsFromPlan(
  planId: string,
  leaids: string[],
  db: DbClient = prisma,
): Promise<{ removed: number; planId: string }> {
  if (!Array.isArray(leaids) || leaids.length === 0) {
    throw new ServiceError("provide at least one district", 400);
  }
  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new ServiceError("Territory plan not found", 404);

  const result = await db.territoryPlanDistrict.deleteMany({
    where: { planId, districtLeaid: { in: leaids } },
  });
  return { removed: result.count, planId };
}
```

- **Lean and transaction-safe**, matching the philosophy documented on
  `addDistrictsToPlan`: no inline rollup/tag sync. `districtCount` and the target
  rollups self-heal on the plan's next GET — `syncPlanRollups`
  (`plans/lib/rollup-sync.ts`) recomputes them from current junction membership, so
  they are correct after a removal.
- Removing a leaid that isn't in the plan is a harmless no-op (`deleteMany` simply
  doesn't match it); `removed` reflects how many rows actually deleted.
- Target-service rows (`territory_plan_district_service`) for the removed
  membership are cleared by the existing `onDelete: Cascade` on the junction.

### 2. Type — extend the operation union
`src/features/copilot/lib/types.ts`: add `"remove_districts"` to `CopilotOperation`:

```ts
export type CopilotOperation = "create" | "update" | "add_districts" | "remove_districts";
```

### 3. Action registration — `plan.remove_districts`
`src/features/copilot/lib/action-registry.ts`, structurally identical to
`plan.add_districts`:

- `objectType: "plan"`, `operation: "remove_districts"`, `needsTarget: true`
  (targetId = plan id).
- `fieldsSchema: z.object({ leaids: z.array(z.string().min(1)).min(1, "provide at least one district") })`.
- `validate`: reuse `missingLeaids` / `leaidErrors` so the model can't invent
  leaids (same as add).
- `buildPreview`: `title: "Remove districts from plan"`, model-authored `summary`
  (names the districts + plan), row `{ label: "Districts", value: String(f.leaids.length) }`,
  **`destructive: true`** (first action to set this).
- `execute`: `removeDistrictsFromPlan(String(targetId), f.leaids, ctx.db)` — runs
  inside the execute endpoint's existing `$transaction`; the `copilot_action_log`
  audit row is written in the same transaction like every other action.

### 4. System prompt — catalog entry
`src/features/copilot/lib/system-prompt.ts`, add under the plan actions
(near the `plan.add_districts` entry at line ~75):

```
### plan.remove_districts — unlink districts from a plan
Use when the rep says "remove [district] from [plan]" / "remove these / all
districts from my plan". Set `targetId` to the plan id; look up each leaid first.
To remove ALL, query the plan's current districts (territory_plan_districts joined
to districts) and propose removing that explicit set. Reversible via
plan.add_districts. Name the districts in the `summary` — the rep never sees leaids.
- leaids (string[], required) — the districts to remove
```

"Remove all" therefore reuses the leaids-array action: the model queries current
membership, then proposes one confirm card listing the resolved set (count shown
on the card; names in the summary). No clear-all shortcut.

### 5. Confirm-card destructive cue
`src/features/copilot/components/CopilotPanel.tsx` — `ProposedActionCard`.
Today `preview.destructive` is plumbed through the type but never rendered. Wire it
so a destructive action's **Confirm** button uses the Fullmind coral/destructive
token (per `Documentation/UI Framework/tokens.md`; the error bubble's
`#A8281C`/`#FFE0DC` pairing is a reference point), giving a visual warning for
"remove all". ~5 lines; affects only the Confirm button styling when
`action.preview.destructive` is true. All non-destructive actions are unchanged.

## Data flow

1. Rep: "remove all districts from my test plan."
2. Copilot (read rail) runs `run_sql` to find the plan id + its current district
   leaids (`territory_plan_districts ⋈ districts`).
3. Copilot calls `propose_actions` with `plan.remove_districts` (targetId = plan id,
   leaids = resolved set). Propose-time `validate` confirms the leaids are real;
   `buildPreview` renders the confirm card (red Confirm).
4. Rep clicks Confirm → `POST /api/copilot/actions/execute` → re-validates →
   `removeDistrictsFromPlan` inside the transaction → audit row written.
5. Plan's next GET recomputes `districtCount`/rollups via `syncPlanRollups`.

## Error handling

- Missing/empty `leaids` or unknown plan → `ServiceError` (400/404), surfaced by the
  execute endpoint's existing `ServiceError` mapping.
- Invalid/guessed leaids → caught at propose time by `validate` (`leaidErrors`), fed
  back to the model to self-correct before any card reaches the rep.
- Leaids not actually in the plan → silently skipped by `deleteMany`; `removed`
  count reflects reality (acceptable, mirrors add's `skipDuplicates` tolerance).

## Testing

- **Service** (`plans/lib/__tests__/service.test.ts`): `removeDistrictsFromPlan`
  deletes matching junction rows and returns the count; throws 404 on a missing
  plan; no-ops (removed: 0) on a non-member leaid; rejects an empty array.
- **Action registry** (`copilot/lib/__tests__/action-registry.test.ts`):
  `plan.remove_districts` parses a valid `{ leaids }`, rejects empty, requires a
  targetId, `validate` flags unknown leaids, `buildPreview` reports the count and
  `destructive: true`, and `execute` calls `removeDistrictsFromPlan`.

## Verification

1. `npm test` — service + action-registry suites green.
2. In the running app (`npm run dev`, port 3005), open Copilot on a plan with
   districts and ask "remove all districts from my test plan." Confirm: one card
   appears naming the districts with a **red** Confirm; clicking Confirm clears the
   plan's districts; the plan's district count updates on next view; the action
   appears in the Copilot activity log.
