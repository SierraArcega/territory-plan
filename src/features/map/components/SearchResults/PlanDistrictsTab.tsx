"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  useUpdateDistrictTargets,
  useRemoveDistrictFromPlan,
  useAddDistrictsToPlan,
  useServices,
} from "@/lib/api";
import { useMapV2Store } from "@/features/map/lib/store";
import type {
  TerritoryPlanDetail,
  TerritoryPlanDistrict,
  DistrictPacing,
} from "@/features/shared/types/api-types";

// ─── Formatting Helpers ──────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function getAttainmentStyle(pct: number): { bg: string; text: string } {
  if (pct >= 70) return { bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" };
  if (pct >= 40) return { bg: "bg-[#FEF3C7]", text: "text-[#92700C]" };
  return { bg: "bg-[#FEF2F1]", text: "text-[#9B4D46]" };
}

function getPaceBadge(current: number, prior: number): { label: string; bg: string; text: string } | null {
  if (prior === 0 && current === 0) return null;
  if (prior === 0) return { label: "New", bg: "bg-[#EBF0F7]", text: "text-[#3D5A80]" };
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct > 0) return { label: `▲ ${pct}%`, bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" };
  if (pct === 0) return { label: "—", bg: "bg-[#f0edf5]", text: "text-[#8A80A8]" };
  if (pct > -30) return { label: `▼ ${Math.abs(pct)}%`, bg: "bg-[#FEF3C7]", text: "text-[#92700C]" };
  return { label: `▼ ${Math.abs(pct)}%`, bg: "bg-[#FEF2F1]", text: "text-[#9B4D46]" };
}

