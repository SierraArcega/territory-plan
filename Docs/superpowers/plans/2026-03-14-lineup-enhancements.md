# Lineup Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the activity edit gap (plans/states missing in edit mode) and add a rules-based goal suggestions panel to The Lineup.

**Architecture:** Two independent sub-features. Edit gap fix touches the form modal, its mutation hook, and the PATCH API route. Rules-based suggestions adds a small DB model (feedback only), a new API route (pure DB query + computation), a React Query hook, and two new UI components mounted above the activity timeline in LineupView. No AI API calls — suggestions are computed server-side using a priority-ordered rules engine.

**Tech Stack:** Next.js App Router, Prisma + Supabase (PostgreSQL), React Query (`@tanstack/react-query`), Tailwind CSS v4, Vitest + @testing-library/react.

---

## File Structure

### Chunk 1 — Edit Gap Fix

| Action | File |
|--------|------|
| Modify | `src/features/activities/lib/queries.ts` — add optional `planIds?` and `stateFips?` to `useUpdateActivity` mutation type |
| Modify | `src/app/api/activities/[id]/route.ts` — extract `planIds`/`stateFips` from PATCH body; sync plan and explicit-state links when present |
| Modify | `src/features/activities/components/ActivityFormModal.tsx` — remove `!isEditing` guards; fetch full activity on edit open; pre-populate plan/state/notes; add `onSuccess`, `defaultDistrictLeaid`, `defaultActivityType`, and `defaultTitle` props; disable save until fetch resolves; pass `planIds`/`stateFips` on update |
| New test | `src/app/api/activities/__tests__/route.test.ts` — extend existing test file with PATCH plan/state sync cases |
| New test | `src/features/activities/components/__tests__/ActivityFormModal.test.tsx` — edit mode renders plan/state pickers, pre-populates from full activity fetch, sends planIds on save |

### Chunk 2 — Rules-Based Suggestions

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` — add `SuggestionFeedback` model; add `suggestionFeedback` relation to `UserProfile` |
| Create | `src/features/lineup/lib/queries.ts` — `useLineupSuggestions(date: string)` + `useSuggestionFeedback()` hooks |
| Create | `src/app/api/lineup/suggestions/route.ts` — GET handler: run rules engine, return suggestions |
| Create | `src/app/api/lineup/suggestions/feedback/route.ts` — POST handler: record SuggestionFeedback row |
| Create | `src/features/lineup/components/SuggestionCard.tsx` — single suggestion card |
| Create | `src/features/lineup/components/SuggestionsBanner.tsx` — collapsed banner + floating overlay + feedback button |
| Modify | `src/features/lineup/components/LineupView.tsx` — mount `SuggestionsBanner` above timeline, derive busy count, pass selectedDate and currentUserId |
| New test | `src/features/lineup/lib/__tests__/queries.test.ts` — `useLineupSuggestions` returns null when date ≠ today; calls API when date = today |
| New test | `src/features/lineup/components/__tests__/SuggestionCard.test.tsx` — renders card fields; Schedule button opens ActivityFormModal pre-filled |
| New test | `src/features/lineup/components/__tests__/SuggestionsBanner.test.tsx` — hidden when not today; shows shimmer while loading; renders cards on success; shows error + retry; feedback button shows confirmation |
| New test | `src/app/api/lineup/__tests__/suggestions.test.ts` — returns suggestions for user with goals behind; uses DEFAULT rule when no goals |

---

## Chunk 1: Edit Gap Fix

---

### Task 1: Extend `useUpdateActivity` to accept `planIds` and `stateFips`

**Files:**
- Modify: `src/features/activities/lib/queries.ts:84-98`
- Test: `src/features/activities/lib/__tests__/queries.test.ts` (new file)

- [ ] **Step 1.1: Write the failing test**

Create `src/features/activities/lib/__tests__/queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/features/shared/lib/api-client", () => ({
  fetchJson: vi.fn(),
  API_BASE: "/api",
}));

import { fetchJson } from "@/features/shared/lib/api-client";
const mockFetch = vi.mocked(fetchJson);

