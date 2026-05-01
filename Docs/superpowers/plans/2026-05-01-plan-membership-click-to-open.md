# Plan Membership Click-to-Open — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a plan row in the Plan Membership section closes the district card modal and opens PlanWorkspace for that plan.

**Architecture:** Two small changes in `DistrictExploreModal.tsx`: thread `onClose` into `FullmindTab` as a prop, and inside `FullmindTab` pull `viewPlan` from the Zustand store (`useMapV2Store`) then make each plan row a `button` that calls `onClose(); viewPlan(plan.id)`. No new files, no API changes.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Zustand (`useMapV2Store`)

---

### Task 1: Make plan membership rows clickable

**Files:**
- Modify: `src/features/map/components/SearchResults/DistrictExploreModal.tsx`
- Test: `src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx`

- [ ] **Step 1: Write the failing test**

  At the top of `DistrictExploreModal.test.tsx`, add two module-level spy variables and a store mock. Insert these **before** the existing `vi.mock("@/features/districts/lib/queries", ...)` line:

  ```tsx
  import { fireEvent } from "@testing-library/react";

  const mockViewPlan = vi.fn();
  const mockOnClose = vi.fn();

  vi.mock("@/features/map/lib/store", () => ({
    useMapV2Store: Object.assign(
      vi.fn((selector: (s: any) => any) =>
        selector({ exploreModalVacancyId: null, viewPlan: mockViewPlan })
      ),
      { getState: () => ({ exploreModalVacancyId: null }) }
    ),
  }));
  ```

  > `Object.assign` gives the mock both hook-selector behaviour (`useMapV2Store(s => s.viewPlan)`) and the static `.getState()` call already in the component at line 369.

  Update the existing top-level `beforeEach` to also reset the spies:
  ```tsx
  beforeEach(() => {
    vi.mocked(libApi.useTerritoryPlans).mockReturnValue({
      data: [
        {
          id: "plan-1",
          name: "Kleist Renewal",
          color: "#7C3AED",
          status: "working",
          owner: { id: "user-1", fullName: "Sierra Arcega", avatarUrl: null },
          description: null,
          fiscalYear: 2026,
        },
      ],
    } as any);
    mockViewPlan.mockReset();
    mockOnClose.mockReset();
  });
  ```

  Then add this describe block at the bottom of the file:

  ```tsx
  describe("DistrictExploreModal — plan membership navigation", () => {
    it("calls onClose and viewPlan with the plan id when a plan row is clicked", () => {
      const { container } = renderWithClient(
        <DistrictExploreModal leaid="1234567" onClose={mockOnClose} />
      );
      const planButton = container.querySelector("button[data-plan-id='plan-1']");
      expect(planButton).not.toBeNull();
      fireEvent.click(planButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockViewPlan).toHaveBeenCalledWith("plan-1");
    });
  });
  ```

  > The `data-plan-id` attribute is added in Step 3 to make the button selectable in tests.

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npm test -- DistrictExploreModal --run
  ```

  Expected: FAIL — `button[data-plan-id='plan-1']` not found.

- [ ] **Step 3: Add `onClose` prop to `FullmindTab` and make rows clickable**

  **3a — Thread `onClose` into the `FullmindTab` call site (line ~340):**

  Find:
  ```tsx
  <FullmindTab
    fullmindData={fullmindData ?? null}
    tags={tags}
    territoryPlanIds={territoryPlanIds}
    plans={plans || []}
    activities={activitiesData?.activities || []}
  />
  ```

  Replace with:
  ```tsx
  <FullmindTab
    fullmindData={fullmindData ?? null}
    tags={tags}
    territoryPlanIds={territoryPlanIds}
    plans={plans || []}
    activities={activitiesData?.activities || []}
    onClose={onClose}
  />
  ```

  **3b — Update `FullmindTab` props interface and add `viewPlan` (line ~456):**

  Find:
  ```tsx
  function FullmindTab({
    fullmindData,
    tags,
    territoryPlanIds,
    plans,
    activities,
  }: {
    fullmindData: FullmindData | null;
    tags: Tag[];
    territoryPlanIds: string[];
    plans: TerritoryPlan[];
    activities: ActivityListItem[];
  }) {
    const fmtMoney = (n: number) => (n > 0 ? `$${n.toLocaleString()}` : "—");
    const memberPlans = plans.filter((p) => territoryPlanIds.includes(p.id));
  ```

  Replace with:
  ```tsx
  function FullmindTab({
    fullmindData,
    tags,
    territoryPlanIds,
    plans,
    activities,
    onClose,
  }: {
    fullmindData: FullmindData | null;
    tags: Tag[];
    territoryPlanIds: string[];
    plans: TerritoryPlan[];
    activities: ActivityListItem[];
    onClose: () => void;
  }) {
    const viewPlan = useMapV2Store((s) => s.viewPlan);
    const fmtMoney = (n: number) => (n > 0 ? `$${n.toLocaleString()}` : "—");
    const memberPlans = plans.filter((p) => territoryPlanIds.includes(p.id));
  ```

  **3c — Change plan membership row `div` to `button` (line ~513):**

  Find:
  ```tsx
  {memberPlans.map((plan) => (
    <div key={plan.id} className="flex items-center gap-2.5 py-1.5 overflow-hidden">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
      <span className="text-sm font-medium text-[#544A78] whitespace-nowrap">{plan.name}</span>
      <span className="text-[11px] text-[#A69DC0] capitalize whitespace-nowrap">{plan.status}</span>
      {plan.owner?.fullName && (
        <span className="text-[11px] text-[#A69DC0] truncate min-w-0">· {plan.owner.fullName}</span>
      )}
    </div>
  ))}
  ```

  Replace with:
  ```tsx
  {memberPlans.map((plan) => (
    <button
      key={plan.id}
      data-plan-id={plan.id}
      onClick={() => { onClose(); viewPlan(plan.id); }}
      className="w-full text-left flex items-center gap-2.5 py-1.5 overflow-hidden cursor-pointer rounded hover:bg-[#F7F5FA] transition-colors"
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
      <span className="text-sm font-medium text-[#544A78] whitespace-nowrap">{plan.name}</span>
      <span className="text-[11px] text-[#A69DC0] capitalize whitespace-nowrap">{plan.status}</span>
      {plan.owner?.fullName && (
        <span className="text-[11px] text-[#A69DC0] truncate min-w-0">· {plan.owner.fullName}</span>
      )}
    </button>
  ))}
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npm test -- DistrictExploreModal --run
  ```

  Expected: All 5 tests PASS (2 responsive sizing + 2 plan membership owner + 1 plan membership navigation).

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/map/components/SearchResults/DistrictExploreModal.tsx
  git add src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx
  git commit -m "feat(district-card): clicking a plan in Plan Membership opens PlanWorkspace"
  ```

  Include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` in the commit message.
