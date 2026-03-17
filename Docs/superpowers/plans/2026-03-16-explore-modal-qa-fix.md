# DistrictExploreModal QA Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs that make DistrictExploreModal inaccessible — the SearchBar stacking context covers the modal, and fixed pixel dimensions cause overflow on smaller windows.

**Architecture:** Apply `createPortal(…, document.body)` in `SearchResults/index.tsx` to move the modal's DOM node into the root stacking context. Remove the now-redundant dimming overlay workaround from `SearchBar/index.tsx`. Replace hardcoded pixel dimensions in `DistrictExploreModal.tsx` with viewport-relative `calc()` values capped by `max-w`/`max-h`.

**Tech Stack:** React 18, Next.js 14 (`"use client"`), Tailwind CSS, Vitest, @testing-library/react

---

## File Map

| File | Change |
|---|---|
| `src/features/map/components/SearchResults/index.tsx` | Wrap `<DistrictExploreModal>` in `createPortal(…, document.body)` |
| `src/features/map/components/SearchBar/index.tsx` | Remove `exploreModalLeaid` dimming overlay block |
| `src/features/map/components/SearchResults/DistrictExploreModal.tsx` | Change `w-[1076px] h-[745px]` to responsive `calc()` values |
| `src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx` | New — unit tests for responsive sizing |
| `src/features/map/components/SearchResults/__tests__/SearchResults.test.tsx` | New — unit test for portal rendering location |
| `src/features/map/components/SearchBar/__tests__/SearchBar.test.tsx` | New — unit test confirming overlay is absent |

---

## Chunk 1: Branch + Portal Fix

### Task 1: Create the branch

- [ ] **Step 1: Create and check out the branch**

```bash
git checkout main
git pull
git checkout -b feature/district-search-card/exploreQA
```

Expected: `Switched to a new branch 'feature/district-search-card/exploreQA'`

---

### Task 2: Write a failing test for portal rendering

**Files:**
- Create: `src/features/map/components/SearchResults/__tests__/SearchResults.test.tsx`

The test verifies that when `exploreModalLeaid` is set in the store, the modal's backdrop (a `fixed inset-0` div) appears in `document.body` — not inside the SearchResults container div.

- [ ] **Step 1: Create the test file**

```tsx
// src/features/map/components/SearchResults/__tests__/SearchResults.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SearchResults from "../index";

// ── Store mock ────────────────────────────────────────────────────────────────
let mockExploreModalLeaid: string | null = null;

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      searchFilters: [],
      searchBounds: null,
      searchSort: { column: "enrollment", direction: "desc" },
      isSearchActive: false,       // keeps results hidden so fetch isn't needed
      searchResultsVisible: true,
      toggleSearchResults: vi.fn(),
      selectedDistrictLeaids: new Set<string>(),
      toggleDistrictSelection: vi.fn(),
      setDistrictSelection: vi.fn(),
      setSearchResultLeaids: vi.fn(),
      setSearchResultCentroids: vi.fn(),
      searchResultLeaids: [],
      exploreModalLeaid: mockExploreModalLeaid,
      setExploreModalLeaid: vi.fn(),
    }),
}));

vi.mock("@/features/plans/lib/queries", () => ({
  useTerritoryPlans: () => ({ data: [] }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { id: "user-1" } }),
}));

// Stub the modal itself — we only care it renders into document.body via portal
vi.mock("../DistrictExploreModal", () => ({
  default: () => <div data-testid="explore-modal-sentinel" />,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("SearchResults — portal rendering", () => {
  beforeEach(() => {
    mockExploreModalLeaid = null;
  });

  it("does not render the explore modal when exploreModalLeaid is null", () => {
    mockExploreModalLeaid = null;
    render(<SearchResults />);
    expect(document.body.querySelector("[data-testid='explore-modal-sentinel']")).toBeNull();
  });

  it("renders the explore modal into document.body (not inside SearchResults container) when exploreModalLeaid is set", () => {
    mockExploreModalLeaid = "1234567";
    const { container } = render(<SearchResults />);

    const sentinel = document.body.querySelector("[data-testid='explore-modal-sentinel']");
    expect(sentinel).not.toBeNull();

    // The modal must NOT be inside the SearchResults container div
    expect(container.querySelector("[data-testid='explore-modal-sentinel']")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/SearchResults.test.tsx
```

Expected: test "renders the explore modal into document.body" **FAILS** because the portal isn't applied yet.

---

### Task 3: Apply the portal fix in SearchResults/index.tsx

**Files:**
- Modify: `src/features/map/components/SearchResults/index.tsx`

- [ ] **Step 1: Add the `createPortal` import**

In `index.tsx`, line 3, add `createPortal` to the react-dom import:

```tsx
import { createPortal } from "react-dom";
```

- [ ] **Step 2: Wrap the modal render in `createPortal`**

Find the modal block near line 659 (inside the return JSX):

