# Plans Table-View UX Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two Plans Table-View UX bugs — the district notes editor being clipped by the grid's scroll container, and the Copilot launcher permanently covering the pager — by reusing the existing `AnchoredPopover` and rebuilding the launcher as a collapsible, draggable icon.

**Architecture:** Fix 1 routes the desktop `NotesPopover` through the grid's existing `AnchoredPopover` (body portal + anchor + flip + dismiss) and the shared `Portal` on mobile, escaping the `overflow-auto` clip. Fix 2 rewrites `CopilotLauncher` into a 44px sparkle icon that hover-expands to the pill, opens on tap, and free-drags via Pointer Events with on-screen clamping and `localStorage` persistence; clamping/defaults live in a pure, unit-tested helper module.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vitest + Testing Library (jsdom). Pointer Events for drag (mouse + touch).

---

## File Structure

- **Modify** `src/features/views/components/grid/cells/DistrictNotesCell.tsx` — render the popover via `AnchoredPopover` (desktop) / `Portal` (mobile).
- **Modify** `src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx` — add a portal assertion.
- **No change** `src/features/views/components/notes/NotesPopover.tsx` — reused as-is.
- **Create** `src/features/copilot/lib/launcher-position.ts` — pure position helpers (clamp, default, persistence read).
- **Create** `src/features/copilot/lib/__tests__/launcher-position.test.ts` — unit tests for the helpers.
- **Modify** `src/features/copilot/components/CopilotLauncher.tsx` — collapsible + draggable rewrite.
- **Modify** `src/features/copilot/components/__tests__/CopilotLauncher.test.tsx` — tap/drag/persist/coachmark tests.

Reused existing code (do **not** recreate): `AnchoredPopover` (`grid/AnchoredPopover.tsx`), `Portal` (`shared/lib/portal.tsx`), `useIsMobile` (`shared/hooks/useIsMobile.ts`).

All commands run from the worktree root: `/Users/astonfurious/The Laboratory/territory-plan/.worktrees/fix-plans-table-view-ux`.

---

## Task 1: Notes popover escapes the grid scroll container

**Files:**
- Modify: `src/features/views/components/grid/cells/DistrictNotesCell.tsx`
- Test: `src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx`

- [ ] **Step 1: Add a failing test asserting the popover is portaled out of the cell subtree**

