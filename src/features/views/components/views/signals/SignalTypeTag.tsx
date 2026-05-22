"use client";

/**
 * SignalTypeTag — the tinted VAC / NEWS / RFP marker.
 *
 * Shared by signal leaf rows (icon + 3-letter label) and the district-row
 * count chips (icon + count). Icons are Lucide, rendered with `currentColor`
 * so the per-type tint flows from the wrapper's text color (Fullmind brand
 * convention).
 *
 * Per-type tints draw from the design tokens' semantic/category palettes:
 *   - Vacancy → Steel Blue family (hiring/people)
 *   - News    → Plum family (editorial)
 *   - RFP     → Golden / Warning family (procurement / deadlines)
 */
import { UserSearch, Newspaper, FileText, type LucideIcon } from "lucide-react";
import type { SignalType } from "@/lib/signals/sql";

interface TypeMeta {
  Icon: LucideIcon;
  label: string;
  /** Background tint for the chip/tag pill. */
  bg: string;
  /** Foreground (icon + text) color. */
  fg: string;
}

export const SIGNAL_TYPE_META: Record<SignalType, TypeMeta> = {
  vac: { Icon: UserSearch, label: "VAC", bg: "#e8f1f5", fg: "#4d7285" },
  news: { Icon: Newspaper, label: "NEWS", bg: "#EFEDF5", fg: "#6f4c8c" },
  rfp: { Icon: FileText, label: "RFP", bg: "#fffaf1", fg: "#7d6d3a" },
};

interface SignalTypeTagProps {
  type: SignalType;
  /** When true, render the 3-letter label alongside the icon. */
  withLabel?: boolean;
}

export default function SignalTypeTag({ type, withLabel = false }: SignalTypeTagProps) {
  const meta = SIGNAL_TYPE_META[type];
  const { Icon, label, bg, fg } = meta;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] whitespace-nowrap"
      style={{ background: bg, color: fg }}
      data-signal-type={type}
    >
      <Icon className="h-3 w-3 flex-shrink-0" aria-hidden strokeWidth={2} />
      {withLabel && <span>{label}</span>}
    </span>
  );
}
