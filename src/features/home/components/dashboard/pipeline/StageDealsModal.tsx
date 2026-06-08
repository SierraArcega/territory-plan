"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/features/shared/lib/format";
import Modal from "@/features/shared/components/Modal";
import { PIPELINE_STAGES, type OppView } from "@/features/home/lib/pipeline";
import { TIER_STYLE, sourceLabel, sourceColor, fmtShortDate } from "./health";
import OverdueBadge from "./OverdueBadge";

const STAGE_NAME = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.name]));
const fmt = (v: number) => formatCurrency(v, true);
const PAGE = 50; // never render more than 50 rows at once (CLAUDE.md)

// Drill-in from the funnel: the open deals in one stage (already source-filtered).
// The full stage book can exceed 50 (team mode runs into the hundreds), so the
// header counts every deal while the table reveals them a page at a time.
export default function StageDealsModal({
  stagePrefix,
  opps,
  onClose,
}: {
  stagePrefix: number | null;
  opps: OppView[];
  onClose: () => void;
}) {
  const open = stagePrefix != null;
  const [visible, setVisible] = useState(PAGE);
  const deals = open ? opps.filter((o) => o.stagePrefix === stagePrefix) : [];
  const stageName = open ? STAGE_NAME.get(stagePrefix) ?? "Stage" : "Stage";
  const shown = deals.slice(0, visible);

  // Reset to the first page whenever a different stage is opened.
  useEffect(() => { setVisible(PAGE); }, [stagePrefix]);

  return (
    <Modal open={open} onClose={onClose} ariaLabel={`${stageName} deals`} maxWidth="max-w-[900px]">
      <div className="border-b border-[#E2DEEC] p-5 pr-12">
        <h2 className="text-lg font-bold text-[#403770]">{stageName}</h2>
        <p className="text-xs text-[#8A80A8]">{deals.length} open {deals.length === 1 ? "deal" : "deals"} in this stage.</p>
      </div>
      <div className="overflow-x-auto p-5">
        <table className="min-w-[560px] w-full text-left">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
              <th className="py-1.5 pr-3 font-semibold">Account</th>
              <th className="py-1.5 pr-3 font-semibold">Source</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Min commit</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Max budget</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Close</th>
              <th className="py-1.5 font-semibold">Health</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o, i) => {
              const h = TIER_STYLE[o.tier];
              return (
                <tr key={`${o.account}-${i}`} className="border-t border-[#E2DEEC]">
                  <td className="py-2 pr-3">
                    <div className="text-[13px] font-semibold text-[#403770] whitespace-nowrap">{o.account ?? "—"}</div>
                    {o.state && <div className="text-[10px] text-[#8A80A8]">{o.state}</div>}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap" style={{ color: sourceColor(o.source) }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: sourceColor(o.source) }} />{sourceLabel(o.source)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-[13px] font-bold tabular-nums text-[#403770]">{fmt(o.minPurchase)}</td>
                  <td className="py-2 pr-3 text-right text-[13px] tabular-nums text-[#8A80A8]">{fmt(o.maxBudget)}</td>
                  <td className="py-2 pr-3 text-right text-[12px] tabular-nums text-[#5C5378] whitespace-nowrap">{fmtShortDate(o.closeDate)}</td>
                  <td className="py-2">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: h.color, background: h.bg }}>{h.label}</span>
                      {o.overdue && <OverdueBadge />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {deals.length > visible && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className="rounded-full border border-[#D4CFE2] px-4 py-1.5 text-xs font-semibold text-[#5C5378] hover:bg-[#EFEDF5] whitespace-nowrap"
            >
              Show more ({deals.length - visible} remaining)
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
