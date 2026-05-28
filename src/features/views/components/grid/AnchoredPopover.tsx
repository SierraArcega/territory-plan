"use client";

/**
 * AnchoredPopover — renders its children in a body portal, positioned just
 * below (or above, when space is tight) an anchor element.
 *
 * Why a portal: the Filter / Sort / Group chip triggers live inside the grid's
 * chip strip, which uses `overflow-x: auto`. Per the CSS spec, `overflow-x: auto`
 * forces the computed `overflow-y` from `visible` to `auto`, turning the strip
 * into a scroll container on BOTH axes. A `position: absolute` dropdown nested
 * in that strip therefore gets clipped to the strip's height and grows a stray
 * scrollbar — hiding the options. Portaling to <body> escapes every overflow
 * ancestor.
 *
 * Vertical placement uses a two-pass approach to avoid clipping near the
 * viewport bottom:
 *   1. First pass: render panel at "below" with visibility:hidden.
 *   2. useLayoutEffect: measure panel height. Flip to "above" if the panel
 *      would overflow the viewport bottom AND there is room above the anchor.
 *      Falls back to "below" when neither direction fits.
 *   3. Set visibility:visible — no flicker.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

interface AnchoredPopoverProps {
  /** Element the popover anchors to. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Whether the popover is shown. */
  open: boolean;
  /** Fired on outside-click or Escape. */
  onDismiss: () => void;
  /**
   * Horizontal alignment of the panel relative to the anchor.
   * - `"left"` (default): panel's left edge aligns with anchor's left edge.
   * - `"right"`: panel's right edge aligns with anchor's right edge.
   */
  align?: "left" | "right";
  children: ReactNode;
}

interface Position {
  top: number;
  left?: number;
  right?: number;
}

export function AnchoredPopover({
  anchorRef,
  open,
  onDismiss,
  align = "left",
  children,
}: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);
  // `ready` gates visibility. False while the first-pass measurement is
  // pending so the panel never flashes at the wrong position.
  const [ready, setReady] = useState(false);

  // Measure the anchor and keep the panel pinned to it. Resets `ready` so
  // the flip check re-runs after every scroll/resize re-measurement.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      if (align === "right") {
        setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      } else {
        setPos({ top: rect.bottom + 4, left: rect.left });
      }
      setReady(false);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, anchorRef, align]);

  // Second pass: after the hidden panel renders, check if it fits below.
  // Flip above when needed; set ready=true to reveal the panel.
  useLayoutEffect(() => {
    if (!open || ready || pos === null || !panelRef.current) return;
    const anchor = anchorRef.current;
    if (!anchor) {
      setReady(true);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const panelH = panelRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    // panelH is 0 when content hasn't rendered yet (jsdom, lazy children).
    // In that case the flip condition is false and we fall through to setReady(true),
    // showing the panel at the "below" default. No re-measurement occurs if content
    // later expands — acceptable since this is an interactive, user-opened popover.
    if (panelH > spaceBelow && rect.top > panelH + 4) {
      // Enough room above — flip.
      if (align === "right") {
        setPos({ top: rect.top - panelH - 4, right: window.innerWidth - rect.right });
      } else {
        setPos({ top: rect.top - panelH - 4, left: rect.left });
      }
    }
    setReady(true);
  }, [open, ready, pos, align, anchorRef]);

  // Dismiss on outside-click + Escape. Deferred attach (setTimeout 0) so the
  // click that opened the popover doesn't immediately close it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onDismiss, anchorRef]);

  if (!open || pos === null || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-50"
      style={{
        top: pos.top,
        left: pos.left,
        right: pos.right,
        visibility: ready ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
