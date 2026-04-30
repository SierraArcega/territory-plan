"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Plus } from "lucide-react";
import { useLowHangingFruitList } from "../lib/queries";
import type { IncreaseTarget, IncreaseTargetCategory } from "../lib/types";
import { formatCurrencyShort, getInitials } from "../lib/format";
import {
  DEFAULT_FILTERS,
  applyFilters,
  type LHFFilters,
} from "../lib/filters";
import LowHangingFruitFilterBar from "./LowHangingFruitFilterBar";
import LhfPlanPicker from "./LhfPlanPicker";

const LMS_OPP_CREATE_URL =
  "https://lms.fullmindlearning.com/opportunities/kanban?_sort=close_date&_dir=asc&school_year=2026-27";

const CATEGORY_LABEL: Record<IncreaseTargetCategory, string> = {
  missing_renewal: "Missing renewal",
  fullmind_winback: "Fullmind winback",
  ek12_winback: "EK12 winback",
};
const CATEGORY_COLORS: Record<
  IncreaseTargetCategory,
  { bg: string; fg: string; dot: string }
> = {
  missing_renewal: { bg: "#FEF2F1", fg: "#B5453D", dot: "#F37167" },
  fullmind_winback: { bg: "#EFEDF5", fg: "#403770", dot: "#403770" },
  ek12_winback: { bg: "#FDEEE8", fg: "#7C3A21", dot: "#E07A5F" },
};
const CATEGORY_PRIORITY: Record<IncreaseTargetCategory, number> = {
  missing_renewal: 0,
  fullmind_winback: 1,
  ek12_winback: 2,
};
const CONFIRMATION_HOLD_MS = 2200;

function heroRevenue(r: IncreaseTarget): number {
  return r.category === "missing_renewal" ? r.fy26Revenue : r.priorYearRevenue;
}

// Most recent prior-year revenue + the FY label, regardless of category.
// Winback rows already get this via priorYearRevenue/priorYearFy. Missing-
// renewal rows have FY25/FY24 fullmind revenue in revenueTrend; surface
// the most recent non-zero entry so reps can see growth vs. shrinkage.
function priorRevenue(r: IncreaseTarget): { amount: number; fy: string | null } {
  if (r.priorYearRevenue > 0) {
    return { amount: r.priorYearRevenue, fy: r.priorYearFy };
  }
  const t = r.revenueTrend;
  if (t.fy25 != null && t.fy25 > 0) return { amount: t.fy25, fy: "FY25" };
  if (t.fy24 != null && t.fy24 > 0) return { amount: t.fy24, fy: "FY24" };
  return { amount: 0, fy: null };
}