```tsx
      {/* Explore modal */}
      {exploreModalLeaid && (
        <DistrictExploreModal
          leaid={exploreModalLeaid}
          onClose={() => setExploreModalLeaid(null)}
          onPrev={canGoPrev ? handleExplorePrev : undefined}
          onNext={canGoNext ? handleExploreNext : undefined}
          currentIndex={currentExploreIndex}
          totalCount={districts.length}
        />
      )}
```

Replace with:

```tsx
      {/* Explore modal — rendered via portal into document.body to escape stacking context */}
      {exploreModalLeaid && createPortal(
        <DistrictExploreModal
          leaid={exploreModalLeaid}
          onClose={() => setExploreModalLeaid(null)}
          onPrev={canGoPrev ? handleExplorePrev : undefined}
          onNext={canGoNext ? handleExploreNext : undefined}
          currentIndex={currentExploreIndex}
          totalCount={districts.length}
        />,
        document.body
      )}
```

- [ ] **Step 3: Run the test — expect PASS**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/SearchResults.test.tsx
```

Expected: all tests **PASS**.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchResults/__tests__/SearchResults.test.tsx
git add src/features/map/components/SearchResults/index.tsx
git commit -m "fix: render DistrictExploreModal via portal to escape stacking context"
```

---

## Chunk 2: Remove SearchBar Workaround Overlay

### Task 4: Write a failing test for SearchBar overlay removal

**Files:**
- Create: `src/features/map/components/SearchBar/__tests__/SearchBar.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/features/map/components/SearchBar/__tests__/SearchBar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import SearchBar from "../index";

// ── Store mock ─────────────────────────────────────────────────────────────────
let mockExploreModalLeaid: string | null = "1234567"; // simulate modal open

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      searchFilters: [],
      toggleLayerBubble: vi.fn(),
      selectedFiscalYear: "fy26",
      setSelectedFiscalYear: vi.fn(),
      compareMode: false,
      compareFyA: "fy25",
      compareFyB: "fy26",
      enterCompareMode: vi.fn(),
      exitCompareMode: vi.fn(),
      setCompareFyA: vi.fn(),
      setCompareFyB: vi.fn(),
      exploreModalLeaid: mockExploreModalLeaid,
      clearSearchFilters: vi.fn(),
    }),
}));

vi.mock("@/features/map/lib/geocode", () => ({
  searchLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/map/lib/ref", () => ({
  mapV2Ref: { current: null },
}));

// Stub all dropdown subcomponents (they have their own heavy deps)
vi.mock("../GeographyDropdown", () => ({ default: () => null }));
vi.mock("../FullmindDropdown", () => ({ default: () => null }));
vi.mock("../CompetitorsDropdown", () => ({ default: () => null }));
vi.mock("../FinanceDropdown", () => ({ default: () => null }));
vi.mock("../DemographicsDropdown", () => ({ default: () => null }));
vi.mock("../AcademicsDropdown", () => ({ default: () => null }));
vi.mock("../FilterPills", () => ({ default: () => null }));

describe("SearchBar — no dimming overlay when modal is open", () => {
  it("does not render a black/40 dimming overlay when exploreModalLeaid is set", () => {
    const { container } = render(<SearchBar />);
    // The removed overlay had class bg-black/40 and pointer-events-auto
    const overlay = container.querySelector(".bg-black\\/40");
    expect(overlay).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npx vitest run src/features/map/components/SearchBar/__tests__/SearchBar.test.tsx
```

Expected: **FAILS** because the overlay still exists in the current code.

---

### Task 5: Remove the overlay from SearchBar/index.tsx

**Files:**
- Modify: `src/features/map/components/SearchBar/index.tsx`

- [ ] **Step 1: Remove the dimming overlay block**

Find and delete this block (lines 122–125 approximately):

```tsx
      {/* Dimming overlay when explore modal is open */}
      {exploreModalLeaid && (
        <div className="absolute inset-0 z-30 bg-black/40 pointer-events-auto cursor-default" />
      )}
```

After removal the `return` block in `SearchBar` starts directly with `{/* Main bar */}`.