In `DistrictNotesCell.test.tsx`, add this test inside the existing `describe("DistrictNotesCell", …)` block (the file's TipTap + `useProfile` mocks already cover the embedded composer):

```tsx
  it("renders the open popover outside the cell's own subtree (portaled)", () => {
    const { container } = wrap(
      <DistrictNotesCell leaid="3601234" districtName="Lincoln" latest="hi" count={1} latestType={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notes/i }));
    const dialog = screen.getByRole("dialog");
    // The popover must NOT live inside the cell's render container — otherwise the
    // grid's `overflow-auto` ancestor clips it. AnchoredPopover portals it to <body>.
    expect(container.contains(dialog)).toBe(false);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx`
Expected: the new test FAILS — currently the popover renders in an `absolute` div inside the cell, so `container.contains(dialog)` is `true`.

- [ ] **Step 3: Rewrite `DistrictNotesCell.tsx` to use `AnchoredPopover` (desktop) / `Portal` (mobile)**

Replace the entire file with:

```tsx
"use client";
import { useRef, useState } from "react";
import { AnchoredPopover } from "../AnchoredPopover";
import { Portal } from "@/features/shared/lib/portal";
import { useIsMobile } from "@/features/shared/hooks/useIsMobile";
import { NotesPopover } from "../../notes/NotesPopover";
import { noteTypeMeta } from "../../../lib/note-types";

interface Props {
  leaid: string;
  districtName: string;
  latest: string | null;
  count: number;
  latestType: string | null;
}

export function DistrictNotesCell({ leaid, districtName, latest, count, latestType }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const popover = (
    <NotesPopover leaid={leaid} districtName={districtName} onClose={() => setOpen(false)} />
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label={`Notes${count ? ` (${count})` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 max-w-[260px] text-left rounded focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {latest ? (
          <>
            <span className="text-sm text-[#544A78] truncate whitespace-nowrap">{latest}</span>
            <span className={`flex-shrink-0 text-[11px] font-bold px-[7px] rounded-full ${latestType ? noteTypeMeta(latestType).pill : "bg-[#EFEBF7] text-[#6F4C8C]"}`}>{count}</span>
          </>
        ) : (
          <span className="text-sm text-[#A69DC0] whitespace-nowrap">+ Add note</span>
        )}
      </button>

      {isMobile
        ? open && <Portal>{popover}</Portal>
        : (
          <AnchoredPopover anchorRef={btnRef} open={open} onDismiss={() => setOpen(false)} align="left">
            {popover}
          </AnchoredPopover>
        )}
    </div>
  );
}
```

Notes for the implementer:
- `useIsMobile()` reads the 639px breakpoint; in the unit suite `matchMedia` is mocked to non-mobile (`src/test/setup.ts`), so the desktop `AnchoredPopover` path is exercised.
- `AnchoredPopover` already handles outside-click + Escape and the body portal; `NotesPopover` is passed unchanged. Its own dismiss listener stays and is harmlessly redundant on desktop (both call `setOpen(false)`).
- The mobile branch renders `NotesPopover` inside `Portal` so its `max-sm:fixed inset-x-0 bottom-0` bottom-sheet styling positions it correctly, escaping the clip.

- [ ] **Step 4: Run the test to verify it passes (and no regressions in the notes suite)**

Run: `npx vitest run src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx src/features/views/components/notes`
Expected: PASS — all `DistrictNotesCell` tests (including the new portal test) and all `notes/` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/cells/DistrictNotesCell.tsx \
        src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx
git commit -m "fix(plans): portal district notes popover out of grid scroll container

Reuse AnchoredPopover (desktop) / Portal (mobile) so the note composer is no
longer clipped by the grid's overflow-auto container and can be saved."
```

---

## Task 2: Pure launcher-position helpers (clamp, default, persistence read)

**Files:**
- Create: `src/features/copilot/lib/launcher-position.ts`
- Test: `src/features/copilot/lib/__tests__/launcher-position.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/copilot/lib/__tests__/launcher-position.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  clampToViewport,
  defaultLauncherPosition,
  readStoredPosition,
  LAUNCHER_SIZE,
  LAUNCHER_POS_KEY,
} from "../launcher-position";

describe("clampToViewport", () => {
  it("leaves an in-bounds position unchanged", () => {
    expect(clampToViewport({ x: 100, y: 120 }, 44, 1000, 800)).toEqual({ x: 100, y: 120 });
  });

  it("clamps past the right/bottom edges (size + 8px margin)", () => {
    expect(clampToViewport({ x: 5000, y: 5000 }, 44, 1000, 800)).toEqual({ x: 948, y: 748 });
  });

  it("clamps negative coordinates to the 8px margin", () => {
    expect(clampToViewport({ x: -50, y: -10 }, 44, 1000, 800)).toEqual({ x: 8, y: 8 });
  });
});

describe("defaultLauncherPosition", () => {
  it("sits bottom-right, raised to clear a pager footer", () => {
    // 1000 - 44 - 20 = 936 (right gap); 800 - 44 - 76 = 680 (bottom gap)
    expect(defaultLauncherPosition(1000, 800)).toEqual({ x: 936, y: 680 });
  });
});

describe("readStoredPosition", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(readStoredPosition()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem(LAUNCHER_POS_KEY, "not json");
    expect(readStoredPosition()).toBeNull();
  });

  it("returns a clamped stored position", () => {
    localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ x: 99999, y: 99999 }));
    const p = readStoredPosition()!;
    // jsdom default viewport is 1024x768
    expect(p).toEqual({ x: 1024 - LAUNCHER_SIZE - 8, y: 768 - LAUNCHER_SIZE - 8 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/launcher-position.test.ts`
