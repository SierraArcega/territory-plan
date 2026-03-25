"use client";

import {
  CalendarCheck,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SummaryCardData {
  icon: LucideIcon;
  iconColor: string;
  count: number;
  label: string;
}

interface FeedSummaryCardsProps {
  dueToday: number;
  alerts: number;
  thisWeek: number;
}

export default function FeedSummaryCards({
  dueToday,
  alerts,
  thisWeek,
}: FeedSummaryCardsProps) {
  const cards: SummaryCardData[] = [
    { icon: CalendarCheck, iconColor: "#403770", count: dueToday, label: "Due Today" },
    { icon: AlertTriangle, iconColor: "#F37167", count: alerts, label: "Needs Attention" },
    { icon: Calendar, iconColor: "#6EA3BE", count: thisWeek, label: "This Week" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {cards.map((card) => (
        <SummaryCard key={card.label} card={card} />
      ))}
    </div>
  );
}

function SummaryCard({ card }: { card: SummaryCardData }) {
  const Icon = card.icon;

  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] p-3 flex flex-col items-center text-center min-w-[100px] flex-1">
      <Icon className="w-6 h-6 mb-1.5" style={{ color: card.iconColor }} />
      <p className="text-2xl font-bold text-[#403770] leading-none">
        {card.count}
      </p>
      <p className="text-xs text-[#8A80A8] mt-1">{card.label}</p>
    </div>
  );
}
