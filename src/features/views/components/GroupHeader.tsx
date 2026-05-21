"use client";

/**
 * GroupHeader — title strip above the view tabs/body for a Plan or List.
 *
 * For plans:
 *   - Eyebrow: ▪ FY26 Plan · {fiscal} + optional Shared pill
 *   - Title: H1 · / · view-icon · view-label · pencil-edit
 *   - Stat grid (auto-fit minmax 110px): Target / Progress / Pipeline /
 *     Contacts / Open opps / Owner (avatar)
 *   - Bottom: 4px progress bar tinted by completion %
 *
 * For lists:
 *   - Eyebrow: 📋 List
 *   - Title: same shape but `view-label` slot shows the saved-list name
 *   - Filter chips (flattened from filterTree)
 *
 * Right-rail actions: filter / search / divider / Share secondary / Save as
 * list primary. Most onClick handlers are stubs for Phase F.
 */
import { useMemo } from "react";
import {
  Filter,
  Search,
  Share2,
  Bookmark,
  Pencil,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GroupKind } from "../hooks/useViewsRouter";
import { lookupViewSpec, type ViewId } from "../lib/view-types";
import {
  flattenForUi,
  type FilterNode,
  type FilterLeaf,
} from "@/lib/saved-views/filter-tree";
import { useViewsStore } from "../lib/store";
import type { PlanWithStats, SavedListSummary } from "../lib/queries";

interface GroupHeaderProps {
  kind: GroupKind;
  viewId: ViewId;
  /** Plan data when kind === "plan". */
  plan?: PlanWithStats | null;
  /** List data when kind === "list". */
  list?: SavedListSummary | null;
}

/** Format a target dollar value into a compact label ("$1.2M"). */
function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

/** Convert a fiscalYear number into a "FY26" label, or null if missing. */
function fiscalLabel(fy: number | null | undefined): string | null {
  if (!fy) return null;
  return `FY${String(fy).slice(-2)}`;
}

/** Color the coverage bar based on completion. */
function progressColor(pct: number | null): string {
  if (pct == null) return "#A69DC0";
  if (pct >= 75) return "#69B34A";
  if (pct >= 50) return "#6EA3BE";
  return "#F37167";
}

/** Sum of all four target rollups on a plan (renewal + winback + expansion + new business). */
function targetTotalFor(plan: PlanWithStats): number {
  return (
    (plan.renewalRollup ?? 0) +
    (plan.winbackRollup ?? 0) +
    (plan.expansionRollup ?? 0) +
    (plan.newBusinessRollup ?? 0)
  );
}

/** % of target dollars covered by open pipeline. Null when no target is set. */
function coverageFor(plan: PlanWithStats): number | null {
  const target = targetTotalFor(plan);
  if (target <= 0) return null;
  return Math.round((plan.pipelineValue / target) * 100);
}

