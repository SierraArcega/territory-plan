"use client";

import FocusCard from "./FocusCard";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface FootprintCardProps {
  states: FocusModeStateData[];
  selectedState: string;
  onSelectState: (abbrev: string) => void;
  onDismiss: () => void;
  /** Delay before animated numbers start counting (ms) */
  animationDelay?: number;
}

export default function FootprintCard({
  states,
  selectedState,
  onSelectState,
  onDismiss,
  animationDelay = 0,
}: FootprintCardProps) {
  const data = states.find((s) => s.abbrev === selectedState) || states[0];
  if (!data) return null;

  const penetration =
    data.state.totalDistricts > 0
      ? (data.state.totalCustomers / data.state.totalDistricts) * 100
      : 0;
  const pipeline = data.state.fy26Pipeline + data.state.fy27Pipeline;

  // Animated numbers
  const animatedCustomers = useAnimatedNumber(data.state.totalCustomers, 600, animationDelay);
  const animatedPipeline = useAnimatedNumber(Math.round(pipeline), 600, animationDelay + 100);

  // Max district invoicing for relative bar sizing
  const maxInvoicing = Math.max(...data.topDistricts.map((d) => d.fy26Invoicing), 1);

  return (
    <FocusCard title="Territory Footprint" onDismiss={onDismiss} className="w-[280px]">
      <div className="space-y-2.5">
        {/* State selector tabs */}
        {states.length > 1 && (
          <div className="flex gap-0.5">
            {states.map((s) => (
              <button
                key={s.abbrev}
                onClick={() => onSelectState(s.abbrev)}
                className={`
                  px-2 py-1 text-[10px] font-semibold rounded-md transition-colors
                  ${selectedState === s.abbrev
                    ? "bg-[#403770] text-white"
                    : "text-gray-400 hover:text-[#403770] hover:bg-gray-50"
                  }
                `}
              >
                {s.abbrev}
              </button>
            ))}
          </div>
        )}

        {/* Customers — animated counter + penetration bar */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            Customers
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[#403770] tabular-nums">
              {animatedCustomers}
            </span>
            <span className="text-xs text-gray-400">
              of {data.state.totalDistricts}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#403770] transition-all duration-700"
                style={{ width: `${Math.min(penetration, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[#403770] tabular-nums">
              {penetration.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Pipeline — animated counter */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            Open Pipeline
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[#403770] tabular-nums">
              {formatCurrency(animatedPipeline)}
            </span>
            <span className="text-xs text-gray-400">
              {data.state.totalWithPipeline} opps
            </span>
          </div>
        </div>

        {/* Top Districts — inline relative bars */}
        {data.topDistricts.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">
              Top Districts
            </div>
            <div className="space-y-1.5">
              {data.topDistricts.map((d, i) => (
                <div key={d.leaid}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-600 truncate flex-1 mr-2">
                      <span className="text-[10px] text-gray-300 mr-1">{i + 1}</span>
                      {d.name}
                    </span>
                    <span className="text-gray-500 font-medium tabular-nums text-[11px]">
                      {formatCurrency(d.fy26Invoicing)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#403770]/30 transition-all duration-700"
                      style={{
                        width: `${(d.fy26Invoicing / maxInvoicing) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FocusCard>
  );
}
