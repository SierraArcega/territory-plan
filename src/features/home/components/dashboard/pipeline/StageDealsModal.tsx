"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "@/features/shared/lib/format";
import { PIPELINE_STAGES, type OppView } from "@/features/home/lib/pipeline";
import { HEALTH_STYLE, sourceLabel, sourceColor, fmtShortDate } from "./health";

const STAGE_NAME = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.name]));
const fmt = (v: number) => formatCurrency(v, true);

// Drill-in from the funnel: the open deals in one stage (already source-filtered).
export default function StageDealsModal({
  stagePrefix,
  opps,
  onClose,
}: {
  stagePrefix: number | null;
  opps: OppView[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (stagePrefix == null) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [stagePrefix, onClose]);

  if (stagePrefix == null) return null;
  const deals = opps.filter((o) => o.stagePrefix === stagePrefix);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#403770]/60 p-4 sm:p-8" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${STAGE_NAME.get(stagePrefix)} deals`}>
      <div className="w-[96vw] max-w-[900px] rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-[#E2DEEC] p-5">
          <div>
            <h2 className="text-lg font-bold text-[#403770]">{STAGE_NAME.get(stagePrefix) ?? "Stage"}</h2>
            <p className="text-xs text-[#8A80A8]">{deals.length} open {deals.length === 1 ? "deal" : "deals"} in this stage.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-[#5C5378] hover:bg-[#EFEDF5]"><X size={16} /></button>
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
              {deals.map((o, i) => {
                const h = HEALTH_STYLE[o.health];
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
                    <td className="py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ color: h.color, background: h.bg }}>{h.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