Expected: FAIL — `Cannot find module '../launcher-position'`.

- [ ] **Step 3: Write the implementation**

Create `src/features/copilot/lib/launcher-position.ts`:

```ts
export interface Position {
  x: number;
  y: number;
}

/** Diameter of the collapsed sparkle icon, in px. */
export const LAUNCHER_SIZE = 44;
/** localStorage key for the persisted launcher position. */
export const LAUNCHER_POS_KEY = "copilot:launcher-pos";

const MARGIN = 8;
const DEFAULT_RIGHT_GAP = 20;
const DEFAULT_BOTTOM_GAP = 76; // clears a ~44px pager footer + breathing room

/** Keep the icon fully on screen with an 8px margin on every edge. */
export function clampToViewport(pos: Position, size: number, vw: number, vh: number): Position {
  const clamp = (v: number, hi: number) => Math.min(Math.max(v, MARGIN), Math.max(MARGIN, hi));
  return {
    x: clamp(pos.x, vw - size - MARGIN),
    y: clamp(pos.y, vh - size - MARGIN),
  };
}

/** Default resting spot: bottom-right, raised above the pager footer. */
export function defaultLauncherPosition(
  vw: number = typeof window !== "undefined" ? window.innerWidth : 1024,
  vh: number = typeof window !== "undefined" ? window.innerHeight : 768,
): Position {
  return clampToViewport(
    { x: vw - LAUNCHER_SIZE - DEFAULT_RIGHT_GAP, y: vh - LAUNCHER_SIZE - DEFAULT_BOTTOM_GAP },
    LAUNCHER_SIZE,
    vw,
    vh,
  );
}

/** Read + clamp the persisted position, or null if absent/invalid. */
export function readStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(LAUNCHER_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Position>;
    if (typeof p?.x === "number" && typeof p?.y === "number") {
      return clampToViewport({ x: p.x, y: p.y }, LAUNCHER_SIZE, window.innerWidth, window.innerHeight);
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/launcher-position.test.ts`
Expected: PASS (8 assertions across 3 describes).

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/lib/launcher-position.ts \
        src/features/copilot/lib/__tests__/launcher-position.test.ts
git commit -m "feat(copilot): pure launcher-position helpers (clamp, default, persist read)"
```

---

## Task 3: Rebuild `CopilotLauncher` as a collapsible, draggable icon

**Files:**
- Modify: `src/features/copilot/components/CopilotLauncher.tsx`
- Test: `src/features/copilot/components/__tests__/CopilotLauncher.test.tsx`

- [ ] **Step 1: Replace the test file with tap/drag/persist/coachmark coverage**

Replace the entire contents of `CopilotLauncher.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotLauncher, COACHMARK_KEY } from "../CopilotLauncher";
import { LAUNCHER_POS_KEY } from "../../lib/launcher-position";

beforeEach(() => localStorage.clear());

function tap(el: Element) {
  fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: 100, clientY: 100, pointerId: 1 });
}