import { useUpdateActivity } from "../queries";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useUpdateActivity", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("sends planIds and stateFips in the request body when provided", async () => {
    mockFetch.mockResolvedValue({ id: "act-1", type: "call", title: "Test", updatedAt: new Date().toISOString() });

    const { result } = renderHook(() => useUpdateActivity(), { wrapper: makeWrapper() });

    await result.current.mutateAsync({
      activityId: "act-1",
      title: "Test",
      planIds: ["plan-1", "plan-2"],
      stateFips: ["06", "08"],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/activities/act-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"planIds":["plan-1","plan-2"]'),
      })
    );
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.stateFips).toEqual(["06", "08"]);
  });

  it("omitting planIds and stateFips does not send them in the body", async () => {
    mockFetch.mockResolvedValue({ id: "act-1", type: "call", title: "Test", updatedAt: new Date().toISOString() });

    const { result } = renderHook(() => useUpdateActivity(), { wrapper: makeWrapper() });

    await result.current.mutateAsync({ activityId: "act-1", title: "Test" });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("planIds");
    expect(body).not.toHaveProperty("stateFips");
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

```bash
npx vitest run src/features/activities/lib/__tests__/queries.test.ts
```

Expected: FAIL — `planIds` not in the request body (TypeScript error or test assertion failure).

- [ ] **Step 1.3: Add `planIds?` and `stateFips?` to `useUpdateActivity`**

In `src/features/activities/lib/queries.ts`, extend the mutation type at lines 84–98:

```typescript
// Update activity mutation
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      ...data
    }: {
      activityId: string;
      type?: ActivityType;
      title?: string;
      startDate?: string | null;
      endDate?: string | null;
      status?: ActivityStatus;
      notes?: string | null;
      outcome?: string | null;
      outcomeType?: string | null;
      assignedToUserId?: string | null;
      planIds?: string[];
      stateFips?: string[];
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

```bash
npx vitest run src/features/activities/lib/__tests__/queries.test.ts
```

Expected: PASS — both test cases pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/features/activities/lib/queries.ts src/features/activities/lib/__tests__/queries.test.ts
git commit -m "feat: extend useUpdateActivity to accept optional planIds and stateFips"
```

---

### Task 2: Extend PATCH handler to sync plan and state links

**Files:**
- Modify: `src/app/api/activities/[id]/route.ts:165-166`
- Test: `src/app/api/activities/__tests__/route.test.ts` (extend existing)

- [ ] **Step 2.1: Write the failing tests**

Append to `src/app/api/activities/__tests__/route.test.ts`. First, look at the existing mock setup to ensure `activityPlan` and `activityState` are added to the Prisma mock (they won't be there yet — add them to the mock definition near the top of the file):

In the `vi.mock("@/lib/prisma", ...)` block, add:
```typescript
activityPlan: {
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
},
activityState: {
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
},
```

Then add these test cases (add to the existing `describe("PATCH")` block or create one):

```typescript
describe("PATCH /api/activities/[id] plan/state sync", () => {
  const existingActivity = {
    id: "activity-1",
    createdByUserId: "user-1",
    assignedToUserId: null,
    googleEventId: null,
  };

  beforeEach(() => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue(existingActivity);
    mockPrisma.activity.update.mockResolvedValue({
      ...existingActivity,
      type: "call",
      title: "Test",
      updatedAt: new Date(),
    });
    mockPrisma.activityPlan.findMany.mockResolvedValue([]);
    mockPrisma.activityPlan.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.activityPlan.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.activityState.findMany.mockResolvedValue([]);
    mockPrisma.activityState.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.activityState.createMany.mockResolvedValue({ count: 0 });
  });

  it("syncs plan links when planIds provided", async () => {
    mockPrisma.activityPlan.findMany.mockResolvedValue([{ planId: "plan-old" }]);

    const req = makeRequest("http://localhost:3000/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Test", planIds: ["plan-new"] }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "activity-1" }) });
    expect(res.status).toBe(200);

    expect(mockPrisma.activityPlan.deleteMany).toHaveBeenCalledWith({
      where: { activityId: "activity-1", planId: { in: ["plan-old"] } },
    });
    expect(mockPrisma.activityPlan.createMany).toHaveBeenCalledWith({
      data: [{ activityId: "activity-1", planId: "plan-new" }],
      skipDuplicates: true,
    });
  });

  it("syncs explicit state links when stateFips provided", async () => {
    mockPrisma.activityState.findMany.mockResolvedValue([{ stateFips: "06" }]);

    const req = makeRequest("http://localhost:3000/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Test", stateFips: ["08"] }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "activity-1" }) });
    expect(res.status).toBe(200);

    expect(mockPrisma.activityState.deleteMany).toHaveBeenCalledWith({
      where: { activityId: "activity-1", isExplicit: true, stateFips: { in: ["06"] } },
    });
    expect(mockPrisma.activityState.createMany).toHaveBeenCalledWith({
      data: [{ activityId: "activity-1", stateFips: "08", isExplicit: true }],
      skipDuplicates: true,
    });
  });

  it("skips plan sync when planIds not in body", async () => {
    const req = makeRequest("http://localhost:3000/api/activities/activity-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Test" }),
    });

    await PATCH(req, { params: Promise.resolve({ id: "activity-1" }) });

    expect(mockPrisma.activityPlan.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2.2: Run the failing tests**

```bash
npx vitest run src/app/api/activities/__tests__/route.test.ts
```

Expected: FAIL — `activityPlan`/`activityState` not found on mock, and sync logic not in handler.

- [ ] **Step 2.3: Implement plan/state sync in the PATCH handler**

In `src/app/api/activities/[id]/route.ts`, replace line 166:

```typescript
const { type, title, notes, startDate, endDate, status, outcome, outcomeType, assignedToUserId } = body;
```

with:

```typescript
const { type, title, notes, startDate, endDate, status, outcome, outcomeType, assignedToUserId, planIds, stateFips } = body;
```

Then after the `updateActivityOnCalendar(...)` call (after line 226), add the sync logic before the `return NextResponse.json(...)`:

```typescript
    // Sync plan links if planIds was explicitly provided in the request body
    if (planIds !== undefined) {
      const currentPlans = await prisma.activityPlan.findMany({
        where: { activityId: id },
        select: { planId: true },
      });
      const currentPlanIdSet = new Set(currentPlans.map((p: { planId: string }) => p.planId));
      const newPlanIdSet = new Set(planIds as string[]);

      const toDelete = [...currentPlanIdSet].filter((pid) => !newPlanIdSet.has(pid));
      const toAdd = [...newPlanIdSet].filter((pid) => !currentPlanIdSet.has(pid));

      if (toDelete.length > 0) {
        await prisma.activityPlan.deleteMany({
          where: { activityId: id, planId: { in: toDelete } },
        });
      }
      if (toAdd.length > 0) {
        await prisma.activityPlan.createMany({
          data: toAdd.map((planId: string) => ({ activityId: id, planId })),
          skipDuplicates: true,
        });
      }
    }

    // Sync explicit state links if stateFips was explicitly provided in the request body
    if (stateFips !== undefined) {
      const currentStates = await prisma.activityState.findMany({
        where: { activityId: id, isExplicit: true },
        select: { stateFips: true },
      });
      const currentFipsSet = new Set(currentStates.map((s: { stateFips: string }) => s.stateFips));
      const newFipsSet = new Set(stateFips as string[]);

      const toDeleteFips = [...currentFipsSet].filter((f) => !newFipsSet.has(f));
      const toAddFips = [...newFipsSet].filter((f) => !currentFipsSet.has(f));

      if (toDeleteFips.length > 0) {
        await prisma.activityState.deleteMany({
          where: { activityId: id, isExplicit: true, stateFips: { in: toDeleteFips } },
        });
      }
      if (toAddFips.length > 0) {
        await prisma.activityState.createMany({
          data: toAddFips.map((fips: string) => ({ activityId: id, stateFips: fips, isExplicit: true })),
          skipDuplicates: true,
        });
      }
    }
```

- [ ] **Step 2.4: Run the tests to verify they pass**

```bash
npx vitest run src/app/api/activities/__tests__/route.test.ts
```

Expected: PASS — all new test cases pass, no regressions.

- [ ] **Step 2.5: Commit**

```bash
git add src/app/api/activities/[id]/route.ts src/app/api/activities/__tests__/route.test.ts
git commit -m "feat: extend PATCH /api/activities/[id] to sync plan and state links"
```

---

### Task 3: Update `ActivityFormModal` — edit mode shows plan/state pickers, pre-populated from full fetch

**Files:**
- Modify: `src/features/activities/components/ActivityFormModal.tsx`
- New test: `src/features/activities/components/__tests__/ActivityFormModal.test.tsx`

- [ ] **Step 3.1: Write the failing tests**

Create `src/features/activities/components/__tests__/ActivityFormModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock the API hooks
vi.mock("@/lib/api", () => ({
  useCreateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTerritoryPlans: vi.fn(() => ({
    data: [
      { id: "plan-1", name: "Colorado Plan", color: "#403770" },
      { id: "plan-2", name: "Denver Metro Plan", color: "#F37167" },
    ],
  })),
  useStates: vi.fn(() => ({
    data: [
      { fips: "06", name: "California", abbrev: "CA" },
      { fips: "08", name: "Colorado", abbrev: "CO" },
    ],
  })),
  useUsers: vi.fn(() => ({ data: [] })),
  useProfile: vi.fn(() => ({ data: { id: "user-1" } })),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivity: vi.fn(() => ({ data: null, isLoading: false })),
}));

import { useActivity } from "@/features/activities/lib/queries";
import { useUpdateActivity } from "@/lib/api";
const mockUseActivity = vi.mocked(useActivity);
const mockUseUpdateActivity = vi.mocked(useUpdateActivity);

import ActivityFormModal from "../ActivityFormModal";
import type { ActivityListItem } from "@/features/shared/types/api-types";

const editingActivity: ActivityListItem = {
  id: "act-1",
  type: "call",
  category: "outreach",
  title: "Test Call",
  startDate: "2026-03-14T10:00:00Z",
  endDate: null,
  status: "planned",
  source: "manual",
  outcomeType: null,
  assignedToUserId: "user-1",
  needsPlanAssociation: false,
  hasUnlinkedDistricts: false,
  planCount: 1,
  districtCount: 0,
  stateAbbrevs: ["CO"],
};

const fullActivity = {
  id: "act-1",
  type: "call",
  category: "outreach",
  title: "Test Call",
  notes: "Existing notes",
  startDate: "2026-03-14T10:00:00Z",
  endDate: null,
  status: "planned",
  source: "manual",
  outcome: null,
  outcomeType: null,
  createdByUserId: "user-1",
  assignedToUserId: "user-1",
  createdAt: "2026-03-14T00:00:00Z",
  updatedAt: "2026-03-14T00:00:00Z",
  googleEventId: null,
  needsPlanAssociation: false,
  hasUnlinkedDistricts: false,
  plans: [{ planId: "plan-1", planName: "Colorado Plan", planColor: "#403770" }],
  districts: [],
  contacts: [],
  states: [
    { fips: "08", abbrev: "CO", name: "Colorado", isExplicit: true },
    { fips: "06", abbrev: "CA", name: "California", isExplicit: false }, // inferred — should NOT be pre-selected
  ],
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("ActivityFormModal — edit mode", () => {
  beforeEach(() => {
    mockUseActivity.mockReturnValue({ data: null, isLoading: true } as ReturnType<typeof useActivity>);
  });

  it("renders the Plans picker in edit mode", () => {
    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("Link to Plans")).toBeInTheDocument();
  });

  it("renders the States picker in edit mode", () => {
    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText("States")).toBeInTheDocument();
  });

  it("disables Save Changes button while full activity is loading", () => {
    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("pre-populates plans and explicit states from full activity fetch", async () => {
    mockUseActivity.mockReturnValue({ data: fullActivity, isLoading: false } as ReturnType<typeof useActivity>);

    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      const coloradoPlanCheckbox = screen.getByRole("checkbox", { name: /colorado plan/i });
      expect(coloradoPlanCheckbox).toBeChecked();
    });

    const coloradoStateCheckbox = screen.getByRole("checkbox", { name: /colorado/i });
    expect(coloradoStateCheckbox).toBeChecked();

    // CA was isExplicit: false — should NOT be checked
    const californiaStateCheckbox = screen.getByRole("checkbox", { name: /california/i });
    expect(californiaStateCheckbox).not.toBeChecked();
  });

  it("sends planIds and stateFips in the update call", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    mockUseUpdateActivity.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false } as ReturnType<typeof useUpdateActivity>);
    mockUseActivity.mockReturnValue({ data: fullActivity, isLoading: false } as ReturnType<typeof useActivity>);

    render(
      <ActivityFormModal isOpen initialData={editingActivity} onClose={vi.fn()} />,
      { wrapper: makeWrapper() }
    );

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: "act-1",
          planIds: ["plan-1"],
          stateFips: ["08"],
        })
      );
    });
  });
});
```

- [ ] **Step 3.2: Run the tests to verify they fail**

```bash
npx vitest run src/features/activities/components/__tests__/ActivityFormModal.test.tsx
```

Expected: FAIL — Plans/States pickers not in DOM in edit mode; Save button not disabled; planIds not sent.

- [ ] **Step 3.3: Update `ActivityFormModal`**

Make these changes to `src/features/activities/components/ActivityFormModal.tsx`:

**a) Add `onSuccess`, `defaultDistrictLeaid`, `defaultActivityType`, and `defaultTitle` to the props interface** (after line 24):

```typescript
interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: ActivityCategory;
  defaultPlanId?: string;
  defaultDistrictLeaid?: string;
  defaultActivityType?: ActivityType;
  defaultTitle?: string;
  // Provide initialData to open in edit mode
  initialData?: ActivityListItem | null;
  // Called after a new activity is successfully created — receives the new activity's ID
  onSuccess?: (activityId: string) => void;
}
```

**b) Destructure the new props** (line 32-33):

```typescript
export default function ActivityFormModal({
  isOpen,
  onClose,
  defaultCategory,
  defaultPlanId,
  defaultDistrictLeaid,
  defaultActivityType,
  defaultTitle,
  initialData,
  onSuccess,
}: ActivityFormModalProps) {
```

**b-ii) Apply `defaultActivityType` and `defaultTitle` in the create-mode reset** in the `useEffect` else branch (around line 78):

```typescript
      } else {
        setType(
          defaultActivityType ??
          (defaultCategory ? DEFAULT_TYPE_FOR_CATEGORY[defaultCategory] : "conference")
        );
        setTitle(defaultTitle ?? "");
        // ... rest unchanged
```

**c) Add `useActivity` import** — add at the top, after the existing `@/lib/api` import:

```typescript
import { useActivity } from "@/features/activities/lib/queries";
```

**d) Add the `useActivity` call** — after line 40 (`const { data: profile } = useProfile();`):

```typescript
  // In edit mode, fetch the full activity to get plan/state IDs (ActivityListItem only carries counts)
  const { data: fullActivity, isLoading: isActivityLoading } = useActivity(
    isEditing && isOpen ? (initialData?.id ?? null) : null
  );
```

**e) Add a useEffect to pre-populate plan/state/notes from the full fetch** — add after the existing reset `useEffect` (after line 91):

```typescript
  // Pre-populate plans, states, and notes once the full activity fetch resolves
  useEffect(() => {
    if (fullActivity && isEditing) {
      setSelectedPlanIds(fullActivity.plans.map((p) => p.planId));
      setSelectedStateFips(
        fullActivity.states.filter((s) => s.isExplicit).map((s) => s.fips)
      );
      setNotes(fullActivity.notes ?? "");
    }
  }, [fullActivity, isEditing]);
```

**f) Remove the `!isEditing` guard from the Plans picker** — change line 290:

```typescript
{/* Plans selector */}
<div>
```

(Remove the `{!isEditing && (` wrapper and the corresponding `)}` at line 329, while keeping the inner `<div>` content intact. Also add `disabled` to each checkbox to block interaction while loading in edit mode.)

Inside the plans checkbox, change:
```typescript
onChange={() => togglePlan(plan.id)}
className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
```
to:
```typescript
onChange={() => togglePlan(plan.id)}
disabled={isEditing && isActivityLoading}
className="rounded border-gray-300 text-[#403770] focus:ring-[#403770] disabled:opacity-50"
```

**g) Remove the `!isEditing` guard from the States picker** — change line 332:

```typescript
{/* States selector */}
<div>
```

(Remove the `{!isEditing && (` wrapper and corresponding `)}` at line 362. Add `disabled` to the state checkboxes the same way as plans.)

**h) Update `isPending` to also disable Save while the full activity is loading** — replace line 162:

```typescript
const isPending = createActivity.isPending || updateActivity.isPending;
const isSaveDisabled = !title.trim() || isPending || (isEditing && isActivityLoading);
```

**i) Update the Save button** — change the `disabled` prop at line 415:

```typescript
disabled={isSaveDisabled}
```

**j) Update `handleSubmit` edit path** — replace the `updateActivity.mutateAsync` call (lines 115-124) to pass planIds and stateFips:

```typescript
      if (isEditing) {
        await updateActivity.mutateAsync({
          activityId: initialData!.id,
          type,
          title: title.trim(),
          startDate: startDate || undefined,
          endDate: isMultiDay && endDate ? endDate : null,
          notes: notes.trim() || undefined,
          status,
          assignedToUserId: assignedToUserId || null,
          planIds: selectedPlanIds,
          stateFips: selectedStateFips,
        });
```

**k) Capture the created activity ID and call `onSuccess`** — replace the `createActivity.mutateAsync` call (lines 126-136):

```typescript
      } else {
        const created = await createActivity.mutateAsync({
          type,
          title: title.trim(),
          startDate: startDate || undefined,
          endDate: isMultiDay && endDate ? endDate : undefined,
          notes: notes.trim() || undefined,
          status,
          planIds: selectedPlanIds.length > 0 ? selectedPlanIds : undefined,
          stateFips: selectedStateFips.length > 0 ? selectedStateFips : undefined,
          assignedToUserId: assignedToUserId || null,
        });
        onSuccess?.(created.id);
      }
```

- [ ] **Step 3.4: Run the tests to verify they pass**

```bash
npx vitest run src/features/activities/components/__tests__/ActivityFormModal.test.tsx
```

Expected: PASS — all five test cases pass.

- [ ] **Step 3.5: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: All previously passing tests still pass.

- [ ] **Step 3.6: Commit**

```bash
git add src/features/activities/components/ActivityFormModal.tsx src/features/activities/components/__tests__/ActivityFormModal.test.tsx
git commit -m "feat: fix edit gap — plans/states pickers now appear and pre-populate in edit mode"
```

---

## Chunk 2: Rules-Based Suggestions

---

### Task 4: Add `SuggestionFeedback` DB model

**Files:**
- Modify: `prisma/schema.prisma`

This is a lightweight demand-signal table. No caching table is needed — the rules engine is fast (pure DB queries).

- [ ] **Step 4.1: Add the `SuggestionFeedback` model to `prisma/schema.prisma`**

Append after the `UserGoal` model block (after the last model in the file):

```prisma
// ===== Suggestion Feedback =====
// Tracks users who clicked "Want AI-powered recommendations?" — used as a demand signal.
// No personal data beyond userId + timestamp.
model SuggestionFeedback {
  id        String      @id @default(uuid())
  userId    String      @map("user_id") @db.Uuid
  user      UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now()) @map("created_at")

  @@index([userId])
  @@map("suggestion_feedback")
}
```

Also add `suggestionFeedback SuggestionFeedback[]` to the `UserProfile` model (after the `goals UserGoal[]` line):

```prisma
  suggestionFeedback SuggestionFeedback[]
