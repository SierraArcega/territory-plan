"use client";

import { useMemo } from "react";
import { StatCard, Callout, fmtNum } from "./shared";
import type { District } from "../types";

// ─── Methodology Config ──────────────────────────────────────────────────────

const METHODOLOGY = [
  {
    key: "fit",
    label: "Fit",
    weight: 30,
    color: "#403770",
    barClass: "bg-[#403770]",
    description: "Demographic match to our best customers — enrollment, FRPL, locale, diversity",
  },
  {
    key: "value",
    label: "Value",
    weight: 25,
    color: "#69B34A",
    barClass: "bg-[#69B34A]",
    description: "Revenue capacity — district budget, expenditure/pupil, existing vendor spend",
  },
  {
    key: "readiness",
    label: "Readiness",
    weight: 25,
    color: "#D4A84B",
    barClass: "bg-[#D4A84B]",
    description: "Behavioral signals — outsourcing history, competitor spend, enrollment trends",
  },
  {
    key: "state",
    label: "State",
    weight: 20,
    color: "#6EA3BE",
    barClass: "bg-[#6EA3BE]",
    description: "State environment — district consolidation, penetration, territory coverage",
  },
] as const;

// ─── Props ───────────────────────────────────────────────────────────────────

interface HeroSectionProps {
  data: District[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HeroSection({ data }: HeroSectionProps) {
  const stats = useMemo(() => {
    const total = data.length;
    const t1Count = data.filter((d) => d.tier === "Tier 1").length;
    const t2Count = data.filter((d) => d.tier === "Tier 2").length;
    const customers = data.filter((d) => d.is_customer).length;
    const prospects = total - customers;
    const totalRev = data.reduce((sum, d) => sum + (d.lifetime_vendor_rev ?? 0), 0);
    const avgScore =
      total > 0
        ? data.reduce((sum, d) => sum + (d.composite_score ?? 0), 0) / total
        : 0;
    return { total, t1Count, t2Count, customers, prospects, totalRev, avgScore };
  }, [data]);

  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-6">
      <div className="grid grid-cols-5 gap-8">
        {/* ── Left Column ── */}
        <div className="col-span-3">
          <h1 className="text-2xl font-bold text-[#403770]">District Opportunity Score</h1>
          <p className="text-sm text-[#8A80A8] mt-1">
            A composite scoring system that ranks districts by fit, revenue potential, purchase
            readiness, and state environment.
          </p>

          <Callout accent="plum">
            Based on analysis of <strong className="text-[#403770]">1,087 existing customers</strong> across all vendors (Fullmind, Elevate K12, Proximity Learning, TBT, Educere) vs 17,887 non-customers. The strongest predictor is district size (3.3x lift), followed by majority-minority status (1.23x) and suburban/city locale. Each district receives scores across four dimensions that combine into a weighted composite.
          </Callout>

          {/* Methodology Blocks */}
          <div className="mt-6 flex flex-col gap-4">
            {METHODOLOGY.map(({ key, label, weight, color, barClass, description }) => (
              <div key={key}>
                {/* Label row */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color }}>
                    {label} ({weight}%)
                  </span>
                </div>
                {/* Progress bar track */}
                <div className="h-3 w-full bg-[#EFEDF5] rounded-full overflow-hidden mb-1">
                  <div
                    className={`h-3 rounded-full ${barClass}`}
                    style={{ width: `${weight}%` }}
                  />
                </div>
                {/* Description */}
                <p className="text-xs text-[#8A80A8]">{description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Total Districts"
              value={fmtNum(stats.total, { compact: true })}
              sub="in scoring universe"
            />
            <StatCard
              label="Tier 1"
              value={fmtNum(stats.t1Count, { compact: true })}
              sub="top opportunity"
            />
            <StatCard
              label="Tier 2"
              value={fmtNum(stats.t2Count, { compact: true })}
              sub="strong opportunity"
            />
            <StatCard
              label="Customers"
              value={fmtNum(stats.customers, { compact: true })}
              sub="active accounts"
            />
            <StatCard
              label="Prospects"
              value={fmtNum(stats.prospects, { compact: true })}
              sub="not yet customers"
            />
            <StatCard
              label="Total Rev"
              value={fmtNum(stats.totalRev, { dollar: true })}
              sub="lifetime vendor rev"
            />
            <StatCard
              label="Avg Score"
              value={fmtNum(stats.avgScore, { pct: false })}
              sub="composite avg"
            />
            <StatCard
              label="Data Freshness"
              value="Mar 15, 2026"
              sub="scored date"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
