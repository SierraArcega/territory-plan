"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useMapStore } from "@/features/shared/lib/app-store";

/** Sidebar entry that opens the Copilot rail. Not a tab — a launcher. */
export function CopilotNavButton({ collapsed }: { collapsed: boolean }) {
  const setCopilotOpen = useMapStore((s) => s.setCopilotOpen);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setCopilotOpen(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full flex items-center gap-3 px-4 py-3 border-l-3 border-transparent text-[#403770] transition-colors duration-150 hover:bg-[#EFEDF5]"
      title={collapsed ? "Copilot" : undefined}
    >
      <span className="flex-shrink-0 text-[#403770]"><Sparkles className="w-5 h-5" aria-hidden="true" /></span>
      {!collapsed && <span className="text-sm font-medium truncate">Copilot</span>}
      {collapsed && hovered && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-[#403770] text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
          Copilot
        </div>
      )}
    </button>
  );
}
