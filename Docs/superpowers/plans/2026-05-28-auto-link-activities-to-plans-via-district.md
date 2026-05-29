# Auto-link Activities to Plans via their Districts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Whenever an activity gains a district, automatically attach that activity to every territory plan containing the district — silently, across all owners/statuses/fiscal years.

**Architecture:** A single server-only helper `findPlanIdsForDistricts(leaids, db?)` does the `territory_plan_districts` lookup (distinct `plan_id`). Three write paths call it and merge the discovered plan IDs into the `ActivityPlan` rows they create: the activity-create route, the add-district route, and the calendar confirm flow. The helper accepts an optional Prisma transaction client so it can run inside the calendar `$transaction`.

**Tech Stack:** Next.js App Router API routes, Prisma/PostgreSQL, Vitest + Testing Library (jsdom), `vi.mock("@/lib/prisma")` mocking pattern.

**Spec:** `docs/superpowers/specs/2026-05-28-auto-link-activities-to-plans-via-district-design.md`

---

### Task 1: Shared helper `findPlanIdsForDistricts`

**Files:**
- Create: `src/features/activities/lib/plan-linking.ts`
- Test: `src/features/activities/lib/__tests__/plan-linking.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/activities/lib/__tests__/plan-linking.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlanDistrict: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { findPlanIdsForDistricts } from "../plan-linking";

describe("findPlanIdsForDistricts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] for empty input without querying", async () => {
    const result = await findPlanIdsForDistricts([]);
    expect(result).toEqual([]);
    expect(mockPrisma.territoryPlanDistrict.findMany).not.toHaveBeenCalled();
  });

  it("returns distinct planIds for districts that are in plans", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ]);

    const result = await findPlanIdsForDistricts(["0601234", "0605678"]);

    expect(result).toEqual(["plan-1", "plan-2"]);
    expect(mockPrisma.territoryPlanDistrict.findMany).toHaveBeenCalledWith({
      where: { districtLeaid: { in: ["0601234", "0605678"] } },
      select: { planId: true },
      distinct: ["planId"],
    });
  });

  it("returns [] when no plan contains the districts", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);
    const result = await findPlanIdsForDistricts(["9999999"]);
    expect(result).toEqual([]);
  });

  it("uses the provided transaction client when given one", async () => {
    const txFindMany = vi.fn().mockResolvedValue([{ planId: "plan-tx" }]);
    const tx = { territoryPlanDistrict: { findMany: txFindMany } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findPlanIdsForDistricts(["0601234"], tx as any);

    expect(result).toEqual(["plan-tx"]);
    expect(txFindMany).toHaveBeenCalledOnce();
    expect(mockPrisma.territoryPlanDistrict.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/activities/lib/__tests__/plan-linking.test.ts`
Expected: FAIL — cannot resolve `../plan-linking` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/features/activities/lib/plan-linking.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Returns the distinct planIds of every territory plan that contains any of the
 * given district leaids. No owner/status/fiscal-year filtering — auto-linking
 * attaches the activity to all of them.
 *
 * Accepts an optional transaction client so it can run inside a $transaction.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/activities/lib/__tests__/plan-linking.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/activities/lib/plan-linking.ts src/features/activities/lib/__tests__/plan-linking.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(activities): add findPlanIdsForDistricts helper"
```

---

### Task 2: Wire helper into `POST /api/activities` (create)

**Files:**
- Modify: `src/app/api/activities/route.ts` (import near top; logic at ~line 525–560)
- Modify (test): `src/app/api/activities/__tests__/route.test.ts`

Note: the existing "creates activity with relations" test (line ~515) does NOT
mock `territoryPlanDistrict.findMany`. Once POST calls the helper, that mock
returns `undefined` and `.map` throws. Step 1 below fixes that existing test
AND adds a new auto-link test.

- [ ] **Step 1: Write the failing/updated tests**

In `src/app/api/activities/__tests__/route.test.ts`, inside the existing
"creates activity with relations" test (the `it(...)` starting ~line 515),
add a `territoryPlanDistrict.findMany` mock right after the district mock so
the existing assertions still hold (district `0601234` is only in `plan-1`,
which the caller already passed — so no NEW plans, `plans.create` stays
`[{ planId: "plan-1" }]`):

```ts
    // Mock district lookup for state derivation
    mockPrisma.district.findMany.mockResolvedValue([
      { stateFips: "06" },
    ] as never);
    // Auto-link lookup: district 0601234 lives only in plan-1 (already passed)
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
    ] as never);