export default function GroupHeader({
  kind,
  viewId,
  plan,
  list,
}: GroupHeaderProps) {
  const view = lookupViewSpec(viewId);
  const ViewIcon = view.icon;
  const openBuilder = useViewsStore((s) => s.openBuilder);

  // For lists: flatten the filter tree into a chip list. flattenForUi may
  // return warnings (e.g. OR-of-different-fields) — we don't surface them in
  // the header for v1; Phase E's list builder is the user-facing place for
  // those amber notices.
  const filterChips = useMemo(() => {
    if (kind !== "list" || !list) return [];
    return flattenForUi(list.filterTree as FilterNode).rules;
  }, [kind, list]);

  const isPlan = kind === "plan";
  const coverage = isPlan && plan ? coverageFor(plan) : null;

  return (
    <header className="bg-white border-b border-[#D4CFE2] flex-shrink-0">
      <div className="px-5 pt-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isPlan ? (
                <>
                  <span
                    className="w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: "#F37167" }}
                    aria-hidden
                  />
                  <span className="text-[10px] font-semibold uppercase text-[#8A80A8] whitespace-nowrap tracking-[0.08em]">
                    FY{plan?.fiscalYear ? String(plan.fiscalYear).slice(-2) : "—"}{" "}
                    Plan
                    {fiscalLabel(plan?.fiscalYear)
                      ? ` · ${fiscalLabel(plan?.fiscalYear)}`
                      : ""}
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-semibold uppercase text-[#8A80A8] whitespace-nowrap tracking-[0.08em]">
                  📋 List
                </span>
              )}
              {isPlan && plan && plan.owner && (
                <SharedPill />
              )}
              {!isPlan && list?.shared && <SharedPill />}
            </div>

            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[#403770] tracking-tight whitespace-nowrap m-0">
                {plan?.name ?? list?.name ?? "—"}
              </h1>
              <span className="text-[#D4CFE2] text-base whitespace-nowrap">
                /
              </span>
              <ViewIcon
                className="w-3.5 h-3.5 flex-shrink-0 text-[#F37167]"
                aria-hidden
              />
              <span className="text-base font-semibold text-[#544A78] whitespace-nowrap">
                {view.label}
              </span>
              <IconButton aria-label="Rename view" onClick={() => undefined}>
                <Pencil className="w-3 h-3" aria-hidden />
              </IconButton>
            </div>

            {/* Plan stats grid OR List filter chips */}
            {isPlan && plan && <PlanStatGrid plan={plan} />}
            {!isPlan && (
              <FilterChipRow
                chips={filterChips}
                onAddFilter={() => undefined}
              />
            )}
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <IconButton aria-label="Filter">
              <Filter className="w-3.5 h-3.5" aria-hidden />
            </IconButton>
            <IconButton aria-label="Search">
              <Search className="w-3.5 h-3.5" aria-hidden />
            </IconButton>
            <span
              className="w-px h-4 bg-[#E2DEEC] mx-1"
              aria-hidden
            />
            <SecondaryButton>
              <Share2 className="w-3 h-3" aria-hidden />
              <span className="whitespace-nowrap">Share</span>
            </SecondaryButton>
            <PrimaryButton onClick={() => openBuilder()}>
              <Bookmark className="w-3 h-3" aria-hidden />
              <span className="whitespace-nowrap">Save as list</span>
            </PrimaryButton>
          </div>
        </div>

        {/* Pipeline-coverage bar — 4px tall, color graduated by % */}
        {isPlan && (
          <div
            className="mt-4 h-1 rounded-full overflow-hidden"
            style={{ background: "#EFEDF5" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.max(0, Math.min(100, coverage ?? 0))}%`,
                background: progressColor(coverage),
              }}
            />
          </div>
        )}
      </div>
    </header>
  );
}

function SharedPill() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-[#e8f1f5] text-[10px] font-semibold text-[#4d7285]">
      <Users className="w-2.5 h-2.5" aria-hidden />
      <span className="whitespace-nowrap">Shared</span>
    </span>
  );
}

function PlanStatGrid({ plan }: { plan: PlanWithStats }) {
  const target = targetTotalFor(plan);
  const coverage = coverageFor(plan);

  return (
    <div
      className="mt-3 grid gap-x-4 gap-y-2.5 pr-2"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}
    >
      <Stat label="Target" value={target > 0 ? formatMoney(target) : "—"} />
      <Stat
        label="Pipeline coverage"
        value={coverage == null ? "—" : `${coverage}%`}
      />
      <Stat label="Pipeline" value={formatMoney(plan.pipelineValue ?? 0)} />
      <Stat label="Open opps" value={String(plan.oppsCount ?? 0)} />
      <Stat
        label="Closed won min"
        value={formatMoney(plan.closedWonMinCommit ?? 0)}
      />
      <Stat label="Contacts" value={String(plan.contactsCount ?? 0)} />
      <Stat
        label="Owner"
        value={plan.owner?.fullName?.trim() || "—"}
      />
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] font-semibold uppercase text-[#8A80A8] tracking-[0.06em] whitespace-nowrap">
        {label}
      </span>
      <span className="mt-1 text-[14px] font-semibold text-[#403770] whitespace-nowrap tabular-nums">
        {value}
      </span>
    </div>
  );
}

function FilterChipRow({
  chips,
  onAddFilter,
}: {
  chips: FilterLeaf[];
  onAddFilter: () => void;
}) {
  if (chips.length === 0) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onAddFilter}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-[#D4CFE2] text-[11px] font-medium text-[#8A80A8] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100 whitespace-nowrap"
        >
          + Filter
        </button>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((rule, i) => (
        <FilterChip key={`${rule.fieldId}-${i}`} rule={rule} />
      ))}
      <button
        type="button"
        onClick={onAddFilter}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-[#D4CFE2] text-[11px] font-medium text-[#8A80A8] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100 whitespace-nowrap"
      >
        + Filter
      </button>
    </div>
  );
}

function FilterChip({ rule }: { rule: FilterLeaf }) {
  const label = formatRuleLabel(rule);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFFCFA] border border-[#E2DEEC] text-[11px] font-medium text-[#6E6390] whitespace-nowrap">
      <Filter className="w-2.5 h-2.5 text-[#A69DC0]" aria-hidden />
      {label}
    </span>
  );
}

/** Best-effort human label for a flattened filter rule. */
function formatRuleLabel(rule: FilterLeaf): string {
  if (rule.kind === "any") {
    const vals = rule.values
      .map((v) => String(v))
      .slice(0, 2)
      .join(", ");
    const more = rule.values.length > 2 ? ` +${rule.values.length - 2}` : "";
    return `${rule.fieldId}: ${vals}${more}`;
  }
  return `${rule.fieldId} ${rule.op} ${String(rule.value)}`;
}

// ── Buttons ────────────────────────────────────────────────────────────────

function IconButton({
  children,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center p-1.5 rounded-md text-[#8A80A8] hover:text-[#403770] hover:bg-[#F7F5FA] transition-colors duration-100"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#D4CFE2] bg-white text-[12px] font-semibold text-[#544A78] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#403770] text-white text-[12px] font-semibold hover:bg-[#322a5a] transition-colors duration-100"
    >
      {children}
    </button>
  );
}

// Re-export so consumers can build their own variations later without
// reaching into private bindings.
export type { LucideIcon };
