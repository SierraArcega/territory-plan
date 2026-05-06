# LHF Summary Banner — Collapsible Design Spec

**Date:** 2026-05-06
**Status:** Approved for implementation

## Problem

The summary banner on the Low Hanging Fruit page is always expanded. On mobile/narrow viewports it takes up the majority of visible vertical space before the user reaches the filter bar and table, making the page feel cramped and hard to use.

## Solution

Add a collapse/expand toggle to the summary banner. One file touched, no architecture changes.

### Behaviour

- On first load (or if sessionStorage key is absent): banner is **expanded**
- A chevron-up button in the top-right corner of the banner collapses it
- **Collapsed state:** the full banner body is hidden; a slim 28px row replaces it showing "Instructions" label on the left and chevron-down on the right
- Clicking the collapsed row (or its chevron) re-expands the banner
- State is persisted to `sessionStorage` under the key `"lhf-banner-collapsed"` so it survives navigation within the session but resets on the next visit

### Implementation

**File:** `src/features/leaderboard/components/LowHangingFruitView.tsx`

Add state near the top of the component:
```tsx
const [bannerCollapsed, setBannerCollapsed] = useState(() =>
  typeof window !== "undefined" &&
  sessionStorage.getItem("lhf-banner-collapsed") === "true"
);

const toggleBanner = () => {
  setBannerCollapsed((prev) => {
    const next = !prev;
    sessionStorage.setItem("lhf-banner-collapsed", String(next));
    return next;
  });
};
```

Replace the existing summary banner `<div>` with:

```tsx
{/* Summary banner */}
{bannerCollapsed ? (
  <button
    onClick={toggleBanner}
    className="flex-shrink-0 flex items-center justify-between px-5 py-2 bg-[#F7F5FA] border-b border-[#E2DEEC] w-full text-left"
    aria-expanded={false}
    aria-label="Show instructions"
  >
    <span className="text-[11px] font-semibold text-[#6E6390]">Instructions</span>
    <ChevronDown className="w-3.5 h-3.5 text-[#8A80A8]" />
  </button>
) : (
  <div className="flex-shrink-0 px-5 py-3.5 bg-[#F7F5FA] border-b border-[#E2DEEC]">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        {/* existing banner content — unchanged */}
      </div>
      <button
        onClick={toggleBanner}
        className="flex-shrink-0 text-[#8A80A8] hover:text-[#403770] mt-0.5"
        aria-expanded={true}
        aria-label="Hide instructions"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
)}
```

`ChevronDown` is already imported. Add `ChevronUp` from `lucide-react`.

### Out of Scope

- Persisting collapse state across sessions (localStorage) — sessionStorage is sufficient
- Collapsing the banner on other pages
- Any changes to the banner content itself
- Any changes to the sidebar, Revenue Rank widget, or AppShell