```

Then add a NEW test at the end of the `describe("POST /api/activities", ...)`
block (before its closing `});` at ~line 624):

```ts
  it("auto-links plans that contain the activity's districts", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);

    mockPrisma.district.findMany.mockResolvedValue([
      { stateFips: "06" },
    ] as never);
    // District 0601234 lives in plan-1 (caller-supplied) AND plan-2 (auto)
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ] as never);

    mockPrisma.activity.create.mockResolvedValue({
      id: "new-activity-2",
      type: "discovery_call",
      title: "Demo",
      notes: null,
      startDate: null,
      endDate: null,
      status: "planned",
      metadata: null,
      createdByUserId: "user-1",
      createdAt: new Date("2026-02-23T00:00:00Z"),
      updatedAt: new Date("2026-02-23T00:00:00Z"),
      plans: [],
      districts: [],
      contacts: [],
      states: [],
      expenses: [],
      attendees: [],
      relations: [],
      relatedTo: [],
    } as never);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        type: "discovery_call",
        title: "Demo",
        planIds: ["plan-1"],
        districtLeaids: ["0601234"],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // create() called with both plan-1 (supplied) and plan-2 (auto), deduped
    const createArg = mockPrisma.activity.create.mock.calls[0][0];
    const createdPlanIds = createArg.data.plans.create.map(
      (p: { planId: string }) => p.planId,
    );
    expect(createdPlanIds.sort()).toEqual(["plan-1", "plan-2"]);
    expect(createArg.data.districts.create).toHaveLength(1);
  });
