# Plan Modal — Add District Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline combobox to the plan detail modal's Districts tab so users can search and add districts by name without leaving the modal.

**Architecture:** A new `AddDistrictCombobox` component in the toolbar of `DistrictsTable`. It calls the existing `/api/districts/search` API (extended with a `name` param) and uses the existing `useAddDistrictsToPlan` mutation enhanced with optimistic updates. The combobox follows WAI-ARIA 1.2 combobox pattern.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind 4, Next.js App Router, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-03-23-plan-modal-add-district-combobox-spec.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/api/districts/search/route.ts` | Add `name` query param for case-insensitive name search |
| Create | `src/features/plans/components/AddDistrictCombobox.tsx` | The combobox UI: button → input → dropdown → add |
| Create | `src/features/plans/components/__tests__/AddDistrictCombobox.test.tsx` | Tests for combobox behavior |
| Modify | `src/features/plans/lib/queries.ts` | Add `useDistrictNameSearch` hook, add optimistic update to `useAddDistrictsToPlan` |
| Modify | `src/features/plans/components/DistrictsTable.tsx` | Integrate combobox in toolbar, update empty state, add highlight animation |
| Modify | `src/features/plans/components/__tests__/DistrictsTable.test.tsx` | Add test for updated empty state |

---

## Task 0: Create Feature Branch

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feature/plan-modal-add-district-combobox main
```

- [ ] **Step 2: Verify clean state**

Run: `git status`
Expected: Clean working tree on `feature/plan-modal-add-district-combobox`

---

## Task 1: Add `name` Query Param to District Search API

**Files:**
- Modify: `src/app/api/districts/search/route.ts:54-60`

- [ ] **Step 1: Write the API change**

In the `GET` handler, right after `const url = req.nextUrl;` (line 60), add name param parsing. Then inject it into the `where` clause before the query runs.

After line 60 (`const url = req.nextUrl;`), add:

```ts
// Name search shortcut (used by combobox — simpler than constructing a filters array)
const nameParam = url.searchParams.get("name");
```

Then in the `where` clause construction (around line 255 where `const where: Record<string, unknown> = { ...filterWhere, ...relationWhere };`), add the name filter:

```ts
const where: Record<string, unknown> = { ...filterWhere, ...relationWhere };
// Add name search if provided
if (nameParam) {
  where.name = { contains: nameParam, mode: "insensitive" };
}
```

- [ ] **Step 2: Manual test**

Run: `curl "http://localhost:3005/api/districts/search?name=jeffer&limit=5"` (requires dev server running and auth — alternatively test from browser console). Confirm results contain districts with "jeffer" in the name.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/districts/search/route.ts
git commit -m "feat: add name query param to district search API"
```

---

## Task 2: Add `useDistrictNameSearch` Hook

**Files:**
- Modify: `src/features/plans/lib/queries.ts`

- [ ] **Step 1: Add the hook**

At the bottom of `src/features/plans/lib/queries.ts`, add:

```ts
// District name search for the combobox
export interface DistrictSearchResult {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  accountType: string | null;
  owner: string | null;
}

