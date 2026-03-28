"use client";

import { useState, useEffect, useRef } from "react";
import { useMyLeaderboardRank } from "../lib/queries";
import TierBadge from "./TierBadge";
import RankTicker from "./RankTicker";
import { parseTierRank, TIER_COLORS } from "../lib/types";
import type { TierRank } from "../lib/types";

interface LeaderboardHomeWidgetProps {
  onOpenModal: () => void;
}

const SHIMMER_INTERVAL = 5 * 60 * 1000;

export default function LeaderboardHomeWidget({ onOpenModal }: LeaderboardHomeWidgetProps) {
  const { data, isLoading } = useMyLeaderboardRank();
  const [shimmer, setShimmer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevRankRef = useRef<number | null>(null);
  const [rankChanged, setRankChanged] = useState(false);

  // Periodic shimmer
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

  if (isLoading || !data) return null;

  const tierRank = (data.tier ?? "iron_3") as TierRank;
  const { tier } = parseTierRank(tierRank);
  const colors = TIER_COLORS[tier];

  // Build ticker lines
  const tickerLines: { text: string; highlight?: boolean }[] = [];
  if (data.above) {
    const diff = data.above.totalPoints - data.totalPoints;
    tickerLines.push({
      text: `#${data.above.rank} ${data.above.fullName} — +${diff} pts ahead`,
    });
  }
  tickerLines.push({
    text: `You: #${data.rank} of ${data.totalReps} — ${data.totalPoints} pts`,
    highlight: true,
  });
  if (data.below) {
    const diff = data.totalPoints - data.below.totalPoints;
    tickerLines.push({
      text: `#${data.below.rank} ${data.below.fullName} — ${diff} pts behind`,
    });
  }

  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative mb-6 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-100 overflow-hidden"
      style={{
        backgroundColor: colors.bg,
        boxShadow: isHovered ? `0 0 20px ${colors.glow}` : "0 0 0 transparent",
        transform: rankChanged ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.glow}, transparent)`,
            animation: "shimmer-sweep 1s ease-in-out",
          }}
        />
      )}

      {/* Top row: tier badge + rank */}
      <div className="flex items-center justify-between mb-2">
        <TierBadge tierRank={tierRank} size="md" />
        <span className="text-lg font-bold text-plum">#{data.rank}</span>
      </div>

      {/* Season name */}
      <p className="text-[10px] font-medium text-[#8A80A8] mb-1.5">
        {data.seasonName}
      </p>

      {/* Ticker */}
      <RankTicker lines={tickerLines} />
    </div>
  );
}
