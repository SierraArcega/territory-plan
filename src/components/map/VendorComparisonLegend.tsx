"use client";

interface LegendItem {
  vendor: string;
  color: string;
  label: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { vendor: "Fullmind", color: "#F37167", label: "Fullmind" },
  { vendor: "Proximity Learning", color: "#6EA3BE", label: "Proximity Learning" },
  { vendor: "Elevate K12", color: "#E07A5F", label: "Elevate K12" },
  { vendor: "Tutored By Teachers", color: "#7C3AED", label: "Tutored By Teachers" },
];

interface VendorComparisonLegendProps {
  className?: string;
}

export default function VendorComparisonLegend({
  className = "",
}: VendorComparisonLegendProps) {
  return (
    <div
      className={`
        bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200
        px-3 py-2 text-sm
        ${className}
      `}
    >
      <div className="font-semibold text-[#403770] mb-2 text-xs uppercase tracking-wide">
        Vendor Comparison
      </div>
      <div className="space-y-1.5">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.vendor} className="flex items-center gap-2">
            <span
              className="inline-block rounded-sm flex-shrink-0"
              style={{
                width: 14,
                height: 10,
                backgroundColor: item.color,
                opacity: 0.7,
              }}
            />
            <span className="text-[#403770] text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
