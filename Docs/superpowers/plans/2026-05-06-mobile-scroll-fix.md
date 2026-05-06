# Mobile Scroll Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix iOS/WebKit touch-scroll being completely frozen on all content tabs (Plans, Activities, Low Hanging Fruit, etc.) by replacing the body `overflow: hidden` pattern with `overscroll-behavior: none`, and modernise the AppShell root to use dynamic viewport height.

**Architecture:** Three targeted changes — `globals.css` (root cause fix + legacy iOS rule), `AppShell.tsx` (dvh height + touch-action hint), `CLAUDE.md` (mobile testing guidance so this class of bug doesn't recur). No per-view changes needed; the global fix covers all tabs.

**Tech Stack:** Tailwind CSS 4, Next.js 16 App Router, React 19. No new dependencies.

---

### Task 1: Create isolated worktree

**Files:**
- No file edits — workspace setup only

- [ ] **Step 1: Create the worktree**

From the main repo directory run:
```bash
git worktree add ../territory-plan-mobile-scroll-fix -b fix/mobile-scroll
```

- [ ] **Step 2: Confirm worktree is clean**

```bash
cd ../territory-plan-mobile-scroll-fix && git status
```
Expected: `On branch fix/mobile-scroll — nothing to commit, working tree clean`

---

### Task 2: Fix `globals.css` — root cause

**Files:**
- Modify: `src/app/globals.css:39-46`

The `overflow: hidden` on `html, body` is the root cause. On iOS/WebKit it prevents touch-scroll events from reaching any inner `overflow: auto` container, freezing all tabs. Replace it with `overscroll-behavior: none` (prevents bounce/overscroll without blocking child scroll) and add a global `-webkit-overflow-scrolling: touch` rule for legacy iOS 14 / Chrome-on-iOS coverage.

- [ ] **Step 1: Open `src/app/globals.css` and find the `html, body` block (lines 39–46)**

It currently reads:
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

- [ ] **Step 2: Replace that block with the following**

```css
html,
body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overscroll-behavior: none;
}

[class*="overflow-auto"],
[class*="overflow-y-auto"],
[class*="overflow-scroll"],
[class*="overflow-y-scroll"] {
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 3: Run the test suite to check for regressions**

```bash
npm test -- --run
```
Expected: all existing tests pass. These tests run in jsdom and don't test CSS scrolling — they verify no JS logic was accidentally broken.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(mobile): replace overflow:hidden on body with overscroll-behavior:none"
```

---

### Task 3: Update `AppShell.tsx` — dvh height + touch-action

**Files:**
- Modify: `src/features/shared/components/layout/AppShell.tsx:47,63`

Two changes:
1. Add `h-dvh` to the root div — switches from static `100vh` (which includes iOS address bar, causing layout jump when bar hides) to dynamic viewport height that tracks the actual visible area.
2. Add `overscroll-none` to the root div — belt-and-suspenders on the fixed container itself.
3. Add `touch-pan-y` to `<main>` — explicitly tells iOS that vertical panning is valid in the content area.

- [ ] **Step 1: Open `src/features/shared/components/layout/AppShell.tsx`**

Find the return statement. The root div currently reads:
```tsx
<div className="fixed inset-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
```

And `<main>` currently reads:
```tsx
<main className="flex-1 relative overflow-hidden">
```

- [ ] **Step 2: Update the root div — add `h-dvh overscroll-none`**

```tsx
<div className="fixed inset-0 h-dvh flex flex-col bg-[#FFFCFA] overflow-hidden overscroll-none">
```

- [ ] **Step 3: Update `<main>` — add `touch-pan-y`**

```tsx
<main className="flex-1 relative overflow-hidden touch-pan-y">
```

- [ ] **Step 4: Run the test suite**

```bash
npm test -- --run
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/components/layout/AppShell.tsx
git commit -m "fix(mobile): use h-dvh and touch-pan-y in AppShell for iOS scroll"
```

---

### Task 4: Update `CLAUDE.md` — Mobile Testing section

**Files:**
- Modify: `CLAUDE.md` (after the `### UX Defaults` section)

- [ ] **Step 1: Open `CLAUDE.md` and find the `### UX Defaults` section**

Locate the end of the UX Defaults block (it ends before `### Testing`).

- [ ] **Step 2: Insert the following new section between `### UX Defaults` and `### Testing`**

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
  legacy iOS 14 / Chrome-on-iOS coverage (handled globally in `globals.css`).
- **Test scroll on iPhone before marking a view complete** — use Safari
  Responsive Design Mode locally (Develop → Enter Responsive Design Mode),
  then verify on a real device before approving a PR.
- **Local device testing — two options (same WiFi required for both):**
  - `.local` hostname (permanent): `http://A-Arcega.local:3005` — requires
    one-time Supabase redirect URL whitelist (`http://A-Arcega.local:3005/**`)
    and `NEXT_PUBLIC_SITE_URL=http://A-Arcega.local:3005` in `.env.local`
  - Local IP (per-session): `ipconfig getifaddr en0` → `http://<ip>:3005`
    (auth redirects will fail; use only for pre-login visual checks)
- **Smoke-test the map tab** after any AppShell layout change — MapLibre touch
  gestures share the same event system.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add mobile testing guidance to CLAUDE.md"
```

---

### Task 5: Manual smoke test — Safari Responsive Design Mode

No code changes. Verify the fix works before opening the PR.

- [ ] **Step 1: Start the dev server on the worktree**

```bash
npm run dev
```
Expected: server starts on port 3005.

- [ ] **Step 2: Open Safari on Mac, enable Responsive Design Mode**

Safari menu → Develop → Enter Responsive Design Mode (if Develop menu is not visible: Safari → Settings → Advanced → Show Develop menu).

Select an iPhone model preset (e.g. iPhone 15 Pro).

- [ ] **Step 3: Navigate to `http://localhost:3005`**

Log in if needed.

- [ ] **Step 4: Run through the smoke test checklist**

| Surface | Action | Expected |
|---|---|---|
| Plans tab | Swipe vertically | List scrolls |
| Activities tab | Swipe vertically | List scrolls |
| Low Hanging Fruit | Swipe vertically | Rows scroll |
| Low Hanging Fruit | Swipe horizontally on table | Table scrolls horizontally |
| Map tab | Pan and pinch | Map moves and zooms |
| Any tab | Scroll down to hide address bar | Layout does not jump |

- [ ] **Step 5: If any check fails, stop and debug before continuing**

The most likely remaining issue if scroll still doesn't work: a specific view has its own `overflow: hidden` container without a downstream scroll target. Inspect the failing view's DOM in Safari DevTools (Elements panel) and look for the innermost `overflow: hidden` element — it likely needs `overflow: auto` or a `touch-action: pan-y` addition.

---

### Task 6: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin fix/mobile-scroll
```

- [ ] **Step 2: Open a PR via GitHub CLI**

```bash
gh pr create \
  --title "fix(mobile): restore touch-scroll across all tabs on iOS" \
  --body "$(cat <<'EOF'
## Problem
On iPhone (Chrome and Safari), all content tabs — Plans, Activities, Low Hanging Fruit — were completely frozen. No vertical or horizontal scrolling worked in any direction.

## Root cause
`globals.css` set `overflow: hidden` on both `html` and `body`. On iOS/WebKit this prevents touch-scroll events from propagating to inner `overflow: auto` children, regardless of nesting depth.

## Changes
- **`globals.css`**: Replace `overflow: hidden` on `html, body` with `overscroll-behavior: none`. Add global `-webkit-overflow-scrolling: touch` rule for legacy iOS 14 / Chrome-on-iOS.
- **`AppShell.tsx`**: Add `h-dvh` (dynamic viewport height — fixes address-bar layout jump), `overscroll-none`, and `touch-pan-y` on `<main>`.
- **`CLAUDE.md`**: Add Mobile Testing section so this class of bug doesn't recur.

## Smoke test checklist
- [ ] Plans tab — vertical scroll works on iPhone
- [ ] Activities tab — vertical scroll works on iPhone
- [ ] Low Hanging Fruit — vertical + horizontal table scroll works on iPhone
- [ ] Map tab — pan and pinch-zoom still work
- [ ] Address bar hide/show — no layout jump

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Share the PR link with Aston for review and approval before merge**