```

- [ ] **Step 4.2: Apply the migration to Supabase**

```bash
npx prisma migrate dev --name add-suggestion-feedback
```

If Prisma migrate fails due to the live Supabase connection, apply the SQL directly in the Supabase SQL Editor instead:

```sql
CREATE TABLE suggestion_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX suggestion_feedback_user_id_idx ON suggestion_feedback (user_id);
```

Then regenerate the Prisma client:

```bash
npx prisma generate
```

- [ ] **Step 4.3: Verify the Prisma client compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors related to the new model.

- [ ] **Step 4.4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add SuggestionFeedback model for demand tracking"
```

---

### Task 5: Create `useLineupSuggestions` + `useSuggestionFeedback` hooks

**Files:**
- Create: `src/features/lineup/lib/queries.ts`
- New test: `src/features/lineup/lib/__tests__/queries.test.ts`

- [ ] **Step 5.1: Write the failing tests**

Create `src/features/lineup/lib/__tests__/queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock date utils to control "today"
vi.mock("@/features/shared/lib/date-utils", () => ({
  getToday: vi.fn(() => "2026-03-14"),
}));

vi.mock("@/features/shared/lib/api-client", () => ({
  fetchJson: vi.fn(),
  API_BASE: "/api",
}));

import { fetchJson } from "@/features/shared/lib/api-client";
const mockFetch = vi.mocked(fetchJson);

import { useLineupSuggestions, useSuggestionFeedback } from "../queries";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useLineupSuggestions", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns null immediately when date is not today", () => {
    const { result } = renderHook(() => useLineupSuggestions("2026-03-13"), {
      wrapper: makeWrapper(),
    });
    expect(result.current.suggestions).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches from /api/lineup/suggestions when date is today", async () => {
    const fakeSuggestions = [{ activityType: "call", title: "Test", opportunityType: "renewal" }];
    mockFetch.mockResolvedValue({ suggestions: fakeSuggestions });

    const { result } = renderHook(() => useLineupSuggestions("2026-03-14"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.suggestions).toEqual(fakeSuggestions);
    expect(mockFetch).toHaveBeenCalledWith("/api/lineup/suggestions");
  });
});

describe("useSuggestionFeedback", () => {
  beforeEach(() => mockFetch.mockReset());

  it("POSTs to /api/lineup/suggestions/feedback on mutate", async () => {
    mockFetch.mockResolvedValue({});

    const { result } = renderHook(() => useSuggestionFeedback(), {
      wrapper: makeWrapper(),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/lineup/suggestions/feedback",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
```