describe("CopilotLauncher", () => {
  it("opens on tap (pointer down/up with no movement)", () => {
    const onOpen = vi.fn();
    render(<CopilotLauncher onOpen={onOpen} />);
    tap(screen.getByRole("button", { name: /open copilot/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does NOT open when dragged, and persists the dropped position", () => {
    const onOpen = vi.fn();
    render(<CopilotLauncher onOpen={onOpen} />);
    const btn = screen.getByRole("button", { name: /open copilot/i });
    fireEvent.pointerDown(btn, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(btn, { clientX: 300, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(btn, { clientX: 300, clientY: 250, pointerId: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    expect(localStorage.getItem(LAUNCHER_POS_KEY)).toBeTruthy();
  });

  it("restores a persisted position on mount", () => {
    localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ x: 40, y: 50 }));
    render(<CopilotLauncher onOpen={() => {}} />);
    const btn = screen.getByRole("button", { name: /open copilot/i });
    expect(btn.style.left).toBe("40px");
    expect(btn.style.top).toBe("50px");
  });

  it("shows the coachmark once, then never again", () => {
    const { unmount } = render(<CopilotLauncher onOpen={() => {}} />);
    expect(screen.getByText(/right here/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dismiss tip/i }));
    expect(screen.queryByText(/right here/i)).toBeNull();
    expect(localStorage.getItem(COACHMARK_KEY)).toBe("1");
    unmount();
    render(<CopilotLauncher onOpen={() => {}} />);
    expect(screen.queryByText(/right here/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotLauncher.test.tsx`
Expected: FAIL — the current launcher opens on `click` (not pointer tap), has no `LAUNCHER_POS_KEY` persistence, and sets no inline `left`/`top`, so the tap, drag, and restore tests fail.

- [ ] **Step 3: Rewrite `CopilotLauncher.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import {
  LAUNCHER_SIZE,
  LAUNCHER_POS_KEY,
  clampToViewport,
  defaultLauncherPosition,
  readStoredPosition,
  type Position,
} from "../lib/launcher-position";

export const COACHMARK_KEY = "copilot:coachmark-dismissed";

/** Pointer movement (px) past which a press becomes a drag, not a tap. */
const DRAG_THRESHOLD = 5;

export function CopilotLauncher({ onOpen }: { onOpen: () => void }) {
  const [showCoach, setShowCoach] = useState(() => {
    try { return !localStorage.getItem(COACHMARK_KEY); }
    catch { return false; }
  });
  const [pos, setPos] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);

  // Drag bookkeeping in a ref so move/up handlers see live values without re-binding.
  const drag = useRef<
    { startX: number; startY: number; originX: number; originY: number; moved: boolean } | null
  >(null);

  // Position needs window dimensions, so resolve it on the client after mount.
  useEffect(() => {
    setPos(readStoredPosition() ?? defaultLauncherPosition());
  }, []);

  // Re-clamp into the viewport on resize so the icon never strands off-screen.
  useEffect(() => {
    function onResize() {
      setPos((p) => (p ? clampToViewport(p, LAUNCHER_SIZE, window.innerWidth, window.innerHeight) : p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function dismissCoach() {
    setShowCoach(false);
    try { localStorage.setItem(COACHMARK_KEY, "1"); } catch { /* ignore */ }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (pos === null) return;
    drag.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDragging(true);
    setPos(clampToViewport(
      { x: d.originX + dx, y: d.originY + dy },
      LAUNCHER_SIZE, window.innerWidth, window.innerHeight,
    ));
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
    if (!d) return;
    if (!d.moved) {
      onOpen(); // a tap, not a drag
      return;
    }
    setPos((p) => {
      if (p) { try { localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
      return p;
    });
  }

  // Hold render until the client position is known (avoids an SSR/first-paint jump).
  if (pos === null) return null;

  return (
    <>
      {showCoach && (
        <div
          className="fixed z-[51] max-w-[200px] rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-lg"
          style={{ left: Math.max(8, pos.x + LAUNCHER_SIZE - 200), top: Math.max(8, pos.y - 60) }}
        >
          <button
            type="button"
            onClick={dismissCoach}
            aria-label="Dismiss tip"
            className="absolute right-1.5 top-1.5 rounded p-0.5 text-[#A89FC4] hover:text-[#403770]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <p className="pr-3 text-xs text-[#403770]">
            Ask me what&apos;s slipping, or to log a call — <b>I&apos;m right here.</b>
          </p>
        </div>
      )}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label="Open Copilot"
        className="group fixed z-50 flex h-11 w-11 touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-full bg-[#403770] text-white shadow-lg transition-[width,padding,background-color] hover:w-auto hover:bg-[#322a5a] hover:px-4 sm:hover:pl-4"
        style={{ left: pos.x, top: pos.y, cursor: dragging ? "grabbing" : "grab" }}
      >
        <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="hidden whitespace-nowrap text-sm font-medium group-hover:inline">Copilot</span>
      </button>
    </>
  );
}
```

Notes for the implementer:
- `touch-none` lets the pointer drag work on touch without the page stealing the gesture as a scroll; it's on a 44px button only (safe — unrelated to the map-gesture rule in CLAUDE.md).
- Tap vs drag is decided by `DRAG_THRESHOLD`; opening happens on `pointerup` of a non-moved press, so dragging never opens the panel and there is no `onClick`.
- `setPointerCapture` / `releasePointerCapture` are optional-chained — jsdom doesn't implement them.
- Hover expands the icon to the pill on desktop (`group-hover`); on touch there's no hover, so it stays a compact icon. The panel-open behavior is unchanged for the parent (`onOpen` prop is the same).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/CopilotLauncher.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/components/CopilotLauncher.tsx \
        src/features/copilot/components/__tests__/CopilotLauncher.test.tsx
git commit -m "fix(copilot): collapsible, draggable launcher that clears the pager

Rest as a 44px sparkle icon (hover-expands to the pill), open on tap, free-drag
via Pointer Events with on-screen clamping and persisted position. Resolves the
launcher permanently covering the grid pager's next-page control."
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run all touched/related tests together**

Run:
```bash
npx vitest run \
  src/features/views/components/grid/cells \
  src/features/views/components/notes \
  src/features/copilot/lib \
  src/features/copilot/components/__tests__/CopilotLauncher.test.tsx
```
Expected: all PASS, 0 failures.

- [ ] **Step 2: Typecheck the project**

Run: `npx tsc --noEmit`
Expected: no errors. (If unrelated pre-existing errors appear, confirm they are not in the four files this plan touches.)

- [ ] **Step 3: Lint only the changed files** (full-tree eslint OOMs — lint the changed set)

Run:
```bash
npx eslint \
  src/features/views/components/grid/cells/DistrictNotesCell.tsx \
  src/features/copilot/lib/launcher-position.ts \
  src/features/copilot/components/CopilotLauncher.tsx
```
Expected: clean.

- [ ] **Step 4: Manual smoke (dev server)**

Run: `npm run dev` (port 3005), then in the browser:
- Plans → Table View: open a NOTES cell while the grid is scrolled horizontally and vertically; confirm the full composer + **Add note** button are visible/reachable and a note saves. Resize narrow and re-check. On an iPhone/responsive mode, confirm the bottom-sheet still appears.
- Copilot icon: confirm it rests as the small sparkle icon clear of the pager; the pager's next-page arrow is clickable. Hover → expands to "Copilot" pill; click/tap → panel opens. Drag the icon elsewhere, reload, confirm it stays. Repeat the drag on a touch device. Confirm the first-run coachmark appears near the icon and dismisses with the X.

- [ ] **Step 5: No commit** (verification only). If any step fails, return to the relevant task.

---

## Self-Review

**Spec coverage:**
- Fix 1 root cause (overflow-auto clip) → Task 1 (AnchoredPopover desktop / Portal mobile). ✓
- Fix 1 mobile bottom-sheet preserved → Task 1 Step 3 mobile branch. ✓
- Fix 2 collapsed icon + hover-expand → Task 3 button classes. ✓
- Fix 2 tap-vs-drag threshold, mouse + touch → Task 3 pointer handlers + Task 3 tests. ✓
- Fix 2 on-screen clamping + persistence + default-clears-pager → Task 2 helpers + tests. ✓
- Fix 2 coachmark kept + anchored to icon → Task 3 coachmark block + test. ✓
- Out of scope (no backend/panel/pager-logic changes) → respected. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code and exact commands. ✓

**Type consistency:** `Position`, `LAUNCHER_SIZE`, `LAUNCHER_POS_KEY`, `clampToViewport`, `defaultLauncherPosition`, `readStoredPosition` are defined in Task 2 and consumed with identical names/signatures in Task 3. `AnchoredPopover` props (`anchorRef`, `open`, `onDismiss`, `align`) match the existing component. ✓
