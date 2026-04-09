# Geography Dropdown Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 300-600ms first-click delay on the Geography dropdown by prefetching state/county data and virtualizing the county list.

**Architecture:** Add a `useGeographyPrefetch()` hook called from SearchBar to warm the TanStack Query cache on page load. Add `virtualize` and `loading` props to `FilterMultiSelect` so the county list renders only visible rows via `@tanstack/react-virtual`. All other FilterMultiSelect callers are unaffected.

**Tech Stack:** React 19, TanStack Query v5, @tanstack/react-virtual, Vitest + Testing Library

**Branch:** `feat/geography-dropdown-perf`

**Spec:** `docs/superpowers/specs/2026-04-08-geography-dropdown-perf-spec.md`

---

### Task 1: Create feature branch and install dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/geography-dropdown-perf
```

- [ ] **Step 2: Install @tanstack/react-virtual**

```bash
npm install @tanstack/react-virtual
```

Expected: Package added to `dependencies` in `package.json`. No peer dependency warnings (already has `react` 19 and `@tanstack/react-query` v5).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @tanstack/react-virtual dependency"
```

---

### Task 2: Add useGeographyPrefetch hook and wire into SearchBar

**Files:**
- Modify: `src/features/map/lib/queries.ts` (after line 63, after `useCounties`)
- Modify: `src/features/map/components/SearchBar/index.tsx` (imports + hook call)

- [ ] **Step 1: Add useGeographyPrefetch to queries.ts**

Add after the `useCounties` function (after line 63):

```typescript
// Prefetch geography data on page load so dropdowns open instantly
export function useGeographyPrefetch() {
  useStates();
  useCounties();
}
```

- [ ] **Step 2: Call useGeographyPrefetch in SearchBar**

In `src/features/map/components/SearchBar/index.tsx`, add the import at the top with other imports:

```typescript
import { useGeographyPrefetch } from "@/features/map/lib/queries";
```

Then call the hook inside the SearchBar component body (before any other logic, after the opening of the function):

```typescript
export default function SearchBar() {
  useGeographyPrefetch();
  // ... rest of component
```

Note: SearchBar is always mounted when the map is visible, so this triggers the prefetch on page load.

- [ ] **Step 3: Verify dev server still compiles**

```bash
npm run dev
```

Expected: No compilation errors. Open browser dev tools Network tab — `/api/states` and `/api/counties` should fire on initial page load, not when clicking Geography.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/lib/queries.ts src/features/map/components/SearchBar/index.tsx
git commit -m "feat: prefetch geography data on page load"
```

---

### Task 3: Refactor GeographyDropdown to use useStates() hook

**Files:**
- Modify: `src/features/map/components/SearchBar/GeographyDropdown.tsx`

- [ ] **Step 1: Replace raw fetch with useStates()**

In `GeographyDropdown.tsx`, make these changes:

Add `useStates` to the imports:

```typescript
import { useCounties, useStates } from "@/features/map/lib/queries";
```

Remove the `useState` for states (line 20):

```typescript
// DELETE: const [states, setStates] = useState<Array<{ abbrev: string; name: string }>>([]);
```

Remove the `useEffect` that fetches states (lines 47-58):

```typescript
// DELETE the entire useEffect block:
// useEffect(() => {
//   fetch("/api/states")
//     .then(...)
//     .catch(() => {});
// }, []);
```

Replace with the `useStates()` hook, placed after the existing `useCounties()` call:

```typescript
// Fetch counties via TanStack Query (cached for the session)
const { data: counties = [] } = useCounties();

// Fetch states via TanStack Query (cached 24h, prefetched on page load)
const { data: rawStates = [], isLoading: isLoadingStates } = useStates();
const states = rawStates.slice().sort((a, b) => a.name.localeCompare(b.name));
```

Also capture `isLoading` from counties:

```typescript
const { data: counties = [], isLoading: isLoadingCounties } = useCounties();
```

- [ ] **Step 2: Remove conditional render guards, always show sections**

Replace the conditional rendering (lines 176-193):

```typescript
{/* State */}
{states.length > 0 && (
  <FilterMultiSelect
    label="State"
    column="state"
    options={states.map((s) => ({ value: s.abbrev, label: `${s.name} (${s.abbrev})` }))}
    onApply={(col, vals) => addFilter(col, "in", vals)}
  />
)}

{/* County */}
{countyOptions.length > 0 && (
  <FilterMultiSelect
    label="County"
    column="countyName"
    options={countyOptions}
    onApply={handleCountyApply}
  />
)}
```

With always-rendered sections that pass loading and virtualize props:

```typescript
{/* State */}
<FilterMultiSelect
  label="State"
  column="state"
  options={states.map((s) => ({ value: s.abbrev, label: `${s.name} (${s.abbrev})` }))}
  onApply={(col, vals) => addFilter(col, "in", vals)}
  loading={isLoadingStates}
