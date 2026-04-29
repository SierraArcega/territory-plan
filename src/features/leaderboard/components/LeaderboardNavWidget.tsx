"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useRevenueRank } from "../lib/queries";

interface LeaderboardNavWidgetProps {
  collapsed: boolean;
  onOpenModal: () => void;
}

const SHIMMER_INTERVAL = 5 * 60 * 1000;
const FY_TOGGLE_KEY = "revenue-rank-fy";

function formatCompactCurrency(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function fyLabels(): { current: string; next: string } {
  const now = new Date();
  const fy = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return {
    current: `FY${String(fy).slice(-2)}`,
    next: `FY${String(fy + 1).slice(-2)}`,
  };
}

export default function LeaderboardNavWidget({
  collapsed,
  onOpenModal,
}: LeaderboardNavWidgetProps) {
  const labels = fyLabels();
  const [fy, setFy] = useState<"current" | "next">(() => {
    if (typeof window === "undefined") return "current";
    return (sessionStorage.getItem(FY_TOGGLE_KEY) as "current" | "next") ?? "current";
  });
  const { data, isLoading } = useRevenueRank(fy);
  const [minimized, setMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("leaderboard-minimized") === "true";
  });
  const [shimmer, setShimmer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevRankRef = useRef<number | null>(null);
  const [rankChanged, setRankChanged] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1000);
    }, SHIMMER_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data && prevRankRef.current !== null && prevRankRef.current !== data.rank) {
      setRankChanged(true);
      setTimeout(() => setRankChanged(false), 1500);
    }
    if (data) prevRankRef.current = data.rank;
  }, [data?.rank]);

  const handleToggle = (next: "current" | "next") => {
    setFy(next);
    sessionStorage.setItem(FY_TOGGLE_KEY, next);
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMinimized(true);
    sessionStorage.setItem("leaderboard-minimized", "true");
  };

  if (collapsed || minimized) return null;
  if (isLoading || !data) return null;

  const inRoster = data.inRoster;
  const rankLabel = inRoster ? `#${data.rank} of ${data.totalReps}` : "—";
  const fyCurrent = fy === "current";

  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative mb-6 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-100 overflow-hidden bg-[#F7F5FA]"
      style={{
        boxShadow: isHovered ? "0 0 20px rgba(64, 55, 112, 0.15)" : "0 0 0 transparent",
        transform: rankChanged ? "scale(1.02)" : "scale(1)",
      }}
    >
      {shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(64, 55, 112, 0.15), transparent)",
            animation: "shimmer-sweep 1s ease-in-out",
          }}
        />
      )}

      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[11px] font-semibold text-[#403770]">Revenue Rank</p>
          <p className="text-xs text-[#8A80A8]">{rankLabel}</p>
        </div>
        <button
          onClick={handleMinimize}
          className="text-[#8A80A8] hover:text-[#403770]"
          aria-label="Minimize"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-1 my-1.5" role="tablist">
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle("current"); }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            fyCurrent ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
          }`}
          role="tab"
          aria-selected={fyCurrent}
        >
          {labels.current}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle("next"); }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            !fyCurrent ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
          }`}
          role="tab"
          aria-selected={!fyCurrent}
        >
          {labels.next}
        </button>
      </div>

      <p className="text-base font-bold text-[#403770]">
        {inRoster ? formatCompactCurrency(data.revenue) : ""}
      </p>
    </div>
  );
}
