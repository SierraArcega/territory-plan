"use client";

import { useMapStore } from "@/lib/store";

interface VendorLayerToggleProps {
  className?: string;
}

export default function VendorLayerToggle({
  className = "",
}: VendorLayerToggleProps) {
  const { vendorLayerVisible, toggleVendorLayer } = useMapStore();

  return (
    <button
      onClick={toggleVendorLayer}
      className={`
        flex items-center gap-2 px-3 py-2
        bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200
        hover:bg-gray-50 transition-colors text-sm font-medium
        ${className}
      `}
      aria-pressed={vendorLayerVisible}
      aria-label={`Switch to ${vendorLayerVisible ? "Fullmind" : "Competitor"} View`}
    >
      {/* Toggle switch */}
      <span
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
          border-2 border-transparent transition-colors duration-200 ease-in-out
          ${vendorLayerVisible ? "bg-[#403770]" : "bg-gray-200"}
        `}
        role="switch"
        aria-checked={vendorLayerVisible}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full
            bg-white shadow ring-0 transition duration-200 ease-in-out
            ${vendorLayerVisible ? "translate-x-4" : "translate-x-0"}
          `}
        />
      </span>
      <span className="text-[#403770]">
        {vendorLayerVisible ? "Competitor View" : "Fullmind View"}
      </span>
    </button>
  );
}
