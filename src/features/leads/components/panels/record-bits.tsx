"use client";

// Small shared atoms for the record panels (RecordPanels.jsx in the handoff):
// retention note, stat cell, row button, icon tile, and initials avatar.

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/** Green note explaining that engagement history is retained on the record. */
export function RetentionNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-[18px] flex items-start gap-[9px] rounded-[10px] border border-[#CDE9BC] bg-[#EAF8E0] px-[13px] py-2.5">
      <CheckCircle2 size={15} className="mt-px shrink-0 text-[#56792F]" aria-hidden />
      <div className="text-xs leading-[1.45] text-[#4A6A2A]">{children}</div>
    </div>
  );
}

export function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "good";
}) {
  return (
    <div className="rounded-[10px] border border-[#EDEAF4] bg-[#FAF8FC] px-3 py-2.5">
      <div
        className="text-[19px] font-bold leading-[1.1] tabular-nums"
        style={{ color: tone === "good" ? "#56792F" : "#403770" }}
      >
        {value}
      </div>
      <div className="mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.05em] text-[#8A80A8]">
        {label}
      </div>
    </div>
  );
}

/** Full-width clickable record row (school / contact / lead / district). */
export function RowButton({
  onClick,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex w-full items-center gap-[11px] rounded-[10px] border border-[#E2DEEC] bg-white px-3 py-2.5 text-left transition-colors duration-[110ms] hover:border-[#B8B0D0] hover:bg-[#FBFAFD]"
    >
      {children}
    </button>
  );
}

/** 30px tinted icon square used at the start of record rows. */
export function RecordIconTile({
  icon: Icon,
  bg,
  fg,
  size = 15,
}: {
  icon: React.ComponentType<{ size?: number | string; "aria-hidden"?: boolean }>;
  bg: string;
  fg: string;
  size?: number;
}) {
  return (
    <span
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
      style={{ background: bg, color: fg }}
    >
      <Icon size={size} aria-hidden />
    </span>
  );
}

/** Purple-ringed initials avatar for contact rows. */
export function ContactInitials({ name }: { name: string }) {
  const parts = name.split(" ").filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (name.slice(0, 2).toUpperCase() || "—");
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#7A6FD0] bg-[#FFFCFA] text-xs font-bold text-[#5A4F9E]">
      {initials}
    </span>
  );
}

/** "N activities" / "1 activity" caption text. */
export function activitiesLabel(n: number): string {
  return `${n} ${n === 1 ? "activity" : "activities"}`;
}
