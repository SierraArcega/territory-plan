"use client";

/**
 * Detail-panel atoms — the small composition primitives every *DetailContent
 * component reuses. Extracted into one file so the per-kind components stay
 * lean and the prototype's visual rhythm (10px uppercase labels, plum-tinted
 * `#FFFCFA` cards with `#E2DEEC` borders, 12px serif-feel notes blocks) is
 * defined in exactly one place.
 *
 * Tokens used (all from `Documentation/UI Framework/tokens.md`):
 *   - #FFFCFA — Surface (off-white card bg)
 *   - #E2DEEC — Border Subtle (card edges)
 *   - #EFEDF5 — Hover (row divider tint)
 *   - #403770 — Plum (primary text)
 *   - #544A78 — Strong (body emphasis)
 *   - #8A80A8 — Secondary (labels)
 *   - #F37167 — Coral (item dot accent)
 */
import type { ReactNode } from "react";

// ── Eyebrow label (10px uppercase, secondary color) ───────────────────────

export function EyebrowLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[10px] font-bold uppercase text-[#8A80A8] tracking-wider whitespace-nowrap"
      style={{ letterSpacing: "0.06em" }}
    >
      {children}
    </div>
  );
}

// ── Section — label + slot, with consistent vertical rhythm ────────────────

export function Section({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <EyebrowLabel>{label}</EyebrowLabel>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

// ── Stat card — 2-column grid cell with label + value ──────────────────────

export function Stat({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg">
      <div
        className="text-[10px] font-semibold uppercase text-[#8A80A8] tracking-wider whitespace-nowrap"
        style={{ letterSpacing: "0.06em" }}
      >
        {label}
      </div>
      <div className="text-sm font-bold text-[#403770] mt-0.5 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
        {value}
      </div>
    </div>
  );
}

// ── 2-column stats grid wrapper ────────────────────────────────────────────

export function StatsGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

// ── Key-value row (dotted divider style) ───────────────────────────────────

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#EFEDF5]">
      <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">{k}</span>
      <span
        className="text-xs font-medium text-[#403770] tabular-nums truncate text-right"
        title={typeof v === "string" ? v : undefined}
      >
        {v}
      </span>
    </div>
  );
}

// ── Item row — coral dot + title + sub ─────────────────────────────────────

export function Item({
  title,
  sub,
  last = false,
}: {
  title: ReactNode;
  sub?: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex items-start gap-2.5 py-2 " +
        (last ? "" : "border-b border-[#EFEDF5]")
      }
    >
      <div className="w-1.5 h-1.5 rounded-full bg-[#F37167] mt-1.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#403770] font-medium">{title}</div>
        {sub != null ? (
          <div className="text-[11px] text-[#8A80A8] mt-0.5">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

// ── Notes/Scope/Summary block — 10px padded off-white card with body text ──

export function NoteBlock({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs text-[#544A78] leading-relaxed p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg">
      {children}
    </div>
  );
}

// ── Pill — small status/stage indicator with custom bg/fg ──────────────────

export function Pill({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/**
 * Token reference for the stage/status pills — these colors come straight
 * from the prototype's STAGE_PILL_PS / STAGE_PILL_DP maps. Centralizing them
 * here keeps the per-kind components from re-declaring the same lookups.
 */
export const STAGE_PILL: Record<string, { bg: string; fg: string }> = {
  // Customer/Engagement
  customer: { bg: "#EDFFE3", fg: "#5f665b" },
  champion: { bg: "#EDFFE3", fg: "#5f665b" },
  prospect: { bg: "#e8f1f5", fg: "#4d7285" },
  engaged: { bg: "#e8f1f5", fg: "#4d7285" },
  cold: { bg: "#EFEDF5", fg: "#6f6786" },
  lapsed: { bg: "#FEF2F1", fg: "#c25a52" },
  churned: { bg: "#FEF2F1", fg: "#c25a52" },
  // Opportunity stages
  discovery: { bg: "#e8f1f5", fg: "#4d7285" },
  proposal: { bg: "#FFF6DD", fg: "#7d6d3a" },
  negotiation: { bg: "#FEF2F1", fg: "#c25a52" },
  // RFP statuses
  open: { bg: "#EDFFE3", fg: "#5f665b" },
  closed: { bg: "#EFEDF5", fg: "#6f6786" },
  expired: { bg: "#EFEDF5", fg: "#6f6786" },
};

export function lookupStagePill(key: string | null | undefined): {
  bg: string;
  fg: string;
} {
  if (!key) return STAGE_PILL.prospect;
  return STAGE_PILL[key.toLowerCase()] ?? STAGE_PILL.prospect;
}

// ── Scroll body wrapper — common padding + gap between sections ────────────

export function PanelBody({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-4"
      // -webkit-overflow-scrolling: touch for iOS smoothness per CLAUDE.md.
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}

// ── Loading skeleton — stats grid + section placeholders ───────────────────

export function PanelBodySkeleton() {
  return (
    <PanelBody>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg animate-pulse"
          >
            <div className="h-2 w-12 rounded bg-[#EFEDF5]" />
            <div className="h-3.5 w-16 rounded bg-[#E2DEEC] mt-1.5" />
          </div>
        ))}
      </div>
      <div>
        <div className="h-2 w-20 rounded bg-[#EFEDF5] animate-pulse" />
        <div className="mt-2 h-16 rounded-lg bg-[#FFFCFA] border border-[#E2DEEC] animate-pulse" />
      </div>
      <div>
        <div className="h-2 w-20 rounded bg-[#EFEDF5] animate-pulse" />
        <div className="mt-2 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E2DEEC] mt-1.5" />
              <div className="flex-1">
                <div className="h-2.5 w-32 rounded bg-[#EFEDF5] animate-pulse" />
                <div className="h-2 w-16 rounded bg-[#F7F5FA] animate-pulse mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PanelBody>
  );
}

// ── Error card — inline retry affordance ──────────────────────────────────

export function PanelError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <PanelBody>
      <div className="rounded-lg border border-[#f58d85] bg-[#fef1f0] p-3 text-xs text-[#c25a52]">
        <div className="font-semibold mb-1 whitespace-nowrap">
          Couldn&apos;t load details
        </div>
        <div className="text-[#544A78] mb-2">{message}</div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-white border border-[#D4CFE2] text-[#403770] text-xs font-medium hover:bg-[#F7F5FA] transition-colors duration-100"
          >
            Retry
          </button>
        ) : null}
      </div>
    </PanelBody>
  );
}
