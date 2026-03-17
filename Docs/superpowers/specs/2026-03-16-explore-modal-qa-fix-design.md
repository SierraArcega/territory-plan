# DistrictExploreModal QA Fix — Design Spec

**Date:** 2026-03-16
**Branch:** `feature/district-search-card/exploreQA`
**Files touched:**
- `src/features/map/components/SearchResults/index.tsx`
- `src/features/map/components/SearchResults/DistrictExploreModal.tsx`
- `src/features/map/components/SearchBar/index.tsx`

---

## Problem

Two bugs cause the `DistrictExploreModal` to become unreadable or inaccessible depending on window size.

### Bug 1 — SearchBar covers the modal

`DistrictExploreModal` uses `fixed z-40` (backdrop) and `fixed z-50` (content). These fixed elements are rendered as descendants of `SearchResults` (`absolute z-10`). The exact stacking context trap mechanism may involve an ancestor with `transform`, `filter`, or `will-change` creating an implicit stacking context that traps fixed descendants — but regardless of mechanism, the observable result is that the `SearchBar` (`relative z-20`) paints above the modal.

As a manual workaround, `SearchBar` already renders its own dimming overlay when the modal is open:

```tsx
{exploreModalLeaid && (
  <div className="absolute inset-0 z-30 bg-black/40 pointer-events-auto cursor-default" />
)}
```

This overlay is now a known artifact of the bug.

### Bug 2 — Fixed pixel dimensions overflow on small windows

The modal is hardcoded at `w-[1076px] h-[745px]`. On viewports narrower than ~1160px or shorter than ~825px, the modal extends beyond the visible area. The close (X) button and tab content become unreachable.

---

## Solution

### Fix 1 — React Portal + remove SearchBar workaround overlay

**In `SearchResults/index.tsx`:** Wrap the `<DistrictExploreModal>` render in `createPortal(…, document.body)`.

Portal rendering moves the modal's DOM node to `document.body`, placing it in the root stacking context. `fixed z-50` there is unambiguous. All navigation state (`canGoPrev`, `canGoNext`, `handleExplorePrev`, `handleExploreNext`) and the `exploreModalLeaid` store binding stay in `SearchResults`. Only the render location moves.

```tsx
// SearchResults/index.tsx
import { createPortal } from "react-dom";

// Replace:
{exploreModalLeaid && (
  <DistrictExploreModal ... />
)}

// With:
{exploreModalLeaid && createPortal(
  <DistrictExploreModal ... />,
  document.body
)}
```

`SearchResults` already has `"use client"` so `document.body` is safe.

**In `SearchBar/index.tsx`:** Remove the dimming overlay workaround entirely. The modal supplies its own `fixed inset-0 z-40 bg-black/40` backdrop. Leaving the SearchBar overlay would produce a double backdrop and block pointer events over the toolbar unnecessarily.

```tsx
// Remove this block from SearchBar/index.tsx:
{exploreModalLeaid && (
  <div className="absolute inset-0 z-30 bg-black/40 pointer-events-auto cursor-default" />
)}
```

### Fix 2 — Responsive modal sizing (DistrictExploreModal.tsx)

Replace hardcoded pixel dimensions with viewport-relative values that cap at the current sizes.

| Property | Before | After |
|---|---|---|
| Width | `w-[1076px]` | `w-[calc(100vw-112px)] max-w-[1076px]` |
| Height | `h-[745px]` | `h-[calc(100vh-80px)] max-h-[745px]` |

**Budget rationale:**
- **112px horizontal:** Two nav arrow buttons (40px each = 80px) + `gap-3` (12px) between each of the three flex siblings = 24px gaps + ~8px safety margin = 112px.
- **80px vertical:** "Return to Map" button row (~36px) + position counter row (~28px) + gaps = ~80px.

The tab body (`flex-1 overflow-y-auto`) already scrolls — content adjusts automatically as the modal shrinks.

**Known risk:** The "Add to Plan" dropdown in the modal footer uses `absolute bottom-full` and the modal root is `overflow-hidden`. On short viewports the dropdown may clip. This pre-exists the fix but should be explicitly verified during testing.

---

## Scope

### In scope
- Portal wrapping in `SearchResults/index.tsx`
- Remove `SearchBar` dimming overlay workaround from `SearchBar/index.tsx`
- Width/height class changes in `DistrictExploreModal.tsx`

### Out of scope
- Modal tab content, sidebar data, or footer action changes
- Store changes
- API changes
- Navigation logic (stays in `SearchResults`)
- Keyboard handling (stays in `DistrictExploreModal`)

---

## Testing

1. Open the map and run a search to populate the results panel.
2. Click "Explore" on a district card to open the modal.
3. Verify the modal renders above the SearchBar and filter pills.
4. Verify there is only **one** backdrop (no double-dim over the SearchBar area).
5. Resize the window to ~900px wide — confirm the modal scales down, stays on screen, and the X button remains visible.
6. Resize the window to ~700px tall — confirm tab content scrolls within the modal.
7. Verify Escape key closes the modal; left/right arrow keys navigate districts.
8. Verify first district in list: left arrow key is a no-op and Prev arrow button is hidden.
9. Verify last district in list: right arrow key is a no-op and Next arrow button is hidden.
10. Verify "Add to Plan" dropdown opens correctly and is accessible on both full-size and small windows.
