"use client";

// OppDrawer — slide-over list of deal events / open deals / cold districts.
// Owns its own Esc + backdrop close. 440px wide. Layers above the activity
// drawer (z-40/z-50): backdrop z-[60], panel z-[70].
//
// `kind` is one of:
//  - 'won' | 'lost' | 'created' | 'progressed' | 'all'  → OppEvent[] grouped by date
//  - 'overdue'                                          → OpenDeal[] (severity-railed)
//  - 'cold'                                             → ColdDistrict[] (snowflake)

import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import type { OppEvent, OpenDeal } from "@/features/shared/types/api-types";
import { OPP_STYLE } from "./oppStyle";
import { formatMoney } from "./formatMoney";
import OverdueDealRow from "./OverdueDealRow";
import ColdDistrictRow, { type ColdDistrict } from "./ColdDistrictRow";

export type OppDrawerKind =
  | "won"
  | "lost"
  | "created"
  | "progressed"
  | "closing"
  | "all"
  | "overdue"
  | "cold";

interface KindMeta {
  accent: string;
  bg: string;
}

const KIND_META: Record<OppDrawerKind, KindMeta> = {
  won: { accent: "#2D6B4D", bg: "#DDEFE3" },
  lost: { accent: "#9B3A2E", bg: "#F5D4CF" },
  created: { accent: "#403770", bg: "#E8E4F1" },
  progressed: { accent: "#C79A3E", bg: "#FCEFC7" },
  closing: { accent: "#5E4691", bg: "#F2EBFA" },
  all: { accent: "#403770", bg: "#EFEDF5" },
  overdue: { accent: "#8F5218", bg: "#FFE9CC" },
  cold: { accent: "#3F5A72", bg: "#DCE6EF" },
};

interface OppDrawerProps {
  open: boolean;
  kind: OppDrawerKind;
  heading: string;
  rangeLabel?: string;
  scopeLabel?: string;
  /** OppEvent list (kind in won/lost/created/progressed/all). */
  events?: OppEvent[];
  /** Overdue OpenDeals (kind === 'overdue'). */
  overdueDeals?: OpenDeal[];
  /** Cold districts (kind === 'cold'). */
  coldList?: ColdDistrict[];
  onClose: () => void;
}

