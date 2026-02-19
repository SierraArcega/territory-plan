"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import FocusCard from "./FocusCard";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface YoYCardProps {
  states: FocusModeStateData[];
  selectedState: string;
  onSelectState: (abbrev: string) => void;
  onDismiss: () => void;
}

export default function YoYCard({
  states,
  selectedState,
  onSelectState,
  onDismiss,
}: YoYCardProps) {
  const data = states.find((s) => s.abbrev === selectedState) || states[0];
  if (!data) return null;

  // Chart data: FY25 vs FY26, bookings vs invoicing (plan districts)
  const chartData = [
    {
      name: "FY25",
      bookings: data.plan.fy25ClosedWon,
      invoicing: data.plan.fy25Invoicing,
    },
    {
      name: "FY26",
      bookings: data.plan.fy26ClosedWon,
      invoicing: data.plan.fy26Invoicing,
    },
  ];

  return (
    <FocusCard title="YoY Performance" onDismiss={onDismiss} className="w-[280px]">
      <div className="space-y-2.5">
        {/* State selector tabs (synced with footprint) */}
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

        {/* Recharts grouped bar chart */}
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2} barCategoryGap="30%">
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrency(v)}
                width={45}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(Number(value) || 0),
                  name === "bookings" ? "Closed Won" : "Net Invoicing",
                ]}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                }}
              />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value) => (value === "bookings" ? "Closed Won" : "Net Invoicing")}
              />
              <Bar dataKey="bookings" fill="#403770" radius={[3, 3, 0, 0]} />
              <Bar dataKey="invoicing" fill="#F37167" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </FocusCard>
  );
}
