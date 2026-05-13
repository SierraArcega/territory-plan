"use client";

/**
 * DetailPanelHeader — shared chrome at the top of every detail panel.
 *
 * Composition:
 *   - Eyebrow row: 10px uppercase label with optional tiny icon (coral).
 *   - H2 title row (18px / 700 / plum / -0.01em letter-spacing).
 *   - Meta row: status/stage pills + secondary info (kept on one visual line
 *     when possible per `Documentation/UI Framework/tokens.md` § Narrow-Width
 *     Resilience — every text node gets `whitespace-nowrap` and the parent
 *     flex-wraps when squeezed).
 *   - Action row: primary "Log activity" (plum bg, 12px) + secondary "Save"
 *     + secondary share icon button. All onClicks are stubs in v1 — the brief
 *     explicitly notes they remain wired only where existing handlers exist.
 *
 * 18px horizontal / 14px-12px vertical padding mirrors the prototype's
 * `padding: 14px 18px 12px` exactly. The 1px bottom border uses the Subtle
 * border token (#E2DEEC) per tokens.md.
 */
import type { ReactNode } from "react";
import { X, Pencil, Bookmark, Share2 } from "lucide-react";

export interface DetailPanelHeaderProps {
  /** Tiny coral icon shown left of the eyebrow text. Optional. */
  eyebrowIcon?: ReactNode;
  /** Uppercase eyebrow text (e.g. "MI · District", "Contact"). */
  eyebrow: ReactNode;
  /** Main title — usually the entity name. */
  title: ReactNode;
  /** Meta row — typically pills + secondary text. */
  meta?: ReactNode;
  /** Close handler — wired to the X button + escape/click-outside. */
  onClose: () => void;
  /**
   * Optional override for the primary action button. Defaults to a stub
   * "Log activity" button that's wired to a no-op. v1 ships with a stub
   * because the spec's existing activity-logging entry point lives elsewhere
   * (the activities/Quick Log flyout) — wiring that across kinds is v1.1.
   */
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  /** Optional override for the secondary "Save / Add to list" button. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Share icon button onClick — defaults to no-op. */
  onShare?: () => void;
}

const PRIMARY_BTN_CLS =
  "flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 " +
  "rounded-lg bg-[#403770] text-white text-xs font-semibold " +
  "hover:bg-[#322a5a] transition-colors duration-100";
const SECONDARY_BTN_CLS =
  "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 " +
  "rounded-lg bg-white border border-[#D4CFE2] text-[#403770] text-xs font-medium " +
  "hover:bg-[#F7F5FA] transition-colors duration-100";

export default function DetailPanelHeader({
  eyebrowIcon,
  eyebrow,
  title,
  meta,
  onClose,
  primaryActionLabel = "Log activity",
  onPrimaryAction,
  secondaryActionLabel = "Save",
  onSecondaryAction,
  onShare,
}: DetailPanelHeaderProps) {
  return (
    <div className="px-[18px] pt-[14px] pb-3 border-b border-[#E2DEEC]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {eyebrowIcon ? (
              <span className="text-[#F37167] inline-flex flex-shrink-0">
                {eyebrowIcon}
              </span>
            ) : null}
            <span
              className="text-[10px] font-bold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ letterSpacing: "0.06em" }}
            >
              {eyebrow}
            </span>
          </div>
          <h2
            className="text-[18px] font-bold text-[#403770] leading-tight m-0"
            style={{ letterSpacing: "-0.01em" }}
          >
            {title}
          </h2>
          {meta ? (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">{meta}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="p-1.5 rounded-lg text-[#8A80A8] hover:bg-[#F7F5FA] hover:text-[#544A78] transition-colors duration-100 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <button
          type="button"
          onClick={onPrimaryAction}
          className={PRIMARY_BTN_CLS}
        >
          <Pencil className="w-2.5 h-2.5" aria-hidden />
          <span className="whitespace-nowrap">{primaryActionLabel}</span>
        </button>
        <button
          type="button"
          onClick={onSecondaryAction}
          className={SECONDARY_BTN_CLS}
        >
          <Bookmark className="w-2.5 h-2.5" aria-hidden />
          <span className="whitespace-nowrap">{secondaryActionLabel}</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label="Share"
          className={SECONDARY_BTN_CLS}
        >
          <Share2 className="w-2.5 h-2.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
