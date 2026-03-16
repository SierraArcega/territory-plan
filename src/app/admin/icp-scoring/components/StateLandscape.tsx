"use client";

import { useMemo, useState } from "react";
import type { District } from "../types";
import { SectionCard, fmtNum, SortArrow, TIER_FILLS } from "./shared";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StateRow {
  state: string;
  total: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  customers: number;
  revenue: number;
  scoreSum: number;
  penetration: number;
  avgScore: number;
}

type SortKey =
  | "state"
  | "total"
  | "t1"
  | "t2"
  | "customers"
  | "penetration"
  | "revenue"
  | "avgScore"
  | "tierMix";

// ─── Mini Tier Bar ────────────────────────────────────────────────────────────

function TierMiniBar({ row }: { row: StateRow }) {
  const total = row.total || 1;
  const segments: Array<{ pct: number; color: string }> = [
    { pct: (row.t1 / total) * 100, color: TIER_FILLS["Tier 1"] },
    { pct: (row.t2 / total) * 100, color: TIER_FILLS["Tier 2"] },
    { pct: (row.t3 / total) * 100, color: TIER_FILLS["Tier 3"] },
    { pct: (row.t4 / total) * 100, color: TIER_FILLS["Tier 4"] },
  ];

  return (
    <div
      className="flex h-2 rounded-full overflow-hidden"
      style={{ width: 80 }}
      aria-label={`T1:${row.t1} T2:${row.t2} T3:${row.t3} T4:${row.t4}`}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
        />
      ))}
    </div>
  );
}

// ─── Sort Helper ─────────────────────────────────────────────────────────────

function getValue(row: StateRow, key: SortKey): number | string {
  switch (key) {
    case "state":
      return row.state;
    case "total":
      return row.total;
    case "t1":
      return row.t1;
    case "t2":
      return row.t2;
    case "customers":
      return row.customers;
    case "penetration":
      return row.penetration;
    case "revenue":
      return row.revenue;
    case "avgScore":
      return row.avgScore;
    case "tierMix":
      return row.t1 + row.t2;
    default:
      return 0;
  }
}

function sortRows(
  rows: StateRow[],
  key: SortKey | null,
  dir: "asc" | "desc",
): StateRow[] {
  return [...rows].sort((a, b) => {
    // Default sort: t1+t2 descending
    if (key === null) {
      return b.t1 + b.t2 - (a.t1 + a.t2);
    }
    const av = getValue(a, key);
    const bv = getValue(b, key);
    if (typeof av === "string" && typeof bv === "string") {
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number;
    const bn = bv as number;
    return dir === "asc" ? an - bn : bn - an;
  });
}

// ─── Column Header ────────────────────────────────────────────────────────────

function ColHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey | null;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === colKey;
  return (
    <th
      className="px-3 py-2 text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider cursor-pointer hover:text-[#403770] transition-colors duration-100 select-none"
      onClick={() => onSort(colKey)}
      style={{ textAlign: align }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col gap-px">
          <SortArrow direction="asc" active={active && sortDir === "asc"} />
          <SortArrow direction="desc" active={active && sortDir === "desc"} />
        </span>
      </span>
    </th>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StateLandscape({ data }: { data: District[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  // Aggregate per-state stats
  const stateStats = useMemo<StateRow[]>(() => {
    const map = new Map<
      string,
      {
        total: number;
        t1: number;
        t2: number;
        t3: number;
        t4: number;
        customers: number;
        revenue: number;
        scoreSum: number;
      }
    >();

    data.forEach((d) => {
      const s = map.get(d.state) || {
        total: 0,
        t1: 0,
        t2: 0,
        t3: 0,
        t4: 0,
        customers: 0,
        revenue: 0,
        scoreSum: 0,
      };
      s.total++;
      if (d.tier === "Tier 1") s.t1++;
      else if (d.tier === "Tier 2") s.t2++;
      else if (d.tier === "Tier 3") s.t3++;
      else s.t4++;
      if (d.is_customer) s.customers++;
      s.revenue += d.lifetime_vendor_rev;
      s.scoreSum += d.composite_score;
      map.set(d.state, s);
    });

    return Array.from(map.entries()).map(([state, s]) => ({
      state,
      ...s,
      penetration: s.total > 0 ? (s.customers / s.total) * 100 : 0,
      avgScore: s.total > 0 ? s.scoreSum / s.total : 0,
    }));
  }, [data]);

  const sorted = useMemo(
    () => sortRows(stateStats, sortKey, sortDir),
    [stateStats, sortKey, sortDir],
  );

  const visible = showAll ? sorted : sorted.slice(0, 30);
  const hasMore = sorted.length > 30;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const colHeaderProps = {
    sortKey,
    sortDir,
    onSort: handleSort,
  };

  return (
    <SectionCard
      title="State Landscape"
      description="Geographic opportunity — where to focus sales effort"
    >
      <div className="overflow-hidden border border-[#D4CFE2] rounded-lg">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#F7F5FA]">
            <tr>
              <ColHeader label="State" colKey="state" align="left" {...colHeaderProps} />
              <ColHeader label="Total" colKey="total" align="right" {...colHeaderProps} />
              <ColHeader label="T1" colKey="t1" align="right" {...colHeaderProps} />
              <ColHeader label="T2" colKey="t2" align="right" {...colHeaderProps} />
              <ColHeader label="Customers" colKey="customers" align="right" {...colHeaderProps} />
              <ColHeader label="Pen%" colKey="penetration" align="right" {...colHeaderProps} />
              <ColHeader label="Revenue" colKey="revenue" align="right" {...colHeaderProps} />
              <ColHeader label="Avg Score" colKey="avgScore" align="right" {...colHeaderProps} />
              <ColHeader label="Tier Mix" colKey="tierMix" align="left" {...colHeaderProps} />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.state}
                className="border-t border-[#E2DEEC] hover:bg-[#EFEDF5] transition-colors duration-75"
              >
                <td className="px-3 py-2 text-sm font-medium text-[#403770]">
                  {row.state}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] text-right tabular-nums">
                  {fmtNum(row.total)}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] text-right tabular-nums">
                  {fmtNum(row.t1)}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] text-right tabular-nums">
                  {fmtNum(row.t2)}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] text-right tabular-nums">
                  {fmtNum(row.customers)}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] text-right tabular-nums">
                  {fmtNum(row.penetration, { pct: true })}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] text-right tabular-nums">
                  {fmtNum(row.revenue, { dollar: true })}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] text-right tabular-nums">
                  {fmtNum(row.avgScore)}
                </td>
                <td className="px-3 py-2">
                  <TierMiniBar row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && !showAll && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-sm font-medium text-[#403770] border border-[#D4CFE2] rounded-lg px-4 py-2 hover:bg-[#EFEDF5] transition-colors duration-100"
          >
            Show all {sorted.length} states
          </button>
        </div>
      )}
    </SectionCard>
  );
}
