# Pagination

Page controls for data collections.

> **Canonical source** — table documentation references this file for pagination specs.

See `_foundations.md` for focus ring and disabled state.

---

## Layout

```
flex items-center justify-between
```

Full width matching parent container. Separated from content above by `mt-3`.

## Result Summary (Left)

```
text-xs text-[#8A80A8]
```

| Context | Format |
|---|---|
| Normal | "Showing 1-25 of 142" |
| Filtered | "Showing 1-25 of 42 (142 total)" |

## Page Controls (Right)

| Element | Classes |
|---|---|
| Container | `flex items-center gap-1` |
| Prev/Next arrows | `w-8 h-8 rounded-lg` with chevron `w-4 h-4` |
| Page numbers | `w-8 h-8 rounded-lg text-sm font-medium` |
| Inactive page | `text-[#6E6390] hover:bg-[#EFEDF5]` |
| Active page | `bg-[#403770] text-white` |
| Disabled | `text-[#A69DC0] cursor-not-allowed opacity-50` |
| Ellipsis | `text-[#A69DC0]`, shown when page count > 7 |

## Code Example

```tsx
<div className="flex items-center justify-between mt-3">
  {/* Result summary */}
  <span className="text-xs text-[#8A80A8]">
    Showing 1-25 of 142
  </span>

  {/* Page controls */}
  <div className="flex items-center gap-1">
    {/* Prev */}
    <button
      disabled={page === 1}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E6390] hover:bg-[#EFEDF5] disabled:text-[#A69DC0] disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    {/* Page numbers */}
    <button className="w-8 h-8 rounded-lg text-sm font-medium bg-[#403770] text-white">
      1
    </button>
    <button className="w-8 h-8 rounded-lg text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
      2
    </button>
    <button className="w-8 h-8 rounded-lg text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
      3
    </button>
    <span className="w-8 h-8 flex items-center justify-center text-[#A69DC0]">...</span>
    <button className="w-8 h-8 rounded-lg text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
      6
    </button>

    {/* Next */}
    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E6390] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
</div>
```

## Items Per Page Selector

```
border border-[#D4CFE2] rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E6390]
```

- **Options:** 10, 25, 50, 100
- **Position:** Right-aligned, before page number buttons, `mr-4`

## Keyboard

- Arrow keys move between page buttons
- `Enter` selects a page
- `Tab` moves between the per-page selector and page controls

## Codebase Examples

| Component | File |
|---|---|
| ExploreTable | `src/features/map/components/explore/ExploreTable.tsx` |
