"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { District } from "../types";
import { SectionCard, fmtNum } from "./shared";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BucketRow {
  label: string;
  value: number;
}

// ─── Custom Tooltips ─────────────────────────────────────────────────────────

function PctTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#D4CFE2] rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-[#403770] mb-1">{label}</p>
      <p className="text-xs text-[#6E6390]">
        Penetration:{" "}
        <span className="font-medium text-[#544A78]">
          {fmtNum(payload[0].value, { pct: true })}
        </span>
      </p>
    </div>
  );
}

function DollarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#D4CFE2] rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-[#403770] mb-1">{label}</p>
      <p className="text-xs text-[#6E6390]">
        Avg Revenue:{" "}
        <span className="font-medium text-[#544A78]">
          {fmtNum(payload[0].value, { dollar: true })}
        </span>
      </p>
    </div>
  );
}

// ─── Shared bar chart axes/bar config ────────────────────────────────────────

function InsightBarChart({
  data,
  tooltipType,
}: {
  data: BucketRow[];
  tooltipType: "pct" | "dollar";
}) {
  const height = data.length * 32 + 20;

  const tickFormatter = (v: number) =>
    tooltipType === "pct"
      ? `${v.toFixed(0)}%`
      : v >= 1_000_000
        ? `$${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
          ? `$${(v / 1_000).toFixed(0)}K`
          : `$${v.toFixed(0)}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
      >
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "#8A80A8", fontSize: 11 }}
          width={100}
          axisLine={false}
          tickLine={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "#8A80A8", fontSize: 11 }}
          axisLine={{ stroke: "#E2DEEC" }}
          tickLine={false}
          tickFormatter={tickFormatter}
        />
        <Tooltip
          content={
            tooltipType === "pct" ? (
              <PctTooltip />
            ) : (
              <DollarTooltip />
            )
          }
          cursor={{ fill: "#EFEDF5" }}
        />
        <Bar dataKey="value" fill="#403770" radius={[0, 4, 4, 0]} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill="#403770" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WildCardSignals({ data }: { data: District[] }) {
  // Card 1: Outsourcing Behavior
  const outsourcingData = useMemo<BucketRow[]>(() => {
    const buckets: Record<
      string,
      { total: number; customers: number; order: number }
    > = {
      "No payments": { total: 0, customers: 0, order: 0 },
      "< $1M": { total: 0, customers: 0, order: 1 },
      "$1M–$5M": { total: 0, customers: 0, order: 2 },
      "$5M–$20M": { total: 0, customers: 0, order: 3 },
      "$20M+": { total: 0, customers: 0, order: 4 },
    };

    for (const d of data) {
      const spend = (d.charter_payments || 0) + (d.private_payments || 0);
      let key: string;
      if (spend === 0) key = "No payments";
      else if (spend < 1_000_000) key = "< $1M";
      else if (spend < 5_000_000) key = "$1M–$5M";
      else if (spend < 20_000_000) key = "$5M–$20M";
      else key = "$20M+";

      buckets[key].total++;
      if (d.is_customer) buckets[key].customers++;
    }

    return Object.entries(buckets)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([label, { total, customers }]) => ({
        label,
        value: total > 0 ? (customers / total) * 100 : 0,
      }));
  }, [data]);

  // Card 2: Enrollment Trend
  const enrollmentTrendData = useMemo<BucketRow[]>(() => {
    const BUCKET_ORDER = [
      "Sharp Decline",
      "Moderate Decline",
      "Slight Decline",
      "Stable",
      "Growing",
    ];
    const buckets: Record<string, { total: number; customers: number }> = {
      "Sharp Decline": { total: 0, customers: 0 },
      "Moderate Decline": { total: 0, customers: 0 },
      "Slight Decline": { total: 0, customers: 0 },
      Stable: { total: 0, customers: 0 },
      Growing: { total: 0, customers: 0 },
    };

    for (const d of data) {
      const trend = d.enrollment_trend_3yr;
      if (trend == null) continue;

      let key: string;
      if (trend < -5) key = "Sharp Decline";
      else if (trend < -2) key = "Moderate Decline";
      else if (trend < 0) key = "Slight Decline";
      else if (trend <= 2) key = "Stable";
      else key = "Growing";

      buckets[key].total++;
      if (d.is_customer) buckets[key].customers++;
    }

    return BUCKET_ORDER.map((label) => ({
      label,
      value:
        buckets[label].total > 0
          ? (buckets[label].customers / buckets[label].total) * 100
          : 0,
    }));
  }, [data]);

  // Card 3: Multi-Vendor Districts
  const vendorData = useMemo<BucketRow[]>(() => {
    const buckets: Record<
      string,
      { total: number; totalRev: number; order: number }
    > = {
      "0": { total: 0, totalRev: 0, order: 0 },
      "1": { total: 0, totalRev: 0, order: 1 },
      "2": { total: 0, totalRev: 0, order: 2 },
      "3": { total: 0, totalRev: 0, order: 3 },
      "4+": { total: 0, totalRev: 0, order: 4 },
    };

    for (const d of data) {
      const count = d.vendor_count;
      const key = count >= 4 ? "4+" : String(count);
      if (!(key in buckets)) continue;
      buckets[key].total++;
      buckets[key].totalRev += d.lifetime_vendor_rev;
    }

    return Object.entries(buckets)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([label, { total, totalRev }]) => ({
        label,
        value: total > 0 ? totalRev / total : 0,
      }));
  }, [data]);

  return (
    <SectionCard
      title="Wild Card Signals"
      description="Non-obvious behavioral patterns that predict purchasing"
    >
      <div className="grid grid-cols-3 gap-6">
        {/* Card 1: Outsourcing Behavior */}
        <div className="bg-[#F7F5FA] rounded-lg border border-[#E2DEEC] p-4">
          <p className="text-sm font-semibold text-[#403770] mb-1">
            Outsourcing Spend vs Penetration
          </p>
          <p className="text-xs text-[#8A80A8] mb-3">
            Districts paying &gt;$1M to charters/private schools have 17%
            penetration — 4.5x the baseline
          </p>
          <InsightBarChart data={outsourcingData} tooltipType="pct" />
        </div>

        {/* Card 2: Enrollment Trend */}
        <div className="bg-[#F7F5FA] rounded-lg border border-[#E2DEEC] p-4">
          <p className="text-sm font-semibold text-[#403770] mb-1">
            Enrollment Trend vs Penetration
          </p>
          <p className="text-xs text-[#8A80A8] mb-3">
            Slightly declining districts (0–2%) have 8% penetration — the
            &ldquo;worried but not desperate&rdquo; zone
          </p>
          <InsightBarChart data={enrollmentTrendData} tooltipType="pct" />
        </div>

        {/* Card 3: Multi-Vendor Districts */}
        <div className="bg-[#F7F5FA] rounded-lg border border-[#E2DEEC] p-4">
          <p className="text-sm font-semibold text-[#403770] mb-1">
            Vendor Count vs Avg Revenue
          </p>
          <p className="text-xs text-[#8A80A8] mb-3">
            Districts buying from 2+ vendors spend 7.3x more on average ($772K
            vs $106K)
          </p>
          <InsightBarChart data={vendorData} tooltipType="dollar" />
        </div>
      </div>
    </SectionCard>
  );
}
