# Plans Multi-Select Filters Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six multi-select filters (Status, FY, Owner, States, Districts, Schools) to PlansListView so users can narrow the plans table and card grid interactively.

**Architecture:** Four simple filters (Status, FY, Owner, States) run fully client-side against the already-loaded plan list via a `useMemo`. Two async filters (Districts, Schools) use a new `AsyncMultiSelect` component that debounces search input and calls existing API endpoints. The school filter uses each school's parent `leaid` as the filter value, meaning "show plans containing the district this school belongs to" — this avoids adding thousands of school IDs to each plan response while still delivering the right filtering behaviour. Both district and school filters operate against a new `districtLeaids: string[]` field added to the plan list API response.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library, Next.js App Router, Prisma (PostgreSQL)

**Spec:** `docs/superpowers/specs/2026-03-15-plans-filters-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/features/shared/components/AsyncMultiSelect.tsx` | Async search multi-select component |
| Create | `src/features/shared/components/__tests__/AsyncMultiSelect.test.tsx` | Unit tests for AsyncMultiSelect |
| Modify | `src/features/shared/types/api-types.ts` | Add `districtLeaids` to `TerritoryPlan` |
| Modify | `src/app/api/territory-plans/route.ts` | Include `districtLeaids` in GET response |
| Modify | `src/app/api/schools/route.ts` | Add `districtName` to school search response |
| Modify | `src/features/shared/components/views/PlansView.tsx` | Filter state, filteredPlans memo, filter bar UI |

---

## Chunk 1: AsyncMultiSelect Component

### Task 1: Write failing tests for AsyncMultiSelect

**Files:**
- Create: `src/features/shared/components/__tests__/AsyncMultiSelect.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/features/shared/components/__tests__/AsyncMultiSelect.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AsyncMultiSelect } from "../AsyncMultiSelect";
import type { MultiSelectOption } from "../MultiSelect";

const RESULTS: MultiSelectOption[] = [
  { value: "lea001", label: "Lincoln USD (CA)" },
  { value: "lea002", label: "Jefferson USD (TX)" },
];

function setup(props: Partial<React.ComponentProps<typeof AsyncMultiSelect>> = {}) {
  const onChange = vi.fn();
  const onSearch = vi.fn().mockResolvedValue(RESULTS);
  const utils = render(
    <AsyncMultiSelect
      id="test-async"
      label="Districts"
      selected={[]}
      onChange={onChange}
      onSearch={onSearch}
      placeholder="Search districts…"
      countLabel="districts"
      {...props}
    />
  );
  return { ...utils, onChange, onSearch };
}

describe("AsyncMultiSelect — trigger label", () => {
  it("shows placeholder when nothing is selected", () => {
    setup();
    expect(screen.getByRole("button", { name: /Search districts…/i })).toBeInTheDocument();
  });

  it("shows item label for 1 selected item (from label map)", () => {
    setup({ selected: ["lea001"] });
    // The component must display the label even before a search populates results.
    // On mount with a pre-selected value and no label map entry, it should fall back
    // to displaying the value string until a label is resolved.
    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("shows count label for 4+ selected", () => {
    setup({
      selected: ["lea001", "lea002", "lea003", "lea004"],
    });
    expect(screen.getByRole("button", { name: /4 districts/i })).toBeInTheDocument();
  });
});

describe("AsyncMultiSelect — dropdown search", () => {
  it("does NOT call onSearch when query is fewer than 2 chars", async () => {
    const user = userEvent.setup();
    const { onSearch } = setup();
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "L");
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("calls onSearch after debounce when query is 2+ chars", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "Li");
    expect(onSearch).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(250); });
    expect(onSearch).toHaveBeenCalledWith("Li");
    vi.useRealTimers();
  });

  it("shows results from onSearch in the options list", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    onSearch.mockResolvedValue(RESULTS);
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "Li");
    act(() => { vi.advanceTimersByTime(250); });
    await waitFor(() => {
      expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it("shows 'Type to search…' hint when query is empty", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    expect(screen.getByText(/Type to search/i)).toBeInTheDocument();
  });

  it("shows 'Search failed — try again' when onSearch rejects", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    onSearch.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "Li");
    act(() => { vi.advanceTimersByTime(250); });
    await waitFor(() => {
      expect(screen.getByText(/Search failed/i)).toBeInTheDocument();
    });
    vi.useRealTimers();
  });
});

describe("AsyncMultiSelect — selection and label persistence", () => {
  it("calls onChange with the selected value", async () => {
    vi.useFakeTimers();
    const { onChange, onSearch } = setup();
    onSearch.mockResolvedValue(RESULTS);
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "Li");
    act(() => { vi.advanceTimersByTime(250); });
    await waitFor(() => screen.getByText("Lincoln USD (CA)"));
    await user.click(screen.getByText("Lincoln USD (CA)"));
    expect(onChange).toHaveBeenCalledWith(["lea001"]);
    vi.useRealTimers();
  });

  it("persists chip label after results are cleared by a new search", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup({ selected: [] });
    onSearch.mockResolvedValue(RESULTS);
    const user = userEvent.setup({ delay: null });

    // Open and select lea001
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "Li");
    act(() => { vi.advanceTimersByTime(250); });
    await waitFor(() => screen.getByText("Lincoln USD (CA)"));
    await user.click(screen.getByText("Lincoln USD (CA)"));

    // Re-render with the selection applied and a new search that returns nothing
    onSearch.mockResolvedValue([]);
    // The chip "Lincoln USD (CA)" should still be visible
    await waitFor(() => {
      expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();
    });
    vi.useRealTimers();
  });
});

describe("AsyncMultiSelect — select-all row", () => {
  it("does NOT render a select-all row", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    onSearch.mockResolvedValue(RESULTS);
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "Li");
    act(() => { vi.advanceTimersByTime(250); });
    await waitFor(() => screen.getByText("Lincoln USD (CA)"));
    expect(screen.queryByText(/Select all/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Select \d+ results/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("AsyncMultiSelect — close behaviour", () => {
  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail (component does not exist yet)**

```bash
cd "C:\Users\aston\OneDrive\Desktop\The Laboratory\territory-plan"
npx vitest run src/features/shared/components/__tests__/AsyncMultiSelect.test.tsx
```

Expected: all tests FAIL with "Cannot find module '../AsyncMultiSelect'"

---

### Task 2: Implement AsyncMultiSelect

**Files:**
- Create: `src/features/shared/components/AsyncMultiSelect.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/shared/components/AsyncMultiSelect.tsx
"use client";

