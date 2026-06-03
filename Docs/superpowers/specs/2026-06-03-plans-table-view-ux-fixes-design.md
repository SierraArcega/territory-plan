# Plans Table-View UX Fixes — Design

**Date:** 2026-06-03
**Branch:** `fix/plans-table-view-ux` (off `main`)
**Scope:** Two independent UX bugs in the shared GridView ("Table View") used by Plans.

---

## Bug 1 — District notes editor is clipped (can't reach/save the note)

### Symptom
In the Plans Table View, clicking a NOTES cell ("+ Add note" or an existing note)
opens the note composer, but the composer is visually cut off at the column's
right edge and at the bottom of the grid. The user cannot see or reach the full
editor / save control.

### Root cause
`NotesPopover` (a 480px composer) is rendered by `DistrictNotesCell` as an
**`absolute`-positioned child inside the table's scroll container**:

- `GridView.tsx:590` → `<div className="flex-1 min-h-0 overflow-auto">` wraps the `<table>`.
- `DistrictNotesCell.tsx` renders the open popover as
  `<div className="absolute left-0 top-full mt-1 z-50">`.

An `overflow-auto` ancestor clips any absolutely-positioned descendant to its
visible box, so the popover is cropped to the table viewport. The save handler
is **not** at fault — `NoteComposer` captures the full text regardless of
display. This is purely a clipping bug.

The mobile path already escapes the clip via
`max-sm:fixed inset-x-0 bottom-0` (bottom-sheet). Only the desktop `absolute`
path is broken.

### Fix
Render the **desktop** popover through a **React portal** into `document.body`,
anchored to the trigger button, so it escapes the `overflow-auto` ancestor.

- `DistrictNotesCell` keeps a `ref` to the trigger button. When open, it measures
  `getBoundingClientRect()` and passes coordinates to `NotesPopover`.
- The portal-rendered popover is positioned `fixed` near the trigger, **flipping**
  vertical (above/below) and horizontal (right-aligned) placement when near the
  viewport edge so the 480px composer always fits on screen.
- Reposition on `scroll` (capture) and `resize` while open; close on the next
  meaningful scroll is **not** required — repositioning is enough and matches
  typical anchored-popover behavior.
- Existing outside-click + Escape close logic in `NotesPopover` is preserved
  (the outside-click listener already uses the popover's own ref, which still
  works from a portal).
- **Mobile bottom-sheet path is unchanged.** Detect viewport via the existing
  `max-sm:` breakpoint approach / `useIsMobile()` so mobile continues to use the
  fixed bottom-sheet and skips anchored positioning.

### Components touched
- `src/features/views/components/grid/cells/DistrictNotesCell.tsx` — add trigger
  ref, measure rect, render popover via `createPortal` with computed position.
- `src/features/views/components/notes/NotesPopover.tsx` — accept optional
  anchor/position props for the desktop portal placement; keep mobile classes.

### Testing
- Extend `DistrictNotesCell.test.tsx` / `NotesPopover.test.tsx`:
  - Popover renders outside the scroll container (into `document.body` / a portal),
    not as a DOM descendant of the trigger's `overflow` ancestor.
  - Open/close still works; outside-click and Escape still close it.
- Manual: open a NOTES cell in a horizontally/vertically scrolled grid and confirm
  the full composer + save are reachable; verify mobile bottom-sheet unaffected.

---

## Bug 2 — Copilot launcher blocks the pager (and can't be moved)

### Symptom
The Copilot launcher is a `fixed bottom-5 right-5 z-50` pill in the bottom-right
corner. It (and its `z-[51]` coachmark) sit on top of the GridView pager's
"next page" arrow / page selector and intercept the clicks. It cannot be moved
or made smaller.

### Root cause
`CopilotLauncher` (`src/features/copilot/components/CopilotLauncher.tsx`) is
viewport-fixed at the bottom-right with no awareness of, or clearance from, the
pager controls that live at the bottom-right of the table footer
(`GridPager.tsx`). Higher `z-index` means it wins the click.

### Fix — make the launcher collapsible + draggable
Rebuild `CopilotLauncher` into a small, self-contained draggable widget. Approved
behavior:

- **Resting state:** compact **44px sparkle icon** (not the full pill).
- **Hover (desktop, pointer: fine):** expands into the full "✨ Copilot" pill as
  an affordance. **Click/tap opens** the Copilot panel. On touch (no hover) it
  stays an icon; tap opens.
- **Draggable — free placement:** the icon stays exactly where it is dropped,
  **clamped fully on-screen**. Position is persisted to `localStorage` and
  restored on next visit.
- **Tap vs. drag:** a small pointer-movement threshold (~5px) distinguishes a
  tap (opens panel) from a drag (moves icon). Implemented with Pointer Events so
  it works for **both mouse and touch**.
- **Coachmark:** kept, shown once (existing `COACHMARK_KEY` localStorage flag),
  **anchored next to the icon's current position** so it never floats detached,
  dismissible via the existing X.
- **Default position:** bottom-right, **offset upward** to clear a standard
  pager footer out of the box (e.g. `right: 20px`, `bottom: ~76px`), so the
  "next page" control is clickable before the user ever drags. Users can then
  drag it anywhere; the dragged position persists.

### State & persistence
- Position state `{ x, y }` (or right/bottom offsets) held in the launcher and
  written to `localStorage` under a new key, e.g. `copilot:launcher-pos`.
- On mount: read persisted position; if none, use the default offset above.
- On window `resize`: re-clamp the stored position into the viewport so the icon
  never ends up off-screen.

### Components touched
- `src/features/copilot/components/CopilotLauncher.tsx` — full rewrite of the
  launcher: collapsed icon + hover-expand, pointer-based drag with threshold +
  clamping, persisted position, coachmark anchored to current position.
- (If drag/persist logic grows, extract a small `useDraggablePosition` hook in
  the same `copilot/` folder for testability — decided during implementation.)
- No change required to `CopilotPanel` / `AppShell` mounting unless the launcher's
  props change.

### Testing
- Extend `CopilotLauncher.test.tsx`:
  - Tap (pointerdown→pointerup with no movement) calls `onOpen`.
  - Drag (pointerdown→move beyond threshold→pointerup) does **not** call `onOpen`
    and updates/persists position; persisted value written to `localStorage`.
  - Position is clamped within viewport bounds.
  - Collapsed icon is the default rendered state; coachmark shows once and
    dismisses (existing behavior retained).
- Manual: drag on desktop (mouse) and on a touch device; confirm the pager's
  "next page" control is clickable in its default position and after moving the
  icon; reload and confirm position restored.

---

## Out of scope
- No backend / API / Prisma changes.
- No changes to Copilot panel contents, conversation logic, or nudges.
- No changes to GridView pagination logic (`GridPager` / `grid-pagination`).
- The "reserve space in the pager" alternative was considered and rejected in
  favor of the draggable launcher.

## Risks / notes
- Portal-rendered popover must not break the existing outside-click listener —
  verify the listener fires correctly for a portaled node (it uses the popover's
  own ref, so it should).
- Pointer-event drag must not interfere with the panel-open click; the movement
  threshold is the safeguard. Verify on iOS Safari (touch) per project mobile
  testing rules.
- Keep all colors/tokens within the Fullmind palette already used by these
  components (no Tailwind grays).