export function useDistrictNameSearch(query: string) {
  return useQuery({
    queryKey: ["districtNameSearch", query],
    queryFn: async () => {
      const res = await fetchJson<{ data: DistrictSearchResult[] }>(
        `${API_BASE}/districts/search?name=${encodeURIComponent(query)}&limit=10`
      );
      return res.data;
    },
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds — search results are fairly stable
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "queries.ts" || echo "No errors in queries.ts"`

- [ ] **Step 3: Commit**

```bash
git add src/features/plans/lib/queries.ts
git commit -m "feat: add useDistrictNameSearch hook for combobox"
```

---

## Task 3: Add Optimistic Update to `useAddDistrictsToPlan`

**Files:**
- Modify: `src/features/plans/lib/queries.ts:103-137`

- [ ] **Step 1: Understand the existing mutation**

The existing `useAddDistrictsToPlan` (line 103) only does `invalidateQueries` on success. We need to add `onMutate` for optimistic insert, `onError` for rollback, and keep the existing `onSuccess` invalidation. Follow the same pattern used by `useUpdateDistrictTargets` (line 192-291).

- [ ] **Step 2: Add the `districtData` param and optimistic update**

Replace the existing `useAddDistrictsToPlan` function with:

```ts
export function useAddDistrictsToPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      leaids,
      filters,
    }: {
      planId: string;
      leaids?: string | string[];
      filters?: { column: string; op: string; value?: unknown }[];
      /** Partial district data for optimistic UI — not sent to server */
      districtData?: Partial<TerritoryPlanDistrict>;
    }) =>
      fetchJson<{ added: number; planId: string }>(
        `${API_BASE}/territory-plans/${planId}/districts`,
        {
          method: "POST",
          body: JSON.stringify({ leaids, filters }),
        }
      ),
    onMutate: async (variables) => {
      // Only do optimistic update if districtData is provided (combobox flow)
      if (!variables.districtData || !variables.leaids) return undefined;

      await queryClient.cancelQueries({ queryKey: ["territoryPlan", variables.planId] });

      const planKey = ["territoryPlan", variables.planId] as const;
      const previousPlan = queryClient.getQueryData<TerritoryPlanDetail>(planKey);

      if (previousPlan) {
        const leaid = Array.isArray(variables.leaids) ? variables.leaids[0] : variables.leaids;
        const newDistrict: TerritoryPlanDistrict = {
          leaid,
          addedAt: new Date().toISOString(),
          name: "",
          stateAbbrev: null,
          enrollment: null,
          owner: null,
          renewalTarget: null,
          winbackTarget: null,
          expansionTarget: null,
          newBusinessTarget: null,
          notes: null,
          returnServices: [],
          newServices: [],
          tags: [],
          opportunities: [],
          ...variables.districtData,
        };

        queryClient.setQueryData<TerritoryPlanDetail>(planKey, {
          ...previousPlan,
          districts: [...previousPlan.districts, newDistrict],
        });
      }

      return { previousPlan };
    },
    onError: (_err, variables, context) => {
      // Roll back optimistic update
      if (context?.previousPlan) {
        queryClient.setQueryData(["territoryPlan", variables.planId], context.previousPlan);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
      const leaids = variables.leaids;
      if (leaids) {
        const ids = Array.isArray(leaids) ? leaids : [leaids];
        for (const id of ids) {
          queryClient.invalidateQueries({ queryKey: ["district", id] });
        }
      }
    },
  });
}
```

Note: The `districtData` field is added to the mutation variables type but is NOT included in `JSON.stringify` — it's only used by `onMutate`. The `mutationFn` destructures `planId`, `leaids`, `filters` and ignores `districtData`.

You also need to add `TerritoryPlanDistrict` and `TerritoryPlanDetail` to the imports at the top of the file:

```ts
import type {
  TerritoryPlan,
  TerritoryPlanDetail,
  TerritoryPlanDistrict,
  Contact,
  Service,
  PlanDistrictDetail,
  PlanOpportunityRow,
} from "@/features/shared/types/api-types";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "queries.ts" || echo "No errors in queries.ts"`

- [ ] **Step 4: Commit**

```bash
git add src/features/plans/lib/queries.ts
git commit -m "feat: add optimistic update to useAddDistrictsToPlan"
```

---

## Task 4: Build `AddDistrictCombobox` Component

**Files:**
- Create: `src/features/plans/components/AddDistrictCombobox.tsx`
- Create: `src/features/plans/components/__tests__/AddDistrictCombobox.test.tsx`

- [ ] **Step 1: Write the test file**

Create `src/features/plans/components/__tests__/AddDistrictCombobox.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddDistrictCombobox from "../AddDistrictCombobox";

