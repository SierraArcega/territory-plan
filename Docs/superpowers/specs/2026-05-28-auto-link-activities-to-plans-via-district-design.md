# Auto-link Activities to Plans via their Districts

**Date:** 2026-05-28
**Status:** Approved (design)

## Problem

When a rep logs an activity against a district, and that district is already a
member of one or more territory plans, the activity is **not** automatically
attached to those plans. Today plan linking is manual: the caller must pass an
explicit `planIds[]` when creating an activity, or use the link endpoints after
the fact. The only place any district→plan inference happens is the Google
Calendar sync confirmation flow, which suggests a single "working" plan.

This means activities silently fall off the plans they logically belong to,
and reps see "needs plan association" warnings for districts that are clearly
already planned.

## Goal

Whenever an activity gains a district, automatically attach the activity to
**every** territory plan that contains that district — across all owners, all
statuses, and all fiscal years — silently, without a confirmation step.

## Decisions (confirmed with user)

- **Which plans:** *Any plan, anyone's.* Every `TerritoryPlan` containing the
  district, regardless of `ownerId` / `userId`, regardless of `status`,
  regardless of `fiscalYear`. No scope filter.
- **When:** *Both create and add-district.* Auto-link fires when an activity is
  first created with districts, and when a district is later added to an
  existing activity. Plus the calendar confirm path (below).
- **Visibility:** *Silent.* No banner, no "linked via district" badge. The
  plans appear on the activity like any manually-linked plan; a rep can still
  manually remove one if it's wrong.
- **Calendar path:** *Yes, apply there too.* The calendar confirm flow gets the
  same "attach all containing plans" behavior, in addition to its existing
  single suggested plan.

## Architecture

### New shared helper

A single server-only function holds the lookup so the three call sites don't
duplicate the query (per CLAUDE.md "mirror logic = extract a helper").

```ts
// src/features/activities/lib/plan-linking.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Returns the distinct planIds of every territory plan that contains any of
 * the given district leaids. No owner/status/fiscal-year filtering — callers
 * that want auto-linking attach the activity to all of them.
 *
 * Accepts an optional transaction client so it can run inside the calendar
 * confirm $transaction.
 */
export async function findPlanIdsForDistricts(
  leaids: string[],
  db: Db = prisma,
): Promise<string[]> {
  if (leaids.length === 0) return [];
  const rows = await db.territoryPlanDistrict.findMany({
    where: { districtLeaid: { in: leaids } },
    select: { planId: true },
    distinct: ["planId"],
  });
  return rows.map((r) => r.planId);
}
```

### Call site 1 — `POST /api/activities` (create)

File: `src/app/api/activities/route.ts` (~line 525–560).

After `allDistrictLeaids` is computed and before the `prisma.activity.create`,
look up auto plans and union them with the caller-supplied `planIds`:

```ts
const autoPlanIds = await findPlanIdsForDistricts(allDistrictLeaids);
const mergedPlanIds = [...new Set([...planIds, ...autoPlanIds])];
```

Then change the `plans.create` block to map over `mergedPlanIds` instead of
`planIds`. (`@@id([activityId, planId])` plus the dedupe means no duplicate
rows.)

### Call site 2 — `POST /api/activities/[id]/districts` (add-district)

File: `src/app/api/activities/[id]/districts/route.ts` (after the
`activityDistrict.createMany` at ~line 60).

```ts
const autoPlanIds = await findPlanIdsForDistricts(leaids);
let plansLinked = 0;
if (autoPlanIds.length > 0) {
  const res = await prisma.activityPlan.createMany({
    data: autoPlanIds.map((planId) => ({ activityId: id, planId })),
    skipDuplicates: true,
  });
  plansLinked = res.count;
}
```

Add `plansLinked` to the JSON response (alongside `linked`, `statesAdded`) so
the client can refresh / invalidate plan-related queries if needed.

### Call site 3 — `confirmCalendarEvent` (calendar sync)

File: `src/features/calendar/lib/sync.ts` (~line 503–536).

