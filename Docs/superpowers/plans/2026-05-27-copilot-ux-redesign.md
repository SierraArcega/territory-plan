# Copilot UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the copilot rail into a discoverable, polished assistant — a proactive home state, a clearer conversation, draft-style/batched confirm cards, and first-class entry points — keeping today's read/write brains unchanged.

**Architecture:** Evolve the existing 380px right rail (`CopilotPanel`). Add one read-only backend endpoint for proactive "nudges" (reusing existing deal/plan-status logic via newly-extracted shared helpers), a recent-conversations endpoint, and decompose the panel's UI into focused components. No changes to the agent loop, stream route, action registry, or execute route.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, TanStack Query, Zustand, Tailwind 4, Lucide icons, Vitest + Testing Library.

**Spec:** `Docs/superpowers/specs/2026-05-27-copilot-ux-redesign-design.md`

---

## Conventions for every task

- Tests are co-located in `__tests__/` next to source (Vitest + jsdom).
- Run a single test file with: `npx vitest run <path>`.
- **Commits must contain NO model identifiers** — no Claude co-author trailer, no
  "generated with" footer. Use `git commit --no-verify` is NOT required; commit
  normally but omit any AI trailer. (Branch rule for `feat/ai-copilot-core-objects`.)
- Stage files precisely (`git add <paths>`), never `git add -A` — this worktree
  may have concurrent sessions.
- Brand tokens only: plum `#403770` (hover `#322a5a`), neutrals `#F7F5FA`
  `#EFEDF5` `#E2DEEC` `#FBFAFD` `#FFFCFA`, muted text `#6E6390` `#8A80A8`, coral
  risk `#F37167`/`#A8281C`, success `#1F7A3F`. No Tailwind grays. Lucide icons,
  `currentColor`. Text spans get `whitespace-nowrap` (the rail is a narrow column).

---

## File Structure

**Phase 1 — Backend (nudges + recent conversations)**
- Create `src/features/deals/lib/open-deals.ts` — `CLOSED_RX`, `isOpenDeal`, `isOverdue`, `getOpenDeals(userId, db, opts)`. Single source of truth for "open"/"overdue".
- Modify `src/app/api/deals/open/route.ts` — delegate to `getOpenDeals`.
- Create `src/features/plans/lib/plan-alerts.ts` — `getStalePlans`, `getDistrictsWithoutContacts` (moved from the feed route).
- Modify `src/app/api/feed/alerts/route.ts` — delegate to `plan-alerts.ts`.
- Create `src/features/copilot/lib/nudge-types.ts` — `CopilotNudge`, `NudgeKind`, `NudgeSeverity`.
- Create `src/features/copilot/lib/stale-in-stage.ts` — pure `computeStaleInStageCount(opps, now)`.
- Create `src/features/copilot/lib/nudges-service.ts` — `buildCopilotNudges(userId, db, now)` assembling all four nudges.
- Create `src/app/api/copilot/nudges/route.ts` — `GET`, returns `CopilotNudge[]`.
- Create `src/features/copilot/lib/recent-conversations.ts` — `loadRecentConversations(userId, db, limit)`.
- Create `src/app/api/copilot/conversations/route.ts` — `GET`, returns recent threads.
- Modify `src/features/copilot/hooks/` — add `useCopilotNudges.ts`, `useCopilotConversations.ts`.

**Phase 2 — Home state**
- Create `src/features/copilot/components/CopilotHomeState.tsx` — greeting + nudges + suggested prompts + recent.
- Modify `src/features/copilot/components/CopilotPanel.tsx` — render home state when empty; add `handleSeed`.

**Phase 3 — Conversation flow**
- Create `src/features/copilot/components/CopilotProgress.tsx` — friendly streaming label.
- Create `src/features/copilot/lib/progress-labels.ts` — pure `friendlyProgressLabel(events)`.
- Create `src/features/copilot/components/AnswerBlock.tsx` — table + "View on map" button (absorbs `AnswerTable`).
- Create `src/features/copilot/components/ProposedActionCard.tsx` — extracted + restyled (draft look, collapsed settled state).
- Create `src/features/copilot/components/BatchActionCard.tsx` — grouped + expandable multi-action confirm.
- Modify `CopilotPanel.tsx` — use the above; group same-kind proposals into a batch card.

