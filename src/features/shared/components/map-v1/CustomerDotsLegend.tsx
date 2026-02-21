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
  { category: "multi_year", color: "#403770", size: 10, label: "Multi-year customer" },
  { category: "new", color: "#22C55E", size: 8, label: "New this year" },
  { category: "lapsed", color: "#EF4444", size: 8, label: "Lapsed customer" },
  { category: "pipeline", color: "#F59E0B", size: 7, label: "In pipeline" },
  { category: "target", color: "#6EA3BE", size: 6, label: "Target" },
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
