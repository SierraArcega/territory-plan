"use client";

// OppSummaryStrip — header strip with 4 kind pills (won/lost/created/progressed)
// + past-due pill + cold pill. Each click → onOpen(kind).
//
// Presentational: receives `events`, `overdueDeals`, `coldList` as props.
// The view owns data fetching and passes them in.

import { Snowflake } from "lucide-react";
import type { OppEvent, OpenDeal } from "@/features/shared/types/api-types";
import { OPP_STYLE } from "./oppStyle";
import { formatMoney } from "./formatMoney";
import type { OppDrawerKind } from "./OppDrawer";
import type { ColdDistrict } from "./ColdDistrictRow";

interface OppSummaryStripProps {
  events: OppEvent[];
  overdueDeals: OpenDeal[];
  coldList: ColdDistrict[];
  /** Display label for the time window (e.g. "This week"). */
  rangeLabel?: string;
  /** "Team pipeline" or "Your pipeline". */
  scopeLabel?: string;
  onOpen: (kind: OppDrawerKind) => void;
}

interface Stat {
  k: "won" | "lost" | "created" | "progressed" | "closing";
  label: string;
}

const STATS: Stat[] = [
  { k: "won", label: "Closed won" },
  { k: "lost", label: "Closed lost" },
  { k: "created", label: "New deals" },
  { k: "progressed", label: "Progressed" },
  { k: "closing", label: "Closing" },
];

export default function OppSummaryStrip({
  events,
  overdueDeals,
  coldList,
  rangeLabel,
  scopeLabel,
  onOpen,
}: OppSummaryStripProps) {
  // Bucket events by kind once.
  const buckets = {
    won: [] as OppEvent[],
    lost: [] as OppEvent[],
    created: [] as OppEvent[],
    progressed: [] as OppEvent[],
    closing: [] as OppEvent[],
  };
  for (const e of events) buckets[e.kind].push(e);

  const overdueAmt = overdueDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
  const coldAmt = coldList.reduce((s, d) => s + (d.amount ?? 0), 0);

  return (
    <div className="flex items-center gap-0 px-4 py-2.5 bg-[#FBF9FC] border border-[#E2DEEC] rounded-[10px] min-w-0 overflow-x-auto">
      {(scopeLabel || rangeLabel) && (
        <button
          type="button"
          onClick={() => onOpen("all")}
          title="See all deal activity in range"
          aria-label={`See all deal activity${rangeLabel ? ` for ${rangeLabel.toLowerCase()}` : ""}`}
          className="fm-focus-ring text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8] mr-4 inline-flex items-center gap-1.5 bg-transparent border-0 cursor-pointer px-1.5 py-1 rounded-md hover:bg-[#F2EFF7] hover:text-[#403770] [transition-duration:120ms] transition-colors"
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#F37167" }}
            aria-hidden
          />
          {[scopeLabel, rangeLabel].filter(Boolean).join(" · ")}
        </button>
      )}

      {STATS.map((s, i) => {
        const sty = OPP_STYLE[s.k];
        const list = buckets[s.k];
        const n = list.length;
        const amt = list.reduce((sum, e) => sum + (e.amount ?? 0), 0);
        const disabled = n === 0;
        return (
          <button
            key={s.k}
            type="button"
            disabled={disabled}
            onClick={() => onOpen(s.k)}
            title={disabled ? "None in range" : `See ${n} ${s.label.toLowerCase()}`}
            aria-label={
              disabled
                ? `No ${s.label.toLowerCase()} in range`
                : `See ${n} ${s.label.toLowerCase()} ${n === 1 ? "deal" : "deals"} totaling ${formatMoney(amt)}`
            }
            className="fm-focus-ring flex items-baseline gap-1.5 px-4 py-1.5 bg-transparent [transition-duration:120ms] transition-colors hover:enabled:bg-[#F2EFF7] disabled:opacity-55 disabled:cursor-default whitespace-nowrap flex-shrink-0"
            style={{
              minWidth: 160,
              borderLeft: i === 0 ? "none" : "1px solid #E2DEEC",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <span
              className="text-[14px] font-bold tabular-nums"
              style={{ color: sty.color }}
            >
              {n}
            </span>
            <span className="text-[11px] text-[#8A80A8] font-medium">
              {s.label}
            </span>
            <span className="ml-auto text-[11px] font-semibold text-[#403770] tabular-nums">
              {formatMoney(amt)}
            </span>
          </button>
        );
      })}

      {(overdueDeals.length > 0 || coldList.length > 0) && (
        <div className="ml-auto flex items-center gap-2 pl-3 flex-shrink-0">
          {overdueDeals.length > 0 && (
            <button
              type="button"
              onClick={() => onOpen("overdue")}
              title={`${overdueDeals.length} open ${overdueDeals.length === 1 ? "deal has" : "deals have"} a close date in the past`}
              aria-label={`See ${overdueDeals.length} past-due open ${overdueDeals.length === 1 ? "deal" : "deals"} totaling ${formatMoney(overdueAmt)}`}
              className="fm-focus-ring flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF4E6] border border-[#F3B26A] cursor-pointer hover:bg-[#FFE9CC] hover:border-[#E09545] [transition-duration:120ms] transition-colors whitespace-nowrap"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "#E09545" }}
                aria-hidden
              />
              <span className="text-[13px] font-bold text-[#8F5218] tabular-nums">
                {overdueDeals.length}
              </span>
              <span className="text-[11px] font-semibold text-[#8F5218]">
                Past due
              </span>
              <span className="text-[11px] font-semibold text-[#8F5218] tabular-nums opacity-70 pl-1 border-l border-[#8F521840]">
                {formatMoney(overdueAmt)}
              </span>
            </button>
          )}

          {coldList.length > 0 && (
            <button
              type="button"
              onClick={() => onOpen("cold")}
              title={`${coldList.length} top ${coldList.length === 1 ? "district has" : "districts have"} had no logged activity in 21+ days`}
              aria-label={`See ${coldList.length} ${coldList.length === 1 ? "district" : "districts"} going cold totaling ${formatMoney(coldAmt)}`}
              className="fm-focus-ring flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF3F7] border border-[#A9BFD0] cursor-pointer hover:bg-[#DCE6EF] hover:border-[#8AA4BB] [transition-duration:120ms] transition-colors whitespace-nowrap"
            >
              <Snowflake
                className="w-3 h-3 flex-shrink-0"
                style={{ color: "#4C6B85" }}
                strokeWidth={2}
              />
              <span className="text-[13px] font-bold text-[#3F5A72] tabular-nums">
                {coldList.length}
              </span>
              <span className="text-[11px] font-semibold text-[#4C6B85]">
                going cold
              </span>
              <span className="text-[11px] font-semibold text-[#4C6B85] tabular-nums opacity-70 pl-1 border-l border-[#4C6B8540]">
                {formatMoney(coldAmt)}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
