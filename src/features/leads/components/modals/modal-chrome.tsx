"use client";

// Shared chrome for the Leads modals (Add lead / Bulk upload / Outcome /
// Disqualify / Link opportunity / Schedule meeting) — composes the app-wide
// Modal (backdrop, focus trap, Esc) with the handoff's ModalShell pixels
// (LeadModals.jsx): header w/ 18/700 plum title + 12.5 subtitle + X, a
// scrollable body, and a right-aligned footer above a hairline.

import type { ReactNode } from "react";
import { X } from "lucide-react";
import Modal from "@/features/shared/components/Modal";

export const FIELD_CLASS =
  "w-full rounded-lg border border-[#C2BBD4] bg-white px-3 py-[9px] text-[13.5px] text-[#403770] outline-none placeholder:text-[#A69DC0] focus:border-[#403770]";
export const FIELD_ERROR_CLASS =
  "w-full rounded-lg border border-[#F58D85] bg-[#FEF6F5] px-3 py-[9px] text-[13.5px] text-[#403770] outline-none placeholder:text-[#A69DC0] focus:border-[#403770]";
export const SELECT_CLASS = `${FIELD_CLASS} cursor-pointer`;

export const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F37167] px-4 py-2 text-sm font-medium text-white transition-colors duration-[120ms] hover:bg-[#e25f55] disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_GHOST =
  "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-[#403770] transition-colors duration-[120ms] hover:bg-[#EFEDF5]";
export const BTN_DANGER =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#C25A52] px-4 py-2 text-sm font-medium text-white transition-colors duration-[120ms] hover:bg-[#ad4a43] disabled:cursor-not-allowed disabled:opacity-50";

/** Field label (Lbl in the prototype) — 11/600 muted plum, coral dot when required. */
export function FieldLabel({ children, req }: { children: ReactNode; req?: boolean }) {
  return (
    <label className="mb-[5px] block whitespace-nowrap text-[11px] font-semibold text-[#6E6390]">
      {children}
      {req && <span className="text-[#C25A52]"> ·</span>}
    </label>
  );
}

/** Plum toggle buttons (dataset / activity-type / opp-mode pickers). */
export function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-2 text-[12.5px] font-semibold transition-colors duration-[120ms] ${
        active
          ? "border-[#403770] bg-[#403770] text-white"
          : "border-[#D4CFE2] bg-white text-[#5C5277] hover:border-[#A69DC0]"
      }`}
    >
      {children}
    </button>
  );
}

interface LeadModalShellProps {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  /** Tailwind max-width class for the panel (prototype widths: 560/620/480/460/440). */
  maxWidth?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export default function LeadModalShell({
  title,
  subtitle,
  onClose,
  maxWidth = "max-w-[560px]",
  footer,
  children,
}: LeadModalShellProps) {
  return (
    <Modal open onClose={onClose} ariaLabel={title} maxWidth={maxWidth} showClose={false}>
      <div className="flex max-h-[85vh] flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#EFEDF5] px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-[-0.01em] text-[#403770]">{title}</h2>
            {subtitle && (
              <p className="mt-1 truncate text-[12.5px] text-[#8A80A8]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex shrink-0 rounded-lg p-1.5 text-[#8A80A8] transition-colors duration-[120ms] hover:bg-[#EFEDF5] hover:text-[#403770]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [touch-action:pan-y]">
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-[#EFEDF5] px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </Modal>
  );
}
