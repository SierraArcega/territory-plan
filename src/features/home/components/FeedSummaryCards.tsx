"use client";

import {
  CircleAlert,
  TrendingUp,
  FolderOpen,
  ListTodo,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SummaryCardData {
  icon: LucideIcon;
  iconColor: string;
  count: number;
  label: string;
}

interface FeedSummaryCardsProps {
  overdueTasks: number;
  unmappedOpps: number;
  unmappedExpenses: number;
  needNextSteps: number;
  meetingsToLog: number;
}

export default function FeedSummaryCards({
  overdueTasks,
  unmappedOpps,
  unmappedExpenses,
  needNextSteps,
  meetingsToLog,
}: FeedSummaryCardsProps) {
  const cards: SummaryCardData[] = [
    { icon: CircleAlert, iconColor: "#F37167", count: overdueTasks, label: "Overdue Tasks" },
    { icon: TrendingUp, iconColor: "#E8913A", count: unmappedOpps, label: "Unmapped Opps" },
    { icon: FolderOpen, iconColor: "#6EA3BE", count: unmappedExpenses, label: "Unmapped Expenses" },
    { icon: ListTodo, iconColor: "#544A78", count: needNextSteps, label: "Need Next Steps" },
    { icon: CalendarClock, iconColor: "#8AA891", count: meetingsToLog, label: "Meetings to Log" },
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
