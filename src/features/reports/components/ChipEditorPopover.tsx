"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Offset from the anchor's bottom edge in px. Defaults to 8. */
  offsetY?: number;
  /** Explicit min-width. Defaults to the anchor's width. */
  minWidth?: number;
}

/**
 * Portal-rendered floating popover anchored to a chip. Closes on Escape and
 * outside-click. No Floating UI dependency — positions via simple bounding
 * rect read. Anchor must be a stable DOM node (ref.current).
 */
export default function ChipEditorPopover({
  anchor,
  open,
  onClose,
  children,
  offsetY = 8,
  minWidth,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose, anchor]);

  if (!open || !anchor || typeof document === "undefined") return null;

  const rect = anchor.getBoundingClientRect();
  const top = rect.bottom + offsetY + window.scrollY;
  const left = rect.left + window.scrollX;
  const width = minWidth ?? Math.max(rect.width, 240);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      className="fixed z-30 bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-4"
      style={{ top, left, minWidth: width }}
    >
      {children}
    </div>,
    document.body,
  );
}
