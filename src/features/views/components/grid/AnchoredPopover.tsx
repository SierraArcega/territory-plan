"use client";

/**
 * AnchoredPopover — renders its children in a body portal, positioned just
 * below an anchor element.
 *
 * Why a portal: the Filter / Sort / Group chip triggers live inside the grid's
 * chip strip, which uses `overflow-x-auto`. Per the CSS spec, `overflow-x: auto`
 * forces the computed `overflow-y` from `visible` to `auto`, turning the strip
 * into a scroll container on BOTH axes. A `position: absolute` dropdown nested
 * in that strip therefore gets clipped to the strip's height and grows a stray
 * scrollbar — hiding the options. Portaling to <body> escapes every overflow
 * ancestor. This mirrors the established pattern in
 * `features/shared/components/MultiSelect.tsx`.
 *
 * Positioning is `fixed` and re-measured on scroll/resize so the panel tracks
 * the trigger even while the strip scrolls horizontally.
 */
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

interface AnchoredPopoverProps {
  /** Element the popover anchors beneath (its bottom-left corner). */
  anchorRef: RefObject<HTMLElement | null>;
  /** Whether the popover is shown. */
  open: boolean;
  /** Fired on outside-click or Escape. */
  onDismiss: () => void;
  children: ReactNode;
}

interface Position {
  top: number;
  left: number;
}

export function AnchoredPopover({
  anchorRef,
  open,
  onDismiss,
  children,
}: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  // Measure the anchor and keep the panel pinned beneath it. Re-measuring on
  // scroll (capture phase, so it catches the strip's own scroll) and resize
  // keeps the panel attached while the trigger moves. `pos` is intentionally
  // not cleared on close — the render below already gates on `open`, so a
  // stale position is never shown, and re-opening re-measures immediately.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      // +4px gap matches the prior `mt-1` spacing.
      setPos({ top: rect.bottom + 4, left: rect.left });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, anchorRef]);

  // Dismiss on outside-click + Escape. Deferred attach (setTimeout 0) so the
  // click that opened the popover doesn't immediately close it. Clicks inside
  // the anchor (trigger + sibling chips) or the portaled panel are kept open.
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
      style={{ top: pos.top, left: pos.left }}
    >
      {children}
    </div>,
    document.body,
  );
}
