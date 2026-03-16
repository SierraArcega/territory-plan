"use client";

import { useCallback } from "react";
import { useDistrictScores } from "./hooks";
import type { District } from "./types";
import HeroSection from "./components/HeroSection";
import TierDistribution from "./components/TierDistribution";
import ScoreDistribution from "./components/ScoreDistribution";
import StateLandscape from "./components/StateLandscape";
import WildCardSignals from "./components/WildCardSignals";
import TopProspects from "./components/TopProspects";
import MethodologySummary from "./components/MethodologySummary";

export default function IcpScoringPage() {
  const { data, loading, error, retry } = useDistrictScores();

  const handleExportCSV = useCallback(() => {
    const headers = ["leaid","name","state","city","enrollment","frpl_rate","composite_score","fit_score","value_score","readiness_score","state_score","tier","is_customer","lifetime_vendor_rev","vendor_count"];
    const rows = data.map(d => headers.map(h => {
      const v = d[h as keyof District];
      if (v == null) return "";
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      return String(v);
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "icp_district_scores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="min-h-full bg-off-white">
      {/* Sticky header */}
      <div className="bg-white border-b border-[#D4CFE2] sticky top-0 z-30 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#403770] tracking-tight">District Opportunity Score</h1>
            <p className="text-sm text-[#8A80A8] mt-0.5">Interactive ICP scoring report</p>
          </div>
          {data.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-sm font-medium bg-[#403770] text-white rounded-lg hover:bg-[#322a5a] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
            >
              Export All CSV
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#F7F5FA] rounded-lg h-48 animate-pulse border border-[#E2DEEC]" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mb-4 text-[#F37167]">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm font-semibold text-[#544A78] mb-2">Something went wrong</span>
            <span className="text-xs text-[#8A80A8] mb-3">Failed to load district scores</span>
            <button onClick={retry} className="text-sm text-[#403770] underline hover:no-underline">Try again</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <span className="text-sm font-semibold text-[#544A78] mb-2">No scoring data available</span>
            <span className="text-xs text-[#8A80A8]">Generate scores by running the scoring script first</span>
          </div>
        )}

        {/* Report sections */}
        {!loading && !error && data.length > 0 && (
          <div className="flex flex-col gap-6">
            <MethodologySummary />
            <HeroSection data={data} />
            <TierDistribution data={data} />
            <ScoreDistribution data={data} />
            <StateLandscape data={data} />
            <WildCardSignals data={data} />
            <TopProspects data={data} />
          </div>
        )}
      </div>
    </div>
  );
}