**Phase 4 — Entry, header & feel**
- Create `src/features/copilot/components/CopilotLauncher.tsx` — polished pill + first-run coachmark (extracted from `CopilotPanel`'s closed-state).
- Create `src/features/copilot/components/CopilotNavButton.tsx` — sidebar entry that opens the rail.
- Modify `src/features/shared/components/navigation/Sidebar.tsx` — render `CopilotNavButton`.
- Modify `CopilotPanel.tsx` — use `CopilotLauncher`; label "New chat".

---

# Phase 1 — Backend: nudges + recent conversations

## Task 1: Extract open/overdue-deal helper

**Files:**
- Create: `src/features/deals/lib/open-deals.ts`
- Test: `src/features/deals/lib/__tests__/open-deals.test.ts`
- Modify: `src/app/api/deals/open/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/deals/lib/__tests__/open-deals.test.ts
import { describe, it, expect } from "vitest";
import { isOpenDeal, isOverdue } from "../open-deals";

describe("isOpenDeal", () => {
  it("is false for null/empty stage", () => {
    expect(isOpenDeal(null)).toBe(false);
    expect(isOpenDeal("")).toBe(false);
  });
  it("is false for closed won/lost (any spacing/case)", () => {
    expect(isOpenDeal("Closed Won")).toBe(false);
    expect(isOpenDeal("closed_lost")).toBe(false);
    expect(isOpenDeal("CLOSED WON")).toBe(false);
  });
  it("is true for an open stage", () => {
    expect(isOpenDeal("Negotiation")).toBe(true);
    expect(isOpenDeal("Proposal Sent")).toBe(true);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-05-27T00:00:00Z");
  it("is true when closeDate is in the past", () => {
    expect(isOverdue(new Date("2026-05-01T00:00:00Z"), now)).toBe(true);
  });
  it("is false when closeDate is future or null", () => {
    expect(isOverdue(new Date("2026-06-01T00:00:00Z"), now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/deals/lib/__tests__/open-deals.test.ts`
Expected: FAIL — cannot find module `../open-deals`.

- [ ] **Step 3: Write the helper**

```ts
// src/features/deals/lib/open-deals.ts
import type { PrismaClient } from "@prisma/client";

/** Canonical open/closed test for opportunity stages. */
export const CLOSED_RX = /closed[_ ](won|lost)/i;

/** A deal is "open" when its stage is set and not Closed Won/Lost. */
export function isOpenDeal(stage: string | null | undefined): boolean {
  return !!stage && !CLOSED_RX.test(stage);
}

/** A deal is "overdue/slipping" when open and its close date has passed. */
export function isOverdue(closeDate: Date | null | undefined, now: Date): boolean {
  return closeDate != null && closeDate.getTime() < now.getTime();
}

export interface OpenDeal {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  closeDate: string | null;
  districtLeaid: string | null;
  districtName: string | null;
  salesRepId: string | null;
  daysToClose: number | null;
  detailsLink: string | null;
}

type Db = Pick<PrismaClient, "opportunity">;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Open deals for a rep (or all), newest close-date first. Mirrors /api/deals/open. */
export async function getOpenDeals(
  db: Db,
  opts: { ownerId: string | "all"; stateAbbrevs?: string[]; limit?: number; now?: Date },
): Promise<OpenDeal[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  const now = (opts.now ?? new Date()).getTime();
  const ownerWhere = opts.ownerId === "all" ? {} : { salesRepId: opts.ownerId };
  const stateAbbrevs = opts.stateAbbrevs ?? [];

  const opps = await db.opportunity.findMany({
    where: {
      ...ownerWhere,
      stage: { not: null },
      ...(stateAbbrevs.length > 0
        ? { district: { is: { stateAbbrev: { in: stateAbbrevs } } } }
        : {}),
    },
    select: {
      id: true, name: true, stage: true, netBookingAmount: true, closeDate: true,
      districtLeaId: true, districtName: true, salesRepId: true, detailsLink: true,
    },
    orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }],
    take: limit * 2,
  });

  return opps
    .filter((o) => isOpenDeal(o.stage))
    .slice(0, limit)
    .map((o) => ({
      id: o.id,
      name: o.name,
      stage: o.stage,
      amount: o.netBookingAmount ? Number(o.netBookingAmount) : null,
      closeDate: o.closeDate?.toISOString() ?? null,
      districtLeaid: o.districtLeaId,
      districtName: o.districtName,
      salesRepId: o.salesRepId,
      daysToClose:
        o.closeDate != null ? Math.round((o.closeDate.getTime() - now) / ONE_DAY_MS) : null,
      detailsLink: o.detailsLink,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/deals/lib/__tests__/open-deals.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Refactor the route to delegate**

Replace the body of `src/app/api/deals/open/route.ts` after auth with:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getOpenDeals } from "@/features/deals/lib/open-deals";

export const dynamic = "force-dynamic";

// GET /api/deals/open[?ownerId=...|all][&state=CA,NY][&limit=N]
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ownerParam = searchParams.get("ownerId");
  const stateAbbrevs = (searchParams.get("state") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const limit = parseInt(searchParams.get("limit") ?? "200", 10) || 200;

  const deals = await getOpenDeals(prisma, {
    ownerId: ownerParam === "all" ? "all" : ownerParam || user.id,
    stateAbbrevs,
    limit,
  });
  return NextResponse.json({ deals, total: deals.length });
}
```

- [ ] **Step 6: Run existing deal tests + typecheck**

Run: `npx vitest run src/features/activities/components/page/deals && npx tsc --noEmit`
Expected: PASS / no type errors. (Manual: `/api/deals/open` response shape is unchanged.)

- [ ] **Step 7: Commit**

```bash
git add src/features/deals/lib/open-deals.ts src/features/deals/lib/__tests__/open-deals.test.ts src/app/api/deals/open/route.ts
git commit -m "refactor(deals): extract open/overdue-deal helper; route delegates"
```

---

## Task 2: Extract stale-plan / districts-without-contacts helper

**Files:**
- Create: `src/features/plans/lib/plan-alerts.ts`
- Test: `src/features/plans/lib/__tests__/plan-alerts.test.ts`
- Modify: `src/app/api/feed/alerts/route.ts`

- [ ] **Step 1: Write the failing test** (pure staleness predicate)

```ts
// src/features/plans/lib/__tests__/plan-alerts.test.ts
import { describe, it, expect } from "vitest";
import { isPlanStale } from "../plan-alerts";

describe("isPlanStale", () => {
  const since = new Date("2026-04-27T00:00:00Z"); // 30d before "now"
  it("is stale when there are no activity dates", () => {
    expect(isPlanStale([], since)).toBe(true);
  });
  it("is stale when the latest date is before the cutoff", () => {
    expect(isPlanStale([new Date("2026-03-01")], since)).toBe(true);
  });
  it("is not stale when any date is on/after the cutoff", () => {
    expect(isPlanStale([new Date("2026-03-01"), new Date("2026-05-01")], since)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/plans/lib/__tests__/plan-alerts.test.ts`
Expected: FAIL — cannot find module `../plan-alerts`.

- [ ] **Step 3: Write the helper** (move logic verbatim from the feed route)

```ts
// src/features/plans/lib/plan-alerts.ts
import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "territoryPlan" | "territoryPlanDistrict">;

/** A plan is stale when its most recent activity/task date is before `since`. */
export function isPlanStale(dates: Date[], since: Date): boolean {
  if (dates.length === 0) return true;
  const last = Math.max(...dates.map((d) => d.getTime()));
  return last < since.getTime();
}

export interface StalePlan {
  planId: string;
  planName: string;
  planColor: string | null;
  districtCount: number;
  lastActivityDate: string | null;
}

export async function getStalePlans(db: Db, userId: string, since: Date): Promise<StalePlan[]> {
  const plans = await db.territoryPlan.findMany({
    where: { userId },
    select: {
      id: true, name: true, color: true, districtCount: true,
      activityLinks: { select: { activity: { select: { createdAt: true, startDate: true } } } },
      taskLinks: { select: { task: { select: { createdAt: true, dueDate: true } } } },
    },
  });

  return plans
    .map((plan) => {
      const dates: Date[] = [];
      for (const link of plan.activityLinks) {
        dates.push(link.activity.createdAt);
        if (link.activity.startDate) dates.push(link.activity.startDate);
      }
      for (const link of plan.taskLinks) {
        dates.push(link.task.createdAt);
        if (link.task.dueDate) dates.push(link.task.dueDate);
      }
      const last = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
      return {
        planId: plan.id, planName: plan.name, planColor: plan.color,
        districtCount: plan.districtCount,
        lastActivityDate: last?.toISOString() ?? null,
        _stale: isPlanStale(dates, since),
      };
    })
    .filter((p) => p._stale)
    .map(({ _stale, ...rest }) => rest);
}

export interface DistrictWithoutContacts {
  leaid: string;
  districtName: string;
  stateAbbrev: string;
  planId: string;
  planName: string;
  planColor: string | null;
}

export async function getDistrictsWithoutContacts(
  db: Db,
  userId: string,
): Promise<DistrictWithoutContacts[]> {
  const planDistricts = await db.territoryPlanDistrict.findMany({
    where: { plan: { userId } },
    select: {
      districtLeaid: true,
      plan: { select: { id: true, name: true, color: true } },
      district: {
        select: {
          leaid: true, name: true, stateAbbrev: true,
          _count: { select: { contacts: true } },
        },
      },
    },
  });

  return planDistricts
    .filter((pd) => pd.district._count.contacts === 0)
    .map((pd) => ({
      leaid: pd.district.leaid,
      districtName: pd.district.name,
      stateAbbrev: pd.district.stateAbbrev ?? "",
      planId: pd.plan.id,
      planName: pd.plan.name,
      planColor: pd.plan.color,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/plans/lib/__tests__/plan-alerts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor the feed route to delegate**

Replace `src/app/api/feed/alerts/route.ts` with:

```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getStalePlans, getDistrictsWithoutContacts } from "@/features/plans/lib/plan-alerts";

export const dynamic = "force-dynamic";