function startOfDayIso(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayName(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
}

interface EventGroup {
  flat: false;
  dateIso: string;
  items: OppEvent[];
}
interface FlatGroupEvent {
  flat: true;
  kind: "events";
  items: OppEvent[];
}
interface FlatGroupOverdue {
  flat: true;
  kind: "overdue";
  items: OpenDeal[];
}
interface FlatGroupCold {
  flat: true;
  kind: "cold";
  items: ColdDistrict[];
}
type Group = EventGroup | FlatGroupEvent | FlatGroupOverdue | FlatGroupCold;

export default function OppDrawer({
  open,
  kind,
  heading,
  rangeLabel,
  scopeLabel,
  events = [],
  overdueDeals = [],
  coldList = [],
  onClose,
}: OppDrawerProps) {
  // Esc closes ONLY this drawer — stop propagation so it doesn't bubble to
  // the activity drawer if both are open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const meta = KIND_META[kind] ?? KIND_META.all;
  const isOverdue = kind === "overdue";
  const isCold = kind === "cold";

  // Build groups for the body.
  const groups: Group[] = [];
  if (isOverdue) {
    const sorted = [...overdueDeals].sort(
      (a, b) => (a.daysToClose ?? 0) - (b.daysToClose ?? 0)
    );
    groups.push({ flat: true, kind: "overdue", items: sorted });
  } else if (isCold) {
    const sorted = [...coldList].sort(
      (a, b) => b.daysSinceActivity - a.daysSinceActivity
    );
    groups.push({ flat: true, kind: "cold", items: sorted });
  } else {
    const sorted = [...events].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    const seen = new Map<string, EventGroup>();
    for (const e of sorted) {
      const key = startOfDayIso(e.occurredAt);
      let g = seen.get(key);
      if (!g) {
        g = { flat: false, dateIso: key, items: [] };
        seen.set(key, g);
        groups.push(g);
      }
      g.items.push(e);
    }
  }

  // Header summary stats.
  const itemCount = isOverdue
    ? overdueDeals.length
    : isCold
      ? coldList.length
      : events.length;
  const itemNoun = isCold ? "district" : "deal";
  const totalAmt = isOverdue
    ? overdueDeals.reduce((s, d) => s + (d.amount ?? 0), 0)
    : isCold
      ? coldList.reduce((s, d) => s + (d.amount ?? 0), 0)
      : events.reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <>
      {/* Backdrop — click closes only this drawer */}
      <div
        data-testid="opp-drawer-backdrop"
        className="fixed inset-0 z-[60]"
        style={{
          background: "rgba(47,41,75,0.35)",
          animation: "fmFadeIn 160ms ease-out",
        }}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label={heading}
        aria-modal="true"
        className="fm-drawer-panel fixed z-[70] bg-white border-l border-[#D4CFE2] flex flex-col left-0 md:left-auto right-0 bottom-0 md:bottom-auto top-auto md:top-0 w-full md:w-[440px] md:max-w-[90vw] max-h-[85vh] md:max-h-none md:h-full rounded-t-2xl md:rounded-none"
        style={{
          boxShadow: "-20px 0 40px rgba(64,55,112,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 pt-[18px] pb-3.5 border-b border-[#E2DEEC]"
          style={{ background: meta.bg }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {(scopeLabel || rangeLabel) && (
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: meta.accent }}
                >
                  {[scopeLabel, rangeLabel].filter(Boolean).join(" · ")}
                </div>
              )}
              <h2 className="mt-1 text-[18px] font-bold text-[#403770] -tracking-[0.01em]">
                {heading}
              </h2>
              <div className="mt-1.5 text-[12px] text-[#544A78]">
                <strong className="tabular-nums">{itemCount}</strong>{" "}
                {itemCount === 1 ? itemNoun : `${itemNoun}s`} ·{" "}
                <strong className="tabular-nums">
                  {formatMoney(totalAmt)}
                </strong>
                {isCold && (
                  <span className="text-[#8A80A8] font-medium"> at risk</span>
                )}
              </div>
              {isOverdue && (
                <div className="mt-2 text-[11px] leading-snug text-[#8F5218]">
                  Open deals whose <strong>close date has passed</strong>.
                  Advance the stage, update the date, or mark as lost.
                </div>
              )}
              {isCold && (
                <div className="mt-2 text-[11px] leading-snug text-[#3F5A72]">
                  Top districts with{" "}
                  <strong>no logged activity in 21+ days</strong>. Send a
                  check-in, book a meeting, or update the account.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="fm-focus-ring w-7 h-7 rounded-md border border-[#D4CFE2] bg-white text-[#544A78] inline-flex items-center justify-center hover:bg-[#FBF9FC] [transition-duration:120ms] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {itemCount === 0 ? (
            <div className="p-10 text-center text-[#8A80A8] text-[13px]">
              {isCold
                ? "No cold districts — everything has recent activity."
                : isOverdue
                  ? "No past-due open deals."
                  : "No deals in this range."}
            </div>
          ) : (
            groups.map((g) => {
              if (g.flat && g.kind === "overdue") {
                return (
                  <div key="overdue">
                    {g.items.map((d) => (
                      <OverdueDealRow key={d.id} deal={d} />
                    ))}
                  </div>
                );
              }
              if (g.flat && g.kind === "cold") {
                return (
                  <div key="cold">
                    {g.items.map((c) => (
                      <ColdDistrictRow key={c.leaid} district={c} />
                    ))}
                  </div>
                );
              }
              if (g.flat) {
                // unreachable for type narrowing; keeps TS happy
                return null;
              }
              return (
                <div key={g.dateIso}>
                  <div className="px-5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8] bg-[#FBF9FC] border-b border-[#EFEDF5] flex justify-between">
                    <span>{fmtDateShort(g.dateIso)}</span>
                    <span className="text-[#A69DC0] font-medium">
                      {dayName(g.dateIso)}
                    </span>
                  </div>
                  {g.items.map((d) => (
                    <OppDrawerEventRow key={d.id} deal={d} />
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E2DEEC] bg-[#FBF9FC] text-[11px] text-[#8A80A8] flex justify-between items-center">
          <span>
            Press{" "}
            <kbd className="px-1.5 py-px text-[10px] bg-white border border-[#D4CFE2] rounded text-[#544A78] font-semibold">
              Esc
            </kbd>{" "}
            to close
          </span>
        </div>
      </aside>
    </>
  );
}

// Small inline row used for OppEvent items inside the drawer body.
function OppDrawerEventRow({ deal }: { deal: OppEvent }) {
  const sty = OPP_STYLE[deal.kind];
  const Icon = sty.icon;
  return (
    <div className="px-5 py-3 flex items-start gap-3 border-b border-[#F7F5FA] bg-white">
      <div
        className="w-7 h-7 rounded-md flex-shrink-0 inline-flex items-center justify-center"
        style={{ background: sty.bg, color: sty.color }}
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-semibold text-[#403770] truncate">
            {deal.districtName ?? "Unknown district"}
          </div>
          <div
            className="text-[13px] font-bold tabular-nums flex-shrink-0"
            style={{ color: sty.color }}
          >
            {formatMoney(deal.amount)}
          </div>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-[#6E6390] flex items-center gap-2 flex-wrap">
            <span>{sty.label}</span>
            <span className="text-[#C2BBD4]">·</span>
            <span>{deal.stage ?? "—"}</span>
          </div>
          {deal.detailsLink && (
            <a
              href={deal.detailsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#544A78] border border-[#D4CFE2] hover:bg-[#F7F5FA] transition-colors duration-100 fm-focus-ring"
            >
              View
              <ExternalLink className="w-3 h-3" strokeWidth={2} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
