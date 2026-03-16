"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { SectionCard, fmtNum } from "./shared";
import type { District } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bucketColor(min: number): string {
  if (min >= 60) return "#F37167"; // coral
  if (min >= 40) return "#D4A84B"; // gold
  if (min >= 20) return "#8A80A8"; // secondary
  return "#D4CFE2";               // muted
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface BucketPayload {
  range: string;
  count: number;
  customers: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BucketPayload }>;
}) {
  if (!active || !payload?.length) return null;
  const { range, count, customers } = payload[0].payload;
  return (
    <div className="bg-white border border-[#D4CFE2] rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-[#403770] mb-1">
        Score {range}
      </p>
      <p className="text-xs text-[#6E6390]">
        {count} districts{" "}
        <span className="text-[#8A80A8]">({customers} customers)</span>
      </p>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScoreDistributionProps {
  data: District[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoreDistribution({ data }: ScoreDistributionProps) {
  // Histogram bins (0-4, 5-9, … 95-99)
  const buckets = useMemo(() => {
    const bins = Array.from({ length: 20 }, (_, i) => ({
      range: `${i * 5}-${i * 5 + 4}`,
      min: i * 5,
      count: 0,
      customers: 0,
    }));
    data.forEach((d) => {
      const idx = Math.min(19, Math.floor(d.composite_score / 5));
      bins[idx].count++;
      if (d.is_customer) bins[idx].customers++;
    });
    return bins;
  }, [data]);

  // Sub-score averages by score range
  const ranges = useMemo(() => {
    const r = [
      { label: "80-100", min: 80, max: 101 },
      { label: "60-79", min: 60, max: 80 },
      { label: "40-59", min: 40, max: 60 },
      { label: "20-39", min: 20, max: 40 },
      { label: "0-19", min: 0, max: 20 },
    ];
    return r.map(({ label, min, max }) => {
      const subset = data.filter(
        (d) => d.composite_score >= min && d.composite_score < max,
      );
      const n = subset.length;
      return {
        label,
        count: n,
        customers: subset.filter((d) => d.is_customer).length,
        avgFit: n
          ? subset.reduce((s, d) => s + d.fit_score, 0) / n
          : 0,
        avgValue: n
          ? subset.reduce((s, d) => s + d.value_score, 0) / n
          : 0,
        avgReadiness: n
          ? subset.reduce((s, d) => s + d.readiness_score, 0) / n
          : 0,
        avgState: n
          ? subset.reduce((s, d) => s + d.state_score, 0) / n
          : 0,
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="Score Distribution"
      description="How composite scores are distributed across all districts"
    >
      {/* ── Histogram ── */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={buckets}>
          <CartesianGrid
            horizontal
            strokeDasharray="3 3"
            stroke="#E2DEEC"
            vertical={false}
          />
          <XAxis
            dataKey="range"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={{ stroke: "#E2DEEC" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={{ stroke: "#E2DEEC" }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell key={i} fill={bucketColor(b.min)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* ── Sub-score Averages Table ── */}
      <div className="mt-6 overflow-hidden border border-[#D4CFE2] rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F7F5FA]">
              {[
                "Score Range",
                "Count",
                "Customers",
                "Avg Fit",
                "Avg Value",
                "Avg Readiness",
                "Avg State",
              ].map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranges.map((r) => (
              <tr key={r.label} className="border-t border-[#E2DEEC]">
                <td className="px-3 py-2 text-sm font-medium text-[#544A78]">
                  {r.label}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] tabular-nums">
                  {r.count.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] tabular-nums">
                  {r.customers.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] tabular-nums">
                  {fmtNum(r.avgFit)}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] tabular-nums">
                  {fmtNum(r.avgValue)}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] tabular-nums">
                  {fmtNum(r.avgReadiness)}
                </td>
                <td className="px-3 py-2 text-sm text-[#6E6390] tabular-nums">
                  {fmtNum(r.avgState)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