function getPercentOfBadge(current: number, fullPrior: number): { label: string; bg: string; text: string } | null {
  if (fullPrior === 0) return null;
  const pct = Math.round((current / fullPrior) * 100);
  if (pct >= 70) return { label: `${pct}%`, bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" };
  if (pct >= 40) return { label: `${pct}%`, bg: "bg-[#FEF3C7]", text: "text-[#92700C]" };
  return { label: `${pct}%`, bg: "bg-[#FEF2F1]", text: "text-[#9B4D46]" };
}

// ─── Sort ────────────────────────────────────────────────────────

type SortColumn = "name" | "target" | "actual" | "attainment";

// ─── Main Component ──────────────────────────────────────────────

interface PlanDistrictsTabProps {
  plan: TerritoryPlanDetail;
  onClose: () => void;
}

export default function PlanDistrictsTab({ plan, onClose }: PlanDistrictsTabProps) {
  const [expandedLeaid, setExpandedLeaid] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const getTotal = (d: TerritoryPlanDistrict) =>
    (d.renewalTarget ?? 0) + (d.expansionTarget ?? 0) + (d.winbackTarget ?? 0) + (d.newBusinessTarget ?? 0);

  const getAttainment = (d: TerritoryPlanDistrict) => {
    const total = getTotal(d);
    if (total === 0) return null;
    const actual = d.actuals?.totalRevenue ?? 0;
    return Math.round((actual / total) * 100);
  };

  const sortedDistricts = useMemo(() => {
    const sorted = [...plan.districts];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name": cmp = (a.name ?? "").localeCompare(b.name ?? ""); break;
        case "target": cmp = getTotal(a) - getTotal(b); break;
        case "actual": cmp = (a.actuals?.totalRevenue ?? 0) - (b.actuals?.totalRevenue ?? 0); break;
        case "attainment": cmp = (getAttainment(a) ?? -1) - (getAttainment(b) ?? -1); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [plan.districts, sortCol, sortDir]);

  const totals = useMemo(() => {
    return plan.districts.reduce(
      (acc, d) => ({
        target: acc.target + getTotal(d),
        actual: acc.actual + (d.actuals?.totalRevenue ?? 0),
      }),
      { target: 0, actual: 0 }
    );
  }, [plan.districts]);

  if (plan.districts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-10 h-10 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No districts yet</p>
        <p className="text-xs text-[#A69DC0] mt-1">Add districts to start building your territory plan.</p>
        <div className="mt-4 flex items-center gap-2">
          <AddDistrictButton planId={plan.id} existingLeaids={[]} />
          <BrowseMapButton planId={plan.id} onClose={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section label */}
      <div className="shrink-0 px-5 pt-2.5 pb-1.5 flex items-baseline justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">Revenue Targets</span>
        <span className="text-[9px] text-[#C2BBD4]">Click row to edit targets &amp; view pacing</span>
      </div>

      {/* Table header */}
      <div className="shrink-0 border-y border-[#E2DEEC] bg-[#FAFAFE]">
        <div className="grid grid-cols-[1fr_110px_110px_55px_28px] items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
          <SortBtn label="District" col="name" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
          <SortBtn label="Rev. Target" col="target" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <SortBtn label="Rev. Actual" col="actual" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <SortBtn label="Attain." col="attainment" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="center" />
          <span />
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedDistricts.map((district) => (
          <DistrictRow
            key={district.leaid}
            district={district}
            planId={plan.id}
            fiscalYear={plan.fiscalYear}
            isExpanded={expandedLeaid === district.leaid}
            onToggle={() =>
              setExpandedLeaid((prev) =>
                prev === district.leaid ? null : district.leaid
              )
            }
          />
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E2DEEC] px-5 py-3 flex items-center justify-between bg-[#FAFAFE]">
        <div className="flex items-center gap-2">
          <AddDistrictButton
            planId={plan.id}
            existingLeaids={plan.districts.map((d) => d.leaid)}
          />
          <BrowseMapButton planId={plan.id} onClose={onClose} />
        </div>
        <span className="text-[11px] text-[#A69DC0]">
          {plan.districts.length} district{plan.districts.length !== 1 ? "s" : ""}
          {" · Rev. Target: "}
          <span className="font-semibold text-[#544A78]">{formatCurrency(totals.target)}</span>
          {" · Actual: "}
          <span className="font-semibold text-[#544A78]">{formatCurrency(totals.actual)}</span>
        </span>
      </div>
    </div>
  );
}

// ─── District Row ───────────────────────────────────────────────

function DistrictRow({
  district,
  planId,
  fiscalYear,
  isExpanded,
  onToggle,
}: {
  district: TerritoryPlanDistrict;
  planId: string;
  fiscalYear: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const updateTargets = useUpdateDistrictTargets();
  const removeMutation = useRemoveDistrictFromPlan();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const totalTarget =
    (district.renewalTarget ?? 0) +
    (district.expansionTarget ?? 0) +
    (district.winbackTarget ?? 0) +
    (district.newBusinessTarget ?? 0);

  const actualRevenue = district.actuals?.totalRevenue ?? 0;
  const attainment = totalTarget > 0 ? Math.round((actualRevenue / totalTarget) * 100) : null;

  const handleTargetSave = useCallback(
    (field: string, value: number | null) => {
      updateTargets.mutate({ planId, leaid: district.leaid, [field]: value });
    },
    [planId, district.leaid, updateTargets]
  );

  const handleNotesSave = useCallback(
    (notes: string) => {
      updateTargets.mutate({ planId, leaid: district.leaid, notes: notes || null });
    },
    [planId, district.leaid, updateTargets]
  );

  const handleRemove = () => {
    removeMutation.mutate({ planId, leaid: district.leaid });
    setConfirmRemove(false);
  };

  return (
    <div className={`${isExpanded ? "border-b-2 border-[#E2DEEC]" : "border-b border-[#f0edf5]"} last:border-b-0`}>
      {/* Collapsed row */}
      <div
        className={`grid grid-cols-[1fr_110px_110px_55px_28px] items-center px-5 py-2.5 cursor-pointer transition-colors ${
          isExpanded ? "bg-[#FAFAFE] border-b border-[#E2DEEC]" : "hover:bg-[#FAFAFE]"
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            className={`shrink-0 transition-transform ${isExpanded ? "rotate-90 text-[#403770]" : "text-[#C2BBD4]"}`}
          >
            <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth={isExpanded ? "1.5" : "1.2"} fill="none" strokeLinecap="round" />
          </svg>
          <span className={`text-xs truncate ${isExpanded ? "font-semibold text-[#403770]" : "font-medium text-[#544A78]"}`}>
            {district.name}
          </span>
        </div>

        {totalTarget > 0 ? (
          <span className={`text-xs text-right tabular-nums ${isExpanded ? "font-bold text-[#403770]" : "font-semibold text-[#544A78]"}`}>
            {formatCurrency(totalTarget)}
          </span>
        ) : (
          <span className="text-[10px] text-right text-[#C2BBD4] italic">Not set</span>
        )}

        <span className="text-xs text-right tabular-nums text-[#6E6390]">
          {formatCurrency(actualRevenue)}
        </span>

        <div className="text-center">
          {attainment != null ? (
            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${getAttainmentStyle(attainment).bg} ${getAttainmentStyle(attainment).text}`}>
              {attainment}%
            </span>
          ) : (
            <span className="text-[11px] text-[#C2BBD4]">—</span>
          )}
        </div>

        {/* Remove button */}
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          {isExpanded && (
            confirmRemove ? (
              <button
                onClick={handleRemove}
                disabled={removeMutation.isPending}
                className="text-[9px] font-bold text-[#F37167] hover:text-[#d4534a] transition-colors"
              >
                {removeMutation.isPending ? "..." : "Yes"}
              </button>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                onMouseLeave={() => setConfirmRemove(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#C2BBD4] hover:text-[#F37167] hover:bg-[#FEF2F1] transition-colors"
                aria-label={`Remove ${district.name}`}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 3H10M4 3V2H8V3M5 5V9M7 5V9M3 3V10.5C3 10.8 3.2 11 3.5 11H8.5C8.8 11 9 10.8 9 10.5V3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-5 pb-4 pl-8 pt-3 bg-[#FAFAFE] space-y-3.5">
          {/* Revenue Target Breakdown — 4 across */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0] mb-1.5">Revenue Target Breakdown</div>
            <div className="grid grid-cols-4 gap-1.5">
              <TargetCard label="Renewal" field="renewalTarget" value={district.renewalTarget} onSave={handleTargetSave} />
              <TargetCard label="Expansion" field="expansionTarget" value={district.expansionTarget} onSave={handleTargetSave} />
              <TargetCard label="Winback" field="winbackTarget" value={district.winbackTarget} onSave={handleTargetSave} />
              <TargetCard label="New Biz" field="newBusinessTarget" value={district.newBusinessTarget} onSave={handleTargetSave} />
            </div>
          </div>

          {/* YoY Pacing + Notes side-by-side */}
          <div className="grid grid-cols-[3fr_2fr] gap-3">
            {/* Left: Pacing table */}
            <PacingTable pacing={district.pacing} fiscalYear={fiscalYear} />

            {/* Right: Services + Notes */}
            <div className="space-y-3">
              <ServiceSelector planId={planId} district={district} />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0] mb-1.5">Notes</div>
                <AutoSaveTextarea
                  initialValue={district.notes ?? ""}
                  onSave={handleNotesSave}
                  placeholder="Add notes about this district..."
                />
              </div>
              <a
                href={`https://lms.fullmindlearning.com/opportunities/kanban?school_year=${fiscalYear - 1}-${String(fiscalYear).slice(-2)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6E6390] hover:text-[#403770] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Create opportunity in LMS
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Target Card ─────────────────────────────────────────────────

function TargetCard({
  label,
  field,
  value,
  onSave,
}: {
  label: string;
  field: string;
  value: number | null;
  onSave: (field: string, value: number | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(value != null ? String(value) : "");
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseCurrency(editValue);
    if (parsed !== value) {
      onSave(field, parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") inputRef.current?.blur();
    if (e.key === "Escape") setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border-2 border-[#403770]/30 rounded-lg" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] text-[#8A80A8]">{label}</span>
        <div className="relative w-[72px]">
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-[#A69DC0]">$</span>
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full pl-3.5 pr-1 py-0.5 text-[11px] text-right bg-transparent focus:outline-none tabular-nums text-[#403770] font-bold"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-[#E2DEEC] rounded-lg cursor-pointer hover:border-[#403770]/30 hover:shadow-sm transition-all group/card"
    >
      <span className="text-[10px] text-[#8A80A8]">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-bold text-[#403770] tabular-nums">
          {value != null ? formatCurrency(value) : "—"}
        </span>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className="text-[#C2BBD4] opacity-0 group-hover/card:opacity-100 transition-opacity">
          <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// ─── Pacing Table ────────────────────────────────────────────────

export function PacingTable({ pacing, fiscalYear }: { pacing?: DistrictPacing; fiscalYear: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const fyShort = String(fiscalYear).slice(-2);
  const priorFyShort = String(fiscalYear - 1).slice(-2);

  const hasBreakdown = pacing?.serviceTypeBreakdown && pacing.serviceTypeBreakdown.length > 0;

  // Remaining metrics after Revenue
  const tailMetrics = pacing
    ? [
        { label: "Pipeline", current: pacing.currentPipeline, sameDate: pacing.priorSameDatePipeline, full: pacing.priorFullPipeline, isCurrency: true },
        { label: "Deals", current: pacing.currentDeals, sameDate: pacing.priorSameDateDeals, full: pacing.priorFullDeals, isCurrency: false },
        { label: "Sessions", current: pacing.currentSessions, sameDate: pacing.priorSameDateSessions, full: pacing.priorFullSessions, isCurrency: false },
      ]
    : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">Year-over-Year Pacing</span>
        <span className="text-[8px] text-[#8A80A8] bg-[#f0edf5] px-1.5 py-0.5 rounded">FY{fyShort} vs FY{priorFyShort}</span>
      </div>
      <div className="bg-white border border-[#E2DEEC] rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] bg-[#FAFAFE] border-b border-[#E2DEEC]">
          <div className="px-2 py-1" />
          <div className="px-2 py-1" />
          <div className="px-2 py-1 text-center border-l border-[#E2DEEC] text-[8px] font-bold text-[#8A80A8]">Same Date PFY</div>
          <div className="px-2 py-1 text-center border-l border-[#E2DEEC] text-[8px] font-bold text-[#8A80A8]">Full PFY</div>
        </div>

        {!pacing ? (
          <div className="px-3 py-4 text-center text-[10px] text-[#C2BBD4] italic">No prior year data</div>
        ) : (
          <>
            {/* Revenue row — expandable when service-type breakdown exists */}
            {(() => {
              const revPaceBadge = getPaceBadge(pacing.currentRevenue, pacing.priorSameDateRevenue);
              const revPctBadge = getPercentOfBadge(pacing.currentRevenue, pacing.priorFullRevenue);
              return (
                <div
                  className={`grid grid-cols-[1fr_1fr_1fr_1fr] items-center py-1.5 border-b border-[#f0edf5] ${hasBreakdown ? "cursor-pointer hover:bg-[#FAFAFE]" : ""}`}
                  onClick={hasBreakdown ? () => setIsExpanded(!isExpanded) : undefined}
                >
                  <span className="px-2 text-[10px] text-[#6E6390] font-medium flex items-center gap-1">
                    {hasBreakdown && (
                      <svg
                        width="6"
                        height="6"
                        viewBox="0 0 6 6"
                        className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="M1.5 0.5L4.5 3L1.5 5.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                    Revenue
                  </span>
                  <span className="px-2 text-right text-[11px] font-bold text-[#544A78] tabular-nums">
                    {formatCurrency(pacing.currentRevenue)}
                  </span>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[10px] text-[#8A80A8] tabular-nums">{formatCurrency(pacing.priorSameDateRevenue)} </span>
                    {revPaceBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${revPaceBadge.bg} ${revPaceBadge.text} font-semibold`}>{revPaceBadge.label}</span>}
                  </div>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[10px] text-[#8A80A8] tabular-nums">{formatCurrency(pacing.priorFullRevenue)} </span>
                    {revPctBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${revPctBadge.bg} ${revPctBadge.text} font-semibold`}>{revPctBadge.label}</span>}
                  </div>
                </div>
              );
            })()}

            {/* Service-type breakdown sub-rows (expanded) */}
            {isExpanded && hasBreakdown && pacing.serviceTypeBreakdown!.map((st) => {
              const paceBadge = getPaceBadge(st.currentRevenue, st.priorSameDateRevenue);
              const pctBadge = getPercentOfBadge(st.currentRevenue, st.priorFullRevenue);
              return (
                <div
                  key={st.serviceType}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center py-1 border-b border-[#f0edf5] bg-[#FAFAFE]/50"
                >
                  <span className="px-2 pl-5 text-[9px] text-[#8A80A8]">{st.serviceType}</span>
                  <div className="px-2 text-right tabular-nums">
                    <div className="text-[10px] text-[#6E6390]">{formatCurrency(st.currentRevenue)}</div>
                    <div className="text-[8px] text-[#A69DC0]">{st.currentSessions} sessions</div>
                  </div>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <div>
                      <span className="text-[9px] text-[#A69DC0] tabular-nums">{formatCurrency(st.priorSameDateRevenue)} </span>
                      {paceBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${paceBadge.bg} ${paceBadge.text} font-semibold`}>{paceBadge.label}</span>}
                    </div>
                    <div className="text-[8px] text-[#C2BBD4]">{st.priorSameDateSessions} sessions</div>
                  </div>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <div>
                      <span className="text-[9px] text-[#A69DC0] tabular-nums">{formatCurrency(st.priorFullRevenue)} </span>
                      {pctBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${pctBadge.bg} ${pctBadge.text} font-semibold`}>{pctBadge.label}</span>}
                    </div>
                    <div className="text-[8px] text-[#C2BBD4]">{st.priorFullSessions} sessions</div>
                  </div>
                </div>
              );
            })}

            {/* Pipeline, Deals, Sessions rows */}
            {tailMetrics!.map((m, i) => {
              const paceBadge = getPaceBadge(m.current, m.sameDate);
              const pctBadge = getPercentOfBadge(m.current, m.full);
              const isLast = i === tailMetrics!.length - 1;
              const fmt = m.isCurrency ? formatCurrency : (v: number) => String(v);
              return (
                <div
                  key={m.label}
                  className={`grid grid-cols-[1fr_1fr_1fr_1fr] items-center py-1.5 ${!isLast ? "border-b border-[#f0edf5]" : ""}`}
                >
                  <span className="px-2 text-[10px] text-[#6E6390] font-medium">{m.label}</span>
                  <span className="px-2 text-right text-[11px] font-bold text-[#544A78] tabular-nums">{fmt(m.current)}</span>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[10px] text-[#8A80A8] tabular-nums">{fmt(m.sameDate)} </span>
                    {paceBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${paceBadge.bg} ${paceBadge.text} font-semibold`}>{paceBadge.label}</span>}
                  </div>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[10px] text-[#8A80A8] tabular-nums">{fmt(m.full)} </span>
                    {pctBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${pctBadge.bg} ${pctBadge.text} font-semibold`}>{pctBadge.label}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Service Selector ────────────────────────────────────────────

function ServiceSelector({
  planId,
  district,
}: {
  planId: string;
  district: TerritoryPlanDistrict;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: allServices = [] } = useServices();
  const updateTargets = useUpdateDistrictTargets();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const returnIds = district.returnServices?.map((s) => s.id) || [];
  const newIds = district.newServices?.map((s) => s.id) || [];
  const allSelected = [...(district.returnServices || []), ...(district.newServices || [])];

  const toggleService = async (serviceId: number, category: "return" | "new") => {
    if (category === "return") {
      const updated = returnIds.includes(serviceId)
        ? returnIds.filter((id) => id !== serviceId)
        : [...returnIds, serviceId];
      await updateTargets.mutateAsync({ planId, leaid: district.leaid, returnServiceIds: updated });
    } else {
      const updated = newIds.includes(serviceId)
        ? newIds.filter((id) => id !== serviceId)
        : [...newIds, serviceId];
      await updateTargets.mutateAsync({ planId, leaid: district.leaid, newServiceIds: updated });
    }
  };

  return (
    <div ref={ref}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0] mb-1.5">Services</div>
      <div className="flex flex-wrap gap-1 items-center mb-1">
        {allSelected.map((s) => (
          <span key={s.id} className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: `${s.color}18`, color: s.color }}>
            {s.name}
          </span>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium text-[#8A80A8] border border-dashed border-[#D4CFE2] hover:border-[#403770]/30 hover:text-[#544A78] transition-colors"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M4 1.5V6.5M1.5 4H6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {allSelected.length === 0 ? "Add services" : "Edit"}
        </button>
      </div>

      {isOpen && (
        <div className="relative">
          <div className="absolute z-50 top-0 left-0 w-56 bg-white rounded-lg shadow-lg border border-[#D4CFE2] py-1 max-h-[280px] overflow-y-auto">
            {allServices.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-[#C2BBD4] italic">No services available</div>
            ) : (
              <>
                <div className="px-3 py-1 text-[9px] font-bold text-[#A69DC0] uppercase tracking-wide">Return Services</div>
                {allServices.map((service) => {
                  const isSelected = returnIds.includes(service.id);
                  return (
                    <button
                      key={`r-${service.id}`}
                      onClick={() => toggleService(service.id, "return")}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${isSelected ? "bg-[#f0edf5] text-[#403770]" : "text-[#544A78] hover:bg-[#FAFAFE]"}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-[#403770] border-[#403770]" : "border-[#D4CFE2]"}`}>
                        {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: service.color }} />
                      <span className="truncate">{service.name}</span>
                    </button>
                  );
                })}
                <div className="border-t border-[#f0edf5] my-1" />
                <div className="px-3 py-1 text-[9px] font-bold text-[#A69DC0] uppercase tracking-wide">New Services</div>
                {allServices.map((service) => {
                  const isSelected = newIds.includes(service.id);
                  return (
                    <button
                      key={`n-${service.id}`}
                      onClick={() => toggleService(service.id, "new")}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${isSelected ? "bg-[#f0edf5] text-[#403770]" : "text-[#544A78] hover:bg-[#FAFAFE]"}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-[#403770] border-[#403770]" : "border-[#D4CFE2]"}`}>
                        {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: service.color }} />
                      <span className="truncate">{service.name}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sort Button ─────────────────────────────────────────────────

function SortBtn({
  label,
  col,
  activeCol,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortColumn;
  activeCol: SortColumn;
  dir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
  align?: "left" | "right" | "center";
}) {
  const isActive = activeCol === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 hover:text-[#544A78] transition-colors ${
        align === "right" ? "justify-end pr-2" : align === "center" ? "justify-center" : ""
      } ${isActive ? "text-[#544A78]" : ""}`}
    >
      {label}
      {isActive && (
        <svg width="8" height="8" viewBox="0 0 8 8" className={dir === "desc" ? "rotate-180" : ""}>
          <path d="M4 2L6.5 6H1.5L4 2Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

// ─── Auto-save Textarea ──────────────────────────────────────────

function AutoSaveTextarea({
  initialValue,
  onSave,
  placeholder,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      defaultValue={initialValue}
      onBlur={(e) => {
        if (e.target.value !== initialValue) {
          onSave(e.target.value);
        }
      }}
      placeholder={placeholder}
      rows={3}
      className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78] resize-none placeholder:text-[#C2BBD4]"
    />
  );
}

// ─── Add District Button ─────────────────────────────────────────

function AddDistrictButton({
  planId,
  existingLeaids,
}: {
  planId: string;
  existingLeaids: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ leaid: string; name: string; stateAbbrev: string }>>([]);
  const [searching, setSearching] = useState(false);
  const addDistricts = useAddDistrictsToPlan();
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/districts?search=${encodeURIComponent(q)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.districts || data.data || data).filter(
            (d: { leaid: string }) => !existingLeaids.includes(d.leaid)
          );
          setResults(items.slice(0, 8));
        }
      } catch { /* silent */ } finally { setSearching(false); }
    }, 300);
  };

  const handleAdd = async (leaid: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: [leaid] });
      setResults((prev) => prev.filter((r) => r.leaid !== leaid));
    } catch { /* silent */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1.5V8.5M1.5 5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add District
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-white rounded-xl shadow-xl border border-[#D4CFE2] overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-[#E2DEEC]">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search districts..."
              autoFocus
              className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78] placeholder:text-[#C2BBD4]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {searching && <div className="px-3 py-4 text-center text-xs text-[#A69DC0]">Searching...</div>}
            {!searching && query && results.length === 0 && <div className="px-3 py-4 text-center text-xs text-[#A69DC0]">No districts found</div>}
            {results.map((d) => (
              <button
                key={d.leaid}
                onClick={() => handleAdd(d.leaid)}
                disabled={addDistricts.isPending}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#FAFAFE] transition-colors disabled:opacity-50"
              >
                <div>
                  <span className="text-xs font-medium text-[#544A78]">{d.name}</span>
                  <span className="text-[10px] text-[#A69DC0] ml-1.5">{d.stateAbbrev}</span>
                </div>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#A69DC0]">
                  <path d="M5 2V8M2 5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Browse Map Button ───────────────────────────────────────────

function BrowseMapButton({ planId, onClose }: { planId: string; onClose: () => void }) {
  const viewPlan = useMapV2Store((s) => s.viewPlan);
  const handleClick = () => { onClose(); viewPlan(planId); };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#544A78] border border-[#D4CFE2] hover:border-[#403770]/30 hover:text-[#403770] transition-colors"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M1 3L4.5 1.5L7.5 3L11 1.5V9L7.5 10.5L4.5 9L1 10.5V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M4.5 1.5V9M7.5 3V10.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      Browse Map
    </button>
  );
}
