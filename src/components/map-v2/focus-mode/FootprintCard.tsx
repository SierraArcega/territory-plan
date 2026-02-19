"use client";

import FocusCard from "./FocusCard";
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
}

export default function FootprintCard({
  states,
  selectedState,
  onSelectState,
  onDismiss,
}: FootprintCardProps) {
  const data = states.find((s) => s.abbrev === selectedState) || states[0];
  if (!data) return null;

  const penetration = data.state.totalDistricts > 0
    ? ((data.state.totalCustomers / data.state.totalDistricts) * 100).toFixed(0)
    : "0";

  return (
    <FocusCard title="Fullmind Footprint" onDismiss={onDismiss} className="w-[280px]">
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
                    ? "bg-plum text-white"
                    : "text-gray-400 hover:text-plum hover:bg-gray-50"
                  }
                `}
              >
                {s.abbrev}
              </button>
            ))}
          </div>
        )}

        {/* Customers */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Customers</div>
          <div className="text-sm font-semibold text-gray-700">
            {data.state.totalCustomers}
            <span className="text-gray-400 font-normal text-xs"> of {data.state.totalDistricts} districts</span>
            <span className="ml-1.5 text-[10px] font-semibold text-plum">{penetration}%</span>
          </div>
        </div>

        {/* Open Pipeline */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Open Pipeline</div>
          <div className="text-sm font-semibold text-gray-700">
            {formatCurrency(data.state.fy26Pipeline + data.state.fy27Pipeline)}
            <span className="text-gray-400 font-normal text-xs ml-1">
              {data.state.totalWithPipeline} opps
            </span>
          </div>
        </div>

        {/* Top 3 Districts */}
        {data.topDistricts.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1">
              Top Districts (FY26 Invoicing)
            </div>
            <div className="space-y-0.5">
              {data.topDistricts.map((d, i) => (
                <div key={d.leaid} className="flex items-center gap-2 text-xs">
                  <span className="text-[10px] text-gray-300 w-3">{i + 1}</span>
                  <span className="text-gray-600 truncate flex-1">{d.name}</span>
                  <span className="text-gray-500 font-medium tabular-nums">
                    {formatCurrency(d.fy26Invoicing)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FocusCard>
  );
}
