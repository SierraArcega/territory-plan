"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import TaskForm from "./right-panels/TaskForm";
import ContactDetail from "./right-panels/ContactDetail";
import ActivityForm from "./right-panels/ActivityForm";
import PlanEditForm from "./right-panels/PlanEditForm";
import DistrictCard from "./right-panels/DistrictCard";
import PlanCard from "./right-panels/PlanCard";

export default function RightPanel() {
  const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  if (!rightPanelContent) return null;

  const isWidePanel = rightPanelContent.type === "district_card" || rightPanelContent.type === "plan_card";

  return (
    <div
      className={`${
        isWidePanel ? "w-[380px]" : "w-[280px]"
      } border-l border-gray-200/60 flex flex-col bg-white/95`}
    >
      {/* Wide panels get their own layout (header + tabs built in) */}
      {isWidePanel && rightPanelContent.id ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-end px-2 pt-2">
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
          <div className="flex-1 overflow-hidden">
            {rightPanelContent.type === "district_card" && (
              <DistrictCard leaid={rightPanelContent.id} />
            )}
            {rightPanelContent.type === "plan_card" && (
              <PlanCard planId={rightPanelContent.id} />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Header with close button */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {rightPanelContent.type === "task_form" && "New Task"}
              {rightPanelContent.type === "task_edit" && "Edit Task"}
              {rightPanelContent.type === "contact_detail" && "Contact"}
              {rightPanelContent.type === "contact_form" && "New Contact"}
              {rightPanelContent.type === "activity_form" && "New Activity"}
              {rightPanelContent.type === "activity_edit" && "Edit Activity"}
              {rightPanelContent.type === "plan_edit" && "Edit Plan"}
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
            {rightPanelContent.type === "task_form" && (
              <TaskForm preLinkedLeaid={rightPanelContent.id} />
            )}
            {rightPanelContent.type === "task_edit" && rightPanelContent.id && (
              <TaskForm taskId={rightPanelContent.id} />
            )}
            {rightPanelContent.type === "contact_detail" && rightPanelContent.id && (
              <ContactDetail contactId={rightPanelContent.id} />
            )}
            {rightPanelContent.type === "activity_form" && (
              <ActivityForm preLinkedLeaid={rightPanelContent.id} />
            )}
            {rightPanelContent.type === "activity_edit" && rightPanelContent.id && (
              <ActivityForm activityId={rightPanelContent.id} />
            )}
            {rightPanelContent.type === "plan_edit" && (
              <PlanEditForm />
            )}
          </div>
        </>
      )}
    </div>
  );
}