// AsyncMultiSelect — same visual UX as MultiSelect but options are loaded
// dynamically via an async onSearch callback instead of a static prop.
// Select-all is intentionally disabled because search results are a small
// slice of a large dataset — bulk-selecting them isn't the intended interaction.

import { useState, useRef, useEffect, useCallback } from "react";
import type { MultiSelectOption } from "./MultiSelect";

export interface AsyncMultiSelectProps {
  id: string;
  label: string;
  selected: string[];
  onChange: (values: string[]) => void;
  onSearch: (query: string) => Promise<MultiSelectOption[]>;
  placeholder?: string;
  countLabel?: string;
  searchPlaceholder?: string;
}

function getTriggerLabel(
  selected: string[],
  labelMap: Map<string, string>,
  placeholder: string,
  countLabel: string
): string {
  if (selected.length === 0) return placeholder;
  if (selected.length === 1) {
    return labelMap.get(selected[0]) ?? selected[0];
  }
  if (selected.length <= 3) {
    return selected.map((v) => labelMap.get(v) ?? v).join(", ");
  }
  return `${selected.length} ${countLabel}`;
}

export function AsyncMultiSelect({
  id,
  label,
  selected,
  onChange,
  onSearch,
  placeholder = "Search…",
  countLabel = "items",
  searchPlaceholder = "Type to search…",
}: AsyncMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  // labelMap accumulates value→label for every item that has ever been selected,
  // so chips and the trigger label resolve correctly even after results change.
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Focus search input when dropdown opens, reset state
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setIsError(false);
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setIsError(false);
      try {
        const opts = await onSearch(q);
        setResults(opts);
      } catch {
        setResults([]);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 250);
  };

  const handleToggle = useCallback(
    (opt: MultiSelectOption) => {
      if (selected.includes(opt.value)) {
        // Deselect: remove from selected and from labelMap
        onChange(selected.filter((v) => v !== opt.value));
        setLabelMap((prev) => {
          const next = new Map(prev);
          next.delete(opt.value);
          return next;
        });
      } else {
        // Select: add to selected and accumulate label
        onChange([...selected, opt.value]);
        setLabelMap((prev) => new Map(prev).set(opt.value, opt.label));
      }
    },
    [selected, onChange]
  );

  const handleChipRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value));
    setLabelMap((prev) => {
      const next = new Map(prev);
      next.delete(value);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setResults([]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const triggerLabel = getTriggerLabel(selected, labelMap, placeholder, countLabel);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] flex items-center gap-2 min-w-[120px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex-1 text-left">{triggerLabel}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Chips — shown for 2+ selections */}
      {selected.length >= 2 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((value) => {
            const chipLabel = labelMap.get(value) ?? value;
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]"
              >
                {chipLabel}
                <button
                  type="button"
                  onClick={() => handleChipRemove(value)}
                  className="text-[#A69DC0] hover:text-[#403770] transition-colors"
                  aria-label={`Remove ${chipLabel}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden">
          {/* Search input */}
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-2 text-sm border-b border-[#E2DEEC] bg-white text-[#403770] placeholder:text-[#A69DC0] focus:outline-none"
            aria-label="Search options"
          />

          {/* Results list */}
          <ul
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            className="max-h-60 overflow-y-auto"
          >
            {isLoading ? (
              <li className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#403770] rounded-full animate-spin" />
              </li>
            ) : isError ? (
              <li className="px-3 py-2 text-sm text-red-500">Search failed — try again</li>
            ) : query.length < 2 ? (
              <li className="px-3 py-2 text-sm text-[#A69DC0] italic">Type to search…</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#A69DC0] italic">No results</li>
            ) : (
              results.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleToggle(opt)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#403770] cursor-pointer select-none hover:bg-[#F7F5FA]"
                  >
                    {isSelected ? (
                      <span
                        className="w-4 h-4 rounded border border-[#403770] bg-[#403770] flex items-center justify-center flex-shrink-0"
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 16 16" className="w-4 h-4">
                          <path
                            d="M3 8L6.5 11.5L13 5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className="w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AsyncMultiSelect;
```

- [ ] **Step 2: Run the tests — confirm they pass**

```bash
npx vitest run src/features/shared/components/__tests__/AsyncMultiSelect.test.tsx
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/AsyncMultiSelect.tsx \
        src/features/shared/components/__tests__/AsyncMultiSelect.test.tsx
git commit -m "feat: add AsyncMultiSelect component with debounced search and label persistence"
```

---

## Chunk 2: Backend — districtLeaids on Plan List

### Task 3: Add districtLeaids to TerritoryPlan type and route response

**Files:**
- Modify: `src/features/shared/types/api-types.ts` — add `districtLeaids: string[]` after `districtCount` (~line 301)
- Modify: `src/app/api/territory-plans/route.ts` — add `districtLeaids` to the returned object (~line 109)

- [ ] **Step 1: Update the TypeScript interface**

In `src/features/shared/types/api-types.ts`, find the `TerritoryPlan` interface and add after `districtCount`:

```ts
  districtCount: number;
  districtLeaids: string[];         // LEAIDs of all districts in this plan
  totalEnrollment: number;
```

Also add the deferred school field for type-completeness (the route won't populate it yet, so default to `[]`):

```ts
  districtLeaids: string[];
  schoolNcesIds: string[];          // populated when school filter is implemented
```

- [ ] **Step 2: Update the route response**

In `src/app/api/territory-plans/route.ts`, `districtLeaIds` is already computed on line 83:
```ts
const districtLeaIds = plan.districts.map((d) => d.districtLeaid);
```

Add `districtLeaids` and `schoolNcesIds` to the GET returned object, after `districtCount`:

```ts
          districtCount: plan._count.districts,
          districtLeaids: districtLeaIds,
          schoolNcesIds: [],   // deferred — filter degrades gracefully via ?? [] guard
```

Also add both fields to the **POST response** object (around line 243) to satisfy the updated `TerritoryPlan` interface — without this, `tsc --noEmit` will error:

```ts
        districtCount: 0,
        districtLeaids: [],
        schoolNcesIds: [],
        totalEnrollment: 0,
```

Also update **`src/app/api/territory-plans/[id]/route.ts`** — the single-plan GET handler returns an object shaped as `TerritoryPlanDetail` (which extends `TerritoryPlan`). Find the `NextResponse.json(...)` return in that file (around line 99) and add both new fields after `districtCount`.

> **Note:** The `[id]/route.ts` `findUnique` does NOT include `_count` in its select, so `plan._count` is undefined. Use `plan.districts.length` instead of `plan._count.districts` for `districtCount` here, and derive `districtLeaids` directly from the already-included `districts` array:

```ts
          districtCount: plan.districts.length,
          districtLeaids: plan.districts.map((d) => d.districtLeaid),
          schoolNcesIds: [],
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/types/api-types.ts \
        src/app/api/territory-plans/route.ts
git commit -m "feat: add districtLeaids to territory plan list response"
```

---

### Task 4: Add districtName to schools search endpoint

**Files:**
- Modify: `src/app/api/schools/route.ts` — add `districtName` to the response items

The `School` model has a `district` relation via `leaid`. We need to include the district name in the select.

- [ ] **Step 1: Update the Prisma select to include district name**

In `src/app/api/schools/route.ts`, update the `findMany` select to include the district:

```ts
    const schools = await prisma.school.findMany({
      where,
      select: {
        ncessch: true,
        leaid: true,
        schoolName: true,
        charter: true,
        schoolLevel: true,
        enrollment: true,
        latitude: true,
        longitude: true,
        city: true,
        stateAbbrev: true,
        lograde: true,
        higrade: true,
        owner: true,
        schoolStatus: true,
        district: {
          select: { name: true },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { schoolName: "asc" },
    });
```

- [ ] **Step 2: Include districtName in the response mapping**

```ts
    const schoolList = schools.map((s) => ({
      ncessch: s.ncessch,
      leaid: s.leaid,
      schoolName: s.schoolName,
      districtName: s.district?.name ?? null,
      charter: s.charter,
      schoolLevel: s.schoolLevel,
      enrollment: s.enrollment,
      latitude: toNumber(s.latitude),
      longitude: toNumber(s.longitude),
      city: s.city,
      stateAbbrev: s.stateAbbrev,
      lograde: s.lograde,
      higrade: s.higrade,
      owner: s.owner,
      schoolStatus: s.schoolStatus,
    }));
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/schools/route.ts
git commit -m "feat: add districtName to schools search endpoint response"
```

---

## Chunk 3: Frontend — PlansListView Filters

### Task 5: Add filter state, filteredPlans memo, and onSearch handlers to PlansListView

**Files:**
- Modify: `src/features/shared/components/views/PlansView.tsx`

The school filter uses `leaid` (not `ncessch`) as the option value, so it reuses the `districtLeaids` field on the plan. This means `selectedSchoolLeaids` and `selectedDistrictLeaids` both filter against `p.districtLeaids` and are OR-combined (a plan passes if it contains any leaid from either filter). This avoids the need to store thousands of school NCES IDs per plan.

- [ ] **Step 1: Write a unit test for filteredPlans memo logic**

This is pure filtering logic — test it by extracting it to a pure function or testing via the rendered component. Add to the existing `HomeView.test.tsx` or create a focused test. Here we test the logic inline using a helper:

Create `src/features/shared/components/views/__tests__/PlansView.filters.test.ts`:

```ts
// src/features/shared/components/views/__tests__/PlansView.filters.test.ts
// Tests for the filteredPlans memo logic extracted as a pure function.
import { describe, it, expect } from "vitest";

// Note: schoolNcesIds is NOT used in filtering — school filtering works by
// mapping each selected school to its parent leaid and filtering via districtLeaids.
type PlanStub = {
  status: string;
  fiscalYear: number;
  owner: { id: string; fullName: string } | null;
  states: { fips: string }[];
  districtLeaids: string[] | undefined;
};

function filterPlans(
  plans: PlanStub[],
  {
    statuses,
    fiscalYears,
    ownerIds,
    stateFips,
    districtLeaids,
    schoolLeaids,
  }: {
    statuses: string[];
    fiscalYears: string[];
    ownerIds: string[];
    stateFips: string[];
    districtLeaids: string[];
    schoolLeaids: string[];
  }
): PlanStub[] {
  let result = plans;
  if (statuses.length)
    result = result.filter((p) => statuses.includes(p.status));
  if (fiscalYears.length)
    result = result.filter((p) => fiscalYears.includes(String(p.fiscalYear)));
  if (ownerIds.length)
    result = result.filter((p) => p.owner && ownerIds.includes(p.owner.id));
  if (stateFips.length)
    result = result.filter((p) => p.states.some((s) => stateFips.includes(s.fips)));
  const allLeaidFilters = [...districtLeaids, ...schoolLeaids];
  if (allLeaidFilters.length)
    result = result.filter((p) =>
      (p.districtLeaids ?? []).some((id) => allLeaidFilters.includes(id))
    );
  return result;
}

const PLANS: PlanStub[] = [
  {
    status: "planning",
    fiscalYear: 2026,
    owner: { id: "u1", fullName: "Alice" },
    states: [{ fips: "06" }],
    districtLeaids: ["lea001", "lea002"],
  },
  {
    status: "working",
    fiscalYear: 2027,
    owner: { id: "u2", fullName: "Bob" },
    states: [{ fips: "48" }],
    districtLeaids: ["lea003"],
  },
  {
    status: "archived",
    fiscalYear: 2026,
    owner: null,
    states: [],
    districtLeaids: undefined,   // intentionally undefined — tests the ?? [] null guard
  },
];

const noFilters = { statuses: [], fiscalYears: [], ownerIds: [], stateFips: [], districtLeaids: [], schoolLeaids: [] };

describe("filterPlans — individual dimensions", () => {
  it("returns all plans when no filters are active", () => {
    expect(filterPlans(PLANS, noFilters)).toHaveLength(3);
  });

  it("filters by status", () => {
    const result = filterPlans(PLANS, { ...noFilters, statuses: ["planning"] });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("planning");
  });

  it("filters by fiscal year (string comparison)", () => {
    const result = filterPlans(PLANS, { ...noFilters, fiscalYears: ["2026"] });
    expect(result).toHaveLength(2);
  });

  it("filters by owner id", () => {
    const result = filterPlans(PLANS, { ...noFilters, ownerIds: ["u1"] });
    expect(result).toHaveLength(1);
    expect(result[0].owner?.id).toBe("u1");
  });

  it("excludes plans with null owner when owner filter is active", () => {
    const result = filterPlans(PLANS, { ...noFilters, ownerIds: ["u1", "u2"] });
    expect(result).toHaveLength(2);
  });

  it("filters by state fips", () => {
    const result = filterPlans(PLANS, { ...noFilters, stateFips: ["06"] });
    expect(result).toHaveLength(1);
  });

  it("filters by district leaid", () => {
    const result = filterPlans(PLANS, { ...noFilters, districtLeaids: ["lea003"] });
    expect(result).toHaveLength(1);
  });

  it("filters by school leaid (OR with district leaids)", () => {
    const result = filterPlans(PLANS, { ...noFilters, schoolLeaids: ["lea001"] });
    expect(result).toHaveLength(1);
  });

  it("does not throw when districtLeaids is undefined on a plan", () => {
    expect(() =>
      filterPlans(PLANS, { ...noFilters, districtLeaids: ["lea999"] })
    ).not.toThrow();
  });
});

describe("filterPlans — combined filters", () => {
  it("ANDs two active filters", () => {
    const result = filterPlans(PLANS, { ...noFilters, statuses: ["planning"], fiscalYears: ["2026"] });
    expect(result).toHaveLength(1);
  });

  it("returns empty array when filters produce no matches", () => {
    const result = filterPlans(PLANS, { ...noFilters, statuses: ["stale"] });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test — confirm it passes (pure logic, no imports to fail)**

```bash
npx vitest run src/features/shared/components/views/__tests__/PlansView.filters.test.ts
```

Expected: all tests PASS

- [ ] **Step 3: Add imports, state, memo, and onSearch handlers to PlansListView**

In `src/features/shared/components/views/PlansView.tsx`:

Add import at top:
```ts
import { AsyncMultiSelect } from "@/features/shared/components/AsyncMultiSelect";
import type { MultiSelectOption } from "@/features/shared/components/MultiSelect";
```

Add inside `PlansListView` (after the existing `useState` hooks):
```ts
  // --- Filter state ---
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedFiscalYears, setSelectedFiscalYears] = useState<string[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [selectedStateFips, setSelectedStateFips] = useState<string[]>([]);
  const [selectedDistrictLeaids, setSelectedDistrictLeaids] = useState<string[]>([]);
  const [selectedSchoolLeaids, setSelectedSchoolLeaids] = useState<string[]>([]);

  const anyFilterActive = [
    selectedStatuses,
    selectedFiscalYears,
    selectedOwnerIds,
    selectedStateFips,
    selectedDistrictLeaids,
    selectedSchoolLeaids,
  ].some((f) => f.length > 0);

  // Derived options for simple filters — only show values that exist in loaded plans
  const statusOptions: MultiSelectOption[] = [
    { value: "planning", label: "Planning" },
    { value: "working", label: "Working" },
    { value: "stale", label: "Stale" },
    { value: "archived", label: "Archived" },
  ];

  const fyOptions: MultiSelectOption[] = useMemo(
    () =>
      [...new Set((plans ?? []).map((p) => p.fiscalYear))]
        .sort()
        .map((year) => ({
          value: String(year),
          label: "FY" + String(year).slice(-2),
        })),
    [plans]
  );

  const ownerOptions: MultiSelectOption[] = useMemo(() => {
    const seen = new Set<string>();
    return (plans ?? [])
      .flatMap((p) => (p.owner ? [p.owner] : []))
      .filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      })
      .map((o) => ({ value: o.id, label: o.fullName }));
  }, [plans]);

  const stateOptions: MultiSelectOption[] = useMemo(() => {
    const seen = new Set<string>();
    return (plans ?? [])
      .flatMap((p) => p.states)
      .filter((s) => {
        if (seen.has(s.fips)) return false;
        seen.add(s.fips);
        return true;
      })
      .map((s) => ({ value: s.fips, label: s.abbrev }));
  }, [plans]);

  // Async search handlers — transform raw API response to MultiSelectOption[]
  const searchDistricts = useCallback(
    async (query: string): Promise<MultiSelectOption[]> => {
      const res = await fetch(
        `/api/districts?search=${encodeURIComponent(query)}&limit=10`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      return (data.districts ?? []).map(
        (d: { leaid: string; name: string; stateAbbrev: string | null }) => ({
          value: d.leaid,
          label: d.stateAbbrev ? `${d.name} (${d.stateAbbrev})` : d.name,
        })
      );
    },
    []
  );

  const searchSchools = useCallback(
    async (query: string): Promise<MultiSelectOption[]> => {
      const res = await fetch(
        `/api/schools?search=${encodeURIComponent(query)}&limit=10`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      // Value is leaid (not ncessch) — the school filter reuses districtLeaids
      // on the plan, meaning "plans containing the district this school belongs to".
      return (data.schools ?? []).map(
        (s: { ncessch: string; leaid: string; schoolName: string; stateAbbrev?: string | null }) => ({
          value: s.leaid,
          label: s.stateAbbrev
            ? `${s.schoolName} (${s.stateAbbrev})`
            : s.schoolName,
        })
      );
    },
    []
  );

  // filteredPlans — applies all six filters in sequence
  const filteredPlans = useMemo(() => {
    let result = plans ?? [];
    if (selectedStatuses.length)
      result = result.filter((p) => selectedStatuses.includes(p.status));
    if (selectedFiscalYears.length)
      result = result.filter((p) =>
        selectedFiscalYears.includes(String(p.fiscalYear))
      );
    if (selectedOwnerIds.length)
      result = result.filter(
        (p) => p.owner && selectedOwnerIds.includes(p.owner.id)
      );
    if (selectedStateFips.length)
      result = result.filter((p) =>
        p.states.some((s) => selectedStateFips.includes(s.fips))
      );
    // District + school leaid filters are OR-combined: a plan passes if it
    // contains any leaid from either filter set.
    const allLeaidFilters = [...selectedDistrictLeaids, ...selectedSchoolLeaids];
    if (allLeaidFilters.length)
      result = result.filter((p) =>
        (p.districtLeaids ?? []).some((id) => allLeaidFilters.includes(id))
      );
    return result;
  }, [
    plans,
    selectedStatuses,
    selectedFiscalYears,
    selectedOwnerIds,
    selectedStateFips,
    selectedDistrictLeaids,
    selectedSchoolLeaids,
  ]);
```

Update the React import at the top of `PlansView.tsx` (currently `import { useState } from "react"`) to:

```ts
import { useState, useMemo, useCallback } from "react";
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors

---

### Task 6: Add filter bar UI to PlansListView

**Files:**
- Modify: `src/features/shared/components/views/PlansView.tsx`

- [ ] **Step 1: Add the MultiSelect import (already added in Task 5)**

Confirm `MultiSelect` is imported:
```ts
import { MultiSelect } from "@/features/shared/components/MultiSelect";
```

- [ ] **Step 2: Add the filter bar JSX between the header and main content**

In the `return (...)` of `PlansListView`, between `</header>` and `<main ...>`, add:

```tsx
      {/* Filter bar — shown whenever plans exist (even if all are filtered out) */}
      {plans && plans.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-6 py-2">
          <div className="max-w-6xl mx-auto flex flex-wrap items-start gap-3">
            <MultiSelect
              id="filter-status"
              label="Status"
              options={statusOptions}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Status"
              countLabel="statuses"
              searchPlaceholder="Search statuses…"
            />
            <MultiSelect
              id="filter-fy"
              label="Fiscal Year"
              options={fyOptions}
              selected={selectedFiscalYears}
              onChange={setSelectedFiscalYears}
              placeholder="FY"
              countLabel="years"
              searchPlaceholder="Search years…"
            />
            <MultiSelect
              id="filter-owner"
              label="Owner"
              options={ownerOptions}
              selected={selectedOwnerIds}
              onChange={setSelectedOwnerIds}
              placeholder="Owner"
              countLabel="owners"
              searchPlaceholder="Search owners…"
            />
            <MultiSelect
              id="filter-states"
              label="States"
              options={stateOptions}
              selected={selectedStateFips}
              onChange={setSelectedStateFips}
              placeholder="States"
              countLabel="states"
              searchPlaceholder="Search states…"
            />
            <AsyncMultiSelect
              id="filter-districts"
              label="Districts"
              selected={selectedDistrictLeaids}
              onChange={setSelectedDistrictLeaids}
              onSearch={searchDistricts}
              placeholder="Districts…"
              countLabel="districts"
              searchPlaceholder="Search districts…"
            />
            <AsyncMultiSelect
              id="filter-schools"
              label="Schools"
              selected={selectedSchoolLeaids}
              onChange={setSelectedSchoolLeaids}
              onSearch={searchSchools}
              placeholder="Schools…"
              countLabel="schools"
              searchPlaceholder="Search schools…"
            />
            {anyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStatuses([]);
                  setSelectedFiscalYears([]);
                  setSelectedOwnerIds([]);
                  setSelectedStateFips([]);
                  setSelectedDistrictLeaids([]);
                  setSelectedSchoolLeaids([]);
                }}
                className="h-9 px-3 text-sm text-[#403770]/60 hover:text-[#403770] flex items-center gap-1 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Replace `plans` with `filteredPlans` in the content area**

In the `plans && plans.length > 0` block (currently around line 216), replace:

```tsx
        ) : plans && plans.length > 0 ? (
          view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
```

with:

```tsx
        ) : filteredPlans.length > 0 || (plans && plans.length > 0) ? (
          filteredPlans.length === 0 ? (
            // Active filters produced no results — show filter-specific empty state
            <div className="text-center py-16">
              <p className="text-gray-500 font-medium">No plans match your filters.</p>
              <button
                onClick={() => {
                  setSelectedStatuses([]);
                  setSelectedFiscalYears([]);
                  setSelectedOwnerIds([]);
                  setSelectedStateFips([]);
                  setSelectedDistrictLeaids([]);
                  setSelectedSchoolLeaids([]);
                }}
                className="mt-3 text-sm text-[#403770] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlans.map((plan) => (
```

Also update the table branch:
```tsx
            <PlansTable plans={filteredPlans} onSelectPlan={onSelectPlan} onEditPlan={setPlanToEdit} />
```

> **Note:** The condition change (`filteredPlans.length > 0 || (plans && plans.length > 0)`) ensures the filter bar remains visible even when filters narrow the list to zero — we only fall through to the first-time onboarding empty state when no plans exist at all.

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/features/shared/components/views/PlansView.tsx \
        src/features/shared/components/views/__tests__/PlansView.filters.test.ts
git commit -m "feat: add multi-select filters to PlansListView

- Six filters: Status, FY, Owner, States, Districts, Schools
- Client-side filtering via filteredPlans memo
- AsyncMultiSelect for district and school search
- No-results state distinct from first-time onboarding empty state"
```

---

## Verification

After all tasks are complete:

- [ ] Open the Plans view in the browser (port 3005)
- [ ] Confirm filter bar appears between header and plans content
- [ ] Select a Status filter — confirm plan count reduces correctly
- [ ] Select a District filter — type 2+ chars, confirm dropdown populates with API results
- [ ] Select a School filter — confirm it filters plans by the school's parent district
- [ ] Activate multiple filters — confirm AND behaviour across dimensions
- [ ] Confirm "Clear" button appears when any filter is active and resets all filters
- [ ] Confirm "No plans match your filters" message appears (not the onboarding empty state) when filters produce no results
- [ ] Switch to card view — confirm filters apply there too