```

- [ ] **Step 2: Run tests to verify state**

Run: `npm test -- src/app/api/activities/__tests__/route.test.ts -t "POST /api/activities"`
Expected: the new "auto-links plans" test FAILS (only `plan-1` in
`plans.create`, missing `plan-2`). The existing "creates activity with
relations" test should PASS (mock added in Step 1).

- [ ] **Step 3: Implement the wiring**

In `src/app/api/activities/route.ts`:

Add the import alongside the other imports at the top of the file:

```ts
import { findPlanIdsForDistricts } from "@/features/activities/lib/plan-linking";
```

Locate this block (currently ~line 525):

```ts
    const allDistrictLeaids = [...new Set([...districtLeaids, ...districtDetails.map((d: { leaid: string }) => d.leaid)])];

    // Create activity with all relations
    const activity = await prisma.activity.create({
```

Insert the auto-link lookup between them:

```ts
    const allDistrictLeaids = [...new Set([...districtLeaids, ...districtDetails.map((d: { leaid: string }) => d.leaid)])];

    // Auto-link: attach this activity to every plan that contains any of its
    // districts (in addition to caller-supplied planIds), deduped.
    const autoPlanIds = await findPlanIdsForDistricts(allDistrictLeaids);
    const mergedPlanIds = [...new Set([...planIds, ...autoPlanIds])];

    // Create activity with all relations
    const activity = await prisma.activity.create({
```

Then change the `plans.create` mapping (currently ~line 545) from `planIds`
to `mergedPlanIds`:

```ts
        plans: {
          create: mergedPlanIds.map((planId: string) => ({ planId })),
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/api/activities/__tests__/route.test.ts`
Expected: PASS (all tests in the file, including the new auto-link test).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/activities/route.ts src/app/api/activities/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(activities): auto-link plans by district on activity create"
```

---

### Task 3: Wire helper into `POST /api/activities/[id]/districts` (add-district)

**Files:**
- Modify: `src/app/api/activities/[id]/districts/route.ts`
- Create (test): `src/app/api/activities/[id]/districts/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/activities/[id]/districts/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockIsAdmin = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    activity: { findUnique: vi.fn() },
    district: { findMany: vi.fn() },
    activityDistrict: { createMany: vi.fn() },
    activityState: { findMany: vi.fn(), createMany: vi.fn() },
    activityPlan: { createMany: vi.fn() },
    territoryPlanDistrict: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { POST } from "../route";

const TEST_USER = { id: "user-1", email: "test@example.com" };

function makeRequest(body: unknown) {
  return new NextRequest(
    new URL("/api/activities/act-1/districts", "http://localhost:3000"),
    { method: "POST", body: JSON.stringify(body) } as never,
  );
}

const params = Promise.resolve({ id: "act-1" });

describe("POST /api/activities/[id]/districts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "act-1",
      createdByUserId: "user-1",
    });
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0601234", stateFips: "06" },
    ]);
    mockPrisma.activityDistrict.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.activityState.findMany.mockResolvedValue([]);
    mockPrisma.activityState.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.activityPlan.createMany.mockResolvedValue({ count: 2 });
  });

  it("auto-links plans containing the added district", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ]);

    const res = await POST(makeRequest({ leaids: ["0601234"] }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plansLinked).toBe(2);
    expect(mockPrisma.activityPlan.createMany).toHaveBeenCalledWith({
      data: [
        { activityId: "act-1", planId: "plan-1" },
        { activityId: "act-1", planId: "plan-2" },
      ],
      skipDuplicates: true,
    });
  });

  it("links no plans when the district is in no plan", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest({ leaids: ["0601234"] }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plansLinked).toBe(0);
    expect(mockPrisma.activityPlan.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/activities/[id]/districts/__tests__/route.test.ts`
Expected: FAIL — response body has no `plansLinked` field, and
`activityPlan.createMany` is never called.

- [ ] **Step 3: Implement the wiring**

In `src/app/api/activities/[id]/districts/route.ts`:

Add the import after the existing imports at the top:

```ts
import { findPlanIdsForDistricts } from "@/features/activities/lib/plan-linking";
```

Locate the `activityDistrict.createMany` block (currently ~line 60):

```ts
    // Create ActivityDistrict records (skip duplicates)
    const result = await prisma.activityDistrict.createMany({
      data: leaids.map((leaid: string) => ({
        activityId: id,
        districtLeaid: leaid,
        warningDismissed: false,
      })),
      skipDuplicates: true,
    });
```

Immediately after it, insert the auto-link block:

```ts
    // Auto-link: attach this activity to every plan that contains any of the
    // newly added districts (idempotent via skipDuplicates).
    const autoPlanIds = await findPlanIdsForDistricts(leaids);
    let plansLinked = 0;
    if (autoPlanIds.length > 0) {
      const planResult = await prisma.activityPlan.createMany({
        data: autoPlanIds.map((planId) => ({ activityId: id, planId })),
        skipDuplicates: true,
      });
      plansLinked = planResult.count;
    }
```

Then update the response (currently ~line 98) to include `plansLinked`:

```ts
    return NextResponse.json({
      linked: result.count,
      activityId: id,
      statesAdded: newStates.length,
      plansLinked,
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/activities/[id]/districts/__tests__/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/activities/\[id\]/districts/route.ts src/app/api/activities/\[id\]/districts/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(activities): auto-link plans by district on add-district endpoint"
```

---

### Task 4: Wire helper into `confirmCalendarEvent` (calendar sync)

**Files:**
- Modify: `src/features/calendar/lib/sync.ts` (`confirmCalendarEvent`, ~line 478–590)
- Create (test): `src/features/calendar/lib/__tests__/confirm-calendar-event.test.ts`

Note: the existing `sync.test.ts` does not exercise `confirmCalendarEvent` and
does not mock `$transaction`. A separate test file keeps that mock isolated.

- [ ] **Step 1: Write the failing test**

Create `src/features/calendar/lib/__tests__/confirm-calendar-event.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Build a tx stub whose methods we can assert on.
const tx = {
  activity: { create: vi.fn() },
  activityPlan: { createMany: vi.fn() },
  activityDistrict: { createMany: vi.fn() },
  district: { findMany: vi.fn() },
  activityContact: { createMany: vi.fn() },
  territoryPlanDistrict: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    calendarEvent: { findUnique: vi.fn(), update: vi.fn() },
    // $transaction immediately invokes the callback with our tx stub
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    // helper called with tx in this flow, but keep a default-client stub too
    territoryPlanDistrict: { findMany: vi.fn() },
  },
}));

vi.mock("@/features/integrations/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => `decrypted_${v}`),
  encrypt: vi.fn((v: string) => `encrypted_${v}`),
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { confirmCalendarEvent } from "../sync";

const USER_ID = "user-123";

describe("confirmCalendarEvent auto-links plans by district", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.calendarEvent.findUnique.mockResolvedValue({
      id: "cal-1",
      userId: USER_ID,
      status: "pending",
      title: "Check-in",
      description: null,
      startTime: new Date("2026-05-01T10:00:00Z"),
      endTime: new Date("2026-05-01T11:00:00Z"),
      googleEventId: "g-1",
      suggestedActivityType: "program_check_in",
      suggestedPlanId: "plan-1",
      suggestedDistrictId: "0601234",
      suggestedContactIds: [],
    });
    mockPrisma.calendarEvent.update.mockResolvedValue({});
    tx.activity.create.mockResolvedValue({ id: "act-1" });
    tx.activityPlan.createMany.mockResolvedValue({ count: 2 });
    tx.activityDistrict.createMany.mockResolvedValue({ count: 1 });
    tx.district.findMany.mockResolvedValue([{ stateFips: "06" }]);
    tx.activityContact.createMany.mockResolvedValue({ count: 0 });
    // District 0601234 is in plan-1 (suggested) AND plan-2 (auto)
    tx.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ]);
  });

  it("attaches the suggested plan plus every other plan containing the district", async () => {
    const result = await confirmCalendarEvent(USER_ID, "cal-1");

    expect(result.activityId).toBe("act-1");

    const planArg = tx.activityPlan.createMany.mock.calls[0][0];
    const linkedPlanIds = planArg.data.map(
      (p: { planId: string }) => p.planId,
    );
    expect(linkedPlanIds.sort()).toEqual(["plan-1", "plan-2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/calendar/lib/__tests__/confirm-calendar-event.test.ts`
Expected: FAIL — only `plan-1` is linked (suggested), `plan-2` missing.

- [ ] **Step 3: Implement the wiring**

In `src/features/calendar/lib/sync.ts`:

Add the import near the top of the file (with the other imports):

```ts
import { findPlanIdsForDistricts } from "@/features/activities/lib/plan-linking";
```

Inside `confirmCalendarEvent`, the linking happens in a `prisma.$transaction`.
At the very top of the transaction callback body (currently the first statement
is `const newActivity = await tx.activity.create({...})` at ~line 513), add the
auto-link lookup BEFORE the activity is created, then merge into the plan list.

Replace the start of the transaction body:

```ts
  const activity = await prisma.$transaction(async (tx) => {
    // Create the activity
    const newActivity = await tx.activity.create({
```

with:

```ts
  const activity = await prisma.$transaction(async (tx) => {
    // Auto-link: every plan containing the resolved districts, in addition to
    // the suggested/override plan(s). Uses tx for read consistency.
    const autoPlanIds = await findPlanIdsForDistricts(districtLeaids, tx);
    const allPlanIds = [...new Set([...planIds, ...autoPlanIds])];

    // Create the activity
    const newActivity = await tx.activity.create({
```

Then change the plan-linking block (currently ~line 528) to use `allPlanIds`:

```ts
    // Link to plans
    if (allPlanIds.length > 0) {
      await tx.activityPlan.createMany({
        data: allPlanIds.map((planId) => ({
          activityId: newActivity.id,
          planId,
        })),
        skipDuplicates: true,
      });
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/calendar/lib/__tests__/confirm-calendar-event.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/calendar/lib/sync.ts src/features/calendar/lib/__tests__/confirm-calendar-event.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(calendar): auto-link plans by district on calendar confirm"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — no regressions, including the existing `sync.test.ts` and the
existing activities `route.test.ts`.

- [ ] **Step 2: TypeScript / lint check**

Run: `npx tsc --noEmit`
Expected: no errors. (If the project has a lint script, also run `npm run lint`.)

- [ ] **Step 3: Final confirmation**

Confirm all four call sites are wired and `findPlanIdsForDistricts` is imported
in: `route.ts` (create), `[id]/districts/route.ts`, and `sync.ts`. No further
commit needed if Tasks 1–4 each committed.

---

## Self-Review Notes

- **Spec coverage:** helper (Task 1), create path (Task 2), add-district path (Task 3), calendar path (Task 4), testing (Tasks 1–5). All spec sections covered.
- **Non-goals respected:** no backfill, no un-linking, no UI badge, no scope filtering.
- **Type consistency:** helper named `findPlanIdsForDistricts` everywhere; returns `string[]`; merged variable is `mergedPlanIds` (create) / `allPlanIds` (calendar) / inlined (districts). `plansLinked` added to the districts response only.
- **Known gotcha handled:** existing "creates activity with relations" test gets a `territoryPlanDistrict.findMany` mock added (Task 2 Step 1) so it doesn't break when POST starts calling the helper.