- [ ] **Step 5.2: Run the test to verify it fails**

```bash
npx vitest run src/features/lineup/lib/__tests__/queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Create `src/features/lineup/lib/queries.ts`**

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { getToday } from "@/features/shared/lib/date-utils";

export interface LineSuggestion {
  activityType: string;
  title: string;
  districtLeaid: string | null;
  districtName: string | null;
  planId: string | null;
  planName: string | null;
  contractValue: number | null;
  lastContactDays: number | null;
  renewalWeeks: number | null;
  opportunityType: "renewal" | "expansion" | "winback" | "new_business";
  reasoning: string;
  goalTags: string[];
  riskTags: string[];
}

interface SuggestionsResponse {
  suggestions: LineSuggestion[];
}

// Returns today's rules-based suggestions, or null if the date isn't today.
export function useLineupSuggestions(date: string) {
  const isToday = date === getToday();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["lineup-suggestions", date],
    queryFn: () => fetchJson<SuggestionsResponse>(`${API_BASE}/lineup/suggestions`),
    enabled: isToday,
    staleTime: 5 * 60 * 1000, // 5 minutes — cheap to recompute but no need to hammer on every render
  });

  return {
    suggestions: isToday ? (data?.suggestions ?? null) : null,
    isLoading: isToday ? isLoading : false,
    error: isToday ? error : null,
    refetch,
  };
}

// Records user interest in AI-powered suggestions (demand signal).
export function useSuggestionFeedback() {
  return useMutation({
    mutationFn: () =>
      fetchJson<void>(`${API_BASE}/lineup/suggestions/feedback`, { method: "POST" }),
  });
}
```

- [ ] **Step 5.4: Run the test to verify it passes**

```bash
npx vitest run src/features/lineup/lib/__tests__/queries.test.ts
```

Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/features/lineup/lib/queries.ts src/features/lineup/lib/__tests__/queries.test.ts
git commit -m "feat: add useLineupSuggestions and useSuggestionFeedback hooks"
```

---

### Task 6: Create `GET /api/lineup/suggestions` and `POST /api/lineup/suggestions/feedback` routes

**Files:**
- Create: `src/app/api/lineup/suggestions/route.ts`
- Create: `src/app/api/lineup/suggestions/feedback/route.ts`
- New test: `src/app/api/lineup/__tests__/suggestions.test.ts`

The GET endpoint:
1. Authenticates the user
2. Loads `UserGoal` + computed actuals, last 30 days of activities, active plans + districts
3. Runs the rules engine to generate up to 3 suggestions
4. Returns the suggestion array

The POST endpoint:
1. Authenticates the user
2. Creates a `SuggestionFeedback` row

**Rules engine (implemented in the route file, exported for testing):**
- **RENEWAL_BEHIND**: `renewalActual < renewalTarget × 0.9` — find districts in active plans with no renewal-type activity in last 30 days, sort by contract value DESC
- **PIPELINE_BEHIND**: `pipelineActual < pipelineTarget × 0.9` — find districts with no activity in last 30 days, sort by contract value DESC
- **LONG_DORMANT**: districts with no activity in 45+ days regardless of goals
- **DEFAULT**: top 3 highest-value districts with no activity in 14+ days (used when no goals or fewer than 3 cards generated above)
- Deduplicate by `districtLeaid` across rules; stop when 3 suggestions are collected

`lastContactDays`: days since the most recent activity for that district (across all time, not just 30 days).
`renewalWeeks`: weeks since most recent renewal-type activity for that district + 52 weeks − elapsed weeks = estimated weeks until next renewal. `null` if no prior renewal activity.

- [ ] **Step 6.1: Write the failing tests**

Create `src/app/api/lineup/__tests__/suggestions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getUser: (...args: unknown[]) => mockGetUser(...args) }));

vi.mock("@/lib/prisma", () => ({
  default: {
    userGoal: { findFirst: vi.fn() },
    activity: { findMany: vi.fn() },
    territoryPlan: { findMany: vi.fn() },
    suggestionFeedback: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
const mockPrisma = vi.mocked(prisma);

import { GET } from "../suggestions/route";
import { POST } from "../suggestions/feedback/route";

const TEST_USER = { id: "user-1" };

function makeGetRequest() {
  return new NextRequest(new URL("http://localhost:3000/api/lineup/suggestions"));
}

function makePostRequest() {
  return new NextRequest(new URL("http://localhost:3000/api/lineup/suggestions/feedback"), {
    method: "POST",
  });
}

const TODAY = new Date().toISOString().split("T")[0];

// A plan with one district that hasn't been contacted
const activePlan = {
  id: "plan-1",
  name: "Colorado Plan",
  districts: [
    {
      districtLeaid: "0812345",
      district: { name: "Jeffco SD", leaid: "0812345", contractValue: 180000 },
    },
  ],
};

// Renewal goal significantly behind
const renewalGoal = {
  id: "goal-1",
  userId: "user-1",
  fiscalYear: new Date().getFullYear(),
  renewalTarget: 500000,
  renewalActual: 200000, // 40% — well behind
  earningsTarget: 800000,
  takeActual: 300000,
  winbackTarget: 50000,
  expansionTarget: 100000,
  newBusinessTarget: 150000,
  pipelineActual: 200000,
};

describe("GET /api/lineup/suggestions", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.userGoal.findFirst.mockResolvedValue(null);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns suggestions using DEFAULT rule when no goals are set", async () => {
    mockPrisma.userGoal.findFirst.mockResolvedValue(null);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([activePlan]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions).toHaveLength(1);
    expect(json.suggestions[0].districtLeaid).toBe("0812345");
    expect(json.suggestions[0].opportunityType).toBeDefined();
  });

  it("prioritises RENEWAL_BEHIND rule when renewal goal is behind", async () => {
    mockPrisma.userGoal.findFirst.mockResolvedValue(renewalGoal);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([activePlan]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions[0].opportunityType).toBe("renewal");
    expect(json.suggestions[0].reasoning).toMatch(/renewal/i);
  });

  it("returns empty array when no active plans", async () => {
    mockPrisma.userGoal.findFirst.mockResolvedValue(renewalGoal);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.territoryPlan.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions).toEqual([]);
  });
});

