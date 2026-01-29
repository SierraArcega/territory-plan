// src/components/map/CustomerDotsLegend.tsx
"use client";

interface LegendItem {
  category: string;
  color: string;
  size: number;
  opacity?: number;
  label: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { category: "multi_year", color: "#403770", size: 8, label: "Multi-year customer" },
  { category: "new", color: "#22C55E", size: 6, label: "New this year" },
  { category: "lapsed", color: "#403770", size: 6, opacity: 0.4, label: "Lapsed customer" },
  { category: "prospect", color: "#F59E0B", size: 5, label: "Prospect" },
];

interface CustomerDotsLegendProps {
  className?: string;
  fadeOnZoom?: boolean;
}

export default function CustomerDotsLegend({
  className = "",
  fadeOnZoom = false,
}: CustomerDotsLegendProps) {
  return (
    <div
      className={`
        bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200
        px-3 py-2 text-sm
        transition-opacity duration-300
        ${fadeOnZoom ? "opacity-50" : "opacity-100"}
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
              className="inline-block rounded-full flex-shrink-0"
              style={{
                width: item.size,
                height: item.size,
                backgroundColor: item.color,
                opacity: item.opacity ?? 1,
              }}
            />
            <span className="text-[#403770] text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
