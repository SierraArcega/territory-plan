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

  // Position depends on window/localStorage (client-only). We render null until
  // this mount effect runs, so server and first client render agree (no hydration
  // mismatch) — the deliberate two-pass init the rule below would otherwise flag.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only post-mount init (see comment above)
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

  function onPointerCancel() {
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // Space would otherwise scroll the page
      onOpen();
    }
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
    // Persist from inside the updater to read the latest queued position (one
    // render ahead of the closure's `pos`). Writing the same value twice under
    // StrictMode is harmless (idempotent).
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
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        aria-label="Open Copilot"
        className="group fixed z-50 flex h-11 w-11 touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-full bg-[#403770] text-white shadow-lg transition-[width,padding,background-color] hover:w-auto hover:bg-[#322a5a] hover:px-4 focus-within:w-auto focus-within:px-4 sm:hover:pl-4"
        style={{ left: pos.x, top: pos.y, cursor: dragging ? "grabbing" : "grab" }}
      >
        <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="hidden whitespace-nowrap text-sm font-medium group-hover:inline group-focus-within:inline">Copilot</span>
      </button>
    </>
  );
}
