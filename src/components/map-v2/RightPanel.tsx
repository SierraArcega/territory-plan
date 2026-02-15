"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import DistrictCard from "./right-panels/DistrictCard";

export default function RightPanel() {
  const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  if (!rightPanelContent) return null;

  return (
    <div className="w-[280px] border-l border-gray-200/60 flex flex-col bg-white/95">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {rightPanelContent.type === "district_card" && "District"}
          {rightPanelContent.type === "task_form" && "New Task"}
          {rightPanelContent.type === "task_edit" && "Edit Task"}
          {rightPanelContent.type === "contact_detail" && "Contact"}
          {rightPanelContent.type === "contact_form" && "New Contact"}
        </span>
        <button
          onClick={closeRightPanel}
          className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Close panel"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {rightPanelContent.type === "district_card" && rightPanelContent.id && (
          <DistrictCard leaid={rightPanelContent.id} />
        )}
        {!["district_card"].includes(rightPanelContent.type) && (
          <div className="text-center py-8 text-xs text-gray-400">
            {rightPanelContent.type} — coming soon
          </div>
        )}
      </div>
    </div>
  );
}
