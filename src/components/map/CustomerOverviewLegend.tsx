// src/components/map/CustomerOverviewLegend.tsx
"use client";

interface LegendItem {
  category: string;
  color: string;
  label: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { category: "multi_year", color: "#403770", label: "Multi-year customer" },
  { category: "new", color: "#22C55E", label: "New this year" },
  { category: "lapsed", color: "#EF4444", label: "Lapsed customer" },
  { category: "pipeline", color: "#F59E0B", label: "In pipeline" },
  { category: "target", color: "#6EA3BE", label: "Target" },
];

interface CustomerOverviewLegendProps {
  className?: string;
}

export default function CustomerOverviewLegend({
  className = "",
}: CustomerOverviewLegendProps) {
  return (
    <div
      className={`
        bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200
        px-3 py-2 text-sm
        ${className}
      `}
    >
      <div className="font-semibold text-[#403770] mb-2 text-xs uppercase tracking-wide">
        Customer Overview
      </div>
      <div className="space-y-1.5">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.category} className="flex items-center gap-2">
            <span
              className="inline-block rounded-sm flex-shrink-0"
              style={{
                width: 14,
                height: 10,
                backgroundColor: item.color,
                opacity: 0.6,
              }}
            />
            <span className="text-[#403770] text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