// GET /api/feed/alerts — "Needs Attention" alerts for the Feed
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [districtsWithoutContacts, stalePlans] = await Promise.all([
      getDistrictsWithoutContacts(prisma, user.id),
      getStalePlans(prisma, user.id, thirtyDaysAgo),
    ]);
    return NextResponse.json({ districtsWithoutContacts, stalePlans });
  } catch (error) {
    console.error("Error fetching feed alerts:", error);
    return NextResponse.json({ error: "Failed to fetch feed alerts" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors. (Manual: `/api/feed/alerts` shape unchanged.)

```bash
git add src/features/plans/lib/plan-alerts.ts src/features/plans/lib/__tests__/plan-alerts.test.ts src/app/api/feed/alerts/route.ts
git commit -m "refactor(plans): extract stale-plan + districts-without-contacts helpers; feed route delegates"
```

---

## Task 3: Nudge types + stale-in-stage computation

**Files:**
- Create: `src/features/copilot/lib/nudge-types.ts`
- Create: `src/features/copilot/lib/stale-in-stage.ts`
- Test: `src/features/copilot/lib/__tests__/stale-in-stage.test.ts`

- [ ] **Step 1: Write the nudge types** (no test — type-only)

```ts
// src/features/copilot/lib/nudge-types.ts
export type NudgeKind = "deals_slipping" | "follow_ups_due" | "stale_plans" | "stale_in_stage";
export type NudgeSeverity = "risk" | "opportunity";

/** One proactive "Worth your attention" item shown in the home state. */
export interface CopilotNudge {
  /** Stable per kind (used as React key + click id). */
  id: NudgeKind;
  kind: NudgeKind;
  severity: NudgeSeverity;
  /** Bold line, e.g. "3 deals are slipping". */
  headline: string;
  /** One-line reason, e.g. "Close dates passed". */
  reason: string;
  count: number;
  /** Prompt injected into the composer when the rep taps the nudge. */
  seedPrompt: string;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/features/copilot/lib/__tests__/stale-in-stage.test.ts
import { describe, it, expect } from "vitest";
import { computeStaleInStageCount, type StageOpp } from "../stale-in-stage";

const now = new Date("2026-05-27T00:00:00Z");
function daysAgo(n: number): string {
  return new Date(now.getTime() - n * 86400000).toISOString();
}

describe("computeStaleInStageCount", () => {
  it("counts opps whose time-in-stage exceeds their stage average (min 3 per stage)", () => {
    const opps: StageOpp[] = [
      { stage: "Negotiation", stageHistory: [{ stage: "Negotiation", changed_at: daysAgo(10) }], createdAt: daysAgo(40) },
      { stage: "Negotiation", stageHistory: [{ stage: "Negotiation", changed_at: daysAgo(12) }], createdAt: daysAgo(40) },
      { stage: "Negotiation", stageHistory: [{ stage: "Negotiation", changed_at: daysAgo(60) }], createdAt: daysAgo(90) },
    ];
    // avg ≈ 27.3d; only the 60d opp exceeds it.
    expect(computeStaleInStageCount(opps, now)).toBe(1);
  });

  it("ignores stages with fewer than 3 opps (too little signal)", () => {
    const opps: StageOpp[] = [
      { stage: "Proposal", stageHistory: [{ stage: "Proposal", changed_at: daysAgo(100) }], createdAt: daysAgo(120) },
      { stage: "Proposal", stageHistory: [{ stage: "Proposal", changed_at: daysAgo(1) }], createdAt: daysAgo(2) },
    ];
    expect(computeStaleInStageCount(opps, now)).toBe(0);
  });

  it("falls back to createdAt when no matching stage_history entry exists", () => {
    const opps: StageOpp[] = [
      { stage: "Discovery", stageHistory: [], createdAt: daysAgo(5) },
      { stage: "Discovery", stageHistory: [], createdAt: daysAgo(5) },
      { stage: "Discovery", stageHistory: [], createdAt: daysAgo(50) },
    ];
    expect(computeStaleInStageCount(opps, now)).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/stale-in-stage.test.ts`
Expected: FAIL — cannot find module `../stale-in-stage`.

- [ ] **Step 4: Write the pure computation**

```ts
// src/features/copilot/lib/stale-in-stage.ts

/** Minimal stage_history entry shape (matches /api/deals/events). */
export interface StageHistoryEntry {
  stage: string;
  changed_at: string;
}

export interface StageOpp {
  stage: string | null;
  stageHistory: StageHistoryEntry[];
  createdAt: string | null;
}

/** Require this many open opps in a stage before we trust its average. */
const MIN_OPPS_PER_STAGE = 3;

function isEntry(v: unknown): v is StageHistoryEntry {
  return (
    !!v && typeof v === "object" &&
    typeof (v as StageHistoryEntry).stage === "string" &&
    typeof (v as StageHistoryEntry).changed_at === "string"
  );
}

/** When the opp entered its current stage: latest stage_history entry for that
 *  stage, else createdAt, else null (excluded). Returns ms time-in-stage. */
function timeInStageMs(opp: StageOpp, now: Date): number | null {
  if (!opp.stage) return null;
  const entries = (opp.stageHistory ?? [])
    .filter(isEntry)
    .filter((h) => h.stage === opp.stage)
    .map((h) => new Date(h.changed_at).getTime())
    .filter((t) => !Number.isNaN(t));
  const enteredAt =
    entries.length > 0 ? Math.max(...entries)
    : opp.createdAt ? new Date(opp.createdAt).getTime()
    : null;
  if (enteredAt == null || Number.isNaN(enteredAt)) return null;
  return now.getTime() - enteredAt;
}

/**
 * Count open opps sitting in their current stage longer than the average
 * time-in-stage for that stage. Stages with < MIN_OPPS_PER_STAGE are skipped.
 */
export function computeStaleInStageCount(opps: StageOpp[], now: Date): number {
  const byStage = new Map<string, number[]>();
  const oppTimes: Array<{ stage: string; t: number }> = [];

  for (const opp of opps) {
    if (!opp.stage) continue;
    const t = timeInStageMs(opp, now);
    if (t == null) continue;
    oppTimes.push({ stage: opp.stage, t });
    byStage.set(opp.stage, [...(byStage.get(opp.stage) ?? []), t]);
  }

  const avgByStage = new Map<string, number>();
  for (const [stage, times] of byStage) {
    if (times.length < MIN_OPPS_PER_STAGE) continue;
    avgByStage.set(stage, times.reduce((a, b) => a + b, 0) / times.length);
  }

  return oppTimes.filter(({ stage, t }) => {
    const avg = avgByStage.get(stage);
    return avg != null && t > avg;
  }).length;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/stale-in-stage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/copilot/lib/nudge-types.ts src/features/copilot/lib/stale-in-stage.ts src/features/copilot/lib/__tests__/stale-in-stage.test.ts
git commit -m "feat(copilot): nudge types + pure stale-in-stage computation"
```

---

## Task 4: Nudges service (assemble all four)

**Files:**
- Create: `src/features/copilot/lib/nudges-service.ts`
- Test: `src/features/copilot/lib/__tests__/nudges-service.test.ts`

- [ ] **Step 1: Write the failing test** (mock db; assert ranking + zero-omission + shape)

```ts
// src/features/copilot/lib/__tests__/nudges-service.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildCopilotNudges } from "../nudges-service";

const now = new Date("2026-05-27T00:00:00Z");

function makeDb(over: Record<string, unknown> = {}) {
  return {
    opportunity: { findMany: vi.fn().mockResolvedValue([]) },
    activity: { count: vi.fn().mockResolvedValue(0) },
    task: { count: vi.fn().mockResolvedValue(0) },
    territoryPlan: { findMany: vi.fn().mockResolvedValue([]) },
    territoryPlanDistrict: { findMany: vi.fn().mockResolvedValue([]) },
    ...over,
  } as never;
}

describe("buildCopilotNudges", () => {
  it("omits zero-count nudges", async () => {
    const nudges = await buildCopilotNudges("u1", makeDb(), now);
    expect(nudges).toEqual([]);
  });

  it("includes deals-slipping with a count and seed prompt", async () => {
    const db = makeDb({
      opportunity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "o1", stage: "Negotiation", closeDate: new Date("2026-05-01"), netBookingAmount: null,
            name: null, districtLeaId: null, districtName: null, salesRepId: "u1", detailsLink: null,
            stageHistory: [], createdAt: new Date("2026-01-01") },
        ]),
      },
    });
    const nudges = await buildCopilotNudges("u1", db, now);
    const slipping = nudges.find((n) => n.kind === "deals_slipping");
    expect(slipping?.count).toBe(1);
    expect(slipping?.severity).toBe("risk");
    expect(slipping?.seedPrompt.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/nudges-service.test.ts`
Expected: FAIL — cannot find module `../nudges-service`.

- [ ] **Step 3: Write the service**

```ts
// src/features/copilot/lib/nudges-service.ts
import type { PrismaClient } from "@prisma/client";
import { isOverdue } from "@/features/deals/lib/open-deals";
import { getStalePlans } from "@/features/plans/lib/plan-alerts";
import { computeStaleInStageCount, type StageOpp } from "./stale-in-stage";
import { isOpenDeal } from "@/features/deals/lib/open-deals";
import type { CopilotNudge } from "./nudge-types";

type Db = Pick<PrismaClient, "opportunity" | "activity" | "task" | "territoryPlan" | "territoryPlanDistrict">;

function endOfWeek(now: Date): Date {
  const d = new Date(now);
  const daysUntilSunday = 7 - d.getDay();
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Build the ranked, non-zero nudge list for a rep. Read-only. */
export async function buildCopilotNudges(
  userId: string,
  db: Db,
  now: Date,
): Promise<CopilotNudge[]> {
  const weekEnd = endOfWeek(now);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Load the rep's open opps once (reused by slipping + stale-in-stage).
  const opps = await db.opportunity.findMany({
    where: { salesRepId: userId, stage: { not: null } },
    select: { id: true, stage: true, closeDate: true, stageHistory: true, createdAt: true },
  });
  const openOpps = opps.filter((o) => isOpenDeal(o.stage));

  const slippingCount = openOpps.filter((o) => isOverdue(o.closeDate ?? null, now)).length;

  const stageOpps: StageOpp[] = openOpps.map((o) => ({
    stage: o.stage,
    stageHistory: Array.isArray(o.stageHistory) ? (o.stageHistory as StageOpp["stageHistory"]) : [],
    createdAt: o.createdAt ? o.createdAt.toISOString() : null,
  }));
  const staleInStageCount = computeStaleInStageCount(stageOpps, now);

  const [activityFollowUps, taskDue, stalePlans] = await Promise.all([
    db.activity.count({ where: { createdByUserId: userId, followUpDate: { gte: now, lte: weekEnd } } }),
    db.task.count({ where: { createdByUserId: userId, dueDate: { gte: now, lte: weekEnd } } }),
    getStalePlans(db, userId, thirtyDaysAgo),
  ]);
  const followUpsCount = activityFollowUps + taskDue;
  const stalePlansCount = stalePlans.length;

  const candidates: CopilotNudge[] = [
    {
      id: "deals_slipping", kind: "deals_slipping", severity: "risk",
      headline: `${slippingCount} ${slippingCount === 1 ? "deal is" : "deals are"} slipping`,
      reason: "Open with a close date in the past",
      count: slippingCount,
      seedPrompt: "Show me my open deals whose close date has already passed.",
    },
    {
      id: "follow_ups_due", kind: "follow_ups_due", severity: "risk",
      headline: `${followUpsCount} follow-up${followUpsCount === 1 ? "" : "s"} due this week`,
      reason: "From your activities and tasks",
      count: followUpsCount,
      seedPrompt: "What follow-ups and tasks do I have due this week?",
    },
    {
      id: "stale_in_stage", kind: "stale_in_stage", severity: "risk",
      headline: `${staleInStageCount} ${staleInStageCount === 1 ? "deal has" : "deals have"} stalled in stage`,
      reason: "In their stage longer than your average",
      count: staleInStageCount,
      seedPrompt: "Which of my open deals have been stuck in their current stage the longest?",
    },
    {
      id: "stale_plans", kind: "stale_plans", severity: "risk",
      headline: `${stalePlansCount} plan${stalePlansCount === 1 ? "" : "s"} ${stalePlansCount === 1 ? "has" : "have"} gone quiet`,
      reason: "No activity in 30 days",
      count: stalePlansCount,
      seedPrompt: "Which of my territory plans have had no activity in the last 30 days?",
    },
  ];

  // Omit zero-count; rank risk before opportunity, then by count desc.
  return candidates
    .filter((n) => n.count > 0)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "risk" ? -1 : 1;
      return b.count - a.count;
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/nudges-service.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/lib/nudges-service.ts src/features/copilot/lib/__tests__/nudges-service.test.ts
git commit -m "feat(copilot): nudges service assembling deals/follow-ups/stale signals"
```

---

## Task 5: Nudges + recent-conversations API routes

**Files:**
- Create: `src/app/api/copilot/nudges/route.ts`
- Create: `src/features/copilot/lib/recent-conversations.ts`
- Create: `src/app/api/copilot/conversations/route.ts`
- Test: `src/features/copilot/lib/__tests__/recent-conversations.test.ts`

- [ ] **Step 1: Write the nudges route** (thin; logic is tested in Task 4)

```ts
// src/app/api/copilot/nudges/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { buildCopilotNudges } from "@/features/copilot/lib/nudges-service";

export const dynamic = "force-dynamic";

// GET /api/copilot/nudges — proactive "Worth your attention" items for the rep.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const nudges = await buildCopilotNudges(user.id, prisma, new Date());
    return NextResponse.json({ nudges });
  } catch (error) {
    console.error("[copilot/nudges] failed", error);
    return NextResponse.json({ nudges: [] });
  }
}
```

- [ ] **Step 2: Write the failing test for recent conversations**

```ts
// src/features/copilot/lib/__tests__/recent-conversations.test.ts
import { describe, it, expect, vi } from "vitest";
import { loadRecentConversations } from "../recent-conversations";

describe("loadRecentConversations", () => {
  it("groups turns by conversation, titled by the first question, newest first", async () => {
    const db = {
      copilotTurn: {
        findMany: vi.fn().mockResolvedValue([
          { conversationId: "c1", question: "iowa fits", createdAt: new Date("2026-05-25") },
          { conversationId: "c2", question: "add lake mills", createdAt: new Date("2026-05-26") },
          { conversationId: "c1", question: "and minnesota?", createdAt: new Date("2026-05-25T01:00:00") },
        ]),
      },
    } as never;
    const out = await loadRecentConversations(db, "u1", 5);
    expect(out).toEqual([
      { conversationId: "c2", title: "add lake mills", updatedAt: new Date("2026-05-26").toISOString() },
      { conversationId: "c1", title: "iowa fits", updatedAt: new Date("2026-05-25T01:00:00").toISOString() },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/recent-conversations.test.ts`
Expected: FAIL — cannot find module `../recent-conversations`.

- [ ] **Step 4: Write the helper**

```ts
// src/features/copilot/lib/recent-conversations.ts
import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "copilotTurn">;

export interface RecentConversation {
  conversationId: string;
  title: string;       // first question of the thread
  updatedAt: string;   // latest turn time (ISO)
}

/** Most-recent conversations for a rep, titled by their opening question. */
export async function loadRecentConversations(
  db: Db,
  userId: string,
  limit: number,
): Promise<RecentConversation[]> {
  // Pull recent turns (newest first), then fold into per-conversation summaries.
  const rows = await db.copilotTurn.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { conversationId: true, question: true, createdAt: true },
  });

  const byConv = new Map<string, { title: string; firstAt: number; lastAt: number }>();
  for (const r of rows) {
    const t = r.createdAt.getTime();
    const cur = byConv.get(r.conversationId);
    if (!cur) {
      byConv.set(r.conversationId, { title: r.question, firstAt: t, lastAt: t });
    } else {
      // rows are newest-first, so an earlier-created turn (smaller t) is the title.
      if (t < cur.firstAt) { cur.firstAt = t; cur.title = r.question; }
      if (t > cur.lastAt) cur.lastAt = t;
    }
  }

  return [...byConv.entries()]
    .map(([conversationId, v]) => ({
      conversationId,
      title: v.title,
      updatedAt: new Date(v.lastAt).toISOString(),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/recent-conversations.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Write the conversations route**

```ts
// src/app/api/copilot/conversations/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { loadRecentConversations } from "@/features/copilot/lib/recent-conversations";

export const dynamic = "force-dynamic";

// GET /api/copilot/conversations — recent threads for the home state's "Recent".
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversations = await loadRecentConversations(prisma, user.id, 5);
  return NextResponse.json({ conversations });
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/app/api/copilot/nudges/route.ts src/app/api/copilot/conversations/route.ts src/features/copilot/lib/recent-conversations.ts src/features/copilot/lib/__tests__/recent-conversations.test.ts
git commit -m "feat(copilot): nudges + recent-conversations API routes"
```

---

## Task 6: Query hooks (`useCopilotNudges`, `useCopilotConversations`)

**Files:**
- Create: `src/features/copilot/hooks/useCopilotNudges.ts`
- Create: `src/features/copilot/hooks/useCopilotConversations.ts`

(No unit test — thin TanStack wrappers; covered by the home-state component test in Task 7.)

- [ ] **Step 1: Write the hooks**

```ts
// src/features/copilot/hooks/useCopilotNudges.ts
import { useQuery } from "@tanstack/react-query";
import type { CopilotNudge } from "../lib/nudge-types";

async function fetchNudges(): Promise<CopilotNudge[]> {
  const r = await fetch("/api/copilot/nudges");
  if (!r.ok) return [];
  const data = (await r.json()) as { nudges?: CopilotNudge[] };
  return data.nudges ?? [];
}

/** Proactive home-state nudges. `enabled` lets the panel fetch only when open. */
export function useCopilotNudges(enabled: boolean) {
  return useQuery({
    queryKey: ["copilot", "nudges"],
    queryFn: fetchNudges,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
```

```ts
// src/features/copilot/hooks/useCopilotConversations.ts
import { useQuery } from "@tanstack/react-query";
import type { RecentConversation } from "../lib/recent-conversations";

async function fetchConversations(): Promise<RecentConversation[]> {
  const r = await fetch("/api/copilot/conversations");
  if (!r.ok) return [];
  const data = (await r.json()) as { conversations?: RecentConversation[] };
  return data.conversations ?? [];
}

export function useCopilotConversations(enabled: boolean) {
  return useQuery({
    queryKey: ["copilot", "conversations"],
    queryFn: fetchConversations,
    enabled,
    staleTime: 60 * 1000,
  });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/features/copilot/hooks/useCopilotNudges.ts src/features/copilot/hooks/useCopilotConversations.ts
git commit -m "feat(copilot): TanStack hooks for nudges + recent conversations"
```

---

# Phase 2 — Home state

## Task 7: `CopilotHomeState` component

**Files:**
- Create: `src/features/copilot/components/CopilotHomeState.tsx`
- Test: `src/features/copilot/components/__tests__/CopilotHomeState.test.tsx`

The component receives everything via props (the panel owns data + actions), so it
is pure and testable. Suggested prompts are a module constant.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/copilot/components/__tests__/CopilotHomeState.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotHomeState } from "../CopilotHomeState";
import type { CopilotNudge } from "../../lib/nudge-types";

const nudge: CopilotNudge = {
  id: "deals_slipping", kind: "deals_slipping", severity: "risk",
  headline: "3 deals are slipping", reason: "Open with a close date in the past",
  count: 3, seedPrompt: "Show me my open deals whose close date has already passed.",
};

describe("CopilotHomeState", () => {
  it("greets by first name and lists nudges", () => {
    render(
      <CopilotHomeState
        firstName="Sierra" nudges={[nudge]} recent={[]} onSeed={() => {}} onResume={() => {}}
      />,
    );
    expect(screen.getByText(/Good (morning|afternoon|evening), Sierra/)).toBeTruthy();
    expect(screen.getByText("3 deals are slipping")).toBeTruthy();
  });

  it("seeds the nudge's prompt on click (auto-send)", () => {
    const onSeed = vi.fn();
    render(
      <CopilotHomeState
        firstName="Sierra" nudges={[nudge]} recent={[]} onSeed={onSeed} onResume={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("3 deals are slipping"));
    expect(onSeed).toHaveBeenCalledWith(nudge.seedPrompt, true);
  });

  it("resumes a recent thread on click", () => {
    const onResume = vi.fn();
    render(
      <CopilotHomeState
        firstName="Sierra" nudges={[]} onSeed={() => {}} onResume={onResume}
        recent={[{ conversationId: "c1", title: "iowa fits", updatedAt: "2026-05-25T00:00:00.000Z" }]}
      />,
    );
    fireEvent.click(screen.getByText("iowa fits"));
    expect(onResume).toHaveBeenCalledWith("c1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotHomeState.test.tsx`
Expected: FAIL — cannot find module `../CopilotHomeState`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/copilot/components/CopilotHomeState.tsx
"use client";

import { AlertCircle, Sparkles } from "lucide-react";
import type { CopilotNudge } from "../lib/nudge-types";
import type { RecentConversation } from "../lib/recent-conversations";

/** Static starter prompts. `send: false` ones populate the composer for editing. */
const SUGGESTED_PROMPTS: Array<{ label: string; prompt: string; send: boolean }> = [
  { label: "My plan summary", prompt: "Give me a summary of my territory plan.", send: true },
  { label: "What's gone stale?", prompt: "Which of my plans or deals need attention?", send: true },
  { label: "Log a call", prompt: "Log a call with ", send: false },
  { label: "Find high-fit districts", prompt: "Find high-fit districts I'm not working yet.", send: true },
];

function greetingPrefix(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface Props {
  firstName: string | null;
  nudges: CopilotNudge[];
  recent: RecentConversation[];
  /** Seed a prompt into the composer; autoSend=true sends immediately. */
  onSeed: (prompt: string, autoSend: boolean) => void;
  onResume: (conversationId: string) => void;
}

export function CopilotHomeState({ firstName, nudges, recent, onSeed, onResume }: Props) {
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="text-lg font-semibold text-[#403770]">
        {greetingPrefix()}{firstName ? `, ${firstName}` : ""}
        <span className="mt-1 block text-sm font-normal text-[#6E6390]">
          Here&apos;s what&apos;s worth a look — or just ask.
        </span>
      </div>

      {nudges.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8A80A8]">
            Worth your attention
          </p>
          <div className="flex flex-col gap-1.5">
            {nudges.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSeed(n.seedPrompt, true)}
                className="flex items-start gap-2.5 rounded-[10px] border border-[#E2DEEC] bg-[#FBFAFD] px-3 py-2.5 text-left transition-colors hover:border-[#403770] hover:bg-[#F7F5FA]"
              >
                <span className={`mt-0.5 shrink-0 ${n.severity === "risk" ? "text-[#F37167]" : "text-[#403770]"}`}>
                  <AlertCircle className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-[#403770]">{n.headline}</span>
                  <span className="block text-xs text-[#6E6390]">{n.reason}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8A80A8]">Jump in</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSeed(s.prompt, s.send)}
              className="rounded-2xl bg-[#EFEDF5] px-3 py-1.5 text-xs text-[#403770] transition-colors hover:bg-[#403770] hover:text-white whitespace-nowrap"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#8A80A8]">Recent</p>
          <div className="flex flex-col">
            {recent.map((c) => (
              <button
                key={c.conversationId}
                type="button"
                onClick={() => onResume(c.conversationId)}
                className="flex items-center gap-2 border-t border-[#F0EDF6] py-2 text-left text-[13px] text-[#6E6390] transition-colors hover:text-[#403770]"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#A89FC4]" />
                <span className="truncate">{c.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotHomeState.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/components/CopilotHomeState.tsx src/features/copilot/components/__tests__/CopilotHomeState.test.tsx
git commit -m "feat(copilot): CopilotHomeState — greeting, nudges, prompts, recent"
```

---

## Task 8: Wire the home state into `CopilotPanel`

**Files:**
- Modify: `src/features/copilot/components/CopilotPanel.tsx`

- [ ] **Step 1: Add imports + data hooks**

At the top of `CopilotPanel.tsx`, add imports:

```tsx
import { useProfile } from "@/features/shared/lib/queries";
import { CopilotHomeState } from "./CopilotHomeState";
import { useCopilotNudges } from "../hooks/useCopilotNudges";
import { useCopilotConversations } from "../hooks/useCopilotConversations";
```

Inside the component, after the existing `const open = useMapStore(...)` lines:

```tsx
  const { data: profile } = useProfile();
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? null;
  const nudges = useCopilotNudges(open).data ?? [];
  const recent = useCopilotConversations(open).data ?? [];
```

- [ ] **Step 2: Refactor `handleSend` to accept an explicit text, and add `handleSeed`**

Change the `handleSend` signature so it can send a passed-in string (nudges/chips
don't wait for `input` state to flush):

```tsx
  const handleSend = useCallback((textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || stream.isPending) return;
    // ... unchanged body, but use `text` (already does) ...
  }, [input, stream, conversationId, getPageContext, applyResult, focusDistricts, setActiveTab]);
```

Update the composer button + textarea Enter handler to call `handleSend()` with no
args (unchanged behavior). Then add:

```tsx
  const handleSeed = useCallback((prompt: string, autoSend: boolean) => {
    if (autoSend) {
      handleSend(prompt);
    } else {
      setInput(prompt);
    }
  }, [handleSend]);

  const handleResume = useCallback((id: string) => {
    setConversationId(id);
    fetch(`/api/copilot/history?conversationId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messages?: CopilotHistoryMessage[] } | null) => {
        if (!data?.messages) return;
        setMessages(data.messages.map((m) => ({ id: uid(), role: m.role, text: m.text, note: m.note })));
      })
      .catch(() => {});
  }, []);
```

- [ ] **Step 3: Replace the empty-thread greeting with the home state**

Find the messages container block:

```tsx
        {messages.length === 0 && (
          <p className="text-sm text-[#6E6390]">{greeting}</p>
        )}
```

Replace with:

```tsx
        {messages.length === 0 && (
          <CopilotHomeState
            firstName={firstName}
            nudges={nudges}
            recent={recent}
            onSeed={handleSeed}
            onResume={handleResume}
          />
        )}
```

Remove the now-unused `greeting` `useMemo`.

- [ ] **Step 4: Verify the existing panel test still passes + typecheck**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotPanel.test.tsx && npx tsc --noEmit`
Expected: PASS / no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): render home state + seed/resume wiring in the panel"
```

---

# Phase 3 — Conversation flow

## Task 9: Friendly progress label

**Files:**
- Create: `src/features/copilot/lib/progress-labels.ts`
- Create: `src/features/copilot/components/CopilotProgress.tsx`
- Test: `src/features/copilot/lib/__tests__/progress-labels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/copilot/lib/__tests__/progress-labels.test.ts
import { describe, it, expect } from "vitest";
import { friendlyProgressLabel } from "../progress-labels";
import type { TurnEvent } from "@/features/reports/lib/agent/types";

const modelCall = (name: string): TurnEvent => ({
  kind: "model_call", iteration: 1, stopReason: null,
  usage: { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
  assistantText: null, toolUses: [{ id: "t1", name, input: {} }],
});

describe("friendlyProgressLabel", () => {
  it("defaults to Thinking when there are no events", () => {
    expect(friendlyProgressLabel([])).toBe("Thinking…");
  });
  it("maps run_sql to a friendly phrase, never the tool name", () => {
    const label = friendlyProgressLabel([modelCall("run_sql")]);
    expect(label).toBe("Searching your data…");
    expect(label).not.toContain("run_sql");
  });
  it("maps propose_actions to Drafting", () => {
    expect(friendlyProgressLabel([modelCall("propose_actions")])).toBe("Drafting…");
  });
  it("uses a generic phrase for an unknown tool (no raw name)", () => {
    const label = friendlyProgressLabel([modelCall("some_internal_tool")]);
    expect(label).toBe("Working…");
    expect(label).not.toContain("some_internal_tool");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/progress-labels.test.ts`
Expected: FAIL — cannot find module `../progress-labels`.

- [ ] **Step 3: Write the pure mapper**

```ts
// src/features/copilot/lib/progress-labels.ts
import type { TurnEvent } from "@/features/reports/lib/agent/types";

/** Friendly phrase per known tool. Unknown tools fall back to "Working…" —
 *  internal tool names must never reach the rep. */
const TOOL_LABELS: Record<string, string> = {
  run_sql: "Searching your data…",
  sample_rows: "Looking through records…",
  get_schema: "Checking your data…",
  propose_actions: "Drafting…",
};

export function friendlyProgressLabel(events: TurnEvent[] | undefined): string {
  if (!events || events.length === 0) return "Thinking…";
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "model_call" && e.toolUses.length > 0) {
      const name = e.toolUses[e.toolUses.length - 1]!.name;
      return TOOL_LABELS[name] ?? "Working…";
    }
  }
  return "Thinking…";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/progress-labels.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the progress component**

```tsx
// src/features/copilot/components/CopilotProgress.tsx
"use client";

import { Loader2 } from "lucide-react";
import { friendlyProgressLabel } from "../lib/progress-labels";
import type { TurnEvent } from "../lib/types";

export function CopilotProgress({ events }: { events: TurnEvent[] | undefined }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#6E6390]">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="whitespace-nowrap">{friendlyProgressLabel(events)}</span>
    </div>
  );
}
```

- [ ] **Step 6: Use it in `CopilotPanel`'s `MessageBlock`**

In `CopilotPanel.tsx`, remove the `latestToolLabel` function and its usage. Replace
the streaming branch in `MessageBlock`:

```tsx
      {msg.streaming && !msg.text ? (
        <CopilotProgress events={msg.events} />
      ) : (
```

Add `import { CopilotProgress } from "./CopilotProgress";` at the top.

- [ ] **Step 7: Run panel test + typecheck + commit**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotPanel.test.tsx && npx tsc --noEmit`
Expected: PASS / no errors.

```bash
git add src/features/copilot/lib/progress-labels.ts src/features/copilot/lib/__tests__/progress-labels.test.ts src/features/copilot/components/CopilotProgress.tsx src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): friendly progress label (no leaked tool names)"
```

---

## Task 10: `AnswerBlock` with "View on map" button

**Files:**
- Create: `src/features/copilot/components/AnswerBlock.tsx`
- Test: `src/features/copilot/components/__tests__/AnswerBlock.test.tsx`
- Modify: `src/features/copilot/components/CopilotPanel.tsx`

The plotting helpers (`extractDistrictLeaids`, `statesForLeaids`, `focusDistricts`,
`boundsForLeaids`, `STATE_BBOX`, `setActiveTab`) already exist and are used by the
auto-plot. `AnswerBlock` adds a button that re-invokes the same focus path.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/copilot/components/__tests__/AnswerBlock.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnswerBlock } from "../AnswerBlock";

describe("AnswerBlock", () => {
  it("hides id columns and shows the View-on-map button when leaids are present", () => {
    const onViewOnMap = vi.fn();
    render(
      <AnswerBlock
        answer={{ columns: ["leaid", "name"], rows: [{ leaid: "1900001", name: "Lake Mills" }], rowCount: 1 }}
        onViewOnMap={onViewOnMap}
      />,
    );
    expect(screen.queryByText("leaid")).toBeNull();
    expect(screen.getByText("name")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /view .* on the map/i }));
    expect(onViewOnMap).toHaveBeenCalledTimes(1);
  });

  it("shows no map button when there is no leaid column", () => {
    render(
      <AnswerBlock
        answer={{ columns: ["name"], rows: [{ name: "Lake Mills" }], rowCount: 1 }}
        onViewOnMap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /view .* on the map/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/AnswerBlock.test.tsx`
Expected: FAIL — cannot find module `../AnswerBlock`.

- [ ] **Step 3: Write the component** (moves `AnswerTable` markup in; adds button)

```tsx
// src/features/copilot/components/AnswerBlock.tsx
"use client";

import { MapPin } from "lucide-react";
import { isIdColumn } from "@/features/reports/lib/result-columns";
import { extractDistrictLeaids } from "../lib/plot-districts";

export interface AnswerPayload {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

export function AnswerBlock({
  answer,
  onViewOnMap,
}: {
  answer: AnswerPayload;
  onViewOnMap: () => void;
}) {
  const visibleColumns = answer.columns.filter((c) => !isIdColumn(c));
  const { leaids } = extractDistrictLeaids(answer.columns, answer.rows);

  return (
    <div className="space-y-2">
      {answer.rows.length === 0 ? (
        <p className="text-sm text-[#6E6390]">No rows.</p>
      ) : visibleColumns.length === 0 ? (
        <p className="text-sm text-[#6E6390]">Plotted on the map — open the Map tab to see them.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2DEEC]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#F7F5FA]">
                {visibleColumns.map((c) => (
                  <th key={c} className="px-2 py-1 text-left font-semibold text-[#6E6390] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.rows.map((row, i) => (
                <tr key={i} className="border-t border-[#E2DEEC]">
                  {visibleColumns.map((c) => (
                    <td key={c} className="px-2 py-1 text-[#403770] whitespace-nowrap">
                      {row[c] == null ? "" : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {answer.rowCount > answer.rows.length && (
            <p className="px-2 py-1 text-[10px] text-[#6E6390]">
              Showing {answer.rows.length} of {answer.rowCount} rows.
            </p>
          )}
        </div>
      )}

      {leaids.length > 0 && (
        <button
          type="button"
          onClick={onViewOnMap}
          className="flex items-center gap-1.5 rounded-lg border border-[#403770] px-3 py-1.5 text-xs font-semibold text-[#403770] transition-colors hover:bg-[#403770] hover:text-white whitespace-nowrap"
        >
          <MapPin className="h-3.5 w-3.5" />
          View {leaids.length} on the map
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/AnswerBlock.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Replace `AnswerTable` usage in `CopilotPanel`**

In `CopilotPanel.tsx`: delete the `AnswerTable` function. Delete the local
`interface AnswerPayload { … }` and instead
`import { AnswerBlock, type AnswerPayload } from "./AnswerBlock";` (the `ChatMessage`
interface keeps using `AnswerPayload`, now imported — one source of truth). Extract
the plot logic from `onComplete` into a reusable callback so the button reuses it:

```tsx
  const plotLeaids = useCallback((columns: string[], rows: Array<Record<string, unknown>>) => {
    const { leaids, truncated } = extractDistrictLeaids(columns, rows);
    if (leaids.length === 0) return { plotted: 0, truncated: false };
    focusDistricts(leaids, statesForLeaids(leaids), boundsForLeaids(leaids, STATE_BBOX));
    setActiveTab("map");
    return { plotted: leaids.length, truncated };
  }, [focusDistricts, setActiveTab]);
```

Use `plotLeaids` inside `onComplete` (replacing the inline focus block, keeping the
truncation chat note). In `MessageBlock`, replace `{msg.answer && <AnswerTable .../>}`
with:

```tsx
      {msg.answer && (
        <AnswerBlock
          answer={msg.answer}
          onViewOnMap={() => onViewOnMap?.(msg.answer!)}
        />
      )}
```

Thread an `onViewOnMap` prop from `CopilotPanel` → `MessageBlock` that calls
`plotLeaids(answer.columns, answer.rows)`.

- [ ] **Step 6: Run tests + typecheck + commit**

Run: `npx vitest run src/features/copilot/components && npx tsc --noEmit`
Expected: PASS / no errors.

```bash
git add src/features/copilot/components/AnswerBlock.tsx src/features/copilot/components/__tests__/AnswerBlock.test.tsx src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): AnswerBlock with repeatable View-on-map button"
```

---

## Task 11: `ProposedActionCard` (extracted + draft styling)

**Files:**
- Create: `src/features/copilot/components/ProposedActionCard.tsx`
- Test: `src/features/copilot/components/__tests__/ProposedActionCard.test.tsx`
- Modify: `src/features/copilot/components/CopilotPanel.tsx`

This moves the existing `ProposedActionCard` out of `CopilotPanel` into its own file
with the restyle (object badge, primary Confirm / quiet Dismiss, collapsed settled
state). Behavior (status handling) is unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/copilot/components/__tests__/ProposedActionCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProposedActionCard } from "../ProposedActionCard";
import type { ProposedAction } from "../../lib/types";

const action: ProposedAction = {
  id: "a1", objectType: "activity", operation: "create", targetId: null,
  fields: {}, preview: { title: "Log activity", summary: "Program check-in — Lake Mills", rows: [{ label: "Type", value: "Program check-in" }], destructive: false },
};

describe("ProposedActionCard", () => {
  it("calls onConfirm when Confirm is clicked", () => {
    const onConfirm = vi.fn();
    render(<ProposedActionCard action={action} status="idle" onConfirm={onConfirm} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(action);
  });

  it("collapses to a done line when confirmed", () => {
    render(<ProposedActionCard action={action} status="confirmed" onConfirm={() => {}} onDismiss={() => {}} />);
    expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull();
    expect(screen.getByText(/Logged|Done/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/ProposedActionCard.test.tsx`
Expected: FAIL — cannot find module `../ProposedActionCard`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/copilot/components/ProposedActionCard.tsx
"use client";

import { Check, Ban, AlertTriangle, Loader2 } from "lucide-react";
import type { ProposedAction } from "../lib/types";

export type ActionStatus = "idle" | "pending" | "confirmed" | "dismissed" | "error";

export function ProposedActionCard({
  action,
  status,
  error,
  onConfirm,
  onDismiss,
}: {
  action: ProposedAction;
  status: ActionStatus;
  error?: string;
  onConfirm: (a: ProposedAction) => void;
  onDismiss: (id: string) => void;
}) {
  if (status === "confirmed") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#1F7A3F]">
        <Check className="h-3.5 w-3.5" /> {action.preview.title} — done.
      </p>
    );
  }
  if (status === "dismissed") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-[#6E6390]">
        <Ban className="h-3.5 w-3.5" /> Dismissed.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2DEEC] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#F0EDF6] bg-[#FBFAFD] px-3 py-2">
        <span className="rounded-md bg-[#EFEDF5] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#403770] whitespace-nowrap">
          {action.preview.title}
        </span>
      </div>
      <p className="px-3 pt-2.5 text-sm font-semibold text-[#403770]">{action.preview.summary}</p>
      {action.preview.rows.length > 0 && (
        <dl className="px-3 pb-2 pt-1 space-y-1">
          {action.preview.rows.map((r, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <dt className="shrink-0 text-[#8A80A8] whitespace-nowrap">{r.label}</dt>
              <dd className="m-0 whitespace-pre-wrap break-words text-[#403770]">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {status === "error" && (
        <p className="flex items-center gap-1 px-3 pb-2 text-xs text-[#A8281C]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error ?? "Something went wrong."}
        </p>
      )}
      <div className="flex gap-2 border-t border-[#F0EDF6] px-3 py-2.5">
        <button
          type="button"
          onClick={() => onConfirm(action)}
          disabled={status === "pending"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#403770] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#322a5a] disabled:opacity-50"
        >
          {status === "pending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => onDismiss(action.id)}
          disabled={status === "pending"}
          className="flex-1 rounded-lg border border-[#E2DEEC] px-3 py-2 text-xs font-semibold text-[#6E6390] transition-colors hover:bg-[#F7F5FA] disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/ProposedActionCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Use it from `CopilotPanel`**

In `CopilotPanel.tsx`: delete the inline `ProposedActionCard` function and the local
`ActionStatus` type; import them from the new file
(`import { ProposedActionCard, type ActionStatus } from "./ProposedActionCard";`).
Keep the single-action render path in `MessageBlock` as-is (it already maps over
`msg.proposedActions`); Task 12 changes the grouping.

- [ ] **Step 6: Run tests + typecheck + commit**

Run: `npx vitest run src/features/copilot/components && npx tsc --noEmit`
Expected: PASS / no errors.

```bash
git add src/features/copilot/components/ProposedActionCard.tsx src/features/copilot/components/__tests__/ProposedActionCard.test.tsx src/features/copilot/components/CopilotPanel.tsx
git commit -m "refactor(copilot): extract + restyle ProposedActionCard (draft look)"
```

---

## Task 12: `BatchActionCard` (grouped + expandable)

**Files:**
- Create: `src/features/copilot/components/BatchActionCard.tsx`
- Test: `src/features/copilot/components/__tests__/BatchActionCard.test.tsx`
- Modify: `src/features/copilot/components/CopilotPanel.tsx`

When a turn proposes 2+ actions of the same `objectType.operation`, render one
summary card; the rep expands to uncheck individual items, then confirms the
selected set. Single actions still use `ProposedActionCard`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/copilot/components/__tests__/BatchActionCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BatchActionCard } from "../BatchActionCard";
import type { ProposedAction } from "../../lib/types";

function mk(id: string, summary: string): ProposedAction {
  return { id, objectType: "activity", operation: "create", targetId: null, fields: {},
    preview: { title: "Log activity", summary, rows: [], destructive: false } };
}
const actions = [mk("a1", "Check-in — Lake Mills"), mk("a2", "Check-in — Forest City"), mk("a3", "Check-in — Garner")];

describe("BatchActionCard", () => {
  it("summarizes the group and confirms all selected by default", () => {
    const onConfirmMany = vi.fn();
    render(<BatchActionCard actions={actions} statusById={{}} onConfirmMany={onConfirmMany} onDismissAll={() => {}} />);
    expect(screen.getByText(/Log 3 activities/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /confirm 3/i }));
    expect(onConfirmMany).toHaveBeenCalledWith(actions);
  });

  it("excludes an unchecked item from the confirmed set", () => {
    const onConfirmMany = vi.fn();
    render(<BatchActionCard actions={actions} statusById={{}} onConfirmMany={onConfirmMany} onDismissAll={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /review/i })); // expand
    // Checkbox aria-label is the full summary ("Check-in — Forest City").
    fireEvent.click(screen.getByLabelText(/Forest City/));
    fireEvent.click(screen.getByRole("button", { name: /confirm 2/i }));
    expect(onConfirmMany).toHaveBeenCalledWith([actions[0], actions[2]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/BatchActionCard.test.tsx`
Expected: FAIL — cannot find module `../BatchActionCard`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/copilot/components/BatchActionCard.tsx
"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { ProposedAction } from "../lib/types";
import type { ActionStatus } from "./ProposedActionCard";

/** Naive pluralizer, good enough for our object nouns (activity→activities). */
function pluralize(noun: string, n: number): string {
  if (n === 1) return noun;
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/** Card title from the group's shared action, e.g. "Log 3 activities". */
function pluralTitle(action: ProposedAction, n: number): string {
  // preview.title is like "Log activity" / "Create contact".
  const [verb, ...rest] = action.preview.title.split(" ");
  const noun = rest.join(" ") || "items";
  return `${verb} ${n} ${pluralize(noun, n)}`;
}

export function BatchActionCard({
  actions,
  statusById,
  onConfirmMany,
  onDismissAll,
}: {
  actions: ProposedAction[];
  statusById: Record<string, ActionStatus>;
  onConfirmMany: (selected: ProposedAction[]) => void;
  onDismissAll: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const selected = useMemo(
    () => actions.filter((a) => !excluded.has(a.id)),
    [actions, excluded],
  );
  const anyPending = actions.some((a) => statusById[a.id] === "pending");
  const allSettled = actions.every(
    (a) => statusById[a.id] === "confirmed" || statusById[a.id] === "dismissed",
  );

  if (allSettled) {
    const done = actions.filter((a) => statusById[a.id] === "confirmed").length;
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#1F7A3F]">
        <Check className="h-3.5 w-3.5" /> {done} of {actions.length} done.
      </p>
    );
  }

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2DEEC] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#F0EDF6] bg-[#FBFAFD] px-3 py-2">
        <span className="rounded-md bg-[#EFEDF5] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#403770] whitespace-nowrap">
          {pluralTitle(actions[0]!, actions.length)}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-[#6E6390] hover:text-[#403770]"
        >
          Review
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </button>
      </div>

      {expanded && (
        <ul className="divide-y divide-[#F0EDF6] px-3 py-1">
          {actions.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2 text-xs text-[#403770]">
              <input
                type="checkbox"
                aria-label={a.preview.summary}
                checked={!excluded.has(a.id)}
                onChange={() => toggle(a.id)}
                className="accent-[#403770]"
              />
              <span className="truncate">{a.preview.summary}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 border-t border-[#F0EDF6] px-3 py-2.5">
        <button
          type="button"
          disabled={anyPending || selected.length === 0}
          onClick={() => onConfirmMany(selected)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#403770] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#322a5a] disabled:opacity-50"
        >
          {anyPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirm {selected.length}
        </button>
        <button
          type="button"
          disabled={anyPending}
          onClick={onDismissAll}
          className="flex-1 rounded-lg border border-[#E2DEEC] px-3 py-2 text-xs font-semibold text-[#6E6390] transition-colors hover:bg-[#F7F5FA] disabled:opacity-50"
        >
          Dismiss all
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/BatchActionCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Group proposals in `CopilotPanel` + add `onConfirmMany`**

In `MessageBlock`, replace the `msg.proposedActions?.map(...)` block with grouping:

```tsx
      {msg.proposedActions && msg.proposedActions.length > 0 && (
        (() => {
          const groups = new Map<string, ProposedAction[]>();
          for (const a of msg.proposedActions) {
            const key = `${a.objectType}.${a.operation}`;
            groups.set(key, [...(groups.get(key) ?? []), a]);
          }
          return [...groups.values()].map((group, gi) =>
            group.length === 1 ? (
              <ProposedActionCard
                key={group[0]!.id}
                action={group[0]!}
                status={actionStatus[group[0]!.id] ?? "idle"}
                error={actionError[group[0]!.id]}
                onConfirm={onConfirm}
                onDismiss={onDismiss}
              />
            ) : (
              <BatchActionCard
                key={`batch-${gi}`}
                actions={group}
                statusById={actionStatus}
                onConfirmMany={onConfirmMany}
                onDismissAll={() => group.forEach((a) => onDismiss(a.id))}
              />
            ),
          );
        })()
      )}
```

Add an `onConfirmMany` callback in `CopilotPanel` (runs the existing per-action
`onConfirm` sequentially so each writes + audits independently):

```tsx
  const onConfirmMany = useCallback(async (selected: ProposedAction[]) => {
    for (const a of selected) await onConfirm(a);
  }, [onConfirm]);
```

Thread `onConfirmMany` from `CopilotPanel` → `MessageBlock`. Import `BatchActionCard`.

- [ ] **Step 6: Run all copilot component tests + typecheck + commit**

Run: `npx vitest run src/features/copilot && npx tsc --noEmit`
Expected: PASS / no errors.

```bash
git add src/features/copilot/components/BatchActionCard.tsx src/features/copilot/components/__tests__/BatchActionCard.test.tsx src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): grouped + expandable batch action confirm"
```

---

# Phase 4 — Entry, header & feel

## Task 13: `CopilotLauncher` (polished pill + first-run coachmark)

**Files:**
- Create: `src/features/copilot/components/CopilotLauncher.tsx`
- Test: `src/features/copilot/components/__tests__/CopilotLauncher.test.tsx`
- Modify: `src/features/copilot/components/CopilotPanel.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/copilot/components/__tests__/CopilotLauncher.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotLauncher, COACHMARK_KEY } from "../CopilotLauncher";

beforeEach(() => localStorage.clear());

describe("CopilotLauncher", () => {
  it("opens on click", () => {
    const onOpen = vi.fn();
    render(<CopilotLauncher onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /open copilot/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("shows the coachmark once, then never again", () => {
    const { unmount } = render(<CopilotLauncher onOpen={() => {}} />);
    expect(screen.getByText(/right here/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dismiss tip/i }));
    expect(screen.queryByText(/right here/i)).toBeNull();
    expect(localStorage.getItem(COACHMARK_KEY)).toBe("1");
    unmount();
    render(<CopilotLauncher onOpen={() => {}} />);
    expect(screen.queryByText(/right here/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotLauncher.test.tsx`
Expected: FAIL — cannot find module `../CopilotLauncher`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/copilot/components/CopilotLauncher.tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export const COACHMARK_KEY = "copilot:coachmark-dismissed";

export function CopilotLauncher({ onOpen }: { onOpen: () => void }) {
  const [showCoach, setShowCoach] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COACHMARK_KEY)) setShowCoach(true);
    } catch {
      // ignore
    }
  }, []);

  function dismissCoach() {
    setShowCoach(false);
    try { localStorage.setItem(COACHMARK_KEY, "1"); } catch { /* ignore */ }
  }

  return (
    <>
      {showCoach && (
        <div className="fixed bottom-20 right-5 z-50 max-w-[200px] rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-lg">
          <button
            type="button"
            onClick={dismissCoach}
            aria-label="Dismiss tip"
            className="absolute right-1.5 top-1.5 rounded p-0.5 text-[#A89FC4] hover:text-[#403770]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="pr-3 text-xs text-[#403770]">
            Ask me what&apos;s slipping, or to log a call — <b>I&apos;m right here.</b>
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open Copilot"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#403770] px-4 py-3 text-white shadow-lg transition-colors hover:bg-[#322a5a]"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium whitespace-nowrap">Copilot</span>
      </button>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotLauncher.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Use it in `CopilotPanel`**

In `CopilotPanel.tsx`, replace the closed-state `if (!open) { return <button…> }`
block with:

```tsx
  if (!open) {
    return <CopilotLauncher onOpen={() => setOpen(true)} />;
  }
```

Add `import { CopilotLauncher } from "./CopilotLauncher";`. Remove the now-unused
`Sparkles`/`Send` imports only if no longer referenced (Sparkles is still used in the
header — keep it).

- [ ] **Step 6: Run tests + typecheck + commit**

Run: `npx vitest run src/features/copilot/components && npx tsc --noEmit`
Expected: PASS / no errors.

```bash
git add src/features/copilot/components/CopilotLauncher.tsx src/features/copilot/components/__tests__/CopilotLauncher.test.tsx src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): polished launcher + one-time first-run coachmark"
```

---

## Task 14: Label "New chat" in the header

**Files:**
- Modify: `src/features/copilot/components/CopilotPanel.tsx`

- [ ] **Step 1: Give the New-chat control a visible label**

In the header, replace the icon-only New-chat button with an icon+label control:

```tsx
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#403770] transition-colors hover:bg-[#EFEDF5]"
          >
            <SquarePen className="h-4 w-4" />
            <span className="whitespace-nowrap">New chat</span>
          </button>
```

(History and Close stay icon-only with their existing `aria-label`s.)

- [ ] **Step 2: Manual check + typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Manual: header reads "🕘  New chat  ✕"; nothing overflows at 380px.)

- [ ] **Step 3: Commit**

```bash
git add src/features/copilot/components/CopilotPanel.tsx
git commit -m "feat(copilot): label the New chat control in the header"
```

---

## Task 15: Sidebar Copilot nav entry

**Files:**
- Create: `src/features/copilot/components/CopilotNavButton.tsx`
- Test: `src/features/copilot/components/__tests__/CopilotNavButton.test.tsx`
- Modify: `src/features/shared/components/navigation/Sidebar.tsx`

The button opens the rail via the shared store (no prop threading through AppShell).
It mirrors the sidebar's tab button styling and respects `collapsed`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/copilot/components/__tests__/CopilotNavButton.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotNavButton } from "../CopilotNavButton";

const setCopilotOpen = vi.fn();
vi.mock("@/features/shared/lib/app-store", () => ({
  useMapStore: (sel: (s: { setCopilotOpen: (v: boolean) => void }) => unknown) =>
    sel({ setCopilotOpen }),
}));

describe("CopilotNavButton", () => {
  it("opens the copilot rail on click and shows its label when expanded", () => {
    render(<CopilotNavButton collapsed={false} />);
    expect(screen.getByText("Copilot")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /copilot/i }));
    expect(setCopilotOpen).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotNavButton.test.tsx`
Expected: FAIL — cannot find module `../CopilotNavButton`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/copilot/components/CopilotNavButton.tsx
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useMapStore } from "@/features/shared/lib/app-store";

/** Sidebar entry that opens the Copilot rail. Not a tab — a launcher. */
export function CopilotNavButton({ collapsed }: { collapsed: boolean }) {
  const setCopilotOpen = useMapStore((s) => s.setCopilotOpen);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setCopilotOpen(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full flex items-center gap-3 px-4 py-3 border-l-3 border-transparent text-[#403770] transition-colors duration-150 hover:bg-[#EFEDF5]"
      title={collapsed ? "Copilot" : undefined}
    >
      <span className="flex-shrink-0 text-[#403770]"><Sparkles className="w-5 h-5" /></span>
      {!collapsed && <span className="text-sm font-medium truncate">Copilot</span>}
      {collapsed && hovered && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-[#403770] text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
          Copilot
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotNavButton.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Render it in the Sidebar**

In `Sidebar.tsx`, add `import { CopilotNavButton } from "@/features/copilot/components/CopilotNavButton";`.
Render it directly under the main tabs nav (so it sits with primary navigation):

```tsx
      <nav className="py-2 flex-shrink-0">
        {MAIN_TABS.map(renderTab)}
        <CopilotNavButton collapsed={collapsed} />
      </nav>
```

- [ ] **Step 6: Run tests + typecheck + commit**

Run: `npx vitest run src/features/copilot && npx tsc --noEmit`
Expected: PASS / no errors.

```bash
git add src/features/copilot/components/CopilotNavButton.tsx src/features/copilot/components/__tests__/CopilotNavButton.test.tsx src/features/shared/components/navigation/Sidebar.tsx
git commit -m "feat(copilot): sidebar nav entry that opens the rail"
```

---

## Task 16: Full-suite green + manual smoke

**Files:** none (verification).

- [ ] **Step 1: Run the full copilot + touched-feature suites**

Run: `npx vitest run src/features/copilot src/features/deals src/features/plans src/features/activities && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 2: Manual smoke (dev server on :3015 per the worktree setup)**

Run: `npx next dev -p 3015` and verify in-app:
- Opening the rail shows the greeting + nudges (or just greeting + prompts if no nudges), suggested chips, recent threads.
- Tapping a nudge sends its prompt and renders an answer; district answers show "View N on the map" and plot on the Map tab.
- "Log a check-in for each of these districts" (with several selected) yields one batch card; unchecking one and confirming writes only the rest (check the Activity log view).
- Sidebar "Copilot" entry opens the rail; the floating launcher shows the coachmark once.
- iPhone Safari: home state + cards scroll inside the fullscreen sheet; nothing overflows at 380px.

- [ ] **Step 3: Commit any fixes found during smoke (no code change ⇒ no commit).**

---

## Self-review checklist (run before handing off to execution)

- **Spec coverage:** §1 home state → Tasks 4–8; §2 conversation flow → Tasks 9–12;
  §3 entry/feel → Tasks 13–15; nudges + reuse → Tasks 1–6. ✓
- **No leaked tool names:** Task 9 maps unknown tools to "Working…". ✓
- **Reuse over reinvention:** deal/plan logic extracted (Tasks 1–2) before the
  nudges service consumes it (Task 4). ✓
- **Type consistency:** `CopilotNudge`/`NudgeKind` (Task 3) used in Tasks 4/6/7;
  `ActionStatus` defined in `ProposedActionCard` (Task 11) and imported by
  `BatchActionCard` (Task 12) and `CopilotPanel`; `AnswerPayload` defined in
  `AnswerBlock` (Task 10) — update `CopilotPanel`'s local `AnswerPayload` to import
  from `AnswerBlock` to avoid a duplicate type. ✓
