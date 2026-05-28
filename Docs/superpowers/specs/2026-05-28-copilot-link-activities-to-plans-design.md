# Copilot: link existing activities to plans

## Problem

The copilot can already link plans **when creating** an activity (`activity.create`
accepts `planIds`, persisted by `createActivity` via the `ActivityPlan` junction).
But there is **no path to link an activity that already exists**: `activity.update`
exposes only scalar fields (title/type/status/notes/dates/outcome/nextStep/
followUpDate/rating), and `updateActivity` never touches the plan/district/contact
junctions.

This surfaced from an audit turn: a query found 12 existing activities (across NY
districts, FY26-27, owner K. Tedesco) that should belong to Kris's plan, and the
copilot correctly reported it could not link them through the confirm flow.

## Goal

Give the copilot a confirm-flow action to attach existing activities to a plan (and
the reverse). The audit case should collapse to **one confirm card**:
*"Add 12 activities to FY26-27 K. Tedesco."*

## Approach

Mirror the existing `plan.add_districts` / `plan.remove_districts` pattern exactly,
swapping the district junction for the activity junction. Plan-centric bulk: one
action links many activities to one plan. Additive — never replaces or clears
existing links.

**Scope held to plans only.** District/contact relinking of existing activities is
out of scope (not the demonstrated need); the same pattern extends later if wanted.

## Data model

Junction already exists — no migration:

```prisma
model ActivityPlan {
  activityId String
  planId     String
  activity   Activity      @relation(..., onDelete: Cascade)
  plan       TerritoryPlan @relation(..., onDelete: Cascade)
  @@id([activityId, planId])
}
```

## Components

### 1. Service — `src/features/plans/lib/service.ts`

Two new functions mirroring `addDistrictsToPlan` / `removeDistrictsFromPlan`
(lines 136–193), writing the `activityPlan` junction instead of
`territoryPlanDistrict`:

- `addActivitiesToPlan(planId, activityIds, db): Promise<{ added: number; planId: string }>`
  - Reject empty `activityIds` (400).
  - Plan must exist (404 otherwise).
  - Every `activityId` must exist in `activity`; reject unknowns (400, list them).
  - `activityPlan.createMany({ data: ids.map(activityId => ({ activityId, planId })), skipDuplicates: true })`.
  - Idempotent: re-adding an already-linked activity is a no-op.
- `removeActivitiesFromPlan(planId, activityIds, db): Promise<{ removed: number; planId: string }>`
  - Reject empty `activityIds` (400); plan must exist (404).
  - `activityPlan.deleteMany({ where: { planId, activityId: { in: ids } } })`.
  - Removing an unlinked activity is a harmless no-op.

Existence checks only — **no ownership gate** (consistent with
`addDistrictsToPlan`; the copilot is single-rep and the system prompt already
scopes to the rep's plans).

### 2. Copilot actions — `src/features/copilot/lib/action-registry.ts`

Mirror `plan.add_districts` / `plan.remove_districts` (lines 606–646):

- `plan.add_activities`
  - `objectType: "plan"`, `operation: "add_activities"`, `targetId` = plan id.
  - `fieldsSchema: z.object({ activityIds: z.array(z.string()).min(1) })`.
  - Propose-time `validate`: a new `missingActivityIds(ids, db)` helper (mirroring
    `missingLeaids`/`leaidErrors`) so a card referencing a non-existent activity
    never reaches the rep — the model self-corrects within the retry budget.
  - `buildPreview`: title "Add activities to plan", summary (model-authored,
    names the activities + plan), rows `[{ label: "Activities", value: count }]`,
    `destructive: false`.
  - `execute: addActivitiesToPlan(String(targetId), f.activityIds, ctx.db)`.
- `plan.remove_activities`
  - Same shape; `buildPreview` mirrors `plan.remove_districts`'s reversible-removal
    flag. `execute: removeActivitiesFromPlan(String(targetId), f.activityIds, ctx.db)`.

### 3. Plumbing

- `CopilotOperation` (`src/features/copilot/lib/types.ts`): add
  `"add_activities" | "remove_activities"`.
- `propose_actions` tool `operation` enum (`src/features/copilot/lib/tools.ts`):
  add the two ops; extend the `targetId` description to mention them (the plan id).
- System prompt action catalog (`src/features/copilot/lib/system-prompt.ts`): two
  new entries under the plan section —
  - `plan.add_activities` — "Use when the rep says add/tie these activities to a
    plan. Set `targetId` to the plan id; look up each activity id with the read
    tools first (e.g. `SELECT id, title FROM activities WHERE …`). Name the
    activities + plan in the `summary`; never show ids. `activityIds` (string[],
    required)."
  - `plan.remove_activities` — counterpart, reversible.
  - Note the audit pattern: to find activities missing the link, query them, then
    propose `plan.add_activities` for the set.

## Testing

- **Service** (`src/features/plans/lib/__tests__/`): `addActivitiesToPlan` adds new
  rows, dedupes/idempotent on re-add, rejects unknown activity ids, 404 on missing
  plan; `removeActivitiesFromPlan` deletes matching rows, no-op on unlinked, 404 on
  missing plan.
- **Registry** (`src/features/copilot/lib/__tests__/`): `plan.add_activities` /
  `plan.remove_activities` parse valid input, reject empty `activityIds`, and
  `validate` flags non-existent activity ids.
- **Enum sync**: `propose_actions` `operation` enum includes the new ops.

## Out of scope

- District/contact relinking of existing activities.
- Auto-linking a plan on `activity.create` when the district is already in a plan
  (separate, complementary idea; does not fix existing activities).
