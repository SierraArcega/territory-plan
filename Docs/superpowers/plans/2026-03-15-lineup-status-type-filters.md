# LineupView Status + Activity Type Filters — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Status and Activity Type multi-select filter dropdowns to the LineupView toolbar, filtering the existing `filteredActivities` useMemo client-side.

**Architecture:** Two inline dropdown components (trigger button + floating panel, click-outside close) added directly to `LineupView.tsx`, following the pattern used in `FilterBar.tsx`. Two new `useState` variables feed two new filter clauses in the existing `filteredActivities` useMemo. No new files or shared components.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-15-lineup-status-type-filters-design.md`

---

## Chunk 1: Filter Logic + Status Dropdown

### Task 1: Write failing tests for filter logic + status dropdown

**Files:**
- Create: `src/features/lineup/components/__tests__/LineupView.test.tsx`

The test file mocks all API hooks and exercises the `filteredActivities` logic through the component UI. `ActivityRow` renders `activity.title`, so querying by title text is the right approach.

- [ ] **Step 1: Create the test file with module mocks**

```tsx
// src/features/lineup/components/__tests__/LineupView.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock all API hooks LineupView depends on
vi.mock("@/lib/api", () => ({
  useProfile: vi.fn(() => ({ data: { id: "u1", fullName: "Alice", email: "alice@test.com" } })),
  useUsers: vi.fn(() => ({ data: [{ id: "u1", fullName: "Alice", email: "alice@test.com", avatarUrl: null }] })),
  useTerritoryPlans: vi.fn(() => ({ data: [] })),
  useActivities: vi.fn(() => ({ data: { activities: [], total: 0 }, isLoading: false })),
  useCreateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock("@/features/lineup/lib/queries", () => ({
  useLineupSuggestions: vi.fn(() => ({ data: null })),
  useSuggestionFeedback: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivity: vi.fn(() => ({ data: null, isLoading: false })),
  useLinkActivityDistricts: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useActivities } from "@/lib/api";
const mockUseActivities = vi.mocked(useActivities);

import LineupView from "../LineupView";

import { type ActivityType } from "@/features/activities/types";

// Minimal ActivityListItem factory — only sets the fields we care about
function makeActivity(overrides: {
  id: string;
  title: string;
  status: "planned" | "completed" | "cancelled";
  type: ActivityType;
}): Record<string, unknown> {
  return {
    id: overrides.id,
    title: overrides.title,
    status: overrides.status,
    type: overrides.type,
    category: "meetings",
    startDate: null,
    endDate: null,
    source: "manual",
    outcomeType: null,
    assignedToUserId: "u1",
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 0,
    districtCount: 0,
    stateAbbrevs: [],
  };
}

function renderLineup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LineupView />
    </QueryClientProvider>
  );
}

const ACTIVITIES = [
  makeActivity({ id: "a1", title: "Planned Demo", status: "planned", type: "demo" }),
  makeActivity({ id: "a2", title: "Completed Call", status: "completed", type: "phone_call" }),
  makeActivity({ id: "a3", title: "Cancelled Campaign", status: "cancelled", type: "email_campaign" }),
  makeActivity({ id: "a4", title: "Planned Call", status: "planned", type: "phone_call" }),
];

describe("LineupView — Status filter", () => {
  beforeEach(() => {
    mockUseActivities.mockReturnValue({
      data: { activities: ACTIVITIES as never, total: 4 },
      isLoading: false,
    } as ReturnType<typeof useActivities>);
  });

  it("shows all activities when no status filter is active", () => {
    renderLineup();
    expect(screen.getByText("Planned Demo")).toBeInTheDocument();
    expect(screen.getByText("Completed Call")).toBeInTheDocument();
    expect(screen.getByText("Cancelled Campaign")).toBeInTheDocument();
    expect(screen.getByText("Planned Call")).toBeInTheDocument();
  });

  it("shows the Status dropdown trigger labeled 'All Statuses'", () => {
    renderLineup();
    expect(screen.getByRole("button", { name: /all statuses/i })).toBeInTheDocument();
  });

  it("filters to only planned activities when 'Planned' is selected", async () => {
    const user = userEvent.setup();
    renderLineup();
    await user.click(screen.getByRole("button", { name: /all statuses/i }));
    await user.click(screen.getByRole("checkbox", { name: /planned/i }));
    expect(screen.getByText("Planned Demo")).toBeInTheDocument();
    expect(screen.getByText("Planned Call")).toBeInTheDocument();
    expect(screen.queryByText("Completed Call")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled Campaign")).not.toBeInTheDocument();
  });

  it("shows trigger label with count when 2 statuses selected", async () => {
    const user = userEvent.setup();
    renderLineup();
    await user.click(screen.getByRole("button", { name: /all statuses/i }));
    await user.click(screen.getByRole("checkbox", { name: /planned/i }));
    await user.click(screen.getByRole("checkbox", { name: /completed/i }));
    expect(screen.getByRole("button", { name: /2 statuses/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:\Users\aston\OneDrive\Desktop\The Laboratory\territory-plan"
npx vitest run src/features/lineup/components/__tests__/LineupView.test.tsx
```

Expected: FAIL — "All Statuses" button not found, filter tests fail

---

### Task 2: Add new imports, state, and useMemo filter clauses

**Files:**
- Modify: `src/features/lineup/components/LineupView.tsx`

- [ ] **Step 1: Expand the activities/types import**

Find this line near the top of `LineupView.tsx`:
```ts
import {
  CATEGORY_LABELS,
  type ActivityCategory,
} from "@/features/activities/types";
```

Replace with:
```ts
import {
  CATEGORY_LABELS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUS_CONFIG,
  ACTIVITY_TYPE_LABELS,
  ALL_ACTIVITY_TYPES,
  VALID_ACTIVITY_STATUSES,
  type ActivityCategory,
  type ActivityStatus,
  type ActivityType,
} from "@/features/activities/types";
```

- [ ] **Step 2: Add the two new state variables**

After this block (~line 211):
```ts
  // State filter built from the returned activities' stateAbbrevs
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
```

Add:
```ts
  // Status and activity type filters (static enum options, client-side)
  const [selectedStatuses, setSelectedStatuses] = useState<ActivityStatus[]>([]);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<ActivityType[]>([]);

  // Status dropdown open/close state and ref
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add click-outside handler for the status dropdown**

After the existing click-outside useEffect for `userPickerRef` (~line 194), add:
```ts
  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusDropdownOpen]);
```

- [ ] **Step 4: Add filter clauses to filteredActivities useMemo**

Find the existing `filteredActivities` useMemo:
```ts
  const filteredActivities = useMemo(() => {
    let result = allActivities;
    // Plan filter: show only activities that have at least one plan (can't match specific plan IDs
    // without plan IDs on ActivityListItem — filter by presence for now)
    if (selectedPlanIds.length > 0) {
      result = result.filter((a) => a.planCount > 0);
    }
    // State filter: show activities that include any of the selected states
    if (selectedStates.length > 0) {
      result = result.filter((a) =>
        a.stateAbbrevs.some((s) => selectedStates.includes(s))
      );
    }
    return result;
  }, [allActivities, selectedPlanIds, selectedStates]);
```

Replace with:
```ts
  const filteredActivities = useMemo(() => {
    let result = allActivities;
    // Plan filter: show only activities that have at least one plan (can't match specific plan IDs
    // without plan IDs on ActivityListItem — filter by presence for now)
    if (selectedPlanIds.length > 0) {
      result = result.filter((a) => a.planCount > 0);
    }
    // State filter: show activities that include any of the selected states
    if (selectedStates.length > 0) {
      result = result.filter((a) =>
        a.stateAbbrevs.some((s) => selectedStates.includes(s))
      );
    }
    // Status filter: show only activities matching selected statuses
    if (selectedStatuses.length > 0) {
      result = result.filter((a) => selectedStatuses.includes(a.status));
    }
    // Type filter: show only activities matching selected activity types
    if (selectedActivityTypes.length > 0) {
      result = result.filter((a) => selectedActivityTypes.includes(a.type));
    }
    return result;
  }, [allActivities, selectedPlanIds, selectedStates, selectedStatuses, selectedActivityTypes]);
```

- [ ] **Step 5: Run the filter logic tests — they should now pass**

```bash
npx vitest run src/features/lineup/components/__tests__/LineupView.test.tsx
```

Expected: PASS for "shows all activities" and "filters to only planned activities"

---

### Task 3: Add the Status dropdown JSX

**Files:**
- Modify: `src/features/lineup/components/LineupView.tsx`

- [ ] **Step 1: Add the Status dropdown after the State chips section**

In the toolbar JSX, find the State chips block that ends with:
```tsx
        )}

        {/* Clear filters button */}
        {(selectedPlanIds.length > 0 || selectedStates.length > 0) && (
```

Insert the Status dropdown between those two blocks:
```tsx
        {/* Status filter dropdown */}
        <div className="relative" ref={statusDropdownRef}>
          <button
            type="button"
            onClick={() => setStatusDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              selectedStatuses.length > 0
                ? "border-[#403770] text-[#403770] bg-[#403770]/5"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {selectedStatuses.length === 0
              ? "All Statuses"
              : selectedStatuses.length === 1
              ? ACTIVITY_STATUS_CONFIG[selectedStatuses[0]].label
              : `${selectedStatuses.length} statuses`}
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {statusDropdownOpen && (
            <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px] py-1">
              {VALID_ACTIVITY_STATUSES.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s)}
                    onChange={() =>
                      setSelectedStatuses((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      )
                    }
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30"
                  />
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ACTIVITY_STATUS_CONFIG[s].color }}
                  />
                  <span className="text-sm text-gray-700">{ACTIVITY_STATUS_CONFIG[s].label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
```

- [ ] **Step 2: Run all status dropdown tests**

```bash
npx vitest run src/features/lineup/components/__tests__/LineupView.test.tsx
```

Expected: all Status filter tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/lineup/components/LineupView.tsx \
        src/features/lineup/components/__tests__/LineupView.test.tsx
git commit -m "feat: add status filter dropdown to LineupView

- Two new state vars: selectedStatuses, selectedActivityTypes
- Two new useMemo filter clauses (AND logic)
- Status dropdown UI with colored dots + click-outside close
- Tests: all activities visible, status filter, label with count"
```

---

## Chunk 2: Activity Type Dropdown + Clear Filters + Docs

### Task 4: Write failing tests for Activity Type dropdown

**Files:**
- Modify: `src/features/lineup/components/__tests__/LineupView.test.tsx`

- [ ] **Step 1: Add Activity Type and combined filter tests**

Append to the test file after the Status filter describe block:
```tsx
describe("LineupView — Activity Type filter", () => {
  beforeEach(() => {
    mockUseActivities.mockReturnValue({
      data: { activities: ACTIVITIES as never, total: 4 },
      isLoading: false,
    } as ReturnType<typeof useActivities>);
  });

  it("shows the Activity Type dropdown trigger labeled 'All Types'", () => {
    renderLineup();
    expect(screen.getByRole("button", { name: /all types/i })).toBeInTheDocument();
  });

  it("filters to only phone calls when 'Phone Call' is selected", async () => {
    const user = userEvent.setup();
    renderLineup();
    await user.click(screen.getByRole("button", { name: /all types/i }));
    await user.click(screen.getByRole("checkbox", { name: /phone call/i }));
    expect(screen.getByText("Completed Call")).toBeInTheDocument();
    expect(screen.getByText("Planned Call")).toBeInTheDocument();
    expect(screen.queryByText("Planned Demo")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled Campaign")).not.toBeInTheDocument();
  });

  it("shows category section headers in the dropdown", async () => {
    const user = userEvent.setup();
    renderLineup();
    await user.click(screen.getByRole("button", { name: /all types/i }));
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Outreach")).toBeInTheDocument();
    expect(screen.getByText("Meetings")).toBeInTheDocument();
  });

  it("shows trigger label with count when 2 types selected", async () => {
    const user = userEvent.setup();
    renderLineup();
    await user.click(screen.getByRole("button", { name: /all types/i }));
    await user.click(screen.getByRole("checkbox", { name: /phone call/i }));
    await user.click(screen.getByRole("checkbox", { name: /demo/i }));
    expect(screen.getByRole("button", { name: /2 types/i })).toBeInTheDocument();
  });
});

describe("LineupView — combined Status + Type filters", () => {
  beforeEach(() => {
    mockUseActivities.mockReturnValue({
      data: { activities: ACTIVITIES as never, total: 4 },
      isLoading: false,
    } as ReturnType<typeof useActivities>);
  });

  it("ANDs status and type filters — only planned phone calls remain", async () => {
    const user = userEvent.setup();
    renderLineup();
    // Select "Planned" status
    await user.click(screen.getByRole("button", { name: /all statuses/i }));
    await user.click(screen.getByRole("checkbox", { name: /planned/i }));
    // Click the type trigger — clicking outside statusDropdownRef closes it, opens type dropdown
    await user.click(screen.getByRole("button", { name: /all types/i }));
    await user.click(screen.getByRole("checkbox", { name: /phone call/i }));
    // Only "Planned Call" matches both filters
    expect(screen.getByText("Planned Call")).toBeInTheDocument();
    expect(screen.queryByText("Planned Demo")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed Call")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled Campaign")).not.toBeInTheDocument();
  });
});

describe("LineupView — Clear filters", () => {
  beforeEach(() => {
    mockUseActivities.mockReturnValue({
      data: { activities: ACTIVITIES as never, total: 4 },
      isLoading: false,
    } as ReturnType<typeof useActivities>);
  });

  it("shows 'Clear filters' when status filter is active", async () => {
    const user = userEvent.setup();
    renderLineup();
    await user.click(screen.getByRole("button", { name: /all statuses/i }));
    await user.click(screen.getByRole("checkbox", { name: /planned/i }));
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("shows 'Clear filters' when type filter is active", async () => {
    const user = userEvent.setup();
    renderLineup();
    await user.click(screen.getByRole("button", { name: /all types/i }));
    await user.click(screen.getByRole("checkbox", { name: /phone call/i }));
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("Clear filters restores all activities and resets both new filters", async () => {
    const user = userEvent.setup();
    renderLineup();
    // Apply status filter
    await user.click(screen.getByRole("button", { name: /all statuses/i }));
    await user.click(screen.getByRole("checkbox", { name: /planned/i }));
    // Clear
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    // All activities visible again
    expect(screen.getByText("Planned Demo")).toBeInTheDocument();
    expect(screen.getByText("Completed Call")).toBeInTheDocument();
    expect(screen.getByText("Cancelled Campaign")).toBeInTheDocument();
    expect(screen.getByText("Planned Call")).toBeInTheDocument();
    // Status trigger reset
    expect(screen.getByRole("button", { name: /all statuses/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npx vitest run src/features/lineup/components/__tests__/LineupView.test.tsx
```

Expected: New Activity Type and combined/clear tests FAIL; previous Status tests still PASS

---

### Task 5: Add the Activity Type dropdown JSX

**Files:**
- Modify: `src/features/lineup/components/LineupView.tsx`

- [ ] **Step 1: Add type dropdown state, ref, and click-outside handler**

After the status dropdown `useState` and `useRef` (added in Task 2), add:
```ts
  // Activity Type dropdown open/close state and ref
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
```

After the status click-outside useEffect (added in Task 2), add:
```ts
  // Close type dropdown on outside click
  useEffect(() => {
    if (!typeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [typeDropdownOpen]);
```

- [ ] **Step 2: Add Activity Type dropdown JSX after the Status dropdown**

Immediately after the closing `</div>` of the Status dropdown and before the "Clear filters" comment, insert:
```tsx
        {/* Activity Type filter dropdown */}
        <div className="relative" ref={typeDropdownRef}>
          <button
            type="button"
            onClick={() => setTypeDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              selectedActivityTypes.length > 0
                ? "border-[#403770] text-[#403770] bg-[#403770]/5"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {selectedActivityTypes.length === 0
              ? "All Types"
              : selectedActivityTypes.length === 1
              ? ACTIVITY_TYPE_LABELS[selectedActivityTypes[0]]
              : `${selectedActivityTypes.length} types`}
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {typeDropdownOpen && (
            <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px] py-1">
              {(Object.entries(ACTIVITY_CATEGORIES) as [ActivityCategory, readonly ActivityType[]][]).map(
                ([cat, types]) => (
                  <div key={cat}>
                    <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    {types.map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedActivityTypes.includes(t)}
                          onChange={() =>
                            setSelectedActivityTypes((prev) =>
                              prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                            )
                          }
                          className="w-3.5 h-3.5 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30"
                        />
                        <span className="text-sm text-gray-700">{ACTIVITY_TYPE_LABELS[t]}</span>
                      </label>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
```

---

### Task 6: Update the "Clear filters" condition and handler

**Files:**
- Modify: `src/features/lineup/components/LineupView.tsx`

- [ ] **Step 1: Expand the Clear filters condition and onClick**

Find:
```tsx
        {/* Clear filters button */}
        {(selectedPlanIds.length > 0 || selectedStates.length > 0) && (
          <button
            onClick={() => { setSelectedPlanIds([]); setSelectedStates([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
          >
            Clear filters
          </button>
        )}
```

Replace with:
```tsx
        {/* Clear filters button */}
        {(selectedPlanIds.length > 0 || selectedStates.length > 0
          || selectedStatuses.length > 0 || selectedActivityTypes.length > 0) && (
          <button
            onClick={() => {
              setSelectedPlanIds([]);
              setSelectedStates([]);
              setSelectedStatuses([]);
              setSelectedActivityTypes([]);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
          >
            Clear filters
          </button>
        )}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run src/features/lineup/components/__tests__/LineupView.test.tsx
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/lineup/components/LineupView.tsx \
        src/features/lineup/components/__tests__/LineupView.test.tsx
git commit -m "feat: add activity type filter dropdown + clear filters update

- Activity Type dropdown with category section headers
- Clear filters expanded to reset all four filter states
- Tests: type filter, category headers, count label, combined AND, clear"
```

---

### Task 7: Update select.md with Do/Don't note

**Files:**
- Modify: `Documentation/UI Framework/Components/Forms/select.md`

- [ ] **Step 1: Read the current end of select.md to find the right insertion point**

Read `Documentation/UI Framework/Components/Forms/select.md` and locate the end of the document or any existing Do/Don't section.

- [ ] **Step 2: Append the Do/Don't note**

Add to the end of the file (or in the existing Do/Don't section if one exists):

```markdown
## Filter Dropdowns

When using multi-select dropdowns as toolbar filters (e.g. Status, Activity Type in LineupView):

**Do:**
- Use static option lists when filtering enum fields (`VALID_ACTIVITY_STATUSES`, `ALL_ACTIVITY_TYPES`) — no need to derive from current results
- Show "All X" as the empty-state trigger label (e.g. "All Statuses", "All Types")
- Show a count label ("N statuses") when 2+ options are selected
- AND multiple active filters together
- Include both new filters in the "Clear filters" condition and reset handler

**Don't:**
- Derive filter options dynamically from the current result set for enum fields — the full option list should always be visible regardless of what's on screen
- Use chip-style buttons for large option sets (11+ items) — use a dropdown instead
```

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/select.md"
git commit -m "docs: add filter dropdown Do/Don't note to select.md"
```

---

### Task 8: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS, no regressions

- [ ] **Step 2: If any tests fail, read the error output carefully and fix before proceeding**
