"use client";

import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import FocusCard from "./FocusCard";
import { useAnimatedNumber } from "@/features/map/hooks/use-animated-number";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface RevenueTrendCardProps {
  states: FocusModeStateData[];
  onDismiss: () => void;
  /** Delay before animated numbers start counting (ms) */
  animationDelay?: number;
}

export default function RevenueTrendCard({
  states,
  onDismiss,
  animationDelay = 0,
}: RevenueTrendCardProps) {
  // Aggregate across all plan states
  const totals = states.reduce(
    (acc, s) => ({
      fy25Invoicing: acc.fy25Invoicing + s.plan.fy25Invoicing,
      fy26Invoicing: acc.fy26Invoicing + s.plan.fy26Invoicing,
      stateFy26: acc.stateFy26 + s.state.fy26ClosedWon,
      planFy26: acc.planFy26 + s.plan.fy26ClosedWon,
      stateFy27Pipeline: acc.stateFy27Pipeline + s.state.fy27Pipeline,
      planFy27Pipeline: acc.planFy27Pipeline + s.plan.fy27Pipeline,
    }),
    {
      fy25Invoicing: 0,
      fy26Invoicing: 0,
      stateFy26: 0,
      planFy26: 0,
      stateFy27Pipeline: 0,
      planFy27Pipeline: 0,
    }
  );

  // YoY delta
  const delta =
    totals.fy25Invoicing > 0
      ? ((totals.fy26Invoicing - totals.fy25Invoicing) / totals.fy25Invoicing) * 100
      : 0;
  const isPositive = delta >= 0;

  // Animated headline number
  const animatedInvoicing = useAnimatedNumber(
    Math.round(totals.fy26Invoicing),
    600,
    animationDelay
  );

  // Chart data — one point per FY (extensible to more FYs later)
  const chartData = [
    { fy: "FY25", invoicing: totals.fy25Invoicing },
    { fy: "FY26", invoicing: totals.fy26Invoicing },
  ];

  // Bookings + pipeline ratios
  const fy26Pct =
    totals.stateFy26 > 0 ? (totals.planFy26 / totals.stateFy26) * 100 : 0;
  const fy27Pct =
    totals.stateFy27Pipeline > 0
      ? (totals.planFy27Pipeline / totals.stateFy27Pipeline) * 100
      : 0;

  return (
    <FocusCard title="Revenue Trend" onDismiss={onDismiss} className="w-[320px]">
      <div className="space-y-3">
        {/* Headline number + delta */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#403770] tabular-nums">
              {formatCurrency(animatedInvoicing)}
            </span>
            {totals.fy25Invoicing > 0 && (
              <span
                className={`
                  px-1.5 py-0.5 text-[10px] font-semibold rounded-full
                  ${isPositive
                    ? "bg-[#EDFFE3] text-[#5f665b]"
                    : "bg-[#F37167]/15 text-[#c25a52]"
                  }
                `}
              >
                {isPositive ? "+" : ""}{delta.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Net Invoicing · Plan Districts
          </div>
        </div>

        {/* Area Chart */}
        <div className="h-[120px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="plumGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#403770" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#403770" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="fy"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [formatCurrency(Number(value)), "Net Invoicing"]}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                  background: "white",
                }}
              />
              <Area
                type="monotone"
                dataKey="invoicing"
                stroke="#403770"
                strokeWidth={2}
                fill="url(#plumGradient)"
                animationDuration={1000}
                animationBegin={Math.max(animationDelay, 500)}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Compact metric rows */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          {/* FY26 Bookings */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-500 w-20">FY26 Bookings</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#403770] transition-all duration-700"
                style={{ width: `${Math.min(fy26Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[#403770] tabular-nums w-14 text-right">
              {formatCurrency(totals.planFy26)}
            </span>
          </div>
          {/* FY27 Pipeline */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-500 w-20">FY27 Pipeline</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#6EA3BE] transition-all duration-700"
                style={{ width: `${Math.min(fy27Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[#6EA3BE] tabular-nums w-14 text-right">
              {formatCurrency(totals.planFy27Pipeline)}
            </span>
          </div>
        </div>
      </div>
    </FocusCard>
  );
}
