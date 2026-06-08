"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import Modal from "@/features/shared/components/Modal";
import { formatCurrency, formatNumber, formatPercent } from "@/features/shared/lib/format";
import { rowsToCsv, downloadCsv } from "@/features/shared/lib/csv";
import { SEGMENT_DEFS, type SegmentKey } from "@/features/home/lib/segments";
import { sourceLabel, sourceColor, fmtShortDate } from "./pipeline/health";
import { useDeals } from "@/features/home/lib/queries";
import type {
  DealMetric,
  PipelineDealRow,
  BookingDealRow,
  UtilizationRow,
  TargetDetailRow,
} from "@/features/home/lib/deals";

const fmt = (v: number | null | undefined) => formatCurrency(v, true);
const PAGE = 50;

// Plain-English framing per metric — title, the row noun, and a friendly empty
// state (reps, not engineers; no IDs).
const META: Record<DealMetric, { title: string; noun: string; nounPlural: string; empty: string }> = {
  pipeline: {
    title: "Open Pipeline",
    noun: "open deal",
    nounPlural: "open deals",
    empty: "No open pipeline in this view yet — deals appear here once they're in an active stage.",
  },
  bookings: {
    title: "Closed-Won Bookings",
    noun: "booking",
    nounPlural: "bookings",
    empty: "No closed-won bookings landed in this view yet.",
  },
  rev: {
    title: "Revenue Utilization",
    noun: "account",
    nounPlural: "accounts",
    empty: "No contracted accounts to measure yet — utilization appears once deals are won.",
  },
  take: {
    title: "Take Utilization",
    noun: "account",
    nounPlural: "accounts",
    empty: "No contracted accounts to measure yet — take appears once deals are won.",
  },
  targets: {
    title: "Targets",
    noun: "district",
    nounPlural: "districts",
    empty: "No districts being worked in this view yet — they appear here once a plan covers them.",
  },
};

type UtilFilter = "all" | "underMin" | "lt40" | "40to80" | "gt80";
const UTIL_PILLS: { key: UtilFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "underMin", label: "Under min" },
  { key: "lt40", label: "<40%" },
  { key: "40to80", label: "40–80%" },
  { key: "gt80", label: ">80%" },
];

function matchesUtil(r: UtilizationRow, f: UtilFilter): boolean {
  if (f === "all") return true;
  if (f === "underMin") return r.underMin;
  if (r.utilPct == null) return false; // no budget → only "all" / "under min"
  if (f === "lt40") return r.utilPct < 0.4;
  if (f === "40to80") return r.utilPct >= 0.4 && r.utilPct <= 0.8;
  return r.utilPct > 0.8; // gt80
}

// Targets funnel filter — mirrors the Targets card's sub-rows so the drill-in reads
// the same way: converted (has open pipeline), active (touched in 90d), stale (not),
// and untargeted (worked but no growth target set).
type TargetFilter = "all" | "converted" | "active" | "stale" | "untargeted";
const TARGET_PILLS: { key: TargetFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "converted", label: "Converted" },
  { key: "active", label: "Active · 90d" },
  { key: "stale", label: "Stale" },
  { key: "untargeted", label: "No targets" },
];

function matchesTarget(r: TargetDetailRow, f: TargetFilter): boolean {
  if (f === "converted") return r.converted;
  if (f === "active") return r.active;
  if (f === "stale") return !r.active;
  if (f === "untargeted") return r.segment == null;
  return true; // all
}

interface Props {
  metric: DealMetric | null;
  fy: number;
  repScope: string;
  onClose: () => void;
}

