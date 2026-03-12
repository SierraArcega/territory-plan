# Loading / Skeletons

Skeleton cards and inline spinners provide placeholder UI during data-fetch states, keeping layout stable and communicating progress without jarring blank regions.

See _foundations.md for transition timing (`animate-pulse`).

---

## Skeleton Cards

Skeleton cards mirror the layout of the component they replace, preserving visual weight and grid structure while data loads.

**Skeleton bar classes:** `bg-[#EFEDF5] rounded animate-pulse`

### Bar Sizes

| Simulates | Height | Width |
|-----------|--------|-------|
| Label text | `h-2.5` | `50–60%` |
| Value / heading | `h-5` | `30–40%` |
| Subtitle / secondary | `h-2` | `65–80%` |

### Card Shell

Use the same container as the loaded component:

```
bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4
```

Space bars with `gap-2.5` inside a flex column.

**Grid:** Match the loaded component's column count. For a 3-card KPI row, render 3 skeleton cards.

### TSX Example — 3-Card KPI Skeleton Grid

```tsx
function KPISkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 flex flex-col gap-2.5"
        >
          {/* Label text */}
          <div className="h-2.5 w-[55%] bg-[#EFEDF5] rounded animate-pulse" />
          {/* Value / heading */}
          <div className="h-5 w-[35%] bg-[#EFEDF5] rounded animate-pulse" />
          {/* Subtitle / secondary */}
          <div className="h-2 w-[70%] bg-[#EFEDF5] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
```

---

## Inline Spinner

Used for button loading states and inline refresh indicators where a full skeleton would be disproportionate.

**Classes:** `w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin`

`border-current` inherits the parent element's text color, so the spinner automatically adapts to primary, destructive, and ghost button variants without additional color overrides.

### TSX Example

```tsx
function SaveButton({ isLoading }: { isLoading: boolean }) {
  return (
    <button
      disabled={isLoading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#6E59A5] text-white text-sm font-medium disabled:opacity-60"
    >
      {isLoading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {isLoading ? "Saving…" : "Save"}
    </button>
  );
}
```

---

## Migration Notes

- `LeadingIndicatorsPanel` and `ExploreKPICards` skeleton patterns should use `bg-[#EFEDF5]` instead of Tailwind `gray-*` classes (e.g., `bg-gray-200`, `bg-gray-100`) for skeleton bar fills to stay consistent with the brand-neutral palette.

---

## Codebase Examples

| Component | Type | File |
|-----------|------|------|
| KPI skeleton grid | Skeleton Cards | `src/features/map/components/explore/ExploreKPICards.tsx` |
| Activity panel skeleton | Skeleton Cards | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Button spinner | Inline Spinner | (shared pattern, see `Navigation/buttons.md`) |
