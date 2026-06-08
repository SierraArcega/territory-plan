"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Portal } from "@/features/shared/lib/portal";
import { useFocusTrap } from "@/features/shared/lib/use-focus-trap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /** Tailwind max-width class for the panel (default centered card width). */
  maxWidth?: string;
  /** Hide the built-in top-right close button (default shown). */
  showClose?: boolean;
  children: ReactNode;
}

// Shared dialog chrome for the dashboard's drill-in modals: a plum-tinted backdrop,
// a white rounded panel, Escape-to-close, click-outside-to-close, a focus trap, and
// the close X. The hand-rolled versions of this lived in RankTrajectoryModal and
// StageDealsModal; both now compose this. Scroll-lock is intentionally done with
// `overscroll-contain` on the scrollable backdrop (not `overflow:hidden` on body) —
// per CLAUDE.md, body overflow:hidden blocks iOS touch-scroll into the panel itself.
export default function Modal({
  open,
  onClose,
  ariaLabel,
  maxWidth = "max-w-[900px]",
  showClose = true,
  children,
}: ModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-[#403770]/60 p-4 sm:p-8"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div
          ref={trapRef}
          className={`relative w-[96vw] ${maxWidth} rounded-2xl bg-white shadow-xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-md p-1 text-[#5C5378] hover:bg-[#EFEDF5]"
            >
              <X size={16} />
            </button>
          )}
          {children}
        </div>
      </div>
    </Portal>
  );
}
