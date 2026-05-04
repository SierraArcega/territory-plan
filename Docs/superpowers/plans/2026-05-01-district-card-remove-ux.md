# District Card Remove UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unintuitive "click card to deselect" pattern with an explicit ✕ button, and make the card body + Explore button both open the district explore view.

**Architecture:** Single file change to `DistrictSearchCard.tsx`. Card wrapper `onClick` switches from `onToggleSelect` to `onExplore`. A new absolutely-positioned ✕ button (Lucide `X` icon) handles deselection with `stopPropagation`. No prop changes needed — both `onToggleSelect` and `onExplore` already exist.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Lucide React, Vitest + Testing Library

---

### Task 1: Write failing tests for DistrictSearchCard click behavior

**Files:**
- Create: `src/features/map/components/SearchResults/__tests__/DistrictSearchCard.test.tsx`

- [ ] **Step 1: Write the failing test file**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import DistrictSearchCard from "../DistrictSearchCard";

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (selector: (s: { setHoveredLeaid: () => void }) => unknown) =>
    selector({ setHoveredLeaid: vi.fn() }),
}));

vi.mock("@/features/shared/lib/financial-helpers", () => ({
  getFinancial: () => null,
}));

const district = {
  leaid: "0123456",
  name: "Union County Schools",
  stateAbbrev: "NC",
  countyName: "Union County",
  enrollment: 41497,
  isCustomer: false,
  accountType: "PROSPECT",
  ownerUser: null,
  ellPct: null,
  swdPct: null,
  childrenPovertyPercent: null,
  medianHouseholdIncome: null,
  expenditurePerPupil: 10600,
  urbanCentricLocale: null,
  districtFinancials: [],
  territoryPlans: [],
};

describe("DistrictSearchCard", () => {
  let onToggleSelect: ReturnType<typeof vi.fn>;
  let onExplore: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggleSelect = vi.fn();
    onExplore = vi.fn();
  });

  it("clicking the card body calls onExplore, not onToggleSelect", () => {
    const { container } = render(
      <DistrictSearchCard
        district={district}
        isSelected={false}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onExplore).toHaveBeenCalledWith("0123456");
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it("clicking the ✕ button calls onToggleSelect, not onExplore", () => {
    const { getByTitle } = render(
      <DistrictSearchCard
        district={district}
        isSelected={true}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    fireEvent.click(getByTitle("Remove"));
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    expect(onExplore).not.toHaveBeenCalled();
  });

  it("clicking the Explore button calls onExplore, not onToggleSelect", () => {
    const { getByRole } = render(
      <DistrictSearchCard
        district={district}
        isSelected={false}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    fireEvent.click(getByRole("button", { name: /explore/i }));
    expect(onExplore).toHaveBeenCalledWith("0123456");
    expect(onToggleSelect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- DistrictSearchCard.test
```

Expected: 3 failing tests. The first will fail because card click currently calls `onToggleSelect`. The second will fail because the ✕ button doesn't exist yet. The third should already pass (Explore button already calls `onExplore`).

---

### Task 2: Implement the card changes

**Files:**
- Modify: `src/features/map/components/SearchResults/DistrictSearchCard.tsx`

- [ ] **Step 1: Add Lucide X import and update card wrapper onClick**

Open `src/features/map/components/SearchResults/DistrictSearchCard.tsx`.

Add `X` to the import at the top of the file (Lucide icons come from `lucide-react`):

```tsx
import { X } from "lucide-react";
```

Change the `handleClick` function (lines 43–45) to open explore instead of toggling selection:

```tsx
const handleClick = () => {
  onExplore(district.leaid);
};
```

- [ ] **Step 2: Add the ✕ remove button and pad the content div**

Replace the inner `<div>` on line 59 (the one that wraps all card content) so it has right padding, and add the ✕ button as the first child of the card wrapper (before that inner div).

The card wrapper currently looks like:

```tsx
<div
  className={`group relative px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${...}`}
  onClick={handleClick}
  onMouseEnter={() => setHoveredLeaid(district.leaid)}
  onMouseLeave={() => setHoveredLeaid(null)}
>
  <div>
    {/* Header: Name + Badge */}
```

Change it to:

```tsx
<div
  className={`group relative px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
    isSelected ? "bg-[#e8f1f5] border-[#6EA3BE]/30 ring-1 ring-[#6EA3BE]/20" : "border-[#E2DEEC] hover:bg-[#EFEDF5] hover:border-[#D4CFE2]"
  }`}
  onClick={handleClick}
  onMouseEnter={() => setHoveredLeaid(district.leaid)}
  onMouseLeave={() => setHoveredLeaid(null)}
>
  <button
    onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
    className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full flex items-center justify-center text-plum/50 bg-plum/10 hover:bg-red-100 hover:text-red-500 transition-colors"
    title="Remove"
  >
    <X size={10} strokeWidth={2.5} />
  </button>
  <div className="pr-6">
    {/* Header: Name + Badge */}
```

The only changes inside the content `<div>` are: it gains `className="pr-6"`. Everything else inside stays identical.

- [ ] **Step 3: Run tests to confirm they pass**

```bash
npm test -- DistrictSearchCard.test
```

Expected: all 3 tests pass.

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
npm test
```

Expected: all tests pass. No existing SearchResults tests should break since `onToggleSelect` and `onExplore` props are unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchResults/DistrictSearchCard.tsx \
        src/features/map/components/SearchResults/__tests__/DistrictSearchCard.test.tsx
git commit -m "feat: replace card-click-to-deselect with explicit X remove button"
```

---

### Task 3: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open http://localhost:3005 in a browser.

- [ ] **Step 2: Verify the new behavior**

1. Search for districts and select 2–3 of them (click the cards to select).

   Wait — with this change, clicking a card now opens Explore instead of selecting. **Selection is toggled via the map** (clicking a district polygon) or the checkbox in `SelectionListPanel`. Confirm that the map click still selects districts correctly.

2. With districts selected, open the search results panel. Confirm:
   - Each selected card shows a small ✕ in its top-right corner
   - Hovering the ✕ turns it red
   - Clicking the ✕ removes the district from the selection without opening Explore
   - Clicking anywhere else on the card (body, name, metrics, plan pills) opens the Explore modal
   - Clicking the "Explore" button also opens the Explore modal

3. Confirm no layout issues: district name and County line don't overlap the ✕ button even on narrow cards.
