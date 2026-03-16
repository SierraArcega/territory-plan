"use client";

import { useMemo } from "react";
import type { District } from "../types";
import { SectionCard, fmtNum, TIER_FILLS } from "./shared";

const TIER_NAMES = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"] as const;

export default function TierDistribution({ data }: { data: District[] }) {
  const tiers = useMemo(() => {
    return TIER_NAMES.map((name) => {
      const districts = data.filter((d) => d.tier === name);
      return {
        name,
        count: districts.length,
        pct: data.length > 0 ? (districts.length / data.length) * 100 : 0,
        customers: districts.filter((d) => d.is_customer).length,
        prospects: districts.filter((d) => !d.is_customer).length,
        revenue: districts.reduce((s, d) => s + d.lifetime_vendor_rev, 0),
        avgEnrollment: districts.length
          ? districts.reduce((s, d) => s + (d.enrollment || 0), 0) /
            districts.length
          : 0,
      };
    });
  }, [data]);

  return (
    <SectionCard
      title="Tier Distribution"
      description="How the 17,910 districts break into opportunity tiers"
    >
      {/* Stacked bar */}
      <div className="h-8 rounded-lg overflow-hidden flex w-full">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            style={{
              width: `${tier.pct}%`,
              backgroundColor: TIER_FILLS[tier.name],
            }}
            className="flex items-center justify-center"
          >
            {tier.pct > 8 && (
              <span className="text-xs font-semibold text-white select-none">
                {tier.pct.toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Tier detail cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="bg-white rounded-lg border border-[#D4CFE2] border-l-[3px] p-4"
            style={{ borderLeftColor: TIER_FILLS[tier.name] }}
          >
            {/* Row 1: Name + dot */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-[#544A78]">
                {tier.name}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: TIER_FILLS[tier.name] }}
              />
            </div>

            {/* Row 2: District count + percentage */}
            <div className="mb-1">
              <span className="text-xs text-[#8A80A8]">Districts </span>
              <span className="text-sm font-semibold text-[#544A78]">
                {fmtNum(tier.count)}
              </span>
              <span className="text-xs text-[#8A80A8]">
                {" "}
                ({fmtNum(tier.pct, { pct: true })})
              </span>
            </div>

            {/* Row 3: Customers · Prospects */}
            <div className="mb-1">
              <span className="text-xs text-[#8A80A8]">
                {fmtNum(tier.customers)}{" "}
                <span className="text-[#544A78] font-semibold">customers</span>{" "}
                · {fmtNum(tier.prospects)}{" "}
                <span className="text-[#544A78] font-semibold">prospects</span>
              </span>
            </div>

            {/* Row 4: Revenue */}
            <div className="mb-1">
              <span className="text-xs text-[#8A80A8]">Revenue </span>
              <span className="text-sm font-semibold text-[#544A78]">
                {fmtNum(tier.revenue, { dollar: true })}
              </span>
            </div>

            {/* Row 5: Avg enrollment */}
            <div>
              <span className="text-xs text-[#8A80A8]">Avg enrollment: </span>
              <span className="text-sm font-semibold text-[#544A78]">
                {fmtNum(tier.avgEnrollment)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
