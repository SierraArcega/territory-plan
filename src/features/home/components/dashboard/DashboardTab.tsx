"use client";

import { useState } from "react";
import { getCurrentFY, fyPills } from "@/lib/fiscal-year";
import ToplineStatStrip from "./ToplineStatStrip";
import RankTrajectoryCard from "./RankTrajectoryCard";
import PipelineSection from "./pipeline/PipelineSection";

// Secondary tab strip below the performance dashboard. Only "pipeline" ships in
// this milestone (Customer trends + Hygiene are deferred).
type SecondaryTab = "pipeline";

export default function DashboardTab() {
  const [fy, setFy] = useState<number>(getCurrentFY());
  const [tab, setTab] = useState<SecondaryTab>("pipeline");

  const pills = fyPills();

  return (
    <div className="flex flex-col gap-8">
      {/* ── Performance dashboard (FY selector + topline cards + rank trajectory) ── */}
      <section aria-label="Performance" className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold text-[#403770] whitespace-nowrap">Performance</h2>
          <p className="text-sm text-[#8A80A8]">
            How your numbers are tracking — against target and against the team.
          </p>
        </div>

        {/* Fiscal-year selector */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Fiscal year">
          {pills.map((p) => {
            const active = p.fy === fy;
            return (
              <button
                key={p.fy}
                type="button"
                aria-pressed={active}
                onClick={() => setFy(p.fy)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#403770] text-white"
                    : "bg-white text-[#5C5378] border border-[#D4CFE2] hover:bg-[#EFEDF5]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Topline cards (Targets card + segment bars / sparklines / deltas land in Phase 2) */}
        <ToplineStatStrip fy={fy} />

        {/* Rank trajectory — monthly standing vs the team, per metric */}
        <RankTrajectoryCard fy={fy} />
      </section>

      {/* ── Secondary tab strip (Pipeline only this milestone) ── */}
      <div className="flex items-center gap-6 border-b border-[#E2DEEC]" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pipeline"}
          onClick={() => setTab("pipeline")}
          className={`relative pb-3 text-sm font-medium transition-colors whitespace-nowrap ${
            tab === "pipeline" ? "text-[#F37167]" : "text-[#8A80A8] hover:text-[#544A78]"
          }`}
        >
          Pipeline
          {tab === "pipeline" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
          )}
        </button>
      </div>

      {tab === "pipeline" && (
        <section aria-label="Pipeline">
          <PipelineSection fy={fy} />
        </section>
      )}
    </div>
  );
}