// Mock the query hooks
const mockMutate = vi.fn();
vi.mock("@/features/plans/lib/queries", () => ({
  useDistrictNameSearch: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
  }),
  useAddDistrictsToPlan: vi.fn().mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  }),
}));

import { useDistrictNameSearch } from "@/features/plans/lib/queries";
const mockUseDistrictNameSearch = vi.mocked(useDistrictNameSearch);

function renderCombobox(props?: Partial<React.ComponentProps<typeof AddDistrictCombobox>>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddDistrictCombobox
        planId="plan-1"
        existingLeaids={new Set()}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe("AddDistrictCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDistrictNameSearch.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
  });

  it("renders the Add District button", () => {
    renderCombobox();
    expect(screen.getByRole("button", { name: /add district/i })).toBeInTheDocument();
  });

  it("shows search input when button is clicked", async () => {
    renderCombobox();
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows results when search returns data", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [
        { leaid: "d1", name: "Jefferson County", stateAbbrev: "SC", enrollment: 12000, accountType: "Customer", owner: null },
        { leaid: "d2", name: "Jefferson Parish", stateAbbrev: "LA", enrollment: 45000, accountType: "Prospect", owner: null },
      ],
      isLoading: false,
    } as any);

    renderCombobox();
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    await userEvent.type(screen.getByRole("combobox"), "jeffer");

    expect(screen.getByText("Jefferson County")).toBeInTheDocument();
    expect(screen.getByText("Jefferson Parish")).toBeInTheDocument();
  });

  it("shows 'In this plan' for existing districts", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [
        { leaid: "d1", name: "Jefferson County", stateAbbrev: "SC", enrollment: 12000, accountType: "Customer", owner: null },
      ],
      isLoading: false,
    } as any);

    renderCombobox({ existingLeaids: new Set(["d1"]) });
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    await userEvent.type(screen.getByRole("combobox"), "jeffer");

    expect(screen.getByText(/in this plan/i)).toBeInTheDocument();
  });

  it("calls mutate when a result is clicked", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [
        { leaid: "d1", name: "Jefferson County", stateAbbrev: "SC", enrollment: 12000, accountType: "Customer", owner: null },
      ],
      isLoading: false,
    } as any);

    renderCombobox();
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    await userEvent.type(screen.getByRole("combobox"), "jeffer");
    await userEvent.click(screen.getByText("Jefferson County"));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plan-1",
        leaids: ["d1"],
      })
    );
  });

  it("closes on Escape", async () => {
    renderCombobox();
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("does not call mutate when clicking an in-plan district", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [
        { leaid: "d1", name: "Jefferson County", stateAbbrev: "SC", enrollment: 12000, accountType: "Customer", owner: null },
      ],
      isLoading: false,
    } as any);

    renderCombobox({ existingLeaids: new Set(["d1"]) });
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    await userEvent.type(screen.getByRole("combobox"), "jeffer");
    await userEvent.click(screen.getByText("Jefferson County"));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows no-results message", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderCombobox();
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    await userEvent.type(screen.getByRole("combobox"), "xyzabc");

    expect(screen.getByText(/no districts matching/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/plans/components/__tests__/AddDistrictCombobox.test.tsx`
Expected: FAIL — `AddDistrictCombobox` module not found

- [ ] **Step 3: Build the component**

Create `src/features/plans/components/AddDistrictCombobox.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDistrictNameSearch, useAddDistrictsToPlan } from "@/features/plans/lib/queries";
import type { DistrictSearchResult } from "@/features/plans/lib/queries";

interface AddDistrictComboboxProps {
  planId: string;
  existingLeaids: Set<string>;
  onAdded?: (leaid: string) => void;
  onError?: (message: string) => void;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AddDistrictCombobox({
  planId,
  existingLeaids,
  onAdded,
  onError,
}: AddDistrictComboboxProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const { data: results, isLoading } = useDistrictNameSearch(debouncedQuery);
  const addMutation = useAddDistrictsToPlan();

  // Filter out already-added districts for clickability, but keep them visible
  const selectableResults = useMemo(() => {
    if (!results) return [];
    return results.map((r) => ({
      ...r,
      isInPlan: existingLeaids.has(r.leaid) || recentlyAdded.has(r.leaid),
    }));
  }, [results, existingLeaids, recentlyAdded]);

  const selectableIndexes = useMemo(
    () => selectableResults
      .map((r, i) => (r.isInPlan ? -1 : i))
      .filter((i) => i >= 0),
    [selectableResults]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(-1);
    // Focus input on next tick
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  const handleAdd = useCallback(
    (district: DistrictSearchResult) => {
      if (existingLeaids.has(district.leaid) || recentlyAdded.has(district.leaid)) return;

      setRecentlyAdded((prev) => new Set(prev).add(district.leaid));

      addMutation.mutate(
        {
          planId,
          leaids: [district.leaid],
          districtData: {
            leaid: district.leaid,
            name: district.name,
            stateAbbrev: district.stateAbbrev,
            enrollment: district.enrollment,
            owner: district.owner,
          },
        },
        {
          onError: () => {
            setRecentlyAdded((prev) => {
              const next = new Set(prev);
              next.delete(district.leaid);
              return next;
            });
            const msg = `Failed to add ${district.name}`;
            setErrorMsg(msg);
            onError?.(msg);
            setTimeout(() => setErrorMsg(null), 3000);
          },
        }
      );

      onAdded?.(district.leaid);
      setQuery("");
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [planId, existingLeaids, recentlyAdded, addMutation, onAdded]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      if (!selectableResults.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const currentPos = selectableIndexes.indexOf(prev);
          const nextPos = currentPos < selectableIndexes.length - 1 ? currentPos + 1 : 0;
          return selectableIndexes[nextPos] ?? -1;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const currentPos = selectableIndexes.indexOf(prev);
          const nextPos = currentPos > 0 ? currentPos - 1 : selectableIndexes.length - 1;
          return selectableIndexes[nextPos] ?? -1;
        });
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const result = selectableResults[activeIndex];
        if (result && !result.isInPlan) {
          handleAdd(result);
        }
      }
    },
    [selectableResults, selectableIndexes, activeIndex, handleAdd, handleClose]
  );

  const listboxId = "add-district-listbox";
  const showDropdown = isOpen && debouncedQuery.length >= 2;

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#403770] bg-transparent border border-dashed border-[#403770]/25 rounded-lg hover:bg-[#403770]/5 hover:border-[#403770]/40 transition-colors"
        aria-label="Add district"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 1v10M1 6h10" />
        </svg>
        Add District
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative" style={{ width: 320 }}>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-[#403770] rounded-lg bg-white shadow-[0_0_0_3px_rgba(64,55,112,0.08)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#403770" strokeWidth="2" className="shrink-0">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `district-option-${activeIndex}` : undefined}
          aria-label="Search districts to add"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search districts by name..."
          className="flex-1 text-sm text-[#403770] placeholder:text-[#A69DC0] bg-transparent outline-none"
        />
        <kbd className="text-[10px] text-[#A69DC0] bg-[#F7F5FA] px-1.5 py-0.5 rounded">ESC</kbd>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden max-h-[280px] overflow-y-auto"
        >
          {isLoading && (
            <li className="px-3 py-3 text-center">
              <div className="inline-block w-4 h-4 border-2 border-[#D4CFE2] border-t-[#403770] rounded-full animate-spin" />
            </li>
          )}

          {!isLoading && selectableResults.length === 0 && (
            <li className="px-4 py-5 text-center">
              <div className="text-sm text-[#8A80A8]">
                No districts matching &ldquo;{debouncedQuery}&rdquo;
              </div>
              <div className="text-xs text-[#A69DC0] mt-1">
                Try a different name or use the map to browse
              </div>
            </li>
          )}

          {!isLoading && selectableResults.length > 0 && (
            <>
              <li className="px-3 py-1.5 text-[10px] font-semibold text-[#A69DC0] uppercase tracking-wider border-b border-[#E2DEEC]">
                {selectableResults.length} result{selectableResults.length !== 1 ? "s" : ""}
              </li>
              {selectableResults.map((district, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    key={district.leaid}
                    id={`district-option-${index}`}
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={district.isInPlan}
                    className={`flex items-center px-3 py-2.5 border-b border-[#F7F5FA] last:border-0 ${
                      district.isInPlan
                        ? "opacity-50 cursor-default"
                        : isActive
                          ? "bg-[#faf9fc] cursor-pointer"
                          : "hover:bg-[#faf9fc] cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!district.isInPlan) handleAdd(district);
                    }}
                    onMouseEnter={() => {
                      if (!district.isInPlan) setActiveIndex(index);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#403770] truncate">
                        {highlightMatch(district.name, query)}
                      </div>
                      <div className="text-[11px] text-[#A69DC0] mt-0.5">
                        {district.stateAbbrev || "—"}
                        {district.enrollment != null && (
                          <> · {district.enrollment.toLocaleString()} enrolled</>
                        )}
                      </div>
                    </div>
                    {district.isInPlan ? (
                      <span className="text-[10px] font-medium text-[#F37167] bg-[#F37167]/8 px-2 py-0.5 rounded-full shrink-0">
                        In this plan
                      </span>
                    ) : district.accountType ? (
                      <AccountBadge accountType={district.accountType} />
                    ) : null}
                  </li>
                );
              })}
            </>
          )}
        </ul>
      )}

      {/* Error toast */}
      {errorMsg && (
        <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-[#fef1f0] border border-[#f58d85] rounded-lg text-xs text-[#F37167] font-medium z-50">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function AccountBadge({ accountType }: { accountType: string }) {
  const isCustomer = accountType === "Customer";
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
        isCustomer
          ? "text-[#6EA3BE] bg-[#6EA3BE]/10"
          : "text-[#8A80A8] bg-[#F7F5FA]"
      }`}
    >
      {accountType}
    </span>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-[#403770]/10 rounded-sm px-px">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/plans/components/__tests__/AddDistrictCombobox.test.tsx`
Expected: All 8 tests PASS

- [ ] **Step 5: Fix any test failures and re-run**

If any tests fail, adjust the component or test as needed and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/features/plans/components/AddDistrictCombobox.tsx src/features/plans/components/__tests__/AddDistrictCombobox.test.tsx
git commit -m "feat: add AddDistrictCombobox component with tests"
```

---

## Task 5: Integrate Combobox into DistrictsTable

**Files:**
- Modify: `src/features/plans/components/DistrictsTable.tsx:245-307`
- Modify: `src/features/plans/components/__tests__/DistrictsTable.test.tsx`

- [ ] **Step 1: Add test for updated empty state**

In `src/features/plans/components/__tests__/DistrictsTable.test.tsx`, add at the bottom:

```tsx
describe("DistrictsTable empty state", () => {
  it("shows Add Districts button and Go to Map button", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onGoToMap = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <DistrictsTable
          districts={[]}
          planId="p1"
          onRemove={vi.fn()}
          onGoToMap={onGoToMap}
        />
      </QueryClientProvider>
    );
    expect(screen.getByRole("button", { name: /add district/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to map/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/plans/components/__tests__/DistrictsTable.test.tsx`
Expected: The new test fails — current empty state has "Go to Map" but not "Add District" as a separate button with that accessible name.

- [ ] **Step 3: Add combobox import and highlight state to DistrictsTable**

At the top of `DistrictsTable.tsx`, add the import:

```tsx
import AddDistrictCombobox from "./AddDistrictCombobox";
```

Inside the `DistrictsTable` component, add highlight tracking state after the existing state declarations (after line 258):

```tsx
const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
const existingLeaids = useMemo(() => new Set(districts.map((d) => d.leaid)), [districts]);

const handleDistrictAdded = useCallback((leaid: string) => {
  setRecentlyAdded((prev) => new Set(prev).add(leaid));
  // Clear highlight after 1.5s
  setTimeout(() => {
    setRecentlyAdded((prev) => {
      const next = new Set(prev);
      next.delete(leaid);
      return next;
    });
  }, 1500);
}, []);
```

Add `useMemo` and `useCallback` to the existing React imports at line 1.

- [ ] **Step 4: Update the empty state**

Replace the empty state block (lines 271-306) with:

```tsx
if (districts.length === 0) {
  return (
    <div className="text-center py-12">
      <svg
        className="w-16 h-16 mx-auto text-gray-300 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-600 mb-2">No districts yet</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
        Search by name to add districts, or browse the map.
      </p>
      <div className="flex items-center justify-center gap-3">
        <AddDistrictCombobox
          planId={planId}
          existingLeaids={existingLeaids}
          onAdded={handleDistrictAdded}
        />
        <button
          onClick={onGoToMap}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] border border-[#403770]/20 rounded-lg hover:bg-[#403770]/5 transition-colors"
          aria-label="Go to Map"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          Go to Map
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add combobox to the populated table toolbar**

After the opening `<div className="overflow-hidden ...">` and before `<div className="overflow-x-auto">` (around line 327), add a toolbar row:

```tsx
<div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
  <AddDistrictCombobox
    planId={planId}
    existingLeaids={existingLeaids}
    onAdded={handleDistrictAdded}
  />
</div>
```

- [ ] **Step 6: Add highlight animation to table rows**

In the `<tr>` element for each district (around line 352), add a conditional style for recently added districts:

Replace the existing `<tr>` className logic:

```tsx
<tr
  key={district.leaid}
  className={`group transition-colors duration-100 hover:bg-gray-50/70 ${!isLast ? "border-b border-gray-100" : ""} ${onDistrictClick ? "cursor-pointer" : ""}`}
```

With:

```tsx
<tr
  key={district.leaid}
  className={`group transition-all duration-100 hover:bg-gray-50/70 ${!isLast ? "border-b border-gray-100" : ""} ${onDistrictClick ? "cursor-pointer" : ""}`}
  style={
    recentlyAdded.has(district.leaid)
      ? { backgroundColor: "rgba(64,55,112,0.06)", transition: "background-color 1.5s ease-out" }
      : undefined
  }
```

- [ ] **Step 7: Run all DistrictsTable tests**

Run: `npx vitest run src/features/plans/components/__tests__/DistrictsTable.test.tsx`
Expected: All tests PASS (existing + new empty state test)

- [ ] **Step 8: Run AddDistrictCombobox tests too**

Run: `npx vitest run src/features/plans/components/__tests__/AddDistrictCombobox.test.tsx`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/features/plans/components/DistrictsTable.tsx src/features/plans/components/__tests__/DistrictsTable.test.tsx
git commit -m "feat: integrate AddDistrictCombobox into DistrictsTable"
```

---

## Task 6: Smoke Test & Cleanup

- [ ] **Step 1: Run the full test suite for the plans feature**

Run: `npx vitest run src/features/plans/`
Expected: All tests pass

- [ ] **Step 2: TypeScript compilation check**

Run: `npx tsc --noEmit`
Expected: No new errors related to changed files

- [ ] **Step 3: Visual smoke test**

Start dev server (`npm run dev`), navigate to a plan in the plan modal. Test:
1. Empty plan: "+ Add District" button visible alongside "Go to Map"
2. Click "+ Add District" → search input appears
3. Type a district name → results appear in dropdown
4. Click a result → district appears in table with highlight
5. Search input clears and refocuses for next search
6. Already-added districts show "In this plan" badge
7. Press Escape → combobox collapses
8. Keyboard: Arrow keys navigate, Enter selects

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -u
git commit -m "chore: cleanup after AddDistrictCombobox integration"
```
