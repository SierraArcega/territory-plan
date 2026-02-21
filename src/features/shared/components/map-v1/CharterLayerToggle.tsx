"use client";

import { useMapStore } from "@/lib/store";

interface CharterLayerToggleProps {
  className?: string;
}

export default function CharterLayerToggle({
  className = "",
}: CharterLayerToggleProps) {
  const { charterLayerVisible, toggleCharterLayer } = useMapStore();

  return (
    <button
      onClick={toggleCharterLayer}
      className={`
        flex items-center gap-2 px-3 py-2
        bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200
        hover:bg-gray-50 transition-colors text-sm font-medium
        ${className}
      `}
      aria-pressed={charterLayerVisible}
      aria-label={`${charterLayerVisible ? "Hide" : "Show"} Charter Districts`}
    >
      {/* Toggle switch */}
      <span
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
          border-2 border-transparent transition-colors duration-200 ease-in-out
          ${charterLayerVisible ? "bg-[#F37167]" : "bg-gray-200"}
        `}
        role="switch"
        aria-checked={charterLayerVisible}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full
            bg-white shadow ring-0 transition duration-200 ease-in-out
            ${charterLayerVisible ? "translate-x-4" : "translate-x-0"}
          `}
        />
      </span>
      {/* School icon */}
      <svg
        className="w-4 h-4 text-[#403770]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
        />
      </svg>
      <span className="text-[#403770]">Charter Districts</span>
    </button>
  );
}