function fmtMonthYear(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function sortByCategoryThenRevenue(rows: IncreaseTarget[]): IncreaseTarget[] {
  return [...rows].sort((a, b) => {
    const c = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (c !== 0) return c;
    return heroRevenue(b) - heroRevenue(a);
  });
}

function buildCsv(rows: IncreaseTarget[]): string {
  const headers = [
    "District",
    "State",
    "Category",
    "Prior revenue",
    "Prior FY",
    "FY26 revenue",
    "FY26 closed won",
    "FY27 pipeline",
    "Suggested target",
    "Last rep",
    "Last close date",
  ];
  const csvRows = rows.map((r) => {
    const p = priorRevenue(r);
    return [
      r.districtName,
      r.state,
      CATEGORY_LABEL[r.category],
      p.amount > 0 ? Math.round(p.amount) : "",
      p.fy ?? "",
      r.category === "missing_renewal" ? Math.round(r.fy26Revenue) : "",
      Math.round(r.fy26OppBookings),
      Math.round(r.fy27OpenPipeline),
      r.suggestedTarget != null ? Math.round(r.suggestedTarget) : "",
      r.lastClosedWon?.repName ?? "",
      r.lastClosedWon?.closeDate ?? "",
    ];
  });
  const escape = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers, ...csvRows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}

function downloadCsv(rows: IncreaseTarget[]) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `low-hanging-fruit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CategoryPill({ category }: { category: IncreaseTargetCategory }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} aria-hidden />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function RepAvatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-[#C2BBD4] bg-[#EFEDF5] text-[#A69DC0] text-[9px]"
        aria-hidden
      >
        ?
      </span>
    );
  }
  const initials = getInitials(name).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#403770] text-white text-[9px] font-semibold shrink-0"
      aria-hidden
    >
      {initials}
    </span>
  );
}

interface RowActionsProps {
  district: IncreaseTarget;
  isConfirmed: boolean;
  confirmedPlanLabel: string;
  onAdded: (planName: string) => void;
}
function RowActions({ district, isConfirmed, confirmedPlanLabel, onAdded }: RowActionsProps) {
  const planBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isConfirmed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#69B34A] whitespace-nowrap">
        <Check className="w-3.5 h-3.5" />
        Added to {confirmedPlanLabel}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <a
        href={LMS_OPP_CREATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Create opportunity in LMS (opens new tab)"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#C2BBD4] text-xs font-semibold text-[#403770] bg-white hover:bg-[#F7F5FA] whitespace-nowrap"
      >
        + Opp <ArrowUpRight className="w-3 h-3" />
      </a>
      <button
        ref={planBtnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPickerOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] whitespace-nowrap"
      >
        <Plus className="w-3 h-3" />
        Plan
        <ChevronDown className="w-2.5 h-2.5 opacity-80" />
      </button>
      {pickerOpen && (
        <LhfPlanPicker
          district={district}
          anchorRef={planBtnRef}
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSuccess={(planName) => {
            setPickerOpen(false);
            onAdded(planName);
          }}
        />
      )}
    </div>
  );
}

export default function LowHangingFruitView() {
  const query = useLowHangingFruitList();
  const [filters, setFilters] = useState<LHFFilters>(DEFAULT_FILTERS);
  const [confirmed, setConfirmed] = useState<{ leaid: string; planName: string } | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allRows = query.data?.districts ?? [];

  const facets = useMemo(() => {
    const counts: Record<IncreaseTargetCategory, number> = {
      missing_renewal: 0,
      fullmind_winback: 0,
      ek12_winback: 0,
    };
    const states = new Set<string>();
    const products = new Set<string>();
    const reps = new Set<string>();
    for (const r of allRows) {
      counts[r.category]++;
      if (r.state) states.add(r.state);
      for (const p of r.productTypes) products.add(p);
      const rep = r.lastClosedWon?.repName;
      if (rep) reps.add(rep);
    }
    return {
      categoryCounts: counts,
      states: [...states].sort(),
      products: [...products].sort(),
      reps: [...reps].sort((a, b) => a.localeCompare(b)),
    };
  }, [allRows]);

  const filtered = useMemo(
    () => sortByCategoryThenRevenue(applyFilters(allRows, filters)),
    [allRows, filters],
  );

  const totalRevenue = useMemo(
    () => filtered.reduce((s, r) => s + heroRevenue(r), 0),
    [filtered],
  );

  const fireConfirmation = (leaid: string, planName: string) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmed({ leaid, planName });
    confirmTimer.current = setTimeout(() => {
      setConfirmed(null);
      confirmTimer.current = null;
    }, CONFIRMATION_HOLD_MS);
  };

  const stripPrefix = (name: string) => name.replace(/^FY27\s*[·:|-]\s*/i, "");

  return (
    <div className="h-full bg-[#FFFCFA] overflow-hidden flex flex-col p-6">
      <div
        className="flex flex-col flex-1 min-h-0 rounded-xl border border-[#D4CFE2] bg-[#FFFCFA] overflow-hidden"
      >
        {/* Header */}
        <header className="flex-shrink-0 flex flex-wrap items-end justify-between gap-3 px-5 py-4 bg-white border-b border-[#E2DEEC]">
          <div>
            <h1 className="text-lg font-bold text-[#403770]">Low hanging fruit</h1>
            <p className="text-xs text-[#6E6390] mt-1">
              <strong className="text-[#403770] font-semibold tabular-nums">
                {allRows.length} districts
              </strong>
              {" · "}
              <span className="tabular-nums">
                {formatCurrencyShort(query.data?.totalRevenueAtRisk ?? 0)}
              </span>{" "}
              FY26 revenue unclaimed
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D4CFE2] text-[#6E6390] bg-white hover:bg-[#F7F5FA] disabled:opacity-50"
          >
            Export CSV
          </button>
        </header>

        <LowHangingFruitFilterBar
          filters={filters}
          facets={facets}
          onChange={setFilters}
          showing={{ visible: filtered.length, total: allRows.length }}
        />

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          {query.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-[#F7F5FA] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="m-6 px-3 py-2 rounded-lg bg-[#fef1f0] border border-[#f58d85] flex items-center justify-between gap-3">
              <span className="text-xs text-[#544A78]">Couldn&apos;t load the list.</span>
              <button
                className="text-xs font-semibold text-[#403770] hover:underline"
                onClick={() => query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div>
                <p className="text-sm text-[#6E6390] mb-2">
                  {allRows.length === 0
                    ? "Every FY26 customer has FY27 activity. Nothing to claim right now."
                    : "No districts match these filters."}
                </p>
                {allRows.length > 0 && (
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="text-xs font-semibold text-[#403770] hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#F7F5FA]">
                <tr className="border-b border-[#D4CFE2]">
                  <Th width={36} className="pl-4 pr-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: "#403770" }}
                    />
                  </Th>
                  <Th minWidth={220}>District</Th>
                  <Th width={50}>St</Th>
                  <Th width={140}>Category</Th>
                  <Th width={92} align="right">Prior rev.</Th>
                  <Th width={92} align="right">FY26 rev.</Th>
                  <Th width={108} align="right">FY26 closed won</Th>
                  <Th width={108} align="right">FY27 pipeline</Th>
                  <Th width={96} align="right">Suggested</Th>
                  <Th width={184}>Last sale</Th>
                  <Th
                    width={208}
                    align="right"
                    className="px-3 sticky right-0 bg-[#F7F5FA]"
                    style={{ boxShadow: "-4px 0 6px -2px rgba(0,0,0,0.05)" }}
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const isConfirmed = confirmed?.leaid === r.leaid;
                  const isLast = idx === filtered.length - 1;
                  const lcw = r.lastClosedWon;
                  const stickyBg = isConfirmed ? "#EDFFE3" : "white";
                  return (
                    <tr
                      key={r.leaid}
                      className="group hover:bg-[#F7F5FA] cursor-pointer"
                      style={{
                        background: isConfirmed ? "#EDFFE3" : undefined,
                        transition: "background 100ms",
                        borderBottom: isLast ? undefined : "1px solid #E2DEEC",
                      }}
                    >
                      <Td className="pl-4 pr-2">
                        <input
                          type="checkbox"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${r.districtName}`}
                          className="w-3.5 h-3.5 rounded"
                          style={{ accentColor: "#403770" }}
                        />
                      </Td>
                      <Td>
                        <div className="font-semibold text-[#403770] whitespace-nowrap">
                          {r.districtName}
                        </div>
                        <div className="text-xs text-[#A69DC0] mt-0.5 whitespace-nowrap">
                          {r.enrollment != null ? `${r.enrollment.toLocaleString()} enrolled` : "—"}
                          {r.fy26SessionCount != null && r.fy26SessionCount > 0 && (
                            <> · {r.fy26SessionCount.toLocaleString()} sessions</>
                          )}
                        </div>
                      </Td>
                      <Td className="text-[#8A80A8] font-semibold whitespace-nowrap">
                        {r.state}
                      </Td>
                      <Td>
                        <CategoryPill category={r.category} />
                      </Td>
                      <Td
                        align="right"
                        className={
                          priorRevenue(r).amount > 0
                            ? "font-bold text-[#403770]"
                            : "text-[#A69DC0]"
                        }
                      >
                        {(() => {
                          const p = priorRevenue(r);
                          if (p.amount <= 0) return "—";
                          return (
                            <>
                              {formatCurrencyShort(p.amount)}
                              {p.fy && (
                                <div className="text-[10px] font-normal text-[#A69DC0]">
                                  {p.fy}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </Td>
                      <Td
                        align="right"
                        className={
                          r.category === "missing_renewal"
                            ? "font-bold text-[#403770]"
                            : "text-[#A69DC0]"
                        }
                      >
                        {r.category === "missing_renewal"
                          ? formatCurrencyShort(r.fy26Revenue)
                          : "—"}
                      </Td>
                      <Td
                        align="right"
                        className={
                          r.fy26OppBookings > 0
                            ? "text-[#403770] font-semibold"
                            : "text-[#A69DC0]"
                        }
                      >
                        {r.fy26OppBookings > 0 ? formatCurrencyShort(r.fy26OppBookings) : "—"}
                      </Td>
                      <Td
                        align="right"
                        className={
                          r.fy27OpenPipeline > 0
                            ? "text-[#6EA3BE] font-semibold"
                            : "text-[#A69DC0]"
                        }
                      >
                        {r.fy27OpenPipeline > 0 ? formatCurrencyShort(r.fy27OpenPipeline) : "—"}
                      </Td>
                      <Td align="right" className="text-[#6E6390]">
                        {r.suggestedTarget != null ? formatCurrencyShort(r.suggestedTarget) : "—"}
                      </Td>
                      <Td>
                        {lcw ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <RepAvatar name={lcw.repName} />
                            <div className="min-w-0">
                              <div className="text-xs text-[#403770] truncate">
                                {lcw.repName ?? "—"}
                              </div>
                              <div className="text-xs text-[#A69DC0] whitespace-nowrap">
                                {fmtMonthYear(lcw.closeDate)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#A69DC0] italic">No prior rep</span>
                        )}
                      </Td>
                      <td
                        className="py-2 px-3 align-middle text-right sticky right-0"
                        style={{
                          background: stickyBg,
                          boxShadow: "-4px 0 6px -2px rgba(0,0,0,0.05)",
                        }}
                      >
                        <RowActions
                          district={r}
                          isConfirmed={isConfirmed}
                          confirmedPlanLabel={
                            isConfirmed ? stripPrefix(confirmed.planName) : ""
                          }
                          onAdded={(planName) => fireConfirmation(r.leaid, planName)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#F7F5FA] border-t border-[#E2DEEC] text-xs text-[#8A80A8]">
          <span>
            <span className="tabular-nums">{filtered.length}</span> districts
          </span>
          <span>
            FY26 unclaimed:{" "}
            <strong className="text-[#403770] font-semibold tabular-nums">
              {formatCurrencyShort(totalRevenue)}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

interface ThProps {
  children?: React.ReactNode;
  width?: number;
  minWidth?: number;
  align?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}
function Th({ children, width, minWidth, align = "left", className = "", style }: ThProps) {
  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: (minWidth ?? width) ? `${minWidth ?? width}px` : undefined,
        ...style,
      }}
      scope="col"
    >
      {children}
    </th>
  );
}

interface TdProps {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}
function Td({ children, align = "left", className = "" }: TdProps) {
  return (
    <td
      className={`py-2 px-3 align-middle text-sm ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}