/>

{/* County */}
<FilterMultiSelect
  label="County"
  column="countyName"
  options={countyOptions}
  onApply={handleCountyApply}
  loading={isLoadingCounties}
  virtualize
/>
```

- [ ] **Step 3: Clean up unused imports**

Remove `useState` from the React import if no longer used (check — `zip`, `radius`, `zipLoading` still use it, so `useState` stays). Remove the `useEffect` import only if no other useEffect remains (check — the click-outside useEffect on line 60 still needs it, so `useEffect` stays). The `useMemo` import stays for `countyOptions` and `selectedStates`.

- [ ] **Step 4: Verify dev server compiles**

```bash
npm run dev
```

Expected: No errors. The Geography dropdown should still work, though `loading` and `virtualize` props aren't consumed by FilterMultiSelect yet (they'll be silently ignored as unknown props until Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchBar/GeographyDropdown.tsx
git commit -m "refactor: use useStates() hook in GeographyDropdown"
```

---

### Task 4: Add virtualization and loading support to FilterMultiSelect

**Files:**
- Modify: `src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx`

This is the largest task. The component gets two new optional props (`loading`, `virtualize`) and a conditional rendering path for the options list.

- [ ] **Step 1: Write the failing test for virtualized rendering**

Create `src/features/map/components/SearchBar/controls/__tests__/FilterMultiSelect.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterMultiSelect from "../FilterMultiSelect";

// Mock the Zustand store
const mockRemoveSearchFilter = vi.fn();
vi.mock("@/features/map/lib/store", () => {
  const storeState = {
    searchFilters: [],
    removeSearchFilter: mockRemoveSearchFilter,
  };
  const useMapV2Store = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  useMapV2Store.getState = () => storeState;
  return { useMapV2Store };
});

// Generate a large options list for virtualization tests
function makeOptions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    value: `val-${i}`,
    label: `Option ${i}`,
  }));
}

describe("FilterMultiSelect", () => {
  const defaultProps = {
    label: "Test",
    column: "test",
    options: makeOptions(10),
    onApply: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("non-virtualized (default)", () => {
    it("renders all options in the DOM", () => {
      render(<FilterMultiSelect {...defaultProps} />);
      // All 10 options + Select All button should be in the DOM
      expect(screen.getByText("Option 0")).toBeInTheDocument();
      expect(screen.getByText("Option 9")).toBeInTheDocument();
      expect(screen.getAllByRole("option")).toHaveLength(11); // 10 + Select All
    });

    it("toggles selection on click", () => {
      const onApply = vi.fn();
      render(<FilterMultiSelect {...defaultProps} onApply={onApply} />);
      fireEvent.click(screen.getByText("Option 3"));
      expect(onApply).toHaveBeenCalledWith("test", ["val-3"]);
    });
  });

  describe("virtualized", () => {
    it("renders fewer DOM nodes than total options", () => {
      const manyOptions = makeOptions(3000);
      const { container } = render(
        <FilterMultiSelect {...defaultProps} options={manyOptions} virtualize />
      );
      // With virtualization, far fewer than 3000 option buttons should exist
      const optionButtons = container.querySelectorAll('[role="option"]');
      // Select All (1) + visible rows + overscan (~25-30 total)
      expect(optionButtons.length).toBeLessThan(50);
      expect(optionButtons.length).toBeGreaterThan(0);
    });

    it("filters options via search", () => {
      const manyOptions = makeOptions(3000);
      render(
        <FilterMultiSelect {...defaultProps} options={manyOptions} virtualize />
      );
      const searchInput = screen.getByPlaceholderText("Search test...");
      fireEvent.change(searchInput, { target: { value: "Option 42" } });
      // Should find the exact match(es) — "Option 42", "Option 420"-"Option 429", "Option 4200"-etc
      // The key point: results are visible and virtualization handles the filtered list
      expect(screen.getByText("Option 42")).toBeInTheDocument();
    });

    it("Select All works across all items, not just rendered ones", () => {
      const onApply = vi.fn();
      const manyOptions = makeOptions(100);
      render(
        <FilterMultiSelect {...defaultProps} options={manyOptions} onApply={onApply} virtualize />
      );
      fireEvent.click(screen.getByText("Select All"));
      // onApply should be called with all 100 values
      expect(onApply).toHaveBeenCalledWith(
        "test",
        expect.arrayContaining(["val-0", "val-99"])
      );
      const callArgs = onApply.mock.calls[0][1];
      expect(callArgs).toHaveLength(100);
    });
  });

  describe("loading state", () => {
    it("shows loading indicator when loading is true", () => {
      render(<FilterMultiSelect {...defaultProps} options={[]} loading />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("shows options when loading is false", () => {
      render(<FilterMultiSelect {...defaultProps} loading={false} />);
      expect(screen.getByText("Option 0")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/map/components/SearchBar/controls/__tests__/FilterMultiSelect.test.tsx
```

