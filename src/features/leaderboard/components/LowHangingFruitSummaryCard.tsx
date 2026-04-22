"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { useLowHangingFruitList } from "../lib/queries";
import { formatCurrency } from "@/features/shared/lib/format";

interface Props {
  onViewAll: () => void;
}

export default function LowHangingFruitSummaryCard({ onViewAll }: Props) {
  const query = useLowHangingFruitList();
  const count = query.data?.districts.length ?? 0;
  const total = query.data?.totalRevenueAtRisk ?? 0;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <Sparkles className="w-10 h-10 text-[#F37167] mb-3" aria-hidden />
      <div className="text-2xl font-bold text-[#403770] tabular-nums">{count.toLocaleString()} districts</div>
      <div className="text-sm text-[#6E6390] mt-1">{formatCurrency(total, true)} FY26 revenue unclaimed</div>
      <button
        type="button"
        onClick={onViewAll}
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
      >
        View all <ArrowRight className="w-4 h-4" />
      </button>
      <p className="mt-3 text-xs text-[#8A80A8] max-w-xs">
        FY26 Fullmind customers with no FY27 activity yet.
      </p>
    </div>
  );
}
