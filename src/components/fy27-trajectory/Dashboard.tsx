"use client";

import { useState, useMemo } from "react";
import { useAnimatedNumber } from "@/features/map/hooks/use-animated-number";
import type { TrajectoryData } from "@/app/fy27-trajectory/queries";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ─── Constants ──────────────────────────────────────────────── */

const PLUM = "#1e1a36";
const PLUM_DEEP = "#0f0d1e";
const CORAL = "#F37167";
const BRAND_PURPLE = "#403770";
const MUTED = "rgba(255,255,255,0.45)";

/* ─── Formatters ─────────────────────────────────────────────── */

function fmtDollar(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtCompact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function fmtNum(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString();
}

/* ─── Sub-components ─────────────────────────────────────────── */

function Section({
  title,
  defaultOpen = true,
  count,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: PLUM }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer"
      >
        <h2 className="text-lg font-semibold text-white flex items-center gap-3">
          {title}
          {count !== undefined && (
            <span
              className="text-xs font-normal px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.1)", color: MUTED }}
            >
              {count}
            </span>
          )}
        </h2>
        <svg
          className="w-5 h-5 text-white/50 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        style={{
          maxHeight: open ? "8000px" : "0",
          transition: "max-height 0.5s ease-in-out",
          overflow: "hidden",
        }}
      >
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  format = "currency",
  delay = 0,
}: {
  label: string;
  value: number;
  format?: "currency" | "number";
  delay?: number;
}) {
  const animated = useAnimatedNumber(value, 1200, delay);
  return (
    <div
      className="rounded-lg px-5 py-4"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="text-2xl font-bold text-white mt-1">
        {format === "currency" ? fmtCompact(animated) : fmtNum(animated)}
      </p>
    </div>
  );
}

function TagBadge({ tag }: { tag: string }) {
  const isEK12 = tag.startsWith("EK12") || tag.startsWith("Elevate");
  const isFM =
    tag.startsWith("Fullmind") || tag === "Churn Risk" || tag === "Key Account";
  const bg = isEK12
    ? "rgba(243,113,103,0.2)"
    : isFM
      ? "rgba(64,55,112,0.4)"
      : "rgba(255,255,255,0.08)";
  const color = isEK12 ? CORAL : isFM ? "#a78bfa" : "rgba(255,255,255,0.6)";
  return (
    <span
      className="inline-block text-[10px] px-1.5 py-0.5 rounded mr-1 mb-0.5"
      style={{ background: bg, color }}
    >
      {tag}
    </span>
  );
}

function SortHeader({
  label,
  field,
  current,
  onSort,
}: {
  label: string;
  field: string;
  current: { field: string; dir: "asc" | "desc" };
  onSort: (f: string) => void;
}) {
  const active = current.field === field;
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
      style={{ color: active ? CORAL : MUTED }}
      onClick={() => onSort(field)}
    >
      {label} {active ? (current.dir === "asc" ? "^" : "v") : ""}
    </th>
  );
}

/* ─── Chart tooltip ──────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm"
      style={{ background: "#2a2546", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <p className="font-medium text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmtCompact(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────── */

