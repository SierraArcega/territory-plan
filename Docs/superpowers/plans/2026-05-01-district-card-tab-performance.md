# District Card Tab Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate cold network waits when switching tabs in the district card by prefetching all tab queries on card mount, adding a fade-up animation on tab switch, and showing loading dots on in-flight tabs.

**Architecture:** Four coordinated changes — parallel `Promise.all` in the district API route shaves ~80ms off card open; `queryClient.prefetchQuery()` in DistrictCard fires all tab queries in parallel on mount so tab switches hit warm cache; `key={activeTab}` on the content wrapper re-triggers a CSS `fadeUp` animation on every switch; `DistrictTabStrip` reads a new `loadingTabs` prop to show pulsing dots while prefetches are in-flight.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query v5, Tailwind 4, Vitest + Testing Library

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/features/activities/lib/queries.ts` | Export `buildActivitiesQueryString` so prefetch callers can share the exact cache key |
| Modify | `src/app/api/districts/[leaid]/route.ts` | Run `centroid` + `getChildren` in `Promise.all` instead of sequential `await` |
| Modify | `src/features/map/components/right-panels/DistrictCard.tsx` | Add prefetch effect + `key={activeTab}` + `tab-content` class + `loadingTabs` wiring |
| Modify | `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx` | Accept `loadingTabs` prop, render pulsing dot per in-flight tab |
| Modify | `src/app/globals.css` | Add `tabFadeUp` keyframe + `.tab-content` animation rule |
| Create | `src/features/map/components/right-panels/__tests__/DistrictCard.prefetch.test.tsx` | Tests for prefetch effect and edge case |
| Create | `src/features/map/components/panels/district/tabs/__tests__/DistrictTabStrip.test.tsx` | Tests for loading dot rendering |

---

## Task 1: Export `buildActivitiesQueryString`

This is a prerequisite — the prefetch in Task 3 must use the identical cache key that `useActivities` uses. The key is `["activities", queryString]` where `queryString` is built by a currently-private function.

**Files:**
- Modify: `src/features/activities/lib/queries.ts`

- [ ] **Step 1: Export the function**

In `src/features/activities/lib/queries.ts`, change line 29 from:

```ts
function buildActivitiesQueryString(params: ActivitiesParams): string {
```

to:

```ts
export function buildActivitiesQueryString(params: ActivitiesParams): string {
```

That's the entire change — one word added. No logic changes.

- [ ] **Step 2: Verify the build still compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/activities/lib/queries.ts
git commit -m "feat: export buildActivitiesQueryString for cache-key reuse"
```

---

## Task 2: Parallelize District API Route Queries

The `GET /api/districts/[leaid]` route currently runs `centroid` and `getChildren` sequentially after the main Prisma query. They are independent and can run in parallel.

**Files:**
- Modify: `src/app/api/districts/[leaid]/route.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/districts/[leaid]/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      findUnique: vi.fn().mockResolvedValue({
        leaid: "1234567",
        name: "Test ISD",
        stateAbbrev: "TX",
        stateFips: "48",
        enrollment: 1000,
        lograde: "PK",
        higrade: "12",
        phone: null,
        streetLocation: null,
        cityLocation: "Austin",
        zipLocation: "78701",
        countyName: "Travis",
        urbanCentricLocale: null,
        numberOfSchools: 5,
        specEdStudents: null,
        ellStudents: null,
        websiteUrl: null,
        jobBoardUrl: null,
        accountType: "district",
        isCustomer: null,
        hasOpenPipeline: null,
        accountName: null,
        lmsid: null,
        notes: null,
        ownerId: null,
        notesUpdatedAt: null,
        enrollmentTrend3yr: null,
        staffingTrend3yr: null,
        graduationTrend3yr: null,
        financeDataYear: null,
        staffDataYear: null,
        saipeDataYear: null,
        graduationDataYear: null,
        demographicsDataYear: null,
        salesExecutiveUser: null,
        ownerUser: null,
        districtTags: [],
        contacts: [],
        territoryPlans: [],
        districtFinancials: [],
        // spread remaining nullable numeric fields as null
        totalRevenue: null, federalRevenue: null, stateRevenue: null,
        localRevenue: null, totalExpenditure: null, expenditurePerPupil: null,
        childrenPovertyCount: null, childrenPovertyPercent: null,
        medianHouseholdIncome: null, graduationRateTotal: null,
        salariesTotal: null, salariesInstruction: null,
        salariesTeachersRegular: null, salariesTeachersSpecialEd: null,
        salariesTeachersVocational: null, salariesTeachersOther: null,
        salariesSupportAdmin: null, salariesSupportInstructional: null,
        benefitsTotal: null, teachersFte: null, teachersElementaryFte: null,
        teachersSecondaryFte: null, adminFte: null, guidanceCounselorsFte: null,
        instructionalAidesFte: null, supportStaffFte: null, staffTotalFte: null,
        chronicAbsenteeismCount: null, chronicAbsenteeismRate: null,
        absenteeismDataYear: null, enrollmentWhite: null, enrollmentBlack: null,
        enrollmentHispanic: null, enrollmentAsian: null,
        enrollmentAmericanIndian: null, enrollmentPacificIslander: null,
        enrollmentTwoOrMore: null, totalEnrollment: null,
        swdPct: null, ellPct: null, studentTeacherRatio: null,
        studentStaffRatio: null, spedStudentTeacherRatio: null,
        vacancyPressureSignal: null, swdTrend3yr: null, ellTrend3yr: null,
        absenteeismTrend3yr: null, studentTeacherRatioTrend3yr: null,
        mathProficiencyTrend3yr: null, readProficiencyTrend3yr: null,
        expenditurePpTrend3yr: null, absenteeismVsState: null,
        graduationVsState: null, studentTeacherRatioVsState: null,
        swdPctVsState: null, ellPctVsState: null, mathProficiencyVsState: null,
        readProficiencyVsState: null, expenditurePpVsState: null,
        absenteeismVsNational: null, graduationVsNational: null,
        studentTeacherRatioVsNational: null, swdPctVsNational: null,
        ellPctVsNational: null, mathProficiencyVsNational: null,
        readProficiencyVsNational: null, expenditurePpVsNational: null,
        absenteeismQuartileState: null, graduationQuartileState: null,
        studentTeacherRatioQuartileState: null, swdPctQuartileState: null,
        ellPctQuartileState: null, mathProficiencyQuartileState: null,
        readProficiencyQuartileState: null, expenditurePpQuartileState: null,
      }),
      $queryRaw: vi.fn().mockResolvedValue([{ lat: 30.2, lng: -97.7 }]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ lat: 30.2, lng: -97.7 }]),
  },
}));

// Mock getChildren
vi.mock("@/features/districts/lib/rollup", () => ({
  getChildren: vi.fn().mockResolvedValue([]),
}));

import { getChildren } from "@/features/districts/lib/rollup";
import prisma from "@/lib/prisma";

describe("GET /api/districts/[leaid]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns district data with correct shape", async () => {
    const req = new NextRequest("http://localhost/api/districts/1234567");
    const res = await GET(req, { params: Promise.resolve({ leaid: "1234567" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.district.leaid).toBe("1234567");
    expect(body.district.name).toBe("Test ISD");
    expect(body.district.isRollup).toBe(false);
    expect(body.contacts).toEqual([]);
    expect(body.tags).toEqual([]);
  });

  it("calls centroid query and getChildren — both are invoked", async () => {
    const req = new NextRequest("http://localhost/api/districts/1234567");
    await GET(req, { params: Promise.resolve({ leaid: "1234567" }) });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getChildren).toHaveBeenCalledWith("1234567");
  });
});
```

- [ ] **Step 2: Run to confirm it fails (or passes — baseline)**

```bash
npx vitest run src/app/api/districts/\\[leaid\\]/__tests__/route.test.ts
```

Note the current output. If it passes, the test still serves as a regression guard for the shape.

- [ ] **Step 3: Apply the `Promise.all` change**

In `src/app/api/districts/[leaid]/route.ts`, replace the three sequential `await`s (lines ~54–68) with:

```ts
// Run centroid lookup and rollup detection in parallel — they're independent
const [centroidResult, childLeaids] = await Promise.all([
  prisma.$queryRaw<{ lat: number; lng: number }[]>`
    SELECT
      COALESCE(ST_Y(centroid::geometry), ST_Y(point_location::geometry)) as lat,
      COALESCE(ST_X(centroid::geometry), ST_X(point_location::geometry)) as lng
    FROM districts WHERE leaid = ${leaid} LIMIT 1`,
  getChildren(leaid),
]);

const centroid = centroidResult.length > 0 ? centroidResult[0] : null;
const isRollup = childLeaids.length > 0;
const schoolCount = isRollup
  ? await prisma.school.count({ where: { leaid: { in: childLeaids } } })
  : 0;
```

Remove the three individual `await` statements that were there before (`centroidResult`, `childLeaids`, `schoolCount`).

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/districts/\\[leaid\\]/__tests__/route.test.ts
```

Expected: all tests PASS, same shape as before.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/\\[leaid\\]/route.ts src/app/api/districts/\\[leaid\\]/__tests__/route.test.ts
git commit -m "perf: parallelize district API centroid + getChildren queries"
```

---

## Task 3: Prefetch Tab Queries on DistrictCard Mount

When the district card opens, fire all three tab-specific queries in parallel into TanStack Query's cache. By the time the rep clicks a tab, the data is already there.

**Files:**
- Modify: `src/features/map/components/right-panels/DistrictCard.tsx`
- Create: `src/features/map/components/right-panels/__tests__/DistrictCard.prefetch.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/map/components/right-panels/__tests__/DistrictCard.prefetch.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DistrictCard from "../DistrictCard";
import { buildActivitiesQueryString } from "@/features/activities/lib/queries";

// ── Shared mock data ─────────────────────────────────────────────────────────
const LEAID = "4800001";
const PLAN_ID = "42";

const mockDistrict = {
  leaid: LEAID,
  name: "Austin ISD",
  stateAbbrev: "TX",
  accountType: "district",
  isRollup: false,
  childLeaids: [],
  schoolCount: 84,
  enrollment: 83000,
  lograde: "PK",
  higrade: "12",
  phone: null,
  streetLocation: null,
  cityLocation: "Austin",
  zipLocation: "78701",
  countyName: "Travis",
  urbanCentricLocale: null,
  numberOfSchools: 84,
  specEdStudents: null,
  ellStudents: null,
  websiteUrl: null,
  jobBoardUrl: null,
  centroidLat: 30.26,
  centroidLng: -97.74,
};

const mockDetailResponse = {
  district: mockDistrict,
  contacts: [{ id: "c1", leaid: LEAID, name: "Dr. Martinez", title: "Superintendent", email: null, phone: null, isPrimary: true }],
  fullmindData: null,
  tags: [],
  trends: null,
  edits: null,
  territoryPlanIds: [PLAN_ID],
  educationData: null,
  enrollmentDemographics: null,
};

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockPrefetchQuery = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      prefetchQuery: mockPrefetchQuery,
      getQueryState: vi.fn().mockReturnValue({ status: "pending" }),
    }),
  };
});

vi.mock("@/lib/api", () => ({
  useDistrictDetail: () => ({ data: mockDetailResponse, isLoading: false, error: null }),
  useRemoveDistrictFromPlan: () => ({ mutate: vi.fn() }),
}));

// Mutable store state — tests mutate mockStoreState.activePlanId to simulate
// different scenarios without re-calling vi.mock (which Vitest hoists and cannot
// be called inside test bodies).
let mockStoreState = { activePlanId: PLAN_ID as string | null, closeRightPanel: vi.fn(), openRightPanel: vi.fn(), panelState: "BROWSE" };

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// Silence child component rendering complexity
vi.mock("../panels/district/tabs/PlanningTab", () => ({ default: () => <div>Planning content</div> }));
vi.mock("../panels/district/tabs/SignalsTab", () => ({ default: () => <div>Signals content</div> }));
vi.mock("../panels/district/tabs/SchoolsTab", () => ({ default: () => <div>Schools content</div> }));
vi.mock("../panels/district/ContactsTab", () => ({ default: () => <div>Contacts content</div> }));
vi.mock("@/features/activities/components/ActivityTimeline", () => ({ default: () => <div>Activity</div> }));
vi.mock("../panels/district/DistrictHeader", () => ({ default: () => <div>Header</div> }));

// ── Tests ────────────────────────────────────────────────────────────────────
describe("DistrictCard — prefetch on mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state so tests don't bleed into each other
    mockStoreState = { activePlanId: PLAN_ID, closeRightPanel: vi.fn(), openRightPanel: vi.fn(), panelState: "BROWSE" };
  });

  it("fires prefetchQuery for schools, planDistrict, and activities on mount", () => {
    render(<DistrictCard leaid={LEAID} />);

    // Schools
    expect(mockPrefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["schoolsByDistrict", LEAID],
      })
    );

    // Plan district detail (only when activePlanId exists)
    expect(mockPrefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["planDistrict", PLAN_ID, LEAID],
      })
    );

    // Activities — key must match what useActivities produces
    const expectedQueryString = buildActivitiesQueryString({ districtLeaid: LEAID });
    expect(mockPrefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["activities", expectedQueryString],
      })
    );

    expect(mockPrefetchQuery).toHaveBeenCalledTimes(3);
  });

  it("skips planDistrict prefetch when no activePlanId", () => {
    mockStoreState = { ...mockStoreState, activePlanId: null };
    render(<DistrictCard leaid={LEAID} />);
    expect(mockPrefetchQuery).toHaveBeenCalledTimes(2);
    const keys = mockPrefetchQuery.mock.calls.map((c) => c[0].queryKey[0]);
    expect(keys).not.toContain("planDistrict");
  });

  it("edge case: Planning tab active while planDistrict prefetch is still pending — no second prefetch fired", async () => {
    // getQueryState returns pending — simulates tab clicked before prefetch lands
    const user = userEvent.setup();
    render(<DistrictCard leaid={LEAID} />);

    const schoolsTab = screen.getByRole("button", { name: /schools/i });
    await user.click(schoolsTab);

    // prefetchQuery must still only have been called 3 times (on mount), not again on tab click
    expect(mockPrefetchQuery).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run src/features/map/components/right-panels/__tests__/DistrictCard.prefetch.test.tsx
```

Expected: FAIL — `prefetchQuery` is never called (effect doesn't exist yet).

- [ ] **Step 3: Add the prefetch effect to DistrictCard**

In `src/features/map/components/right-panels/DistrictCard.tsx`:

Add to the import block at the top:

```ts
import { useQueryClient } from "@tanstack/react-query";
import { buildActivitiesQueryString } from "@/features/activities/lib/queries";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
```

Inside the `DistrictCard` component body, after the existing hooks (after the `removeMutation` line), add:

```ts
const queryClient = useQueryClient();

// Defined at component level so the prefetch effect and getQueryState (Task 5)
// both reference the identical string without recomputing it.
const activityQueryString = buildActivitiesQueryString({ districtLeaid: leaid });

useEffect(() => {
  if (!leaid) return;

  // Prefetch all tab queries in parallel on mount.
  // By the time the rep clicks any tab, TanStack Query finds a cache hit.
  queryClient.prefetchQuery({
    queryKey: ["schoolsByDistrict", leaid],
    queryFn: () => fetchJson(`${API_BASE}/schools/by-district/${leaid}`),
    staleTime: 5 * 60 * 1000,
  });

  if (activePlanId) {
    queryClient.prefetchQuery({
      queryKey: ["planDistrict", activePlanId, leaid],
      queryFn: () =>
        fetchJson(`${API_BASE}/territory-plans/${activePlanId}/districts/${leaid}`),
      staleTime: 2 * 60 * 1000,
    });
  }

  queryClient.prefetchQuery({
    queryKey: ["activities", activityQueryString],
    queryFn: () =>
      fetchJson(`${API_BASE}/activities${activityQueryString ? `?${activityQueryString}` : ""}`),
    staleTime: 2 * 60 * 1000,
  });
}, [leaid, activePlanId, activityQueryString, queryClient]);
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/features/map/components/right-panels/__tests__/DistrictCard.prefetch.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/right-panels/DistrictCard.tsx \
        src/features/map/components/right-panels/__tests__/DistrictCard.prefetch.test.tsx
git commit -m "perf: prefetch all tab queries on district card mount"
```

---

## Task 4: Fade-Up Animation on Tab Switch

Add a `key={activeTab}` to the tab content wrapper so React remounts it on every tab switch, re-triggering a CSS `fadeUp` animation automatically.

**Files:**
- Modify: `src/features/map/components/right-panels/DistrictCard.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add `key` and class to the tab content wrapper in DistrictCard**

In `src/features/map/components/right-panels/DistrictCard.tsx`, find the tab content wrapper (currently line ~114):

```tsx
{/* Tab content */}
<div className="flex-1 overflow-y-auto min-h-0">
```

Change it to:

```tsx
{/* Tab content — key forces remount on switch, re-triggering the CSS animation */}
<div key={activeTab} className="flex-1 overflow-y-auto min-h-0 tab-content">
```

That's the only change in this file for this task.

- [ ] **Step 2: Add the animation CSS to globals.css**

In `src/app/globals.css`, add at the end of the file:

```css
/* District card tab switch animation */
.tab-content {
  animation: tabFadeUp 150ms ease-out;
}

@keyframes tabFadeUp {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Verify visually in the browser**

```bash
npm run dev
```

Open `http://localhost:3005/?tab=map`, click a district, then click through each tab. Every switch should produce a smooth 150ms fade-up. There should be no skeleton flash on Planning or Schools (they're pre-fetched from Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/right-panels/DistrictCard.tsx \
        src/app/globals.css
git commit -m "feat: fade-up animation on district card tab switch"
```

---

## Task 5: Tab Strip Loading Indicators

Show a pulsing dot next to the tab label while its prefetch is still in-flight. This tells the rep "I heard your click, it's loading" before the content renders — eliminating anxious double-clicks.

**Files:**
- Modify: `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx`
- Modify: `src/features/map/components/right-panels/DistrictCard.tsx`
- Modify: `src/app/globals.css`
- Create: `src/features/map/components/panels/district/tabs/__tests__/DistrictTabStrip.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/map/components/panels/district/tabs/__tests__/DistrictTabStrip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DistrictTabStrip from "../DistrictTabStrip";

const noop = () => {};

describe("DistrictTabStrip — loading indicators", () => {
  it("renders no loading dots when loadingTabs is empty", () => {
    render(
      <DistrictTabStrip
        activeTab="planning"
        onSelect={noop}
        loadingTabs={{}}
      />
    );
    expect(document.querySelectorAll(".tab-load-dot")).toHaveLength(0);
  });

  it("renders a loading dot on the Schools tab when loadingTabs.schools is true", () => {
    render(
      <DistrictTabStrip
        activeTab="planning"
        onSelect={noop}
        loadingTabs={{ schools: true }}
      />
    );
    // The dot is inside the Schools button
    const schoolsBtn = screen.getByRole("button", { name: /schools/i });
    expect(schoolsBtn.querySelector(".tab-load-dot")).not.toBeNull();
  });

  it("renders a loading dot on the Planning tab when loadingTabs.planning is true", () => {
    render(
      <DistrictTabStrip
        activeTab="signals"
        onSelect={noop}
        loadingTabs={{ planning: true }}
      />
    );
    const planningBtn = screen.getByRole("button", { name: /planning/i });
    expect(planningBtn.querySelector(".tab-load-dot")).not.toBeNull();
  });

  it("renders no dot on Contacts or Signals regardless of loadingTabs", () => {
    render(
      <DistrictTabStrip
        activeTab="planning"
        onSelect={noop}
        loadingTabs={{ schools: true, planning: true }}
      />
    );
    const contactsBtn = screen.getByRole("button", { name: /contacts/i });
    const signalsBtn = screen.getByRole("button", { name: /signals/i });
    expect(contactsBtn.querySelector(".tab-load-dot")).toBeNull();
    expect(signalsBtn.querySelector(".tab-load-dot")).toBeNull();
  });

  it("dot disappears when loadingTabs.schools becomes false", () => {
    const { rerender } = render(
      <DistrictTabStrip
        activeTab="planning"
        onSelect={noop}
        loadingTabs={{ schools: true }}
      />
    );
    expect(document.querySelectorAll(".tab-load-dot")).toHaveLength(1);

    rerender(
      <DistrictTabStrip
        activeTab="planning"
        onSelect={noop}
        loadingTabs={{ schools: false }}
      />
    );
    expect(document.querySelectorAll(".tab-load-dot")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run src/features/map/components/panels/district/tabs/__tests__/DistrictTabStrip.test.tsx
```

Expected: FAIL — `loadingTabs` prop doesn't exist yet.

- [ ] **Step 3: Update `DistrictTabStrip` to accept `loadingTabs` prop**

Replace the contents of `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx` with:

```tsx
"use client";

export type DistrictTab = "planning" | "signals" | "schools" | "contacts" | "activity";

const TABS: {
  key: DistrictTab;
  label: string;
  path: string;
  stroke: boolean;
}[] = [
  {
    key: "planning",
    label: "Planning",
    path: "M9 2H7a1 1 0 00-1 1v1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1h-2V3a1 1 0 00-1-1zM7 3h2v2H7V3z",
    stroke: false,
  },
  {
    key: "signals",
    label: "Signals",
    path: "M3 13V8M7 13V5M11 13V9M15 13V3",
    stroke: true,
  },
  {
    key: "schools",
    label: "Schools",
    path: "M2 14H14M3 14V5L8 2L13 5V14M6 14V10H10V14M6 7H6.01M10 7H10.01",
    stroke: true,
  },
  {
    key: "contacts",
    label: "Contacts",
    path: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13",
    stroke: true,
  },
  {
    key: "activity",
    label: "Activity",
    path: "M8 4V8L11 10M14 8A6 6 0 112 8A6 6 0 0114 8Z",
    stroke: true,
  },
];

// Only Planning, Schools, and Activity can have in-flight prefetches.
// Contacts and Signals use data already in the district detail response.
const PREFETCHABLE_TABS: DistrictTab[] = ["planning", "schools", "activity"];

interface DistrictTabStripProps {
  activeTab: DistrictTab;
  onSelect: (tab: DistrictTab) => void;
  contactCount?: number;
  showPlanning?: boolean;
  showSignals?: boolean;
  /** Tabs whose background prefetch is still in-flight — shows a pulsing dot */
  loadingTabs?: Partial<Record<DistrictTab, boolean>>;
}

export default function DistrictTabStrip({
  activeTab,
  onSelect,
  contactCount,
  showPlanning = true,
  showSignals = true,
  loadingTabs = {},
}: DistrictTabStripProps) {
  const visibleTabs = TABS
    .filter((t) => t.key !== "planning" || showPlanning)
    .filter((t) => t.key !== "signals" || showSignals);

  return (
    <div className="flex border-b border-gray-100">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const isLoading = PREFETCHABLE_TABS.includes(tab.key) && !!loadingTabs[tab.key];

        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              isActive
                ? "bg-plum/10 text-plum"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0"
              >
                <path
                  d={tab.path}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={tab.stroke ? "none" : "currentColor"}
                />
              </svg>
              {tab.key === "contacts" && contactCount != null && contactCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-plum text-white text-[8px] font-bold px-0.5">
                  {contactCount > 99 ? "99+" : contactCount}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1">
              {tab.label}
              {isLoading && <span className="tab-load-dot" aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Add the loading dot CSS to globals.css**

In `src/app/globals.css`, add after the `tabFadeUp` block from Task 4:

```css
/* Tab strip in-flight loading indicator */
.tab-load-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
  animation: tabDotPulse 1.2s ease-in-out infinite;
}

@keyframes tabDotPulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50%       { opacity: 0.7; transform: scale(1.1); }
}
```

- [ ] **Step 5: Wire `loadingTabs` in DistrictCard**

In `src/features/map/components/right-panels/DistrictCard.tsx`, add these lines after the `queryClient` declaration (after the prefetch `useEffect`):

```ts
// Read prefetch status from cache synchronously — zero fetches triggered
const schoolsLoading =
  queryClient.getQueryState(["schoolsByDistrict", leaid])?.status === "pending";
const planningLoading =
  queryClient.getQueryState(["planDistrict", activePlanId, leaid])?.status === "pending";
// activityQueryString is already defined at the component level from Task 3 — reuse it here.
const activityLoading =
  queryClient.getQueryState(["activities", activityQueryString])?.status === "pending";
```

Then pass the prop to `<DistrictTabStrip>` (find the existing `<DistrictTabStrip ... />` block, around line 105):

```tsx
<DistrictTabStrip
  activeTab={activeTab}
  onSelect={setActiveTab}
  contactCount={contacts.length}
  showPlanning
  showSignals={data.district.accountType === "district" || !data.district.accountType}
  loadingTabs={{
    schools: schoolsLoading,
    planning: planningLoading,
    activity: activityLoading,
  }}
/>
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run src/features/map/components/panels/district/tabs/__tests__/DistrictTabStrip.test.tsx
npm test
```

Expected: all DistrictTabStrip tests PASS, full suite still green.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx \
        src/features/map/components/panels/district/tabs/__tests__/DistrictTabStrip.test.tsx \
        src/features/map/components/right-panels/DistrictCard.tsx \
        src/app/globals.css
git commit -m "feat: add loading indicators to district card tab strip"
```

---

## Task 6: Local Verification (required before PR)

Manual verification checklist. Do not skip the Slow 3G test — this is the explicit edge case called out in the spec.

**Files:** none

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3005/?tab=map`

- [ ] **Step 2: Normal flow verification**

1. Click any district on the map
2. Card opens — verify no visual regression in the header or tab strip
3. Click Planning → content appears with fade-up, no skeleton
4. Click Signals → instant, fade-up
5. Click Schools → instant, fade-up (no skeleton)
6. Click Contacts → instant, fade-up
7. Close card, reopen same district → all tabs still instant (TQ cache)
8. Click a different district → loading dots briefly visible on Planning + Schools while prefetches land, then they disappear

- [ ] **Step 3: Edge case — Slow 3G, tab clicked before prefetch lands**

1. Open browser DevTools → Network → Throttling → set to **Slow 3G**
2. Click a district you haven't opened before (cold cache)
3. The card opens with the district header
4. **Immediately** (within ~1 second) click the Planning tab
5. Observe:
   - The Planning loading dot is visible on the tab
   - A skeleton renders inside the Planning tab
   - **In the Network tab: only ONE request to `/api/territory-plans/:planId/districts/:leaid`** — not two (TanStack Query deduplicates)
   - The skeleton resolves and content fades in — no second load flash
6. Remove throttling

- [ ] **Step 4: Run the full test suite one final time**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Done — ready for PR**