// The drill-in behind a financial topline card. Owns its own query (gated on the
// metric being set, so it doesn't fetch until a card is expanded), renders the
// per-metric table + filter pills + totals footer, and exports the filtered rows.
export default function DealDetailModal({ metric, fy, repScope, onClose }: Props) {
  const open = metric != null;
  const { data, isLoading, isError } = useDeals(fy, repScope, metric);

  // Source filter (pipeline/bookings), utilization filter (rev/take), and the targets
  // funnel filter are kept in separate state so switching cards doesn't carry an
  // incompatible filter over.
  const [source, setSource] = useState<SegmentKey | "all">("all");
  const [util, setUtil] = useState<UtilFilter>("all");
  const [target, setTarget] = useState<TargetFilter>("all");
  const [visible, setVisible] = useState(PAGE);

  // Reset filters + pagination whenever the card (metric) changes, so an open-pipeline
  // source filter doesn't silently carry into the bookings view. Done during render
  // (React's "adjust state on prop change" pattern) rather than in an effect, which
  // would commit a throwaway render and cascade.
  const [prevMetric, setPrevMetric] = useState(metric);
  if (metric !== prevMetric) {
    setPrevMetric(metric);
    setSource("all");
    setUtil("all");
    setTarget("all");
    setVisible(PAGE);
  }

  const isUtil = metric === "rev" || metric === "take";
  const isTargets = metric === "targets";
  const meta = metric ? META[metric] : null;

  // Segments actually present in the rows → no dead source pills.
  const presentSources = useMemo(() => {
    if (!data || isUtil || isTargets) return [];
    const seen = new Set<SegmentKey>();
    for (const r of data.rows as (PipelineDealRow | BookingDealRow)[]) {
      if (r.source) seen.add(r.source);
    }
    return SEGMENT_DEFS.filter((d) => seen.has(d.key));
  }, [data, isUtil, isTargets]);

  const filtered = useMemo<(PipelineDealRow | BookingDealRow | UtilizationRow | TargetDetailRow)[]>(() => {
    if (!data) return [];
    if (isTargets) return (data.rows as TargetDetailRow[]).filter((r) => matchesTarget(r, target));
    if (isUtil) return (data.rows as UtilizationRow[]).filter((r) => matchesUtil(r, util));
    if (source === "all") return data.rows as (PipelineDealRow | BookingDealRow)[];
    return (data.rows as (PipelineDealRow | BookingDealRow)[]).filter((r) => r.source === source);
  }, [data, isTargets, isUtil, source, util, target]);

  function exportCsv() {
    if (!metric || !data) return;
    const { columns, toRecord } = csvShape(metric);
    downloadCsv(`${metric}-FY${String(fy).slice(-2)}`, rowsToCsv(columns, filtered.map(toRecord as (r: unknown) => Record<string, unknown>)));
  }

  if (!open || !meta) return null;

  const total = filtered.length;
  const shown = filtered.slice(0, visible);

  return (
    <Modal open={open} onClose={onClose} ariaLabel={`${meta.title} — detail`} maxWidth="max-w-[1000px]">
      {/* Header */}
      <div className="border-b border-[#E2DEEC] p-5 pr-12">
        <h2 className="text-lg font-bold text-[#403770]">{meta.title}</h2>
        <p className="mt-0.5 text-xs text-[#8A80A8]">
          {isLoading
            ? "Loading…"
            : isError
              ? "Couldn't load this metric."
              : `${total.toLocaleString()} ${total === 1 ? meta.noun : meta.nounPlural}${data?.mode === "team" ? " across the team" : ""}.`}
        </p>
      </div>

      {/* Filter pills */}
      {!isLoading && !isError && data && (
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4" role="tablist" aria-label="Filter">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
            {isTargets ? "Status" : isUtil ? "Utilization" : "Source"}
          </span>
          {isTargets ? (
            TARGET_PILLS.map((p) => (
              <Pill key={p.key} active={target === p.key} label={p.label} onClick={() => { setTarget(p.key); setVisible(PAGE); }} />
            ))
          ) : isUtil ? (
            UTIL_PILLS.map((p) => (
              <Pill key={p.key} active={util === p.key} label={p.label} onClick={() => { setUtil(p.key); setVisible(PAGE); }} />
            ))
          ) : (
            <>
              <Pill active={source === "all"} label="All" onClick={() => { setSource("all"); setVisible(PAGE); }} />
              {presentSources.map((d) => (
                <Pill key={d.key} active={source === d.key} label={d.label} color={d.color} onClick={() => { setSource(d.key); setVisible(PAGE); }} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Body */}
      <div className="px-5 pt-4">
        {isLoading ? (
          <div className="space-y-2 pb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 rounded-md bg-[#F7F5FA] animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-[#5C5378]">Couldn&apos;t load this metric. Try reopening the card.</p>
        ) : total === 0 ? (
          <p className="py-10 text-center text-sm text-[#8A80A8]">{meta.empty}</p>
        ) : (
          <>
            {total > 200 && (
              <div className="mb-3 rounded-md bg-[#F7F5FA] px-3 py-2 text-[11px] text-[#5C5378]">
                {total.toLocaleString()} {meta.nounPlural} — use the filters to narrow this down, or export to CSV.
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-[#E2DEEC]">
              {metric === "pipeline" && <PipelineTable rows={shown as PipelineDealRow[]} />}
              {metric === "bookings" && <BookingTable rows={shown as BookingDealRow[]} />}
              {isUtil && <UtilTable rows={shown as UtilizationRow[]} metric={metric as "rev" | "take"} />}
              {isTargets && <TargetTable rows={shown as TargetDetailRow[]} />}
            </div>
            {shown.length < total && (
              <div className="flex justify-center py-3">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE)}
                  className="rounded-md border border-[#D4CFE2] px-3 py-1.5 text-xs font-medium text-[#5C5378] hover:bg-[#EFEDF5]"
                >
                  Show more ({(total - shown.length).toLocaleString()} more)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Totals footer */}
      {!isLoading && !isError && data && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2DEEC] p-5">
          <TotalsSummary metric={metric} rows={filtered} />
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-md border border-[#D4CFE2] px-3 py-1.5 text-xs font-medium text-[#5C5378] hover:bg-[#EFEDF5] whitespace-nowrap"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      )}
    </Modal>
  );
}

// ── Pills ─────────────────────────────────────────────────────────────────────

function Pill({ active, label, color, onClick }: { active: boolean; label: string; color?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={active
        ? { borderColor: color ?? "#403770", color: color ?? "#403770", backgroundColor: "#F7F5FA" }
        : { borderColor: "#D4CFE2", color: "#5C5378" }}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`py-2 px-3 font-semibold ${right ? "text-right" : "text-left"}`}>{children}</th>
);
const SourceCell = ({ source }: { source: SegmentKey | null }) => (
  <td className="py-2 px-3">
    <span className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap" style={{ color: sourceColor(source) }}>
      <span className="h-2 w-2 rounded-full" style={{ background: sourceColor(source) }} />{sourceLabel(source)}
    </span>
  </td>
);

// ── Tables ──────────────────────────────────────────────────────────────────

function PipelineTable({ rows }: { rows: PipelineDealRow[] }) {
  return (
    <table className="min-w-[640px] w-full text-left">
      <thead>
        <tr className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
          <Th>Account</Th><Th>Stage</Th><Th>Source</Th><Th right>Committed</Th><Th right>Max budget</Th><Th right>Close</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.account}-${i}`} className="border-t border-[#E2DEEC]">
            <td className="py-2 px-3">
              <div className="text-[13px] font-semibold text-[#403770] whitespace-nowrap">{r.account}</div>
              {r.state && <div className="text-[10px] text-[#8A80A8]">{r.state}</div>}
            </td>
            <td className="py-2 px-3 text-[12px] text-[#5C5378] whitespace-nowrap">{r.stageName}</td>
            <SourceCell source={r.source} />
            <td className="py-2 px-3 text-right text-[13px] font-bold tabular-nums text-[#403770]">{fmt(r.committed)}</td>
            <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[#8A80A8]">{fmt(r.maxBudget)}</td>
            <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#5C5378] whitespace-nowrap">{fmtShortDate(r.closeDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BookingTable({ rows }: { rows: BookingDealRow[] }) {
  return (
    <table className="min-w-[680px] w-full text-left">
      <thead>
        <tr className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
          <Th>Account</Th><Th>Product</Th><Th>Source</Th><Th right>Amount</Th><Th right>Min commit</Th><Th right>Max budget</Th><Th right>Closed</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.account}-${i}`} className="border-t border-[#E2DEEC]">
            <td className="py-2 px-3 text-[13px] font-semibold text-[#403770] whitespace-nowrap">{r.account}</td>
            <td className="py-2 px-3 text-[12px] text-[#5C5378] whitespace-nowrap">{r.product ?? "—"}</td>
            <SourceCell source={r.source} />
            <td className="py-2 px-3 text-right text-[13px] font-bold tabular-nums text-[#403770]">{fmt(r.amount)}</td>
            <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#5C5378]">{fmt(r.minCommit)}</td>
            <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#8A80A8]">{fmt(r.maxBudget)}</td>
            <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#5C5378] whitespace-nowrap">{fmtShortDate(r.closedDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UtilTable({ rows, metric }: { rows: UtilizationRow[]; metric: "rev" | "take" }) {
  const moneyLabel = metric === "rev" ? "Delivered rev" : "Delivered take";
  return (
    <table className="min-w-[720px] w-full text-left">
      <thead>
        <tr className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
          <Th>Account</Th><Th right>Min commit</Th><Th right>Max budget</Th><Th right>{moneyLabel}</Th><Th right>Deferred</Th><Th right>Util</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const money = metric === "rev" ? r.revenue : r.take;
          return (
            <tr key={`${r.account}-${i}`} className="border-t border-[#E2DEEC]">
              <td className="py-2 px-3">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-[13px] font-semibold text-[#403770]">{r.account}</span>
                  {r.underMin && <span className="rounded-full bg-[#F37167]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#F37167]">UNDER MIN</span>}
                </div>
              </td>
              <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#5C5378]">{fmt(r.minCommit)}</td>
              <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#8A80A8]">{fmt(r.maxBudget)}</td>
              <td className="py-2 px-3 text-right text-[13px] font-bold tabular-nums text-[#403770]">{fmt(money)}</td>
              <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#C77]">{r.deferred > 0 ? fmt(r.deferred) : "—"}</td>
              <td className="py-2 px-3 text-right text-[12px] font-semibold tabular-nums text-[#5C5378]">
                {r.utilPct == null ? "—" : formatPercent(r.utilPct, 0)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TargetTable({ rows }: { rows: TargetDetailRow[] }) {
  return (
    <table className="min-w-[720px] w-full text-left">
      <thead>
        <tr className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
          <Th>District</Th><Th>Segment</Th><Th right>Target $</Th><Th right>Open pipe</Th><Th right>Pipeline</Th><Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.account}-${i}`} className="border-t border-[#E2DEEC]">
            <td className="py-2 px-3">
              <div className="text-[13px] font-semibold text-[#403770] whitespace-nowrap">{r.account}</div>
              {r.state && <div className="text-[10px] text-[#8A80A8]">{r.state}</div>}
            </td>
            <td className="py-2 px-3">
              <span className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap" style={{ color: r.segment ? sourceColor(r.segment) : "#8A80A8" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: r.segment ? sourceColor(r.segment) : "#C2BBD4" }} />
                {r.segment ? sourceLabel(r.segment) : "No target"}
              </span>
            </td>
            <td className="py-2 px-3 text-right text-[13px] font-bold tabular-nums text-[#403770]">{r.targetDollars > 0 ? fmt(r.targetDollars) : "—"}</td>
            <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#8A80A8]">{r.openPipe > 0 ? fmt(r.openPipe) : "—"}</td>
            <td className="py-2 px-3 text-right text-[12px] tabular-nums text-[#5C5378]">{r.pipeline > 0 ? fmt(r.pipeline) : "—"}</td>
            <td className="py-2 px-3">
              <div className="flex items-center gap-1 whitespace-nowrap">
                {r.converted
                  ? <span className="rounded-full bg-[#403770]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#403770]">CONVERTED</span>
                  : <span className="rounded-full bg-[#EFEDF5] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#8A80A8]">TARGETED</span>}
                {r.active
                  ? <span className="rounded-full bg-[#6BA368]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#5C8A53]">ACTIVE</span>
                  : <span className="rounded-full bg-[#C77]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#C77]">STALE</span>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Totals footer ─────────────────────────────────────────────────────────────

function TotalItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-wider text-[#8A80A8]">{label}</span>{" "}
      <span className={`tabular-nums ${strong ? "text-sm font-bold text-[#403770]" : "text-[12px] font-semibold text-[#5C5378]"}`}>{value}</span>
    </span>
  );
}

function TotalsSummary({ metric, rows }: { metric: DealMetric; rows: (PipelineDealRow | BookingDealRow | UtilizationRow | TargetDetailRow)[] }) {
  const sum = (pick: (r: never) => number) => (rows as never[]).reduce((s, r) => s + pick(r), 0);
  const count = (pick: (r: never) => boolean) => (rows as never[]).filter(pick).length;
  const Item = TotalItem;

  if (metric === "targets") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Item label="Districts" value={rows.length.toLocaleString()} />
        <Item label="Target $" value={fmt(sum((r: TargetDetailRow) => r.targetDollars))} strong />
        <Item label="Pipeline" value={fmt(sum((r: TargetDetailRow) => r.pipeline))} />
        <Item label="Converted" value={formatNumber(count((r: TargetDetailRow) => r.converted))} />
        <Item label="Active · 90d" value={formatNumber(count((r: TargetDetailRow) => r.active))} />
      </div>
    );
  }
  if (metric === "pipeline") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Item label="Deals" value={rows.length.toLocaleString()} />
        <Item label="Committed" value={fmt(sum((r: PipelineDealRow) => r.committed))} strong />
        <Item label="Max budget" value={fmt(sum((r: PipelineDealRow) => r.maxBudget))} />
      </div>
    );
  }
  if (metric === "bookings") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Item label="Bookings" value={rows.length.toLocaleString()} />
        <Item label="Signed" value={fmt(sum((r: BookingDealRow) => r.amount))} strong />
        <Item label="Min commit" value={fmt(sum((r: BookingDealRow) => r.minCommit))} />
        <Item label="Max budget" value={fmt(sum((r: BookingDealRow) => r.maxBudget))} />
      </div>
    );
  }
  // rev | take
  const maxBudget = sum((r: UtilizationRow) => r.maxBudget);
  const money = metric === "rev" ? sum((r: UtilizationRow) => r.revenue) : sum((r: UtilizationRow) => r.take);
  const revenue = sum((r: UtilizationRow) => r.revenue);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Item label="Accounts" value={rows.length.toLocaleString()} />
      <Item label="Min commit" value={fmt(sum((r: UtilizationRow) => r.minCommit))} />
      <Item label="Max budget" value={fmt(maxBudget)} />
      <Item label={metric === "rev" ? "Delivered rev" : "Delivered take"} value={fmt(money)} strong />
      <Item label="Deferred" value={fmt(sum((r: UtilizationRow) => r.deferred))} />
      <Item label="Util" value={maxBudget > 0 ? formatPercent(revenue / maxBudget, 0) : "—"} />
    </div>
  );
}

// ── CSV shape per metric ───────────────────────────────────────────────────────

function csvShape(metric: DealMetric): { columns: string[]; toRecord: (r: never) => Record<string, unknown> } {
  if (metric === "targets") {
    return {
      columns: ["District", "State", "Segment", "Target $", "Open pipeline", "Won", "Pipeline", "Converted", "Active 90d"],
      toRecord: (r: TargetDetailRow) => ({
        District: r.account, State: r.state ?? "", Segment: r.segment ? sourceLabel(r.segment) : "No target",
        "Target $": Math.round(r.targetDollars), "Open pipeline": Math.round(r.openPipe), Won: Math.round(r.won),
        Pipeline: Math.round(r.pipeline), Converted: r.converted ? "yes" : "", "Active 90d": r.active ? "yes" : "",
      }) as unknown as Record<string, unknown>,
    } as { columns: string[]; toRecord: (r: never) => Record<string, unknown> };
  }
  if (metric === "pipeline") {
    return {
      columns: ["Account", "State", "Stage", "Source", "Committed", "Max budget", "Close date"],
      toRecord: (r: PipelineDealRow) => ({
        Account: r.account, State: r.state, Stage: r.stageName, Source: sourceLabel(r.source),
        Committed: Math.round(r.committed), "Max budget": Math.round(r.maxBudget), "Close date": r.closeDate ?? "",
      }) as unknown as Record<string, unknown>,
    } as { columns: string[]; toRecord: (r: never) => Record<string, unknown> };
  }
  if (metric === "bookings") {
    return {
      columns: ["Account", "Product", "Source", "Amount", "Min commit", "Max budget", "Closed date"],
      toRecord: (r: BookingDealRow) => ({
        Account: r.account, Product: r.product ?? "", Source: sourceLabel(r.source),
        Amount: Math.round(r.amount), "Min commit": Math.round(r.minCommit), "Max budget": Math.round(r.maxBudget), "Closed date": r.closedDate ?? "",
      }) as unknown as Record<string, unknown>,
    } as { columns: string[]; toRecord: (r: never) => Record<string, unknown> };
  }
  const moneyCol = metric === "rev" ? "Delivered revenue" : "Delivered take";
  return {
    columns: ["Account", "Source", "Min commit", "Max budget", moneyCol, "Deferred", "Util %", "Under min"],
    toRecord: (r: UtilizationRow) => ({
      Account: r.account, Source: sourceLabel(r.source), "Min commit": Math.round(r.minCommit), "Max budget": Math.round(r.maxBudget),
      [moneyCol]: Math.round(metric === "rev" ? r.revenue : r.take), Deferred: Math.round(r.deferred),
      "Util %": r.utilPct == null ? "" : Math.round(r.utilPct * 100), "Under min": r.underMin ? "yes" : "",
    }) as unknown as Record<string, unknown>,
  } as { columns: string[]; toRecord: (r: never) => Record<string, unknown> };
}
