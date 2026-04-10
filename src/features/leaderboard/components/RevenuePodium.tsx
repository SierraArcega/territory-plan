"use client";

import type { LeaderboardEntry } from "../lib/types";

interface RevenuePodiumProps {
  entries: LeaderboardEntry[];
}

function formatRevenue(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

const PODIUM_STYLES = {
  first: {
    bg: "bg-gradient-to-br from-[#FFF9E6] to-[#FFF3CC]",
    border: "border-[#F0D060]",
    shadow: "shadow-[0_4px_16px_rgba(240,208,96,0.25)]",
    avatarBg: "bg-[#B8860B]",
    rankColor: "text-[#B8860B]",
    lift: "-translate-y-3",
  },
  second: {
    bg: "bg-gradient-to-br from-[#F5F5F7] to-[#E8E8EC]",
    border: "border-[#C0C0C8]",
    shadow: "",
    avatarBg: "bg-[#808088]",
    rankColor: "text-[#808088]",
    lift: "",
  },
  third: {
    bg: "bg-gradient-to-br from-[#FDF5EE] to-[#F8E8D4]",
    border: "border-[#D4A574]",
    shadow: "",
    avatarBg: "bg-[#A0724E]",
    rankColor: "text-[#A0724E]",
    lift: "",
  },
} as const;

export default function RevenuePodium({ entries }: RevenuePodiumProps) {
  if (entries.length < 3) return null;

  const [first, second, third] = entries;

  // Render order: 2nd, 1st, 3rd (visual podium layout)
  const podiumOrder = [
    { entry: second, place: "second" as const },
    { entry: first, place: "first" as const },
    { entry: third, place: "third" as const },
  ];

  return (
    <div className="flex justify-center items-end gap-5 py-8 px-10">
      {podiumOrder.map(({ entry, place }) => {
        const style = PODIUM_STYLES[place];
        return (
          <div
            key={entry.userId}
            className={`flex flex-col items-center px-4 pt-5 pb-4 rounded-xl border w-[200px] transition-transform ${style.bg} ${style.border} ${style.shadow} ${style.lift}`}
          >
            <span className={`text-[13px] font-bold mb-2 ${style.rankColor}`}>
              #{entry.rank}
            </span>
            {entry.avatarUrl ? (
              <img
                src={entry.avatarUrl}
                alt={entry.fullName}
                className="w-12 h-12 rounded-full object-cover mb-2"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${style.avatarBg}`}
              >
                <span className="text-lg font-bold text-white">
                  {getInitials(entry.fullName)}
                </span>
              </div>
            )}
            <span className="text-sm font-semibold text-[#2D2440] text-center mb-1">
              {entry.fullName}
            </span>
            <span className="text-lg font-bold text-[#5B2E91]">
              {formatRevenue(entry.revenue)}
            </span>
            <span className="text-[11px] text-[#8A849A] uppercase tracking-wider mt-0.5">
              Current Year
            </span>
          </div>
        );
      })}
    </div>
  );
}