export default function Dashboard({ data }: { data: TrajectoryData }) {
  const { kpis, revenueTrajectory, plans, targetBreakdown, topAccounts, churnSummary, churned, contracted, growth, bookingsGap } = data;

  // Revenue chart toggle
  const [chartMode, setChartMode] = useState<"combined" | "split">("combined");

  // Plans table state
  const [planSearch, setPlanSearch] = useState("");
  const [planSort, setPlanSort] = useState({ field: "totalTarget", dir: "desc" as "asc" | "desc" });

  // Top accounts sort
  const [acctSort, setAcctSort] = useState({ field: "totalTarget", dir: "desc" as "asc" | "desc" });

  // Churn sort
  const [churnSort, setChurnSort] = useState({ field: "lostRevenue", dir: "desc" as "asc" | "desc" });

  // Growth sort
  const [growthSort, setGrowthSort] = useState({ field: "fy27Pipeline", dir: "desc" as "asc" | "desc" });

  // Generic sort handler
  function toggleSort(
    current: { field: string; dir: "asc" | "desc" },
    setter: (v: { field: string; dir: "asc" | "desc" }) => void,
    field: string
  ) {
    if (current.field === field) {
      setter({ field, dir: current.dir === "asc" ? "desc" : "asc" });
    } else {
      setter({ field, dir: "desc" });
    }
  }

  function sortRows<T extends Record<string, any>>(
    rows: T[],
    sort: { field: string; dir: "asc" | "desc" }
  ): T[] {
    return [...rows].sort((a, b) => {
      const av = a[sort.field] ?? 0;
      const bv = b[sort.field] ?? 0;
      if (typeof av === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }

  // Filtered/sorted plans
  const filteredPlans = useMemo(() => {
    let rows = plans;
    if (planSearch) {
      const q = planSearch.toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }
    return sortRows(rows, planSort);
  }, [plans, planSearch, planSort]);

  const sortedAccounts = useMemo(() => sortRows(topAccounts, acctSort), [topAccounts, acctSort]);
  const sortedChurned = useMemo(() => sortRows(churned, churnSort), [churned, churnSort]);
  const sortedContracted = useMemo(
    () => sortRows(contracted, { field: "contraction", dir: "desc" }),
    [contracted]
  );
  const sortedGrowth = useMemo(() => sortRows(growth, growthSort), [growth, growthSort]);

  const totalChurnRisk = churnSummary.churnedDollars + churnSummary.contractedDollars;

  /* ─── Chart data with $ values scaled to millions for readability ─── */
  const chartData = revenueTrajectory.map((d) => ({
    ...d,
    fmM: d.fm / 1_000_000,
    ek12M: d.ek12 / 1_000_000,
    combinedM: d.combined / 1_000_000,
  }));

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: PLUM_DEEP,
        overflowY: "auto",
        height: "100vh",
      }}
    >
      {/* ─── Sticky Header ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 px-8 py-4 flex items-center justify-between"
        style={{
          background: "rgba(15,13,30,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            <span style={{ color: CORAL }}>Fullmind</span>
            <span className="text-white/40 mx-2">x</span>
            <span style={{ color: "#a78bfa" }}>Elevate K12</span>
            <span className="text-white/60 ml-3 font-normal text-base">
              FY27 Sales Trajectory
            </span>
          </h1>
        </div>
        <p className="text-xs text-white/30">
          Live data &middot; {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </header>

      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">
        {/* ─── Hero KPIs ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPI label="Combined FY27 Target" value={kpis.combinedFy27Target} delay={0} />
          <KPI label="FY27 Pipeline" value={kpis.fy27Pipeline} delay={100} />
          <KPI label="FY26 Combined Revenue" value={kpis.fy26CombinedRevenue} delay={200} />
          <KPI label="Active Customers" value={kpis.activeCustomers} format="number" delay={300} />
          <div
            className="rounded-lg px-5 py-4"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>
              Territory Plans
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {kpis.planCount}
              <span className="text-sm font-normal text-white/40 ml-2">
                covering {fmtNum(kpis.totalDistrictsInPlans)} districts
              </span>
            </p>
          </div>
        </div>

        {/* ─── Revenue Trajectory ────────────────────────────────── */}
        <Section title="Combined Revenue Trajectory" defaultOpen>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setChartMode("combined")}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                background: chartMode === "combined" ? CORAL : "rgba(255,255,255,0.08)",
                color: chartMode === "combined" ? "#fff" : MUTED,
              }}
            >
              Combined
            </button>
            <button
              onClick={() => setChartMode("split")}
              className="px-3 py-1 rounded text-sm transition-colors"
              style={{
                background: chartMode === "split" ? CORAL : "rgba(255,255,255,0.08)",
                color: chartMode === "split" ? "#fff" : MUTED,
              }}
            >
              Fullmind / EK12 Breakdown
            </button>
          </div>

          <ResponsiveContainer width="100%" height={360}>
            {chartMode === "combined" ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="year" stroke={MUTED} tick={{ fill: MUTED, fontSize: 12 }} />
                <YAxis
                  stroke={MUTED}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}M`}
                />
                <Tooltip content={<ChartTooltip />} />
                <defs>
                  <linearGradient id="gradCoral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CORAL} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CORAL} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="combinedM"
                  name="Combined Revenue"
                  stroke={CORAL}
                  strokeWidth={2}
                  fill="url(#gradCoral)"
                />
              </AreaChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="year" stroke={MUTED} tick={{ fill: MUTED, fontSize: 12 }} />
                <YAxis
                  stroke={MUTED}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}M`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ color: MUTED, fontSize: 12 }}
                />
                <Bar dataKey="fmM" name="Fullmind" fill={BRAND_PURPLE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="ek12M" name="Elevate K12" fill={CORAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
          <p className="text-xs mt-2" style={{ color: MUTED }}>
            FY27 shows pipeline (forecast). No FY24 Fullmind data available.
          </p>
        </Section>

        {/* ─── Territory Plans ───────────────────────────────────── */}
        <Section title="FY27 Territory Plans" count={plans.length} defaultOpen>
          <input
            type="text"
            placeholder="Search plans..."
            value={planSearch}
            onChange={(e) => setPlanSearch(e.target.value)}
            className="w-full mb-4 px-4 py-2 rounded-lg text-sm text-white placeholder:text-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <SortHeader label="Plan" field="name" current={planSort} onSort={(f) => toggleSort(planSort, setPlanSort, f)} />
                  <SortHeader label="Districts" field="districtCount" current={planSort} onSort={(f) => toggleSort(planSort, setPlanSort, f)} />
                  <SortHeader label="Renewal" field="renewalRollup" current={planSort} onSort={(f) => toggleSort(planSort, setPlanSort, f)} />
                  <SortHeader label="Expansion" field="expansionRollup" current={planSort} onSort={(f) => toggleSort(planSort, setPlanSort, f)} />
                  <SortHeader label="Winback" field="winbackRollup" current={planSort} onSort={(f) => toggleSort(planSort, setPlanSort, f)} />
                  <SortHeader label="New Biz" field="newBusinessRollup" current={planSort} onSort={(f) => toggleSort(planSort, setPlanSort, f)} />
                  <SortHeader label="Total" field="totalTarget" current={planSort} onSort={(f) => toggleSort(planSort, setPlanSort, f)} />
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2 text-white font-medium max-w-[250px] truncate">{p.name}</td>
                    <td className="px-3 py-2 text-white/70">{p.districtCount}</td>
                    <td className="px-3 py-2 text-white/70">{p.renewalRollup > 0 ? fmtDollar(p.renewalRollup) : "—"}</td>
                    <td className="px-3 py-2 text-white/70">{p.expansionRollup > 0 ? fmtDollar(p.expansionRollup) : "—"}</td>
                    <td className="px-3 py-2 text-white/70">{p.winbackRollup > 0 ? fmtDollar(p.winbackRollup) : "—"}</td>
                    <td className="px-3 py-2 text-white/70">{p.newBusinessRollup > 0 ? fmtDollar(p.newBusinessRollup) : "—"}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: CORAL }}>{fmtDollar(p.totalTarget)}</td>
                    <td className="px-3 py-2 text-white/50">Sierra</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)" }}>
                  <td className="px-3 py-3 font-semibold text-white">Total ({filteredPlans.length} plans)</td>
                  <td className="px-3 py-3 text-white/70">
                    {filteredPlans.reduce((s, p) => s + p.districtCount, 0)}
                  </td>
                  <td className="px-3 py-3 text-white/70">
                    {fmtDollar(filteredPlans.reduce((s, p) => s + p.renewalRollup, 0))}
                  </td>
                  <td className="px-3 py-3 text-white/70">
                    {fmtDollar(filteredPlans.reduce((s, p) => s + p.expansionRollup, 0))}
                  </td>
                  <td className="px-3 py-3 text-white/70">
                    {fmtDollar(filteredPlans.reduce((s, p) => s + p.winbackRollup, 0))}
                  </td>
                  <td className="px-3 py-3 text-white/70">
                    {fmtDollar(filteredPlans.reduce((s, p) => s + p.newBusinessRollup, 0))}
                  </td>
                  <td className="px-3 py-3 font-bold" style={{ color: CORAL }}>
                    {fmtDollar(filteredPlans.reduce((s, p) => s + p.totalTarget, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        {/* ─── FM vs EK12 Target Breakdown ────────────────────────── */}
        <Section title="FY27 Target Breakdown: Fullmind vs EK12" defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Source</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Districts</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Renewal</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Expansion</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Win Back</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>New Biz</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { key: "fm" as const, label: "Fullmind", color: "#a78bfa" },
                  { key: "ek12" as const, label: "Elevate K12", color: CORAL },
                  { key: "both" as const, label: "Both Tags", color: "rgba(255,255,255,0.7)" },
                  { key: "untagged" as const, label: "Untagged", color: MUTED },
                ]).map(({ key, label, color }) => {
                  const bd = targetBreakdown[key];
                  if (bd.total === 0) return null;
                  return (
                    <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/[0.03]">
                      <td className="px-3 py-2 font-medium" style={{ color }}>{label}</td>
                      <td className="px-3 py-2 text-white/70">{fmtNum(bd.districts)}</td>
                      <td className="px-3 py-2 text-white/70">{bd.renewal > 0 ? fmtDollar(bd.renewal) : "—"}</td>
                      <td className="px-3 py-2 text-white/70">{bd.expansion > 0 ? fmtDollar(bd.expansion) : "—"}</td>
                      <td className="px-3 py-2 text-white/70">{bd.winback > 0 ? fmtDollar(bd.winback) : "—"}</td>
                      <td className="px-3 py-2 text-white/70">{bd.newBiz > 0 ? fmtDollar(bd.newBiz) : "—"}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color }}>{fmtDollar(bd.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)" }}>
                  <td className="px-3 py-3 font-semibold text-white">Grand Total</td>
                  <td className="px-3 py-3 text-white/70">
                    {fmtNum(targetBreakdown.fm.districts + targetBreakdown.ek12.districts + targetBreakdown.both.districts + targetBreakdown.untagged.districts)}
                  </td>
                  {(["renewal", "expansion", "winback", "newBiz", "total"] as const).map((col) => (
                    <td key={col} className={`px-3 py-3 ${col === "total" ? "font-bold" : "text-white/70"}`} style={col === "total" ? { color: CORAL } : undefined}>
                      {fmtDollar(
                        targetBreakdown.fm[col] + targetBreakdown.ek12[col] + targetBreakdown.both[col] + targetBreakdown.untagged[col]
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Visual bar breakdown */}
          <div className="mt-4 space-y-2">
            {(["renewal", "expansion", "winback", "newBiz"] as const).map((cat) => {
              const catTotal = targetBreakdown.fm[cat] + targetBreakdown.ek12[cat] + targetBreakdown.both[cat] + targetBreakdown.untagged[cat];
              if (catTotal === 0) return null;
              const fmPct = (targetBreakdown.fm[cat] / catTotal) * 100;
              const ek12Pct = (targetBreakdown.ek12[cat] / catTotal) * 100;
              const bothPct = (targetBreakdown.both[cat] / catTotal) * 100;
              const labels: Record<string, string> = { renewal: "Renewal", expansion: "Expansion", winback: "Win Back", newBiz: "New Biz" };
              return (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white/50">{labels[cat]}</span>
                    <span className="text-xs text-white/40">{fmtCompact(catTotal)}</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    {fmPct > 0 && <div style={{ width: `${fmPct}%`, background: "#a78bfa" }} title={`FM: ${fmtCompact(targetBreakdown.fm[cat])}`} />}
                    {ek12Pct > 0 && <div style={{ width: `${ek12Pct}%`, background: CORAL }} title={`EK12: ${fmtCompact(targetBreakdown.ek12[cat])}`} />}
                    {bothPct > 0 && <div style={{ width: `${bothPct}%`, background: "rgba(255,255,255,0.3)" }} title={`Both: ${fmtCompact(targetBreakdown.both[cat])}`} />}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-4 mt-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#a78bfa" }} />Fullmind</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: CORAL }} />Elevate K12</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />Both</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />Untagged</span>
            </div>
          </div>
        </Section>

        {/* ─── Top Accounts ──────────────────────────────────────── */}
        <Section title="Top Accounts by FY27 Target" count={topAccounts.length} defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>#</th>
                  <SortHeader label="Account" field="name" current={acctSort} onSort={(f) => toggleSort(acctSort, setAcctSort, f)} />
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Tags</th>
                  <SortHeader label="Total Target" field="totalTarget" current={acctSort} onSort={(f) => toggleSort(acctSort, setAcctSort, f)} />
                  <SortHeader label="FY27 Pipeline" field="fy27Pipeline" current={acctSort} onSort={(f) => toggleSort(acctSort, setAcctSort, f)} />
                  <SortHeader label="FM FY26" field="fy26Invoicing" current={acctSort} onSort={(f) => toggleSort(acctSort, setAcctSort, f)} />
                  <SortHeader label="EK12 FY26" field="fy26Ek12" current={acctSort} onSort={(f) => toggleSort(acctSort, setAcctSort, f)} />
                  <SortHeader label="Combined FY26" field="combinedFy26" current={acctSort} onSort={(f) => toggleSort(acctSort, setAcctSort, f)} />
                  <SortHeader label="Enrollment" field="enrollment" current={acctSort} onSort={(f) => toggleSort(acctSort, setAcctSort, f)} />
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map((a, i) => (
                  <tr
                    key={a.leaid}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2 text-white/30 text-xs">{i + 1}</td>
                    <td className="px-3 py-2">
                      <p className="text-white font-medium">{a.name}</p>
                      {a.stateAbbrev && <p className="text-white/40 text-xs">{a.stateAbbrev}</p>}
                    </td>
                    <td className="px-3 py-2 max-w-[180px]">
                      {a.tags.filter((t) => !t.startsWith("City") && !t.startsWith("Suburb") && !t.startsWith("Town") && !t.startsWith("Rural"))
                        .slice(0, 3)
                        .map((t) => <TagBadge key={t} tag={t} />)}
                    </td>
                    <td className="px-3 py-2 font-semibold" style={{ color: CORAL }}>{fmtDollar(a.totalTarget)}</td>
                    <td className="px-3 py-2 text-white/70">{a.fy27Pipeline > 0 ? fmtDollar(a.fy27Pipeline) : "—"}</td>
                    <td className="px-3 py-2" style={{ color: BRAND_PURPLE === "#403770" ? "#a78bfa" : MUTED }}>{a.fy26Invoicing > 0 ? fmtDollar(a.fy26Invoicing) : "—"}</td>
                    <td className="px-3 py-2" style={{ color: CORAL }}>{a.fy26Ek12 > 0 ? fmtDollar(a.fy26Ek12) : "—"}</td>
                    <td className="px-3 py-2 text-white font-medium">{a.combinedFy26 > 0 ? fmtDollar(a.combinedFy26) : "—"}</td>
                    <td className="px-3 py-2 text-white/70">{fmtNum(a.enrollment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ─── Churn & Contraction Risk ──────────────────────────── */}
        <Section title="Churn & Contraction Risk" defaultOpen>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg p-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-xs text-red-400/70 uppercase tracking-wider">Churned</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{churnSummary.churnedCount} accounts</p>
              <p className="text-sm text-red-400/60">{fmtCompact(churnSummary.churnedDollars)} lost revenue</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <p className="text-xs text-yellow-400/70 uppercase tracking-wider">Contracted</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{churnSummary.contractedCount} accounts</p>
              <p className="text-sm text-yellow-400/60">{fmtCompact(churnSummary.contractedDollars)} revenue decline</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: MUTED }}>Total at Risk</p>
              <p className="text-2xl font-bold mt-1" style={{ color: CORAL }}>
                {fmtCompact(totalChurnRisk)}
              </p>
              <p className="text-sm text-white/40">
                {churnSummary.churnedCount + churnSummary.contractedCount} accounts
              </p>
            </div>
          </div>

          {/* Churned table */}
          <h3 className="text-sm font-semibold text-white/70 mb-2 uppercase tracking-wider">
            Churned Accounts (FY25 Combined Revenue, $0 FY26)
          </h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <SortHeader label="Account" field="name" current={churnSort} onSort={(f) => toggleSort(churnSort, setChurnSort, f)} />
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Source</th>
                  <SortHeader label="FM Lost" field="lostFm" current={churnSort} onSort={(f) => toggleSort(churnSort, setChurnSort, f)} />
                  <SortHeader label="EK12 Lost" field="lostEk12" current={churnSort} onSort={(f) => toggleSort(churnSort, setChurnSort, f)} />
                  <SortHeader label="Total Lost" field="lostRevenue" current={churnSort} onSort={(f) => toggleSort(churnSort, setChurnSort, f)} />
                  <SortHeader label="FY27 Pipeline" field="fy27Pipeline" current={churnSort} onSort={(f) => toggleSort(churnSort, setChurnSort, f)} />
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {sortedChurned.slice(0, 30).map((c) => {
                  const srcBg = c.source === "Both" ? "rgba(255,255,255,0.08)" : c.source === "EK12" ? "rgba(243,113,103,0.15)" : "rgba(64,55,112,0.3)";
                  const srcColor = c.source === "Both" ? "rgba(255,255,255,0.7)" : c.source === "EK12" ? CORAL : "#a78bfa";
                  return (
                    <tr
                      key={c.leaid}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2">
                        <p className="text-white font-medium">{c.name}</p>
                        {c.stateAbbrev && <p className="text-white/40 text-xs">{c.stateAbbrev}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: srcBg, color: srcColor }}>
                          {c.source}
                        </span>
                      </td>
                      <td className="px-3 py-2" style={{ color: "#a78bfa" }}>{c.lostFm > 0 ? fmtDollar(c.lostFm) : "—"}</td>
                      <td className="px-3 py-2" style={{ color: CORAL }}>{c.lostEk12 > 0 ? fmtDollar(c.lostEk12) : "—"}</td>
                      <td className="px-3 py-2 text-red-400 font-medium">{fmtDollar(c.lostRevenue)}</td>
                      <td className="px-3 py-2 text-white/70">{c.fy27Pipeline > 0 ? fmtDollar(c.fy27Pipeline) : "—"}</td>
                      <td className="px-3 py-2">
                        {c.fy27Pipeline === 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                            No pipeline
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            Recovery possible
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {churned.length > 30 && (
              <p className="text-xs text-white/30 mt-2 px-3">
                Showing top 30 of {churned.length} churned accounts
              </p>
            )}
          </div>

          {/* Contracted table */}
          <h3 className="text-sm font-semibold text-white/70 mb-2 uppercase tracking-wider">
            Contracted Accounts (Combined FY26 &lt; Combined FY25)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Account</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Source</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>FY25 Combined</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>FY26 Combined</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Decline</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>FY27 Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {sortedContracted.slice(0, 25).map((c) => {
                  const srcBg = c.source === "Both" ? "rgba(255,255,255,0.08)" : c.source === "EK12" ? "rgba(243,113,103,0.15)" : "rgba(64,55,112,0.3)";
                  const srcColor = c.source === "Both" ? "rgba(255,255,255,0.7)" : c.source === "EK12" ? CORAL : "#a78bfa";
                  return (
                    <tr
                      key={c.leaid}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2">
                        <p className="text-white font-medium">{c.name}</p>
                        {c.stateAbbrev && <p className="text-white/40 text-xs">{c.stateAbbrev}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: srcBg, color: srcColor }}>
                          {c.source}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-white/70">{fmtDollar(c.fy25Combined)}</td>
                      <td className="px-3 py-2 text-white/70">{fmtDollar(c.fy26Combined)}</td>
                      <td className="px-3 py-2 text-yellow-400 font-medium">-{fmtDollar(c.contraction)}</td>
                      <td className="px-3 py-2 text-white/70">{c.fy27Pipeline > 0 ? fmtDollar(c.fy27Pipeline) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {contracted.length > 25 && (
              <p className="text-xs text-white/30 mt-2 px-3">
                Showing top 25 of {contracted.length} contracted accounts
              </p>
            )}
          </div>
        </Section>

        {/* ─── Growth Opportunities ──────────────────────────────── */}
        <Section title="Growth Opportunities" count={growth.length} defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>#</th>
                  <SortHeader label="Account" field="name" current={growthSort} onSort={(f) => toggleSort(growthSort, setGrowthSort, f)} />
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Tags</th>
                  <SortHeader label="FY27 Pipeline" field="fy27Pipeline" current={growthSort} onSort={(f) => toggleSort(growthSort, setGrowthSort, f)} />
                  <SortHeader label="FY26 Invoicing" field="fy26Invoicing" current={growthSort} onSort={(f) => toggleSort(growthSort, setGrowthSort, f)} />
                  <SortHeader label="Enrollment" field="enrollment" current={growthSort} onSort={(f) => toggleSort(growthSort, setGrowthSort, f)} />
                </tr>
              </thead>
              <tbody>
                {sortedGrowth.map((g, i) => {
                  const typeBg =
                    g.type === "EXISTING"
                      ? "rgba(16,185,129,0.15)"
                      : g.type === "EK12"
                        ? "rgba(243,113,103,0.15)"
                        : "rgba(139,92,246,0.15)";
                  const typeColor =
                    g.type === "EXISTING" ? "#34d399" : g.type === "EK12" ? CORAL : "#a78bfa";
                  return (
                    <tr
                      key={g.leaid}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2 text-white/30 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <p className="text-white font-medium">{g.name}</p>
                        {g.stateAbbrev && <p className="text-white/40 text-xs">{g.stateAbbrev}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: typeBg, color: typeColor }}
                        >
                          {g.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[160px]">
                        {g.tags.filter((t) => !["City","Suburb","Town","Rural"].includes(t)).slice(0, 2).map((t) => <TagBadge key={t} tag={t} />)}
                      </td>
                      <td className="px-3 py-2 font-semibold" style={{ color: "#34d399" }}>{fmtDollar(g.fy27Pipeline)}</td>
                      <td className="px-3 py-2 text-white/70">{g.fy26Invoicing > 0 ? fmtDollar(g.fy26Invoicing) : "—"}</td>
                      <td className="px-3 py-2 text-white/70">{fmtNum(g.enrollment)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ─── Bookings-to-Invoicing Gap ─────────────────────────── */}
        <Section
          title="Bookings-to-Invoicing Gap (Pilot Candidates)"
          count={bookingsGap.length}
          defaultOpen
        >
          <p className="text-sm text-white/50 mb-4">
            Districts where FY26 closed-won bookings exceed FY26 invoicing by 20%+.
            These deals were signed but not fully delivered — pilot candidates to close the gap before FY27 starts in June.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>District</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>FY26 Bookings</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>FY26 Invoicing</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Gap</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: MUTED }}>Gap %</th>
                </tr>
              </thead>
              <tbody>
                {bookingsGap.map((b) => (
                  <tr
                    key={b.leaid}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2">
                      <p className="text-white font-medium">{b.name}</p>
                      {b.stateAbbrev && <p className="text-white/40 text-xs">{b.stateAbbrev}</p>}
                    </td>
                    <td className="px-3 py-2 text-white/70">{fmtDollar(b.fy26Bookings)}</td>
                    <td className="px-3 py-2 text-white/70">{fmtDollar(b.fy26Invoicing)}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: "#f59e0b" }}>
                      {fmtDollar(b.gapAmount)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: b.gapPercent > 100 ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                          color: b.gapPercent > 100 ? "#f87171" : "#fbbf24",
                        }}
                      >
                        +{b.gapPercent.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ─── 90-Day Plan ───────────────────────────────────────── */}
        <Section title="90-Day Integration Plan" defaultOpen>
          <div className="space-y-6">
            {/* Phase 1 */}
            <TimelinePhase
              phase="Phase 1"
              days="Days 1-30"
              title="Map the Landscape"
              color={CORAL}
              items={[
                "Assign territories across 50 states — divide customer book between FM and EK12 reps by state clusters",
                "Consolidate duplicate territory plans into unified FY27 plan set",
                "Merge EK12 customer book into Fullmind CRM (map EK12 accounts to NCES district IDs)",
                "Identify top 25 at-risk accounts for immediate retention outreach",
                "Build unified KPI dashboard (this page) for weekly board reporting",
              ]}
            />

            {/* Phase 2 */}
            <TimelinePhase
              phase="Phase 2"
              days="Days 31-60"
              title="Protect & Accelerate"
              color="#8B5CF6"
              items={[
                "Lock renewals with existing customers — target 90%+ renewal rate across combined book",
                "Activate FY27 pipeline — move deals from discovery to proposal stage",
                "Launch service pilots for bookings-gap accounts (close delivery gap before June FY27 start)",
                "EK12 customer introductions: pair Fullmind service team with existing EK12 relationships",
                "Cross-sell play: introduce EK12 customers to Fullmind's broader service catalog",
              ]}
            />

            {/* Phase 3 */}
            <TimelinePhase
              phase="Phase 3"
              days="Days 61-90"
              title="Show Momentum"
              color="#10B981"
              items={[
                "Close first wave of FY27 deals — $5M combined pipeline conversion target",
                "Churn-warning outreach to all zero-pipeline churned accounts ($3.4M recovery opportunity)",
                "Board-ready dashboard showing combined revenue trajectory and FY27 forecast confidence",
                "Territory assignment strategy finalized: state-cluster model with shared major accounts",
                "Weekly deal review cadence established across combined sales org",
              ]}
            />

            {/* Divide and conquer */}
            <div
              className="rounded-lg p-5 mt-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                Territory Assignment Strategy: Divide & Conquer
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-white/70">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Approach</p>
                  <ul className="space-y-1.5">
                    <li>Group states into 4-6 territory clusters based on customer density and opportunity</li>
                    <li>Assign primary rep per cluster — owns all accounts in the region</li>
                    <li>Shared coverage for top-25 accounts that span multiple clusters</li>
                    <li>EK12 reps keep existing relationships during 90-day transition</li>
                  </ul>
                </div>
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Success Metrics</p>
                  <ul className="space-y-1.5">
                    <li>100% territory coverage within 30 days</li>
                    <li>Zero accounts without a named owner by Day 45</li>
                    <li>Renewal rate &ge; 90% across combined book</li>
                    <li>$5M FY27 pipeline converted by Day 90</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-white/20">
            Fullmind x Elevate K12 &middot; FY27 Sales Trajectory Dashboard &middot; Confidential
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Timeline Phase sub-component ──────────────────────────── */

function TimelinePhase({
  phase,
  days,
  title,
  color,
  items,
}: {
  phase: string;
  days: string;
  title: string;
  color: string;
  items: string[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex gap-4">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center pt-1">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: color }}
        />
        <div className="w-px flex-1 mt-1" style={{ background: `${color}30` }} />
      </div>

      <div className="flex-1 pb-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 cursor-pointer"
        >
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ background: `${color}20`, color }}
          >
            {phase}
          </span>
          <span className="text-xs text-white/40">{days}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
          <svg
            className="w-4 h-4 text-white/30 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          style={{
            maxHeight: open ? "500px" : "0",
            transition: "max-height 0.3s ease",
            overflow: "hidden",
          }}
        >
          <ul className="mt-3 space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
