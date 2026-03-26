# Plan Detail Modal Close UX Cleanup

**Date:** 2026-03-25
**Scope:** `PlanDetailModal.tsx` only

## Problem

1. The X close button (`absolute top-2 right-2`) sits inside the modal card and overlaps the Vacancies tab
2. Clicking outside the modal doesn't close it — the `z-50` full-screen flex wrapper intercepts clicks before they reach the `z-40` backdrop

## Design

### 1. Relocate X button outside the modal card

- Remove the close button from inside the modal container (currently lines 86-94)
- Place it in the center column, in a top row alongside "Return to Map"
- The top row becomes `flex items-center justify-between` so "Return to Map" is left-aligned and the X button is right-aligned
- X button gets the same floating pill styling as "Return to Map": `bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60`

### 2. Fix click-outside-to-close

- Add `onClick={onClose}` to the `z-50` full-screen flex wrapper (line 55)
- Add `onClick={e => e.stopPropagation()}` to the inner content container (the flex row with arrows + modal card) so clicks inside the modal don't bubble up and trigger close
- The existing `z-40` backdrop `onClick={onClose}` can remain as a fallback but is no longer the primary close mechanism

### 3. No other changes

- Escape key handler unchanged
- Prev/next navigation unchanged
- Tab strip, sidebar, content area unchanged
- No new components or files