Expected: Tests fail because `virtualize` and `loading` props aren't implemented yet. The non-virtualized and toggle tests should pass. The virtualized tests and loading test will fail.

- [ ] **Step 3: Implement the loading prop**

In `FilterMultiSelect.tsx`, update the interface (line 6-11):

```typescript
interface FilterMultiSelectProps {
  label: string;
  column: string;
  options: Array<{ value: string; label: string }>;
  onApply: (column: string, values: string[]) => void;
  loading?: boolean;
  virtualize?: boolean;
}
```

Update the component signature (line 13):

```typescript
export default function FilterMultiSelect({ label, column, options, onApply, loading, virtualize }: FilterMultiSelectProps) {
```

Add a loading state inside the bordered container, right before the options list `<div>` (before line 169). Replace the options list section with a conditional:

```typescript
{/* Options list */}
{loading ? (
  <div className="px-2.5 py-4 text-xs text-[#A69DC0] text-center">
    Loading {label.toLowerCase()}…
  </div>
) : (
  // existing options list div goes here (the <div ref={listRef} ...> block)
)}
```

Specifically, wrap the existing `<div ref={listRef} className="max-h-36 overflow-y-auto" ...>` block (lines 169-228) inside the else branch of this conditional.

- [ ] **Step 4: Implement the virtualize prop**

Add the import at the top of `FilterMultiSelect.tsx`:

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";
```

Add a ref for the scrollable container (alongside the existing refs, around line 33-34):

```typescript
const scrollRef = useRef<HTMLDivElement>(null);
```

Add the virtualizer hook after the existing `filtered` useMemo (after line 40). It should only activate when `virtualize` is true:

```typescript
const rowVirtualizer = useVirtualizer({
  count: filtered.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 28, // matches py-1 + text-xs row height
  overscan: 5,
  enabled: !!virtualize,
});
```

Now update the keyboard navigation handler. When `virtualize` is true and the user presses ArrowDown/ArrowUp, scroll to the active item. Update the `handleKeyDown` function — after `setActiveIndex` calls for ArrowDown and ArrowUp, add scroll-to-index logic. Replace the entire `handleKeyDown` function (lines 81-102):

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActiveIndex((prev) => {
      const next = Math.min(prev + 1, filtered.length);
      if (virtualize && next > 0) rowVirtualizer.scrollToIndex(next - 1, { align: "auto" });
      return next;
    });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActiveIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      if (virtualize && next > 0) rowVirtualizer.scrollToIndex(next - 1, { align: "auto" });
      return next;
    });
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeIndex === 0) {
      selectAll();
    } else if (activeIndex > 0 && filtered[activeIndex - 1]) {
      toggle(filtered[activeIndex - 1].value);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (search) {
      setSearch("");
      setActiveIndex(-1);
    }
  }
};
```

Now replace the options list rendering. The current non-virtualized list (lines 169-228) needs a conditional branch. Replace the `<div ref={listRef} ...>` block with:

