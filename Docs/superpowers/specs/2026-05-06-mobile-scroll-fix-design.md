# Mobile Scroll Fix — Design Spec

**Date:** 2026-05-06
**Status:** Approved for implementation

## Problem

On iPhone (Chrome and Safari), navigating to any content tab — Low Hanging Fruit, Plans, Activities, and others — results in a page where scrolling is completely frozen in all directions.

### Root cause

`globals.css` sets `overflow: hidden` on both `html` and `body`. On iOS/WebKit, this prevents touch-scroll events from propagating to inner `overflow: auto` children, regardless of how deep they are in the tree. Every tab is affected because AppShell wraps all content.

A secondary issue: the AppShell root div uses `fixed inset-0`, which calculates height from `100vh`. On iOS, `100vh` includes the address bar height, so when the bar hides/shows on scroll the layout jumps.

---

## Solution

Three targeted changes. One PR, approved by Aston before merge.

### 1. `src/app/globals.css`

Replace `overflow: hidden` on `html, body` with `overscroll-behavior: none`. This prevents iOS overscroll bounce without blocking touch-scroll delivery to inner containers.

Add a global rule giving every `overflow-auto`/`overflow-scroll` element `-webkit-overflow-scrolling: touch` for legacy iOS 14 and Chrome-on-iOS edge cases.

**Before:**
```css
html,
body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
```

**After:**
```css
html,
body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overscroll-behavior: none;
}

/* iOS touch-scroll for all inner scroll containers */
[class*="overflow-auto"],
[class*="overflow-y-auto"],
[class*="overflow-scroll"],
[class*="overflow-y-scroll"] {
  -webkit-overflow-scrolling: touch;
}
```

### 2. `src/features/shared/components/layout/AppShell.tsx`

Two changes to the JSX:

- Root div: add `h-dvh` (dynamic viewport height — tracks visible viewport as address bar appears/disappears) and `overscroll-none` (Tailwind belt-and-suspenders on the fixed container)
- `<main>`: add `touch-pan-y` so iOS explicitly recognises vertical panning in the content area

**Before:**
```tsx
<div className="fixed inset-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
  ...
  <main className="flex-1 relative overflow-hidden">
```

**After:**
```tsx
<div className="fixed inset-0 h-dvh flex flex-col bg-[#FFFCFA] overflow-hidden overscroll-none">
  ...
  <main className="flex-1 relative overflow-hidden touch-pan-y">
```

### 3. `CLAUDE.md` — Mobile Testing section

Add after the existing **UX Defaults** section:

```markdown
### Mobile Testing
This app is used on iPhone (Safari and Chrome). Any view with a scrollable
inner container must be verified on mobile before shipping.

- **Never set `overflow: hidden` on `html`/`body`** — on iOS/WebKit this blocks
  touch-scroll delivery to all inner containers. Use `overscroll-behavior: none`
  instead, which prevents bounce without the side-effect.
- **Use `touch-action: pan-y`** on `<main>` or any wrapper that contains
  scrollable children.
- **Add `-webkit-overflow-scrolling: touch`** to inner scroll containers for
  legacy iOS 14 / Chrome-on-iOS coverage.
- **Test scroll on iPhone before marking a view complete** — use Safari
  Responsive Design Mode (Develop → Enter Responsive Design Mode) locally, then
  verify on a real device before approving a PR.
- **Local device testing options:**
  - Same WiFi: `ipconfig getifaddr en0` → open `http://<mac-ip>:3005` on iPhone
  - ngrok: `ngrok http 3005` → open the tunnel URL on iPhone (clean up `.env.local` after)
- **Smoke-test the map tab** after any AppShell layout change — MapLibre touch
  gestures share the same event system.
```

---

## Smoke Tests (pre-PR-approval)

Run on actual iPhone (Safari or Chrome) using local IP or ngrok:

| Surface | What to verify |
|---|---|
| Map tab | Pan, zoom, pinch-zoom all work |
| Plans tab | List scrolls vertically |
| Activities tab | List scrolls vertically |
| Low Hanging Fruit | Vertical scroll + horizontal table scroll both work |
| Any tab | Scroll down to hide address bar — layout does not jump |

---

## Out of Scope

- Per-view scroll container restructuring (not needed; the global fix covers all tabs)
- `100dvh` fallback for browsers that don't support `dvh` (all modern iOS/Android support it; desktop fallback via `fixed inset-0` is unchanged)
- Map tab scrolling internals (MapLibre manages its own touch handling)
