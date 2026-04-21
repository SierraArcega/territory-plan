"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, Plus, ChevronDown } from "lucide-react";
import type { IncreaseTarget } from "../lib/types";
import { formatCurrency } from "@/features/shared/lib/format";
import AddToPlanPopover from "./AddToPlanPopover";

interface Props {
  row: IncreaseTarget | null;
  onClose: () => void;
  onAddSuccess: (planName: string) => void;
}

function fyCell(val: number | null): string {
  return val != null ? formatCurrency(val, true) : "—";
}

export default function LowHangingFruitDetailDrawer({ row, onClose, onAddSuccess }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  if (!row) return null;
  const t = row.revenueTrend;
  const lcw = row.lastClosedWon;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-labelledby="lhf-drawer-title"
        className="fixed top-0 right-0 h-full w-[480px] max-w-[100vw] bg-white shadow-xl border-l border-[#E2DEEC] z-50 overflow-y-auto"
      >
        <header className="flex items-start justify-between p-5 border-b border-[#E2DEEC]">
          <div>
            <h2 id="lhf-drawer-title" className="text-lg font-bold text-[#403770]">{row.districtName}</h2>
            <div className="text-xs text-[#8A80A8]">
              {row.state}
              {row.lmsId && (
                <>
                  {" · "}
                  <a
                    href={`https://lms.fullmindlearning.com/districts/${row.lmsId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[#403770] hover:underline"
                  >
                    Open in LMS <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#EFEDF5] text-[#6E6390]"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-5">
          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
              Revenue trend
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { fy: "FY24", val: t.fy24 },
                { fy: "FY25", val: t.fy25 },
                { fy: "FY26", val: t.fy26 },
                { fy: "FY27", val: t.fy27 },
              ].map((c) => (
                <div key={c.fy} className="bg-[#F7F5FA] rounded-lg p-2">
                  <div className="text-[10px] text-[#8A80A8]">{c.fy}</div>
                  <div className="text-sm font-bold text-[#403770] tabular-nums">{fyCell(c.val)}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
              Products purchased
            </div>
            <div className="flex flex-wrap gap-1.5">
              {row.productTypes.length === 0 ? (
                <span className="text-xs text-[#A69DC0]">No product history</span>
              ) : (
                row.productTypes.map((p) => (
                  <span key={p} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white bg-[#403770]">
                    {p}
                  </span>
                ))
              )}
              {row.subProducts.map((sp) => (
                <span key={`sp-${sp}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-[#6E6390] bg-[#EFEDF5] border border-[#D4CFE2]">
                  {sp}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
              FY26 breakdown
            </div>
            <div className="text-xs text-[#6E6390]">
              Completed {formatCurrency(row.fy26CompletedRevenue)}
              {" · "}Scheduled {formatCurrency(row.fy26ScheduledRevenue)}
              {row.fy26SessionCount != null && ` · ${row.fy26SessionCount.toLocaleString()} sessions`}
            </div>
          </section>

          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
              Last sale
            </div>
            {lcw ? (
              <div className="text-xs text-[#6E6390]">
                Closed Won {lcw.schoolYr ?? ""}
                {lcw.amount != null && ` · ${formatCurrency(lcw.amount)}`}
                {lcw.closeDate && ` · ${new Date(lcw.closeDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                {lcw.repName && ` · ${lcw.repName}`}
              </div>
            ) : (
              <div className="text-xs text-[#A69DC0]">No closed-won opportunity on file.</div>
            )}
          </section>

          {row.suggestedTarget != null && (
            <section className="bg-[#F7F5FA] rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
                Suggested target
              </div>
              <div className="text-base font-bold text-[#403770] tabular-nums">
                {formatCurrency(row.suggestedTarget, true)}
              </div>
              <div className="text-xs text-[#8A80A8]">
                {row.category === "missing_renewal" ? "1.05× FY26 revenue" : "0.90× prior year revenue"}
              </div>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 bg-white border-t border-[#E2DEEC] p-4">
          {row.inPlan ? (
            <a
              href={row.lmsId ? `https://lms.fullmindlearning.com/districts/${row.lmsId}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold border border-[#403770] text-[#403770] hover:bg-[#403770] hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in LMS
            </a>
          ) : (
            <button
              ref={addBtnRef}
              type="button"
              onClick={() => setPopoverOpen((v) => !v)}
              className="w-full inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add to plan
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>
          )}
          {popoverOpen && (
            <AddToPlanPopover
              district={row}
              anchorRef={addBtnRef}
              isOpen={popoverOpen}
              onClose={() => setPopoverOpen(false)}
              onSuccess={(planName) => {
                setPopoverOpen(false);
                onAddSuccess(planName);
              }}
            />
          )}
        </footer>
      </aside>
    </>
  );
}
