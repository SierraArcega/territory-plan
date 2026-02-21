"use client";

// Tier fill colors and labels
const TIER_LEGEND = [
  { tier: "multi_year", label: "Multi-Year Customer", color: "#403770", description: "FY25 + FY26 invoicing" },
  { tier: "single_year", label: "Single-Year Customer", color: "#F37167", description: "FY25 OR FY26 invoicing" },
  { tier: "pipeline_only", label: "Pipeline Only", color: "#6EA3BE", description: "Open pipeline, no revenue" },
  { tier: "no_data", label: "No Fullmind Data", color: "#E5E7EB", description: "Not in system" },
];

// Status outline colors
const STATUS_LEGEND = [
  { label: "Customer", color: "#F37167", description: "Has closed won bookings" },
  { label: "Pipeline", color: "#6EA3BE", description: "Has open pipeline" },
  { label: "Both", color: "#403770", description: "Customer with pipeline" },
];

export default function Legend() {
  return (
    <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-10">
      {/* Tier Legend (Fill Colors) */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#403770] mb-2">
          Customer Status
        </h3>
        <div className="space-y-1.5">
          {TIER_LEGEND.map((item) => (
            <div key={item.tier} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{
                  backgroundColor: item.color,
                  opacity: item.tier === "multi_year" ? 0.7 :
                           item.tier === "single_year" ? 0.6 :
                           item.tier === "pipeline_only" ? 0.5 : 0.15,
                }}
              />
              <span className="text-xs text-gray-700">{item.label}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {item.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Legend (Outlines) */}
      <div>
        <h3 className="text-sm font-bold text-[#403770] mb-2">
          Account Status (Outline)
        </h3>
        <div className="space-y-1.5">
          {STATUS_LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-4 h-0.5 rounded"
                style={{
                  backgroundColor: item.color,
                  height: item.label === "Both" ? "3px" : "2px",
                }}
              />
              <span className="text-xs text-gray-700">{item.label}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {item.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
