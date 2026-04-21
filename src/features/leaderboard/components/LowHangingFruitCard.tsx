"use client";

import { useRef, useState } from "react";
import { Plus, ChevronDown, ExternalLink } from "lucide-react";
import type { IncreaseTarget } from "../lib/types";
import { formatCurrency } from "@/features/shared/lib/format";
import AddToPlanPopover from "./AddToPlanPopover";

interface Props {
  row: IncreaseTarget;
  selected: boolean;
  onToggleSelect: (leaid: string) => void;
  onOpenDetail: (row: IncreaseTarget) => void;
  onAddSuccess: (planName: string) => void;
}

const CATEGORY_LABEL: Record<IncreaseTarget["category"], string> = {
  missing_renewal: "Missing Renewal",
  fullmind_winback: "Fullmind Winback",
  ek12_winback: "EK12 Winback",
};

const CATEGORY_COLORS: Record<
  IncreaseTarget["category"],
  { bg: string; fg: string; dot: string }
> = {
  missing_renewal: { bg: "#FEF2F1", fg: "#B5453D", dot: "#F37167" },
  fullmind_winback: { bg: "#EFEDF5", fg: "#403770", dot: "#403770" },
  ek12_winback: { bg: "#FDEEE8", fg: "#7C3A21", dot: "#E07A5F" },
};

function heroRevenue(row: IncreaseTarget): number {
  return row.category === "missing_renewal" ? row.fy26Revenue : row.priorYearRevenue;
}

function formatLastSale(row: IncreaseTarget): string {
  const lcw = row.lastClosedWon;
  if (!lcw) return "No recent sale";
  const rep = lcw.repName ?? "—";
  const date = lcw.closeDate
    ? new Date(lcw.closeDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";
  const amt = lcw.amount != null ? formatCurrency(lcw.amount, true) : "—";
  return `${rep} · ${date} · ${amt}`;
}

export default function LowHangingFruitCard({
  row,
  selected,
  onToggleSelect,
  onOpenDetail,
  onAddSuccess,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const cat = CATEGORY_COLORS[row.category];
  const products = row.productTypes.slice(0, 2);
  const overflow = row.productTypes.length - products.length;

  const classes = [
    "relative bg-white border rounded-lg shadow-sm p-4 cursor-pointer transition-shadow duration-150 hover:shadow-lg",
    selected ? "bg-[#EFEDF5] border-l-4 border-[#403770] border-y border-r-[#D4CFE2]" : "border-[#D4CFE2]",
  ].join(" ");

  return (
    <div
      className={classes}
      onClick={() => onOpenDetail(row)}
      data-testid={`lhf-card-${row.leaid}`}
    >
      {/* Row 1: checkbox + name/state + add button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleSelect(row.leaid)}
            aria-label={`Select ${row.districtName}`}
            className="mt-0.5 w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]"
          />
          <div className="min-w-0">
            <div className="font-semibold text-[#403770] truncate">{row.districtName}</div>
            <div className="text-xs text-[#8A80A8]">{row.state}</div>
          </div>
        </div>
        {row.inPlan ? (
          <a
            href={row.lmsId ? `https://lms.fullmindlearning.com/districts/${row.lmsId}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-[#403770] text-[#403770] hover:bg-[#403770] hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            LMS
          </a>
        ) : (
          <button
            ref={addBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPopoverOpen((v) => !v);
            }}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>
        )}
      </div>

      {/* Row 2: hero revenue */}
      <div className="mt-3">
        <div className="text-xl font-bold text-[#403770] tabular-nums">
          {formatCurrency(heroRevenue(row), true)}
        </div>
        <div className="text-xs text-[#8A80A8]">
          {row.category === "missing_renewal" ? "FY26 revenue" : `${row.priorYearFy ?? "prior"} revenue`}
        </div>
      </div>

      {/* Row 3: sessions + products */}
      <div className="mt-2 text-xs text-[#6E6390]">
        {row.fy26SessionCount != null ? `${row.fy26SessionCount.toLocaleString()} sessions` : "—"}
        {products.length > 0 && (
          <>
            {" · "}
            {products.join(", ")}
            {overflow > 0 && ` +${overflow}`}
          </>
        )}
      </div>

      {/* Row 4: last sale */}
      <div className="mt-1 text-xs text-[#A69DC0]">
        {formatLastSale(row)}
      </div>

      {/* Footer: category chip + suggested */}
      <div className="mt-3 pt-3 border-t border-[#E2DEEC] flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{ backgroundColor: cat.bg, color: cat.fg }}
        >
          <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.dot }} />
          {CATEGORY_LABEL[row.category]}
        </span>
        {row.suggestedTarget != null && (
          <span className="text-xs text-[#6E6390] tabular-nums">
            Suggested: {formatCurrency(row.suggestedTarget, true)}
          </span>
        )}
      </div>

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
    </div>
  );
}
