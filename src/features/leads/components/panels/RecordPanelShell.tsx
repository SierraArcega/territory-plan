"use client";

// Record panel shell — durable record views (Contact / School / District)
// REPLACING the lead detail panel in the same 640px surface (drill-in pages,
// not visual stacking; full-width sheet < 640px), breadcrumb trail
// (`Lead › District › School › Contact` — only the actually-visited path;
// current level not clickable), Back + Close buttons, Esc/Back pops ONE
// level, Close dismisses the whole panel. Chrome per RecordPanels.jsx →
// RecordShell/Breadcrumbs.

import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  GraduationCap,
  School,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import MicroLabel from "../bits/MicroLabel";
import {
  PANEL_SLIDE_ANIMATION,
  PanelBackdrop,
  PanelKeyframes,
  useEscapeKey,
} from "./panel-chrome";

export interface BreadcrumbItem {
  kind: "lead" | "contact" | "school" | "district";
  label: string;
  /** Absent/null on the current (last) level — not clickable. */
  onClick?: (() => void) | null;
}

const CRUMB_ICONS = {
  lead: UserCheck,
  contact: Users,
  school: GraduationCap,
  district: School,
} as const;

export function Breadcrumbs({ trail }: { trail: BreadcrumbItem[] }) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Record trail" className="mb-3 flex flex-wrap items-center gap-1">
      {trail.map((c, i) => {
        const Icon = CRUMB_ICONS[c.kind];
        const last = i === trail.length - 1;
        const common =
          "inline-flex max-w-[150px] items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px]";
        return (
          <span key={`${c.kind}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={12} className="shrink-0 text-[#C2BBD4]" aria-hidden />
            )}
            {c.onClick && !last ? (
              <button
                type="button"
                onClick={c.onClick}
                className={`${common} font-semibold text-[#6EA3BE] hover:text-[#4D7285]`}
              >
                <Icon size={12} className="shrink-0" aria-hidden />
                {c.label}
              </button>
            ) : (
              <span
                aria-current={last ? "location" : undefined}
                className={`${common} ${last ? "font-bold text-[#403770]" : "font-semibold text-[#8A80A8]"}`}
              >
                <Icon
                  size={12}
                  className={`shrink-0 ${last ? "text-[#A69DC0]" : ""}`}
                  aria-hidden
                />
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export interface RecordPanelShellProps {
  kicker: string;
  title: string;
  subtitle?: string | null;
  badges?: ReactNode;
  trail: BreadcrumbItem[];
  /** Pop one level (previous record, or back to the lead panel). */
  onBack: () => void;
  /** Dismiss the whole panel (record stack and lead panel together). */
  onClose: () => void;
  children: ReactNode;
}

export default function RecordPanelShell({
  kicker,
  title,
  subtitle,
  badges,
  trail,
  onBack,
  onClose,
  children,
}: RecordPanelShellProps) {
  // Esc pops ONE level — only the top record panel is mounted, so this is the
  // sole record-stack Esc listener (the lead panel's is disabled meanwhile).
  useEscapeKey(onBack);

  return (
    <>
      <PanelKeyframes />
      {/* Backdrop dismisses the whole panel — same as the lead panel's. */}
      <PanelBackdrop onClick={onClose} zIndex={44} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${kicker}: ${title}`}
        className="absolute inset-y-0 right-0 z-[45] flex w-full flex-col border-l border-[#D4CFE2] bg-white shadow-[-10px_0_28px_-8px_rgba(64,55,112,0.22)] sm:w-[min(640px,calc(100vw-24px))]"
        style={{ animation: PANEL_SLIDE_ANIMATION }}
      >
        <div className="border-b border-[#EFEDF5] px-[22px] py-4">
          <Breadcrumbs trail={trail} />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-[7px]">
                <MicroLabel className="text-[#A69DC0]">{kicker}</MicroLabel>
                {badges}
              </div>
              <h2 className="text-xl font-bold tracking-[-0.01em] text-[#403770] [overflow-wrap:anywhere]">
                {title}
              </h2>
              {subtitle && (
                <div className="mt-0.5 text-[13px] text-[#8A80A8]">{subtitle}</div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                title="Back"
                className="flex rounded-lg p-1.5 text-[#8A80A8] transition-colors duration-[120ms] hover:bg-[#EFEDF5] hover:text-[#403770]"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close record panel"
                title="Close"
                className="flex rounded-lg p-1.5 text-[#8A80A8] transition-colors duration-[120ms] hover:bg-[#EFEDF5] hover:text-[#403770]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-7 pt-[18px] [touch-action:pan-y]">
          {children}
        </div>
      </aside>
    </>
  );
}

/** Shared loading body for record panels (no layout shift). */
export function RecordPanelSkeleton() {
  return (
    <div aria-hidden data-testid="record-skeleton">
      <div className="mb-[18px] h-[52px] animate-pulse rounded-[10px] bg-[#EFEDF5]" />
      <div className="mb-[22px] grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[58px] animate-pulse rounded-[10px] bg-[#F4F2F8]" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-2 h-[52px] animate-pulse rounded-[10px] bg-[#F4F2F8]" />
      ))}
    </div>
  );
}