The plan/district linking happens inside a `prisma.$transaction(tx => ...)`.
Compute the union *before* the plan `createMany`, passing `tx` to the helper so
it reads consistently inside the transaction:

```ts
// after districtLeaids is resolved (line ~507), inside the transaction:
const autoPlanIds = await findPlanIdsForDistricts(districtLeaids, tx);
const allPlanIds = [...new Set([...planIds, ...autoPlanIds])];
```

Then the existing `if (planIds.length > 0)` block uses `allPlanIds` instead.
`districtLeaids` is already resolved before the transaction opens, so the
helper call goes at the top of the transaction body using `tx` (reads
consistently within the transaction). The plan `createMany` already lives
inside the transaction, so `allPlanIds` is in scope there.

### Call site 4 — `PATCH /api/activities/[id]` (edit) — added during implementation

File: `src/app/api/activities/[id]/route.ts` (the "Update districts (replace
all)" block, ~line 486). Editing an activity and adding a district is another
path where the activity gains a district, so it must auto-link too. The block
already deletes + recreates `ActivityDistrict` rows; after the recreate (inside
`if (districts.length > 0)`) we call `findPlanIdsForDistricts(districts.map(d =>
d.leaid))` and `activityPlan.createMany({ ..., skipDuplicates: true })`.

This is **additive only** — consistent with the "no un-linking" non-goal, we do
not remove plan links for districts that were dropped during the edit; we only
attach plans for the new district set.

## Data flow

```
activity gains district(s)
        │
        ▼
findPlanIdsForDistricts(leaids)        ── SELECT DISTINCT plan_id
        │                                  FROM territory_plan_districts
        ▼                                  WHERE district_leaid IN (...)
union with caller-supplied planIds
        │
        ▼
ActivityPlan rows created (skipDuplicates / dedupe)
```

## Edge cases

- **District in no plan:** helper returns `[]`, nothing is attached. No error.
- **District already in a linked plan:** dedupe + composite PK + `skipDuplicates`
  make the operation idempotent.
- **Multiple districts spanning multiple plans:** all distinct plans attach.
- **Empty `leaids`:** helper short-circuits to `[]`.
- **Existing computed flags:** `hasUnlinkedDistricts` / `needsPlanAssociation`
  (computed in the activities GET/serialization layer) naturally resolve to
  "linked" for any district that lives in a plan. No change needed to those
  computations — this is a positive side effect, not a separate task.

## Non-goals

- No UI badge or "linked via district" indicator (silent, per decision).
- No backfill of historical activities (only new district associations
  trigger auto-linking). Backfill can be a follow-up if desired.
- No change to plan-scope/permission semantics — we deliberately attach across
  all owners per the "any plan, anyone's" decision.
- No un-linking when a district is removed from an activity or from a plan
  (out of scope; existing behavior preserved).
- **Integration-created activities (Slack/Gmail send + background syncs)** are
  out of scope. Those flows attach a district to a freshly created activity but
  are not wired to auto-link in this pass. They can be added later by calling
  `findPlanIdsForDistricts` at those sites; deferred because they are
  system/integration-generated rather than "a rep logging an activity."

## Testing

Vitest, co-located in `__tests__/`:

1. **Helper unit tests** (`plan-linking` test): districts in 0 / 1 / many plans;
   district shared by multiple plans returns distinct IDs; empty input → `[]`.
2. **`POST /api/activities`**: creating an activity with a district that lives
   in two plans attaches both `ActivityPlan` rows; caller-supplied `planIds`
   are merged without duplicates.
3. **`POST /api/activities/[id]/districts`**: adding a district auto-attaches
   its plans; response includes `plansLinked`; re-adding is idempotent.
4. **`confirmCalendarEvent`**: confirming an event whose district is in extra
   plans attaches the suggested plan *and* the additional containing plans.

## Files touched

- `src/features/activities/lib/plan-linking.ts` (new)
- `src/app/api/activities/route.ts`
- `src/app/api/activities/[id]/districts/route.ts`
- `src/features/calendar/lib/sync.ts`
- co-located `__tests__/` for the above