```typescript
{/* Options list */}
{loading ? (
  <div className="px-2.5 py-4 text-xs text-[#A69DC0] text-center">
    Loading {label.toLowerCase()}…
  </div>
) : virtualize ? (
  <div>
    {/* Select All — fixed above virtualized list */}
    <button
      id="multiselect-select-all"
      role="option"
      aria-selected={allFilteredSelected}
      onClick={selectAll}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors border-b border-[#E2DEEC] ${
        activeIndex === 0 ? "bg-plum/10" : "hover:bg-[#EFEDF5]"
      }`}
    >
      <input
        type="checkbox"
        checked={allFilteredSelected}
        ref={(el) => { if (el) el.indeterminate = someFilteredSelected; }}
        onChange={selectAll}
        className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-plum focus:ring-plum/30 pointer-events-none"
        tabIndex={-1}
      />
      <span className="text-xs font-medium text-[#6E6390]">
        {allFilteredSelected ? "Deselect All" : "Select All"}
        {search && ` (${filtered.length})`}
      </span>
    </button>

    {/* Virtualized options */}
    <div
      ref={scrollRef}
      className="max-h-36 overflow-y-auto"
      role="listbox"
      id="multiselect-listbox"
    >
      {filtered.length === 0 ? (
        <div className="px-2.5 py-2 text-xs text-[#A69DC0] italic">
          No matches for &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const o = filtered[virtualRow.index];
            const i = virtualRow.index;
            return (
              <button
                key={o.value}
                id={`multiselect-option-${o.value}`}
                role="option"
                aria-selected={selected.has(o.value)}
                onClick={() => toggle(o.value)}
                className={`w-full flex items-center gap-2 px-2.5 py-1 text-left cursor-pointer transition-colors ${
                  activeIndex === i + 1 ? "bg-plum/10" : "hover:bg-[#EFEDF5]"
                }`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => toggle(o.value)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-plum focus:ring-plum/30 pointer-events-none"
                  tabIndex={-1}
                />
                <span className={`text-xs ${selected.has(o.value) ? "text-[#544A78] font-medium" : "text-[#544A78]"}`}>
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  </div>
) : (
  <div ref={listRef} className="max-h-36 overflow-y-auto" role="listbox" id="multiselect-listbox">
    {/* Select All / Remove All */}
    <button
      id="multiselect-select-all"
      role="option"
      aria-selected={allFilteredSelected}
      onClick={selectAll}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors border-b border-[#E2DEEC] ${
        activeIndex === 0 ? "bg-plum/10" : "hover:bg-[#EFEDF5]"
      }`}
    >
      <input
        type="checkbox"
        checked={allFilteredSelected}
        ref={(el) => { if (el) el.indeterminate = someFilteredSelected; }}
        onChange={selectAll}
        className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-plum focus:ring-plum/30 pointer-events-none"
        tabIndex={-1}
      />
      <span className="text-xs font-medium text-[#6E6390]">
        {allFilteredSelected ? "Deselect All" : "Select All"}
        {search && ` (${filtered.length})`}
      </span>
    </button>

    {/* Filtered options */}
    {filtered.length === 0 && (
      <div className="px-2.5 py-2 text-xs text-[#A69DC0] italic">
        No matches for &ldquo;{search}&rdquo;
      </div>
    )}
    {filtered.map((o, i) => (
      <button
        key={o.value}
        id={`multiselect-option-${o.value}`}
        role="option"
        aria-selected={selected.has(o.value)}
        ref={(el) => {
          if (i === activeIndex - 1 && el) {
            el.scrollIntoView({ block: "nearest" });
          }
        }}
        onClick={() => toggle(o.value)}
        className={`w-full flex items-center gap-2 px-2.5 py-1 text-left cursor-pointer transition-colors ${
          activeIndex === i + 1 ? "bg-plum/10" : "hover:bg-[#EFEDF5]"
        }`}
      >
        <input
          type="checkbox"
          checked={selected.has(o.value)}
          onChange={() => toggle(o.value)}
          className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-plum focus:ring-plum/30 pointer-events-none"
          tabIndex={-1}
        />
        <span className={`text-xs ${selected.has(o.value) ? "text-[#544A78] font-medium" : "text-[#544A78]"}`}>
          {o.label}
        </span>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/features/map/components/SearchBar/controls/__tests__/FilterMultiSelect.test.tsx
```

Expected: All tests pass — non-virtualized, virtualized, and loading.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
npm test -- --run
```

Expected: No new failures. Existing SearchBar test should still pass since it mocks GeographyDropdown.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx src/features/map/components/SearchBar/controls/__tests__/FilterMultiSelect.test.tsx
git commit -m "feat: add virtualization and loading support to FilterMultiSelect"
```

---

### Task 5: Manual QA and final commit

**Files:** None — this is a verification task.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test Geography dropdown performance**

Open `http://localhost:3005` in the browser. Open the Network tab in dev tools.

1. On page load, confirm `/api/states` and `/api/counties` fire immediately (prefetch working)
2. Click Geography button — State and County lists should populate instantly (no delay)
3. If on a slow connection, the loading text should appear briefly then resolve

- [ ] **Step 3: Test county virtualization**

1. Open Geography dropdown
2. Scroll through the full county list — should be smooth, no blank flicker
3. Search for "Cook" — results appear instantly
4. Click Select All — all filtered counties get selected
5. Clear search, verify all selected pills appear
6. Use keyboard arrows to navigate — active item stays visible

- [ ] **Step 4: Test state dropdown (non-virtualized path)**

1. Open Geography dropdown
2. States list should render normally (all ~50 items)
3. Search, Select All, toggle — all work as before

- [ ] **Step 5: Test county scoping by state**

1. Select a state (e.g., California)
2. County list should filter to only CA counties
3. Search within scoped counties works

- [ ] **Step 6: Test ZIP code search**

1. Enter a valid ZIP (e.g., 90210)
2. Select radius, click Search
3. Map flies to location, filter pill appears

- [ ] **Step 7: Regression check other dropdowns**

1. Open Fullmind dropdown — Sales Executive, Plans, Tags filters work normally
2. Open Districts dropdown — Sales Executive, Tags filters work normally
3. Filter pills appear and clear correctly for all filter types

- [ ] **Step 8: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address QA findings from geography perf work"
```

Only run this step if fixes were made during QA. Skip if everything passed clean.
