"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useMyLeaderboardRank } from "../lib/queries";
import RankTicker from "./RankTicker";

interface LeaderboardNavWidgetProps {
  collapsed: boolean;
  onOpenModal: () => void;
}

const SHIMMER_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function LeaderboardNavWidget({
  collapsed,
  onOpenModal,
}: LeaderboardNavWidgetProps) {
  const { data, isLoading } = useMyLeaderboardRank();
  const [minimized, setMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("leaderboard-minimized") === "true";
  });
  const [shimmer, setShimmer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevRankRef = useRef<number | null>(null);
  const [rankChanged, setRankChanged] = useState(false);

  // Periodic shimmer every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1000);
    }, SHIMMER_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Detect rank changes
  useEffect(() => {
    if (data && prevRankRef.current !== null && prevRankRef.current !== data.rank) {
      setRankChanged(true);
      setTimeout(() => setRankChanged(false), 1500);
    }
    if (data) prevRankRef.current = data.rank;
  }, [data?.rank]);

  // Persist minimized state
  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMinimized(true);
    sessionStorage.setItem("leaderboard-minimized", "true");
  };

  if (isLoading || !data) return null;

  // Build ticker lines
  const tickerLines: { text: string; highlight?: boolean }[] = [];
  if (data.above) {
    const diff = data.above.totalPoints - data.totalPoints;
    tickerLines.push({
      text: `#${data.above.rank} ${data.above.fullName} — +${diff} pts ahead`,
    });
  }
  tickerLines.push({
    text: `You: #${data.rank} — ${data.totalPoints} pts`,
    highlight: true,
  });
  if (data.below) {
    const diff = data.totalPoints - data.below.totalPoints;
    tickerLines.push({
      text: `#${data.below.rank} ${data.below.fullName} — ${diff} pts behind`,
    });
  }

  // Minimized state: just badge + rank
  if (minimized || collapsed) {
    return (
      <button
        onClick={onOpenModal}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative flex items-center justify-center gap-1.5 px-2 py-2 mx-1 mb-1 rounded-lg cursor-pointer transition-all duration-100"
        style={{
          boxShadow: isHovered ? "0 0 12px rgba(138,128,168,0.3)" : "none",
        }}
        title="Open Leaderboard"
      >
        <span className="text-xs font-bold text-[#403770]">#{data.rank}</span>
      </button>
    );
  }

  // Expanded state
  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative mx-2 mb-1 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100 overflow-hidden"
      style={{
        backgroundColor: "#F7F5FA",
        boxShadow: isHovered ? "0 0 16px rgba(138,128,168,0.3)" : "none",
        transform: rankChanged ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(138,128,168,0.3), transparent)",
            animation: "shimmer-sweep 1s ease-in-out",
          }}
        />
      )}

      {/* Dismiss button */}
      <button
        onClick={handleMinimize}
        className={`absolute top-1 right-1 p-0.5 rounded text-[#8A80A8] hover:text-plum transition-opacity duration-100 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <X size={12} />
      </button>

      {/* Rank display */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-[#403770]">#{data.rank}</span>
        <span className="text-[10px] font-medium text-[#8A80A8]">
          {data.totalPoints} pts
        </span>
      </div>

      {/* Ticker */}
      <RankTicker lines={tickerLines} />
    </div>
  );
}