- [ ] **Step 2: Remove the `exploreModalLeaid` store subscription** (it's no longer needed in SearchBar)

Find in `SearchBar` function body (around line 117):

```tsx
  const exploreModalLeaid = useMapV2Store((s) => s.exploreModalLeaid);
```

Delete that line.

- [ ] **Step 3: Run the test — expect PASS**

```bash
npx vitest run src/features/map/components/SearchBar/__tests__/SearchBar.test.tsx
```

Expected: **PASS**.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchBar/__tests__/SearchBar.test.tsx
git add src/features/map/components/SearchBar/index.tsx
git commit -m "fix: remove redundant SearchBar dimming overlay (modal now uses portal)"
```

---

## Chunk 3: Responsive Modal Sizing

### Task 6: Write a failing test for responsive modal dimensions

**Files:**
- Create: `src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import DistrictExploreModal from "../DistrictExploreModal";

// ── Mock the data hook ────────────────────────────────────────────────────────
vi.mock("@/features/districts/lib/queries", () => ({
  useDistrictDetail: () => ({ data: null, isLoading: true }),
}));

vi.mock("@/lib/api", () => ({
  useTerritoryPlans: () => ({ data: [] }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("DistrictExploreModal — responsive sizing", () => {
  it("modal panel uses max-w-[1076px] instead of fixed w-[1076px]", () => {
    const { container } = render(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    // The modal panel div should NOT have fixed w-[1076px]
    const fixedWidth = container.querySelector(".w-\\[1076px\\]");
    expect(fixedWidth).toBeNull();

    // It SHOULD have max-w-[1076px]
    const maxWidth = container.querySelector(".max-w-\\[1076px\\]");
    expect(maxWidth).not.toBeNull();
  });

  it("modal panel uses max-h-[745px] instead of fixed h-[745px]", () => {
    const { container } = render(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    const fixedHeight = container.querySelector(".h-\\[745px\\]");
    expect(fixedHeight).toBeNull();

    const maxHeight = container.querySelector(".max-h-\\[745px\\]");
    expect(maxHeight).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx
```

Expected: both tests **FAIL** (fixed-size classes still present).

---

### Task 7: Apply responsive sizing in DistrictExploreModal.tsx

**Files:**
- Modify: `src/features/map/components/SearchResults/DistrictExploreModal.tsx`

- [ ] **Step 1: Update the modal panel classes**

Find the modal panel div around line 154:

```tsx
            <div
              ref={modalRef}
              className="bg-white rounded-2xl shadow-xl w-[1076px] h-[745px] flex overflow-hidden"
            >
```

Replace with:

```tsx
            <div
              ref={modalRef}
              className="bg-white rounded-2xl shadow-xl w-[calc(100vw-112px)] max-w-[1076px] h-[calc(100vh-80px)] max-h-[745px] flex overflow-hidden"
            >
```

- [ ] **Step 2: Run the test — expect PASS**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx
```

Expected: both tests **PASS**.

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all tests pass (no regressions from the three changes).

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchResults/__tests__/DistrictExploreModal.test.tsx
git add src/features/map/components/SearchResults/DistrictExploreModal.tsx
git commit -m "fix: make DistrictExploreModal responsive with calc-based dimensions"
```

---

## Chunk 4: Manual Verification + PR

### Task 8: Manual visual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3005` in a browser.

- [ ] **Step 2: Verify z-index fix**

1. Run a district search (apply any filter or zoom in on the map).
2. Click "Explore" on any district card.
3. Confirm the modal and its backdrop appear **above** the SearchBar and filter pills — not covered by them.
4. Confirm there is only **one** backdrop dim (no double-darkening over the search toolbar area).

- [ ] **Step 3: Verify responsive sizing**

1. With the modal open, drag the browser window narrower (down to ~900px width).
2. Confirm the modal shrinks with the window — the X button stays visible and accessible.
3. Drag the window shorter (down to ~700px height).
4. Confirm tab content scrolls inside the modal without the modal itself overflowing.

- [ ] **Step 4: Verify keyboard navigation**

1. Press Escape — modal closes.
2. Reopen the modal. Press left/right arrow keys — navigates to prev/next district.
3. Navigate to the first district — left arrow key is a no-op, Prev button is absent.
4. Navigate to the last district — right arrow key is a no-op, Next button is absent.

- [ ] **Step 5: Verify "Add to Plan" dropdown**

1. Click "Add to Plan" in the modal footer.
2. Confirm the plan dropdown opens and is accessible at both full-size and narrow window sizes.

---

### Task 9: Open a pull request

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/district-search-card/exploreQA
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create \
  --title "fix: DistrictExploreModal QA — portal rendering + responsive sizing" \
  --body "$(cat <<'EOF'
## Summary
- Wraps `<DistrictExploreModal>` in `createPortal(…, document.body)` so the modal's DOM node lives in the root stacking context, resolving the bug where `SearchBar` (z-20) painted over the modal (inside z-10 stacking context)
- Removes the now-redundant `exploreModalLeaid` dimming overlay workaround from `SearchBar`
- Replaces hardcoded `w-[1076px] h-[745px]` with `w-[calc(100vw-112px)] max-w-[1076px]` and `h-[calc(100vh-80px)] max-h-[745px]` so the modal scales with the viewport

## Test plan
- [ ] Modal renders above SearchBar at all viewport widths
- [ ] Single backdrop only (no double-dim over toolbar)
- [ ] Modal shrinks gracefully at ~900px width, X button always visible
- [ ] Tab content scrolls at ~700px height
- [ ] Keyboard: Escape closes, arrows navigate, boundary states are no-ops
- [ ] "Add to Plan" dropdown accessible at all sizes
- [ ] All unit tests pass (`npx vitest run`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