describe("POST /api/lineup/suggestions/feedback", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.suggestionFeedback.create.mockResolvedValue({ id: "fb-1", userId: "user-1", createdAt: new Date() });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(401);
  });

  it("creates a SuggestionFeedback record", async () => {
    const res = await POST(makePostRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.suggestionFeedback.create).toHaveBeenCalledWith({
      data: { userId: "user-1" },
    });
  });
});
```

- [ ] **Step 6.2: Run the tests to verify they fail**

```bash
npx vitest run src/app/api/lineup/__tests__/suggestions.test.ts
```

Expected: FAIL — route modules not found.

- [ ] **Step 6.3: Create `src/app/api/lineup/suggestions/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_OPPORTUNITY_TYPES = ["renewal", "expansion", "winback", "new_business"] as const;
type OpportunityType = (typeof VALID_OPPORTUNITY_TYPES)[number];

export interface Suggestion {
  activityType: string;
  title: string;
  districtLeaid: string | null;
  districtName: string | null;
  planId: string | null;
  planName: string | null;
  contractValue: number | null;
  lastContactDays: number | null;
  renewalWeeks: number | null;
  opportunityType: OpportunityType;
  reasoning: string;
  goalTags: string[];
  riskTags: string[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// Runs the priority-ordered rules engine and returns up to maxCount suggestions.
// Exported so it can be unit-tested independently.
export function buildSuggestions({
  userGoal,
  recentActivities,
  activePlans,
  today,
  maxCount = 3,
}: {
  userGoal: Record<string, unknown> | null;
  recentActivities: Array<{
    districtLeaid: string;
    districtName: string | null;
    planId: string | null;
    planName: string | null;
    contractValue: number | null;
    lastActivityDate: string | null;
    lastRenewalDate: string | null;
  }>;
  activePlans: Array<{
    id: string;
    name: string;
    districts: Array<{
      districtLeaid: string;
      districtName: string;
      contractValue: number | null;
    }>;
  }>;
  today: string;
  maxCount?: number;
}): Suggestion[] {
  const todayMs = new Date(today).getTime();
  const seen = new Set<string>();
  const results: Suggestion[] = [];

  // Build a lookup from leaid → last contact info
  const contactMap = new Map<string, { lastActivityDate: string | null; lastRenewalDate: string | null }>();
  for (const a of recentActivities) {
    if (!contactMap.has(a.districtLeaid)) {
      contactMap.set(a.districtLeaid, { lastActivityDate: a.lastActivityDate, lastRenewalDate: a.lastRenewalDate });
    }
  }

  // Flatten all districts across plans
  const allDistricts = activePlans.flatMap((p) =>
    p.districts.map((d) => ({ ...d, planId: p.id, planName: p.name }))
  );

  function daysSince(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    return Math.floor((todayMs - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  function renewalWeeks(lastRenewalDate: string | null | undefined): number | null {
    if (!lastRenewalDate) return null;
    const elapsed = Math.floor((todayMs - new Date(lastRenewalDate).getTime()) / (1000 * 60 * 60 * 24 * 7));
    return Math.max(0, 52 - elapsed);
  }

  function addSuggestion(
    district: { districtLeaid: string; districtName: string; contractValue: number | null; planId: string; planName: string },
    opportunityType: OpportunityType,
    goalTags: string[],
    riskTags: string[],
    makeReasoning: (lastDays: number | null, rnwWeeks: number | null) => string
  ) {
    if (seen.has(district.districtLeaid) || results.length >= maxCount) return;
    seen.add(district.districtLeaid);
    const contact = contactMap.get(district.districtLeaid);
    const lastDays = daysSince(contact?.lastActivityDate);
    const rnwWeeks = renewalWeeks(contact?.lastRenewalDate);
    results.push({
      activityType: "call",
      title: `${opportunityType === "renewal" ? "Renewal Check-in" : opportunityType === "expansion" ? "Expansion Opportunity" : "Check In"} — ${district.districtName}`,
      districtLeaid: district.districtLeaid,
      districtName: district.districtName,
      planId: district.planId,
      planName: district.planName,
      contractValue: district.contractValue,
      lastContactDays: lastDays,
      renewalWeeks: rnwWeeks,
      opportunityType,
      reasoning: makeReasoning(lastDays, rnwWeeks),
      goalTags,
      riskTags,
    });
  }

  // Sort helper: contract value DESC, then lastContactDays DESC
  function byPriority(a: typeof allDistricts[number], b: typeof allDistricts[number]): number {
    const aVal = a.contractValue ?? 0;
    const bVal = b.contractValue ?? 0;
    if (bVal !== aVal) return bVal - aVal;
    const aDays = daysSince(contactMap.get(a.districtLeaid)?.lastActivityDate) ?? 0;
    const bDays = daysSince(contactMap.get(b.districtLeaid)?.lastActivityDate) ?? 0;
    return bDays - aDays;
  }

  const renewalTarget = (userGoal?.renewalTarget as number) ?? 0;
  const renewalActual = (userGoal?.renewalActual as number) ?? 0;
  const pipelineTarget = ((userGoal?.renewalTarget as number) ?? 0)
    + ((userGoal?.winbackTarget as number) ?? 0)
    + ((userGoal?.expansionTarget as number) ?? 0)
    + ((userGoal?.newBusinessTarget as number) ?? 0);
  const pipelineActual = (userGoal?.pipelineActual as number) ?? 0;

  const notContactedIn30 = allDistricts.filter((d) => {
    const days = daysSince(contactMap.get(d.districtLeaid)?.lastActivityDate);
    return days === null || days >= 30;
  });

  // Rule 1: RENEWAL_BEHIND
  if (userGoal && renewalTarget > 0 && renewalActual < renewalTarget * 0.9) {
    const gap = renewalTarget - renewalActual;
    const sorted = [...notContactedIn30].sort(byPriority);
    for (const d of sorted) {
      addSuggestion(d, "renewal", ["Renewal goal"], ["At risk"], (days, _weeks) => {
        const parts = [`Your renewal goal is ${formatCurrency(gap)} behind.`];
        if (d.contractValue) parts.push(`${d.districtName} (${formatCurrency(d.contractValue)}) is a key renewal.`);
        if (days !== null) parts.push(`Last contact was ${days} day${days === 1 ? "" : "s"} ago.`);
        return parts.join(" ");
      });
    }
  }

  // Rule 2: PIPELINE_BEHIND
  if (results.length < maxCount && userGoal && pipelineTarget > 0 && pipelineActual < pipelineTarget * 0.9) {
    const gap = pipelineTarget - pipelineActual;
    const sorted = [...notContactedIn30].sort(byPriority);
    for (const d of sorted) {
      addSuggestion(d, "expansion", ["Pipeline goal"], ["Opportunity"], (days, _weeks) => {
        const parts = [`Your pipeline is ${formatCurrency(gap)} behind target.`];
        if (d.contractValue) parts.push(`${d.districtName} (${formatCurrency(d.contractValue)}) is an expansion opportunity.`);
        if (days !== null) parts.push(`Last contact was ${days} day${days === 1 ? "" : "s"} ago.`);
        return parts.join(" ");
      });
    }
  }

  // Rule 3: LONG_DORMANT
  if (results.length < maxCount) {
    const dormant = allDistricts
      .filter((d) => {
        const days = daysSince(contactMap.get(d.districtLeaid)?.lastActivityDate);
        return days === null || days >= 45;
      })
      .sort(byPriority);
    for (const d of dormant) {
      addSuggestion(d, "renewal", [], ["Dormant"], (days, _weeks) => {
        const parts = [`${d.districtName} hasn't been contacted in ${days ?? "a long time"} days.`];
        if (d.contractValue) parts.push(`They have ${formatCurrency(d.contractValue)} in active value.`);
        return parts.join(" ");
      });
    }
  }

  // Rule 4: DEFAULT — top high-value districts not contacted in 14+ days
  if (results.length < maxCount) {
    const defaultCandidates = allDistricts
      .filter((d) => {
        const days = daysSince(contactMap.get(d.districtLeaid)?.lastActivityDate);
        return days === null || days >= 14;
      })
      .sort(byPriority);
    for (const d of defaultCandidates) {
      addSuggestion(d, "renewal", [], [], (days, _weeks) => {
        if (days !== null) return `${d.districtName} hasn't been contacted in ${days} day${days === 1 ? "" : "s"}.`;
        return `${d.districtName} is in your active plan and due for a check-in.`;
      });
    }
  }

  return results;
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const currentFiscalYear = new Date().getFullYear();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [userGoal, rawActivities, rawPlans] = await Promise.all([
      prisma.userGoal.findFirst({
        where: { userId: user.id, fiscalYear: currentFiscalYear },
      }),
      prisma.activity.findMany({
        where: { assignedToUserId: user.id },
        select: {
          type: true,
          startDate: true,
          districts: { select: { districtLeaid: true } },
          plans: { select: { planId: true } },
        },
        orderBy: { startDate: "desc" },
        take: 200, // enough to compute per-district last-contact
      }),
      prisma.territoryPlan.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          name: true,
          districts: {
            select: {
              districtLeaid: true,
              district: { select: { name: true, leaid: true } },
            },
          },
        },
        take: 20,
      }),
    ]);

    // Build per-district last-contact and last-renewal lookups from activity history
    const lastContactByLeaid = new Map<string, string>();
    const lastRenewalByLeaid = new Map<string, string>();
    for (const act of rawActivities) {
      for (const d of act.districts) {
        const leaid = d.districtLeaid;
        if (!lastContactByLeaid.has(leaid) && act.startDate) {
          lastContactByLeaid.set(leaid, act.startDate.toISOString());
        }
        if (
          !lastRenewalByLeaid.has(leaid) &&
          act.startDate &&
          ["renewal_call", "renewal_meeting", "renewal"].includes(act.type)
        ) {
          lastRenewalByLeaid.set(leaid, act.startDate.toISOString());
        }
      }
    }

    // Shape data for the rules engine
    const recentActivities = Array.from(lastContactByLeaid.entries()).map(([leaid, lastDate]) => ({
      districtLeaid: leaid,
      districtName: null,
      planId: null,
      planName: null,
      contractValue: null,
      lastActivityDate: lastDate,
      lastRenewalDate: lastRenewalByLeaid.get(leaid) ?? null,
    }));

    const activePlans = rawPlans.map((p) => ({
      id: p.id,
      name: p.name,
      districts: p.districts.map((d) => ({
        districtLeaid: d.districtLeaid,
        districtName: d.district.name,
        contractValue: null, // contract value not in current schema; will be null
      })),
    }));

    const suggestions = buildSuggestions({
      userGoal: userGoal as Record<string, unknown> | null,
      recentActivities,
      activePlans,
      today,
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error computing lineup suggestions:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
```

- [ ] **Step 6.4: Create `src/app/api/lineup/suggestions/feedback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.suggestionFeedback.create({
      data: { userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error recording suggestion feedback:", error);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
```

- [ ] **Step 6.5: Run the tests to verify they pass**

```bash
npx vitest run src/app/api/lineup/__tests__/suggestions.test.ts
```

Expected: PASS — all test cases pass.

- [ ] **Step 6.6: Commit**

```bash
git add src/app/api/lineup/suggestions/route.ts src/app/api/lineup/suggestions/feedback/route.ts src/app/api/lineup/__tests__/suggestions.test.ts
git commit -m "feat: add GET /api/lineup/suggestions (rules engine) and POST /api/lineup/suggestions/feedback"
```

---

### Task 7: Create `SuggestionCard` component

**Files:**
- Create: `src/features/lineup/components/SuggestionCard.tsx`
- New test: `src/features/lineup/components/__tests__/SuggestionCard.test.tsx`

Each card shows: activity type + icon, district + plan names, 3 metric chips (contract value, last contact days, renewal weeks), rule-generated reasoning (1-2 sentences), goal/risk tags, and a Schedule button that opens `ActivityFormModal` pre-filled.

- [ ] **Step 7.1: Write the failing tests**

Create `src/features/lineup/components/__tests__/SuggestionCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { LineSuggestion } from "@/features/lineup/lib/queries";

vi.mock("@/lib/api", () => ({
  useCreateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTerritoryPlans: vi.fn(() => ({ data: [] })),
  useStates: vi.fn(() => ({ data: [] })),
  useUsers: vi.fn(() => ({ data: [] })),
  useProfile: vi.fn(() => ({ data: { id: "user-1" } })),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivity: vi.fn(() => ({ data: null, isLoading: false })),
}));

import SuggestionCard from "../SuggestionCard";

const suggestion: LineSuggestion = {
  activityType: "call",
  title: "Renewal Call — Jeffco SD",
  districtLeaid: "0812345",
  districtName: "Jeffco School District",
  planId: "plan-1",
  planName: "Colorado Expansion Plan",
  contractValue: 180000,
  lastContactDays: 21,
  renewalWeeks: 6,
  opportunityType: "renewal",
  reasoning: "Securing this renewal closes your entire earnings gap for FY2026.",
  goalTags: ["Renewal goal", "Earnings goal"],
  riskTags: ["At risk"],
};

describe("SuggestionCard", () => {
  it("renders activity type and title", () => {
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText(/renewal call — jeffco sd/i)).toBeInTheDocument();
  });

  it("renders district and plan names", () => {
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText(/jeffco school district/i)).toBeInTheDocument();
    expect(screen.getByText(/colorado expansion plan/i)).toBeInTheDocument();
  });

  it("renders metric chips with formatted values", () => {
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText("$180,000")).toBeInTheDocument();
    expect(screen.getByText("21 days ago")).toBeInTheDocument();
    expect(screen.getByText("6 weeks")).toBeInTheDocument();
  });

  it("renders the AI reasoning", () => {
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText(/securing this renewal closes/i)).toBeInTheDocument();
  });

  it("renders goal and risk tags", () => {
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText("Renewal goal")).toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
  });

  it("shows ActivityFormModal when Schedule is clicked", async () => {
    render(<SuggestionCard suggestion={suggestion} />);
    await userEvent.click(screen.getByRole("button", { name: /schedule/i }));
    // Modal title should appear
    expect(screen.getByText("New Activity")).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.2: Run the tests to verify they fail**

```bash
npx vitest run src/features/lineup/components/__tests__/SuggestionCard.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 7.3: Create `src/features/lineup/components/SuggestionCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { LineSuggestion } from "@/features/lineup/lib/queries";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import { useLinkActivityDistricts } from "@/features/activities/lib/queries";

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "🤝",
  demo: "💻",
  conference: "🎤",
  proposal: "📄",
  site_visit: "🏫",
  other: "📌",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

interface SuggestionCardProps {
  suggestion: LineSuggestion;
}

export default function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkDistricts = useLinkActivityDistricts();

  const icon = ACTIVITY_TYPE_ICONS[suggestion.activityType] ?? "📌";

  // Called after the user creates the activity via the pre-filled modal.
  // Attempts to link the suggested district — surfaces a dismissable error if it fails.
  const handleActivityCreated = async (activityId: string) => {
    if (suggestion.districtLeaid) {
      try {
        await linkDistricts.mutateAsync({ activityId, leaids: [suggestion.districtLeaid] });
      } catch {
        setLinkError("Activity saved — couldn't link district. Add it manually.");
      }
    }
  };

  return (
    <>
      <div className="bg-[#FFFCFA] border border-[#D4CFE2] rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow">
        {/* Header row */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-[#403770] text-sm font-semibold">
              {icon} {suggestion.title}
            </div>
            {(suggestion.districtName || suggestion.planName) && (
              <div className="text-[#8A80A8] text-xs mt-0.5 truncate">
                {[suggestion.districtName, suggestion.planName].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="ml-3 flex-shrink-0 bg-[#403770] text-white text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-[#322a5a] transition-colors whitespace-nowrap"
          >
            + Schedule
          </button>
        </div>

        {/* Metric chips */}
        <div className="flex gap-2 mb-2 flex-wrap">
          {suggestion.contractValue !== null && (
            <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-md px-2 py-1">
              <div className="text-[#A69DC0] text-[9px] leading-none mb-0.5">
                {suggestion.opportunityType === "renewal" ? "Contract value" : "Opportunity"}
              </div>
              <div className="text-[#403770] text-[11px] font-semibold">
                {formatCurrency(suggestion.contractValue)}
              </div>
            </div>
          )}
          {suggestion.renewalWeeks !== null && (
            <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-md px-2 py-1">
              <div className="text-[#A69DC0] text-[9px] leading-none mb-0.5">Renews in</div>
              <div className={`text-[11px] font-semibold ${suggestion.renewalWeeks <= 8 ? "text-[#F37167]" : "text-[#403770]"}`}>
                {suggestion.renewalWeeks} weeks
              </div>
            </div>
          )}
          {suggestion.lastContactDays !== null && (
            <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-md px-2 py-1">
              <div className="text-[#A69DC0] text-[9px] leading-none mb-0.5">Last contact</div>
              <div className={`text-[11px] font-semibold ${suggestion.lastContactDays >= 14 ? "text-[#F37167]" : "text-[#403770]"}`}>
                {suggestion.lastContactDays} days ago
              </div>
            </div>
          )}
        </div>

        {/* Reasoning */}
        <p className="text-[#6E6390] text-[11px] leading-relaxed mb-2 italic">
          &ldquo;{suggestion.reasoning}&rdquo;
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {suggestion.riskTags.map((tag) => (
            <span
              key={tag}
              className="bg-[#fef1f0] text-[#F37167] text-[10px] font-medium px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
          {suggestion.goalTags.map((tag) => (
            <span
              key={tag}
              className="bg-[#EFEDF5] text-[#403770] text-[10px] font-medium px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Inline error toast — shown when district auto-link fails after creation */}
      {linkError && (
        <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <span>{linkError}</span>
          <button onClick={() => setLinkError(null)} className="ml-2 text-amber-600 hover:text-amber-900 font-medium">
            ✕
          </button>
        </div>
      )}

      {/* Pre-filled ActivityFormModal */}
      <ActivityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultPlanId={suggestion.planId ?? undefined}
        defaultActivityType={suggestion.activityType as ActivityType}
        defaultTitle={suggestion.title}
        onSuccess={handleActivityCreated}
      />
    </>
  );
}

// Need to import ActivityType at the top of SuggestionCard.tsx:
// import type { ActivityType } from "@/features/activities/types";
```

- [ ] **Step 7.4: Run the tests to verify they pass**

```bash
npx vitest run src/features/lineup/components/__tests__/SuggestionCard.test.tsx
```

Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/features/lineup/components/SuggestionCard.tsx src/features/lineup/components/__tests__/SuggestionCard.test.tsx
git commit -m "feat: add SuggestionCard component"
```

---

### Task 8: Create `SuggestionsBanner` component

**Files:**
- Create: `src/features/lineup/components/SuggestionsBanner.tsx`
- New test: `src/features/lineup/components/__tests__/SuggestionsBanner.test.tsx`

The banner is a collapsed plum bar above the timeline. Clicking it opens a floating overlay with a goal context bar and suggestion cards. Shown only when `isToday` is true.

- [ ] **Step 8.1: Write the failing tests**

Create `src/features/lineup/components/__tests__/SuggestionsBanner.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/features/lineup/lib/queries", () => ({
  useLineupSuggestions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  useCreateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTerritoryPlans: vi.fn(() => ({ data: [] })),
  useStates: vi.fn(() => ({ data: [] })),
  useUsers: vi.fn(() => ({ data: [] })),
  useProfile: vi.fn(() => ({ data: { id: "user-1" } })),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivity: vi.fn(() => ({ data: null, isLoading: false })),
  useLinkActivityDistricts: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useLineupSuggestions } from "@/features/lineup/lib/queries";
const mockUseSuggestions = vi.mocked(useLineupSuggestions);

import SuggestionsBanner from "../SuggestionsBanner";

const fakeSuggestions = [
  {
    activityType: "call",
    title: "Renewal Call — Jeffco",
    districtLeaid: null,
    districtName: "Jeffco SD",
    planId: null,
    planName: null,
    contractValue: 180000,
    lastContactDays: 21,
    renewalWeeks: 6,
    opportunityType: "renewal" as const,
    reasoning: "High value renewal.",
    goalTags: ["Renewal goal"],
    riskTags: ["At risk"],
  },
];

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("SuggestionsBanner", () => {
  const TODAY = "2026-03-14";

  it("renders nothing when not viewing today", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: null, isLoading: false, error: null, refetch: vi.fn() });
    const { container } = render(
      <SuggestionsBanner date="2026-03-13" activityCount={0} />,
      { wrapper: makeWrapper() }
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows shimmer/loading state while fetching", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: null, isLoading: true, error: null, refetch: vi.fn() });
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });
    expect(screen.getByTestId("suggestions-banner-loading")).toBeInTheDocument();
  });

  it("shows error message and retry button on fetch error", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: null, isLoading: false, error: new Error("fail"), refetch: vi.fn() });
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/couldn't load recommendations/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows collapsed banner with suggestion count", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() });
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/1 recommended action/i)).toBeInTheDocument();
  });

  it("shows busy-day text when activityCount >= 4", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() });
    render(<SuggestionsBanner date={TODAY} activityCount={4} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/pretty booked/i)).toBeInTheDocument();
  });

  it("opens overlay and shows suggestion cards on banner click", async () => {
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() });
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });

    await userEvent.click(screen.getByRole("button", { name: /recommended action/i }));

    await waitFor(() => {
      expect(screen.getByText(/renewal call — jeffco/i)).toBeInTheDocument();
    });
  });

  it("shows feedback confirmation after clicking 'Want AI-powered recommendations?'", async () => {
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() });
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });

    // Open the overlay
    await userEvent.click(screen.getByRole("button", { name: /recommended action/i }));

    // Click the feedback link
    await userEvent.click(screen.getByRole("button", { name: /want.*ai-powered/i }));

    await waitFor(() => {
      expect(screen.getByText(/thanks.*tracking interest/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 8.2: Run the tests to verify they fail**

```bash
npx vitest run src/features/lineup/components/__tests__/SuggestionsBanner.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 8.3: Create `src/features/lineup/components/SuggestionsBanner.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useLineupSuggestions, useSuggestionFeedback } from "@/features/lineup/lib/queries";
import SuggestionCard from "./SuggestionCard";

interface SuggestionsBannerProps {
  date: string;
  activityCount: number; // raw count of current user's activities today (for busy-day detection)
}

export default function SuggestionsBanner({ date, activityCount }: SuggestionsBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const { suggestions, isLoading, error, refetch } = useLineupSuggestions(date);
  const feedback = useSuggestionFeedback();

  // Only show when viewing today (hook returns null suggestions when date ≠ today)
  // isLoading is also false when date ≠ today
  if (!isLoading && suggestions === null && !error) return null;

  const isBusy = activityCount >= 4;
  const count = suggestions?.length ?? 0;

  const bannerLabel = isLoading
    ? "Loading recommendations..."
    : error
    ? "Couldn't load recommendations — try again later"
    : isBusy
    ? "Looks like your day is pretty booked — click here if you need more ideas."
    : `${count} Recommended ${count === 1 ? "Action" : "Actions"}`;

  return (
    <div className="mb-3">
      {/* Collapsed banner */}
      <button
        onClick={() => !error && setIsOpen((v) => !v)}
        className="w-full bg-[#403770] rounded-lg px-4 py-2.5 flex items-center justify-between text-left"
        aria-label={bannerLabel}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#F37167] text-base leading-none">✦</span>
          <div>
            {isLoading ? (
              <div data-testid="suggestions-banner-loading" className="flex flex-col gap-1">
                <div className="h-2.5 w-32 bg-white/20 rounded animate-pulse" />
                <div className="h-2 w-24 bg-white/10 rounded animate-pulse" />
              </div>
            ) : error ? (
              <div>
                <div className="text-white text-xs font-semibold">Couldn&apos;t load recommendations — try again later</div>
              </div>
            ) : (
              <div>
                <div className="text-white text-xs font-semibold">
                  {isBusy
                    ? "Looks like your day is pretty booked — click here if you need more ideas."
                    : `${count} Recommended ${count === 1 ? "Action" : "Actions"}`}
                </div>
                <div className="text-[#A69DC0] text-[10px] mt-0.5">Based on your FY{new Date().getFullYear()} goals</div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <button
              onClick={(e) => { e.stopPropagation(); refetch(); }}
              className="text-[#A69DC0] text-[10px] font-medium hover:text-white transition-colors"
              aria-label="Try again"
            >
              Try again
            </button>
          )}
          {!isLoading && !error && (
            <span className="text-[#A69DC0] text-[10px] font-medium">
              {isOpen ? "Hide ▲" : "Show ▼"}
            </span>
          )}
        </div>
      </button>

      {/* Floating overlay — shown when open and suggestions have loaded (even if empty) */}
      {isOpen && suggestions !== null && (
        <div className="mt-2 bg-white border border-[#D4CFE2] rounded-2xl shadow-xl overflow-hidden">
          <div className="p-3 flex flex-col gap-2">
            {suggestions.length === 0 ? (
              <p className="text-[#8A80A8] text-sm text-center py-4">
                Nothing urgent right now — check back tomorrow.
              </p>
            ) : (
              suggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} />
              ))
            )}

            {/* Feedback button — demand signal for AI-powered recommendations */}
            <div className="pt-2 border-t border-[#E2DEEC] mt-1 text-center">
              {feedbackSent ? (
                <span className="text-[#8A80A8] text-[10px]">Thanks! We&apos;re tracking interest.</span>
              ) : (
                <button
                  onClick={() => {
                    feedback.mutate(undefined, { onSuccess: () => setFeedbackSent(true) });
                  }}
                  disabled={feedback.isPending}
                  className="text-[#A69DC0] text-[10px] hover:text-[#403770] transition-colors disabled:opacity-50"
                  aria-label="Want AI-powered recommendations?"
                >
                  Want AI-powered recommendations? Let us know →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.4: Run the tests to verify they pass**

```bash
npx vitest run src/features/lineup/components/__tests__/SuggestionsBanner.test.tsx
```

Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/features/lineup/components/SuggestionsBanner.tsx src/features/lineup/components/__tests__/SuggestionsBanner.test.tsx
git commit -m "feat: add SuggestionsBanner component with loading, error, and empty states"
```

---

### Task 9: Wire `SuggestionsBanner` into `LineupView`

**Files:**
- Modify: `src/features/lineup/components/LineupView.tsx`

- [ ] **Step 9.1: Import `SuggestionsBanner`**

Add to the imports in `LineupView.tsx` (after the `ActivityFormModal` import on line 22):

```typescript
import SuggestionsBanner from "./SuggestionsBanner";
```

- [ ] **Step 9.2: Derive the current user's raw today activity count**

Add a separate `useActivities` call after the existing one (after line 222) to get the count of the current user's activities today, independent of any teammate filter applied in the UI:

```typescript
  // Independent fetch for the current user's own activity count today (used for busy-day detection in the banner).
  // Pinned to getToday() — NOT selectedDate — so it always reflects the real calendar day
  // regardless of which date the user has navigated to in the Lineup.
  const today = getToday();
  const { data: myTodayData } = useActivities(
    profile?.id
      ? {
          startDateFrom: today,
          startDateTo: today,
          assignedToUserIds: [profile.id],
        }
      : {}
  );
  const myTodayActivityCount = myTodayData?.activities.length ?? 0;
```

- [ ] **Step 9.3: Mount `SuggestionsBanner` above the activity timeline**

In the JSX, find the content area that starts the activity timeline. The activities section is rendered inside a `<div className="flex-1 overflow-y-auto ...">` block (around line 460). Insert `SuggestionsBanner` as the first child of that scrollable content div, before the empty-state or activity groups:

Find the scroll container that wraps the activities (the `<div className="flex-1 overflow-y-auto p-6">` or similar). Add `SuggestionsBanner` at the top:

```tsx
      {/* ── Suggestions banner (shown only when viewing today) ── */}
      <SuggestionsBanner
        date={selectedDate}
        activityCount={myTodayActivityCount}
      />
```

Place this immediately before the activity groups render block (before the `isLoading ? (` ternary or the groups rendering).

- [ ] **Step 9.4: Verify the app compiles and runs**

```bash
npm run dev
```

Open `http://localhost:3005`. Navigate to The Lineup tab. Viewing today should show the plum banner. Verify:
- Banner appears when viewing today
- Banner is absent when navigating to another day
- Clicking the banner expands the overlay with suggestion cards (or empty state if no active plans)
- Editing an activity shows plan and state pickers pre-populated

- [ ] **Step 9.5: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add src/features/lineup/components/LineupView.tsx
git commit -m "feat: wire SuggestionsBanner into LineupView above the activity timeline"
```

---

## Final Steps

- [ ] **Run the full test suite one last time**

```bash
npx vitest run
```

Expected: All tests pass, zero failures.

- [ ] **Create a PR**

```bash
gh pr create --title "feat: lineup edit gap fix + rules-based goal suggestions" \
  --body "## Changes

- **Edit gap fix**: Plans and states pickers now appear in activity edit mode, pre-populated from the full activity fetch. Updates are persisted on save.
- **Rules-based suggestions**: Plum banner above the timeline (today only) opens a floating overlay with up to 3 recommended actions generated by a priority-ordered rules engine (renewal gap → pipeline gap → long dormant → default). No AI API calls. Includes a feedback button to track demand for future AI-powered suggestions.

## Test plan
- [ ] Edit an existing activity — verify plan and state pickers appear and pre-populate correctly
- [ ] Save the edited activity — verify plan/state changes persist
- [ ] View The Lineup for today — verify banner appears
- [ ] Navigate to a past date — verify banner disappears
- [ ] Click banner — verify overlay with suggestion cards appears
- [ ] Click Schedule on a card — verify ActivityFormModal opens pre-filled
- [ ] Click 'Want AI-powered recommendations?' — verify confirmation text appears"
```
